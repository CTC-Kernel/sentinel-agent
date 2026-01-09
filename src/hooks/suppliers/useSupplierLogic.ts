import { useCallback, useState, useEffect } from 'react';
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

    const { data: suppliersRaw, loading: loadingSuppliers, error } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true, enabled: !!user?.organizationId && !demoMode }
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
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            await logAction(user, 'CREATE', 'Supplier', `Ajout Fournisseur: ${data.name}`);
            addToast(t('suppliers.toastCreated'), "success");
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
                updatedAt: serverTimestamp()
            });
            await logAction(user, 'UPDATE', 'Supplier', `MAJ Fournisseur: ${data.name}`);
            addToast(t('suppliers.toastUpdated'), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSupplierLogic.updateSupplier');
            throw error;
        }
    }, [user, addToast, t]);

    const deleteSupplier = useCallback(async (id: string, name?: string) => {
        if (!user?.organizationId) return;
        try {
            // Use SupplierService for cascade deletion
            await SupplierService.deleteSupplierWithCascade(id);

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
                addToast("Fichier vide ou invalide", "error");
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
