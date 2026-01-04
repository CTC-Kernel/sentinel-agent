import { useState, useMemo, useEffect } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { useStore } from '../../store';
import { Asset, UserProfile, Supplier, BusinessProcess } from '../../types';
import { AssetFormData } from '../../schemas/assetSchema';
import { ErrorLogger } from '../../services/errorLogger';
import { usePlanLimits } from '../usePlanLimits';
import { DependencyService } from '../../services/dependencyService';
import { AssetService } from '../../services/assetService';
import { z } from 'zod';

export function useAssets() {
    const { user, addToast, demoMode } = useStore();
    const { limits } = usePlanLimits();
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Harden demoMode
    const isDemo = demoMode || window.localStorage.getItem('demoMode') === 'true';

    // Mock Data State
    const [mockAssets, setMockAssets] = useState<Asset[]>([]);
    const [mockUsers, setMockUsers] = useState<UserProfile[]>([]);
    const [mockSuppliers, setMockSuppliers] = useState<Supplier[]>([]);
    const [mockProcesses, setMockProcesses] = useState<BusinessProcess[]>([]);
    const [mockLoading, setMockLoading] = useState(true);

    // Load Mock Data
    useEffect(() => {
        let mounted = true;
        if (isDemo) {
            setMockLoading(true);
            Promise.all([
                import('../../services/mockDataService').then(m => m.MockDataService.getCollection('assets') as unknown as Asset[]),
                import('../../services/mockDataService').then(m => m.MockDataService.getCollection('users') as unknown as UserProfile[]),
                import('../../services/mockDataService').then(m => m.MockDataService.getCollection('suppliers') as unknown as Supplier[]),
                import('../../services/mockDataService').then(m => m.MockDataService.getCollection('business_processes') as unknown as BusinessProcess[]),
            ]).then(([assets, users, suppliers, processes]) => {
                if (!mounted) return;
                setMockAssets(assets);
                setMockUsers(users);
                setMockSuppliers(suppliers);
                setMockProcesses(processes);
                setMockLoading(false);
            }).catch(_err => {
                if (mounted) setMockLoading(false);
            });
        }
        return () => { mounted = false; };
    }, [isDemo]);

    // Fetch Assets (Firestore)
    const { data: firestoreAssets, loading: assetsLoading, refresh: refreshFirestoreAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId && !isDemo, realtime: true }
    );

    // Fetch dependencies
    const { data: firestoreUsers, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId && !isDemo, realtime: true }
    );

    // Switch Data source
    const rawAssets = isDemo ? mockAssets : firestoreAssets;
    const usersList = isDemo ? mockUsers : firestoreUsers;

    // FIX: Ensure usersList is never empty if logged in
    const effectiveUsers = useMemo(() => {
        if (usersList && usersList.length > 0) return usersList;
        if (user && user.uid) return [user];
        return [];
    }, [usersList, user]);

    // Firestore Calls for dependencies
    const { data: firestoreSuppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId && !isDemo, realtime: true }
    );

    const { data: firestoreProcesses, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId && !isDemo, realtime: true }
    );

    const suppliers = isDemo ? mockSuppliers : firestoreSuppliers;
    const processes = isDemo ? mockProcesses : firestoreProcesses;

    const assets = useMemo(() => {
        return rawAssets.map(a => ({
            ...a,
            // Use Service for calculation
            currentValue: AssetService.calculateDepreciation(a.purchasePrice || 0, a.purchaseDate || '')
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [rawAssets]);

    const loading = isDemo ? mockLoading : (assetsLoading || usersLoading || suppliersLoading || processesLoading);

    // Wrapper for refresh
    const refreshAssets = () => {
        if (!isDemo) refreshFirestoreAssets();
    };

    // Actions
    const createAsset = async (data: AssetFormData, preSelectedProjectId?: string | null) => {
        if (!user?.organizationId) return false;
        if (assets.length >= limits.maxAssets) {
            addToast(`Limite atteinte (${limits.maxAssets} actifs). Passez au plan supérieur pour ajouter plus d'actifs.`, "error");
            return false;
        }
        setIsSubmitting(true);
        try {
            const assetId = await AssetService.create(data, user, preSelectedProjectId);
            addToast("Actif créé avec succès", "success");
            refreshAssets();
            return assetId;
        } catch (e) {
            if (e instanceof z.ZodError) {
                addToast((e as unknown as { errors: { message: string }[] }).errors[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(e, 'useAssets.createAsset', 'CREATE_FAILED');
            }
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateAsset = async (id: string, data: AssetFormData) => {
        if (!user?.organizationId) return false;
        setIsSubmitting(true);
        try {
            await AssetService.update(id, data, user);
            addToast("Actif mis à jour avec succès", "success");
            refreshAssets();
            return true;
        } catch (e) {
            if (e instanceof z.ZodError) {
                addToast((e as unknown as { errors: { message: string }[] }).errors[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(e, 'useAssets.updateAsset', 'UPDATE_FAILED');
            }
            return false;
        } finally {
            setIsSubmitting(false);
        }
    };

    const checkDependencies = async (assetId: string) => {
        if (!user?.organizationId) return { hasDependencies: false, dependencies: [], canDelete: true, blockingReasons: [] };
        return await DependencyService.checkAssetDependencies(assetId, user.organizationId);
    };

    const deleteAsset = async (id: string, name: string) => {
        if (!user?.organizationId) return false;

        // Check dependencies before delete
        const depCheck = await DependencyService.checkAssetDependencies(id, user.organizationId);
        if (depCheck.hasDependencies) {
            addToast(`Impossible de supprimer ${name}: lié à ${depCheck.dependencies.length} risque(s).`, "error");
            return false;
        }

        try {
            await AssetService.delete(id, name, user);
            addToast("Actif supprimé avec succès", "success");
            refreshAssets();
            return true;
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useAssets.deleteAsset', 'DELETE_FAILED');
            return false;
        }
    };

    const bulkDeleteAssets = async (ids: string[]) => {
        if (!user?.organizationId) return false;

        // Pre-check all assets for dependencies
        const checks = await Promise.all(ids.map(async (id) => {
            const check = await DependencyService.checkAssetDependencies(id, user.organizationId!);
            return { id, check };
        }));

        const blocked = checks.filter(c => c.check.hasDependencies);
        if (blocked.length > 0) {
            addToast(`${blocked.length} actif(s) ne peuvent pas être supprimés car ils sont liés à des risques.`, "error");
            return false;
        }

        try {
            await AssetService.bulkDelete(ids, user);
            addToast(`${ids.length} actifs supprimés avec succès`, "success");
            refreshAssets();
            return true;
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useAssets.bulkDeleteAssets', 'DELETE_FAILED');
            return false;
        }
    };

    return {
        assets,
        usersList: effectiveUsers,
        suppliers,
        processes,
        loading,
        createAsset,
        updateAsset,
        deleteAsset,
        bulkDeleteAssets,
        isSubmitting,
        refreshAssets,
        checkDependencies
    };
}
