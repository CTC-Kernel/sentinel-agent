import { useState, useMemo, useEffect } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { toast } from '@/lib/toast';
import { Asset, UserProfile, Supplier, BusinessProcess } from '../../types';
import { AssetFormData } from '../../schemas/assetSchema';
import { usePlanLimits } from '../usePlanLimits';
import { DependencyService } from '../../services/dependencyService';
import { AssetService } from '../../services/assetService';
import { ErrorLogger } from '../../services/errorLogger';
// Import Mock Service only once
// import { MockDataService } from '../../services/mockDataService'; // Dynamic import used

export function useAssets(enabled = true) {
    const { demoMode, t } = useStore();
    const { user, claimsSynced } = useAuth();
    const { limits } = usePlanLimits();
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Harden demoMode
    const isDemo = demoMode || (typeof window !== 'undefined' && (
        !!((window as unknown as { __TEST_MODE__: boolean }).__TEST_MODE__) ||
        (() => { try { return localStorage.getItem('demoMode') === 'true' } catch { return false } })()
    ));

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
            const loadMocks = async () => {
                try {
                    const m = await import('../../services/mockDataService');
                    if (!mounted) return;
                    setMockAssets(m.MockDataService.getCollection('assets') as unknown as Asset[]);
                    setMockUsers(m.MockDataService.getCollection('users') as unknown as UserProfile[]);
                    setMockSuppliers(m.MockDataService.getCollection('suppliers') as unknown as Supplier[]);
                    setMockProcesses(m.MockDataService.getCollection('business_processes') as unknown as BusinessProcess[]);
                } catch (err) {
                    ErrorLogger.error(err as Error, 'useAssets.loadMockData');
                } finally {
                    if (mounted) setMockLoading(false);
                }
            };
            loadMocks();
        }
        return () => { mounted = false; };
    }, [isDemo]);

    // Fetch Assets (Firestore)
    const { data: firestoreAssets, loading: assetsLoading, refresh: refreshFirestoreAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId && !isDemo && claimsSynced && enabled, realtime: true }
    );

    // Fetch dependencies
    const { data: firestoreUsers, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId && !isDemo && claimsSynced && enabled, realtime: true }
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
        { logError: true, enabled: !!user?.organizationId && !isDemo && claimsSynced && enabled, realtime: true }
    );

    const { data: firestoreProcesses, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId && !isDemo && claimsSynced && enabled, realtime: true }
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

    // Actions - Decoupled from UI (No Toasts)
    const createAsset = async (data: AssetFormData, preSelectedProjectId?: string | null): Promise<{ success: boolean; id?: string; error?: unknown }> => {
        if (!user?.organizationId) return { success: false, error: 'No organization ID' };

        if (!canEditResource(user as UserProfile, 'Asset')) {
            toast.error(t('common.accessDenied'));
            return { success: false, error: 'PERMISSION_DENIED' };
        }

        // Logical Check (moved from UI)
        if (assets.length >= limits.maxAssets) {
            return { success: false, error: 'LIMIT_REACHED' };
        }

        setIsSubmitting(true);
        try {
            const assetId = await AssetService.create(data, user, preSelectedProjectId);
            refreshAssets();
            return { success: true, id: assetId };
        } catch (e) {
            // Note: Error logging should be consistent, usually services don't toast but hooks might if configured
            // here we want to return the error to the component to toast
            return { success: false, error: e };
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateAsset = async (id: string, data: AssetFormData): Promise<{ success: boolean; error?: unknown }> => {
        if (!user?.organizationId) return { success: false, error: 'No organization ID' };

        if (!canEditResource(user as UserProfile, 'Asset')) {
            toast.error(t('common.accessDenied'));
            return { success: false, error: 'PERMISSION_DENIED' };
        }

        setIsSubmitting(true);
        try {
            await AssetService.update(id, data, user);
            refreshAssets();
            return { success: true };
        } catch (e) {
            return { success: false, error: e };
        } finally {
            setIsSubmitting(false);
        }
    };

    const checkDependencies = async (assetId: string) => {
        if (!user?.organizationId) return { hasDependencies: false, dependencies: [], canDelete: true, blockingReasons: [] };
        return await DependencyService.checkAssetDependencies(assetId, user.organizationId);
    };

    const deleteAsset = async (id: string, name: string): Promise<{ success: boolean; error?: unknown }> => {
        if (!user?.organizationId) return { success: false, error: 'No organization ID' };

        if (!canDeleteResource(user as UserProfile, 'Asset')) {
            toast.error(t('common.accessDenied'));
            return { success: false, error: 'PERMISSION_DENIED' };
        }

        // Note: Dependency Check should be handled by UI before calling this if seeking confirmation
        try {
            await AssetService.delete(id, name, user);
            refreshAssets();
            return { success: true };
        } catch (e) {
            return { success: false, error: e };
        }
    };

    const bulkDeleteAssets = async (ids: string[]): Promise<{ success: boolean; count: number; error?: unknown }> => {
        if (!user?.organizationId) return { success: false, count: 0, error: 'No organization ID' };

        if (!canEditResource(user as UserProfile, 'Asset')) {
            toast.error(t('common.accessDenied'));
            return { success: false, count: 0, error: 'PERMISSION_DENIED' };
        }

        try {
            // Note: Service handles individual deletions which might fail if dependencies exist
            // But here we rely on AssetService.bulkDelete which should be using FunctionsService potentially
            // Actually AssetService.bulkDelete uses FunctionsService now (Phase 20)
            await AssetService.bulkDelete(ids, user);
            refreshAssets();
            return { success: true, count: ids.length };
        } catch (e) {
            return { success: false, count: 0, error: e };
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
