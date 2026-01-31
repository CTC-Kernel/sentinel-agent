import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    where,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Supplier } from '../../types';
import { sanitizeData } from '../../utils/dataSanitizer';
import { logAction } from '../../services/logger';
import { ErrorLogger } from '../../services/errorLogger';
import { SupplierService } from '../../services/SupplierService';
import { useFirestoreCollection } from '../useFirestore';
import { ImportService } from '../../services/ImportService';

export const useSupplierLogic = () => {
    const { user, t, addToast, demoMode } = useStore();
    const [mockSuppliers, setMockSuppliers] = useState<Supplier[]>([]);

    const organizationId = user?.organizationId;
    const constraints = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId)] : undefined;
    }, [organizationId]);

    const { data: suppliersRaw, loading: loadingSuppliers, error } = useFirestoreCollection<Supplier>(
        'suppliers',
        constraints,
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    // Mock Data Effect
    useEffect(() => {
        if (demoMode) {
            const loadMocks = async () => {
                const { MockDataService } = await import('../../services/mockDataService');
                setMockSuppliers(MockDataService.getCollection('suppliers') as Supplier[]);
            };
            loadMocks();
        }
    }, [demoMode]);

    const suppliers = demoMode ? mockSuppliers : suppliersRaw;
    const loading = demoMode ? mockSuppliers.length === 0 : loadingSuppliers;

    const addSupplier = useCallback(async (data: Partial<Supplier>) => {
        if (!user?.organizationId) return;
        try {
            const sanitizedData = sanitizeData(data);
            const docRef = await addDoc(collection(db, 'suppliers'), {
                ...sanitizedData,
                organizationId: user.organizationId,
                createdAt: serverTimestamp() as unknown as string,
                updatedAt: serverTimestamp() as unknown as string,
                createdBy: user.uid,
                updatedBy: user.uid
            });

            // Auto-sync to ICT Provider if marked as ICT
            if (sanitizedData.isICTProvider) {
                try {
                    await SupplierService.syncToICTProvider(docRef.id);
                } catch (syncError) {
                    ErrorLogger.warn(`Failed to sync new supplier ${docRef.id} to ICT Provider: ${syncError}`, 'useSupplierLogic.addSupplier');
                }
            }

            await logAction(user, 'CREATE', 'Supplier', `Ajout fournisseur: ${sanitizedData.name}`);
            addToast(t('suppliers.toastAdded', { name: sanitizedData.name || 'Nouveau fournisseur' }), "success");
            return docRef.id;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSupplierLogic.addSupplier');
            throw error;
        }
    }, [user, addToast, t]);

    const updateSupplier = useCallback(async (id: string, data: Partial<Supplier>) => {
        try {
            const sanitizedData = sanitizeData(data);
            await updateDoc(doc(db, 'suppliers', id), {
                ...sanitizedData,
                updatedAt: serverTimestamp() as unknown as string,
                updatedBy: user?.uid
            });

            // Auto-sync to ICT Provider if ICT status changed or if already ICT
            const shouldSync = sanitizedData.isICTProvider !== undefined || sanitizedData.isICTProvider === true;
            if (shouldSync) {
                try {
                    await SupplierService.syncToICTProvider(id);
                } catch (syncError) {
                    ErrorLogger.warn(`Failed to sync supplier ${id} to ICT Provider: ${syncError}`, 'useSupplierLogic.updateSupplier');
                }
            }

            await logAction(user, 'UPDATE', 'Supplier', `Mise à jour fournisseur ID: ${id}`);
            addToast(t('suppliers.toastUpdated', { name: sanitizedData.name || 'Fournisseur' }), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSupplierLogic.updateSupplier');
            throw error;
        }
    }, [user, addToast, t]);

    const deleteSupplier = useCallback(async (id: string, name?: string) => {
        if (!user?.organizationId) return;
        try {
            // Use SupplierService for cascade deletion
            await SupplierService.deleteSupplierWithCascade(id, user);

            await logAction(user, 'DELETE', 'Supplier', `Suppression Fournisseur: ${name || id}`);
            addToast(t('suppliers.toastDeleted'), 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSupplierLogic.deleteSupplier');
            throw error;
        }
    }, [user, addToast, t]);

    const importSuppliers = useCallback(async (csvContent: string) => {
        if (!user?.organizationId || !user?.uid) return;
        try {
            const lines = ImportService.parseCSV(csvContent);
            if (lines.length === 0) {
                addToast(t('common.toast.emptyOrInvalidFile', { defaultValue: "Fichier vide ou invalide" }), "error");
                return;
            }

            // Use SupplierService for batch import
            const count = await SupplierService.importSuppliersFromCSV(
                lines,
                user.organizationId,
                user.uid,
                user.displayName
            );

            await logAction(user, 'IMPORT', 'Supplier', `Import CSV de ${count} fournisseurs`);
            addToast(t('suppliers.toastImported', { count }), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSupplierLogic.importSuppliers');
            throw error;
        }
    }, [user, addToast, t]);

    // Auto-sync effect for ICT providers - runs once per session to avoid infinite loop
    const hasSyncedRef = useRef(false);
    useEffect(() => {
        if (!user?.organizationId || loading || demoMode) return;
        // Only sync once per session to prevent infinite loop
        // (syncAllICTSuppliers modifies Firestore, which triggers realtime listener)
        if (hasSyncedRef.current) return;

        const syncICTSuppliers = async () => {
            try {
                // Sync all ICT suppliers in background
                const ictSuppliers = suppliers.filter(s => s.isICTProvider);
                if (ictSuppliers.length > 0 && user.organizationId) {
                    hasSyncedRef.current = true;
                    await SupplierService.syncAllICTSuppliers(user.organizationId);
                }
            } catch (error) {
                ErrorLogger.warn(`Background ICT sync failed: ${error}`, 'useSupplierLogic.autoSync');
            }
        };

        // Delay sync to avoid blocking initial load
        const timer = setTimeout(syncICTSuppliers, 2000);
        return () => clearTimeout(timer);
    }, [suppliers, user?.organizationId, loading, demoMode]);

    const checkDependencies = useCallback(async (id: string) => {
        if (!user?.organizationId) return { controls: 0, risks: 0, details: '' };
        try {
            // Use SupplierService to check dependencies
            return await SupplierService.checkDependencies(id, user.organizationId);
        } catch (error) {
            ErrorLogger.warn(error instanceof Error ? error.message : String(error), 'useSupplierLogic.checkDependencies');
            return { controls: 0, risks: 0, details: '' };
        }
    }, [user]);

    return {
        suppliers,
        loading,
        error,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        importSuppliers,
        checkDependencies
    };
};
