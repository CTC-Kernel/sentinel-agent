
import { useState, useMemo } from 'react';
import { where, collection, addDoc, doc, updateDoc, deleteDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { useFirestoreCollection } from '../useFirestore';
import { useStore } from '../../store';
import { Asset, UserProfile, Supplier, BusinessProcess } from '../../types';
import { AssetFormData } from '../../schemas/assetSchema';
import { logAction } from '../../services/logger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { assetSchema } from '../../schemas/assetSchema';
import { z } from 'zod';
import { ErrorLogger } from '../../services/errorLogger';
import { usePlanLimits } from '../usePlanLimits';
import { DependencyService } from '../../services/dependencyService';

export function useAssets() {
    const { user, addToast } = useStore();
    const { limits } = usePlanLimits();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Assets
    const { data: rawAssets, loading: assetsLoading, refresh: refreshAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    // Fetch dependencies for forms/filters
    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    // FIX: Ensure usersList is never empty if logged in
    const effectiveUsers = useMemo(() => {
        if (usersList && usersList.length > 0) return usersList;
        if (user && user.uid) return [user];
        return [];
    }, [usersList, user]);

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    const { data: processes, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    // Calculations
    const calculateDepreciation = (price: number, purchaseDate: string) => {
        if (!price || !purchaseDate) return price;
        const start = new Date(purchaseDate);
        const now = new Date();
        const ageInYears = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        // Amortissement linéaire sur 5 ans
        const value = price * (1 - (ageInYears / 5));
        return Math.max(0, Math.round(value));
    };

    const assets = useMemo(() => {
        return rawAssets.map(a => ({
            ...a,
            currentValue: calculateDepreciation(a.purchasePrice || 0, a.purchaseDate || '')
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [rawAssets]);

    const loading = assetsLoading || usersLoading || suppliersLoading || processesLoading;

    // Actions
    const createAsset = async (data: AssetFormData, preSelectedProjectId?: string | null) => {
        if (!user?.organizationId) return false;
        if (assets.length >= limits.maxAssets) {
            addToast(`Limite atteinte (${limits.maxAssets} actifs). Passez au plan supérieur pour ajouter plus d'actifs.`, "error");
            return false;
        }
        setIsSubmitting(true);
        try {
            const validatedData = assetSchema.parse(data);
            const cleanData = sanitizeData(validatedData);
            const newDoc = {
                ...cleanData,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                relatedProjectIds: preSelectedProjectId ? [preSelectedProjectId] : []
            };
            const docRef = await addDoc(collection(db, 'assets'), newDoc);

            // track storage usage if size provided
            if ((cleanData as Partial<AssetFormData> & { estimatedSizeMB?: number }).estimatedSizeMB && user.organizationId) {
                const estSize = (cleanData as Partial<AssetFormData> & { estimatedSizeMB?: number }).estimatedSizeMB || 0;
                const orgRef = doc(db, 'organizations', user.organizationId);
                await updateDoc(orgRef, {
                    storageUsed: increment(estSize * 1024 * 1024)
                }).catch((error) => {
                    ErrorLogger.warn('Failed to increment storage usage', 'useAssets.createAsset', { metadata: { error } });
                });
            }

            if (preSelectedProjectId) {
                const projectRef = doc(db, 'projects', preSelectedProjectId);
                await updateDoc(projectRef, {
                    relatedAssetIds: arrayUnion(docRef.id)
                });
            }

            await logAction(user, 'CREATE', 'Asset', `Création Actif: ${cleanData.name}`);
            addToast("Actif créé avec succès", "success");
            refreshAssets();
            return docRef.id;
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
            const validatedData = assetSchema.parse(data);
            const cleanData = sanitizeData(validatedData);

            await updateDoc(doc(db, 'assets', id), {
                ...cleanData,
                updatedAt: new Date().toISOString()
            });

            await logAction(user, 'UPDATE', 'Asset', `Mise à jour Actif: ${cleanData.name}`);
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
        // Use global DependencyService
        // Note: The service returns 'dependencies' array, logic is same
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
            await deleteDoc(doc(db, 'assets', id));
            await logAction(user, 'DELETE', 'Asset', `Suppression Actif: ${name}`);
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
        // We do this in parallel to be fast
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
            await Promise.all(ids.map(id => deleteDoc(doc(db, 'assets', id))));

            await logAction(user, 'DELETE', 'Asset', `Suppression en masse de ${ids.length} actifs`);
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
