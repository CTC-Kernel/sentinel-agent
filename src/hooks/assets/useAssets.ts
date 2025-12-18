
import { useState, useMemo } from 'react';
import { where, collection, addDoc, doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
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

export function useAssets() {
    const { user, addToast } = useStore();
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

    const deleteAsset = async (id: string, name: string) => {
        if (!user?.organizationId) return false;
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

    return {
        assets,
        usersList,
        suppliers,
        processes,
        loading,
        createAsset,
        updateAsset,
        deleteAsset,
        isSubmitting,
        refreshAssets
    };
}
