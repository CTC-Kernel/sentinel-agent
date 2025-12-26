import { useCallback } from 'react';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch,
    query,
    getDocs,
    arrayRemove,
    where
} from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Supplier, Criticality } from '../types';
import { sanitizeData } from '../utils/dataSanitizer';
import { logAction } from '../services/logger';
import { ErrorLogger } from '../services/errorLogger';
import { useFirestoreCollection } from './useFirestore';
import { CsvParser } from '../utils/csvUtils';

export const useSuppliers = () => {
    const { user, t, addToast } = useStore();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: suppliers, loading, error } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const addSupplier = useCallback(async (data: Partial<Supplier>) => {
        if (!user?.organizationId) return;
        try {
            const sanitizedData = sanitizeData(data);
            const docRef = await addDoc(collection(db, 'suppliers'), {
                ...sanitizedData,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await logAction(user, 'CREATE', 'Supplier', `Ajout Fournisseur: ${data.name}`);
            addToast(t('suppliers.toastCreated'), "success");
            return docRef.id;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSuppliers.addSupplier');
            throw error;
        }
    }, [user, addToast, t]);

    const updateSupplier = useCallback(async (id: string, data: Partial<Supplier>) => {
        try {
            const sanitizedData = sanitizeData(data);
            await updateDoc(doc(db, 'suppliers', id), {
                ...sanitizedData,
                updatedAt: new Date().toISOString()
            });
            await logAction(user, 'UPDATE', 'Supplier', `MAJ Fournisseur: ${data.name}`);
            addToast(t('suppliers.toastUpdated'), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSuppliers.updateSupplier');
            throw error;
        }
    }, [user, addToast, t]);

    const deleteSupplier = useCallback(async (id: string, name?: string) => {
        if (!user?.organizationId) return;
        try {
            // 1. Dependencies Cleanup
            const controlQuery = query(collection(db, 'controls'), where('organizationId', '==', user.organizationId), where('relatedSupplierIds', 'array-contains', id));
            const riskQuery = query(collection(db, 'risks'), where('organizationId', '==', user.organizationId), where('relatedSupplierIds', 'array-contains', id));

            const [controlsSnap, risksSnap] = await Promise.all([
                getDocs(controlQuery),
                getDocs(riskQuery)
            ]);

            const cleanupPromises: Promise<void>[] = [];
            controlsSnap.docs.forEach(docSnap => {
                cleanupPromises.push(updateDoc(doc(db, 'controls', docSnap.id), { relatedSupplierIds: arrayRemove(id) }));
            });
            risksSnap.docs.forEach(docSnap => {
                cleanupPromises.push(updateDoc(doc(db, 'risks', docSnap.id), { relatedSupplierIds: arrayRemove(id) }));
            });

            await Promise.all(cleanupPromises);

            // 2. Delete related assessments
            const assessmentsQuery = query(collection(db, 'supplierAssessments'), where('supplierId', '==', id));
            const assessmentsSnap = await getDocs(assessmentsQuery);
            const deleteAssessments = assessmentsSnap.docs.map(doc => deleteDoc(doc.ref));

            // 3. Delete related incidents
            const incidentsQuery = query(collection(db, 'supplierIncidents'), where('supplierId', '==', id));
            const incidentsSnap = await getDocs(incidentsQuery);
            const deleteIncidents = incidentsSnap.docs.map(doc => deleteDoc(doc.ref));

            // 4. Delete the supplier itself
            await Promise.all([...deleteAssessments, ...deleteIncidents, deleteDoc(doc(db, 'suppliers', id))]);

            await logAction(user, 'DELETE', 'Supplier', `Suppression Fournisseur: ${name || id}`);
            addToast(t('suppliers.toastDeleted'), 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSuppliers.deleteSupplier');
            throw error;
        }
    }, [user, addToast, t]);

    const importSuppliers = useCallback(async (csvContent: string) => {
        if (!user?.organizationId) return;
        try {
            const lines = CsvParser.parseCSV(csvContent);
            if (lines.length === 0) {
                addToast("Fichier vide ou invalide", "error");
                return;
            }

            const batch = writeBatch(db);
            let count = 0;

            lines.forEach((row: Record<string, string>) => {
                const values = Object.values(row) as string[];
                const name = row['Nom'] || row['Name'] || values[0] || 'Inconnu';
                const category = row['Catégorie'] || row['Category'] || values[1] || 'Autre';
                const criticality = row['Criticité'] || row['Criticality'] || values[2] || 'Moyenne';
                const contactName = row['Contact'] || row['ContactName'] || values[3] || '';
                const contactEmail = row['Email'] || row['ContactEmail'] || values[4] || '';

                if (name) {
                    const newRef = doc(collection(db, 'suppliers'));
                    const newSupplierData: Partial<Supplier> = {
                        organizationId: user.organizationId,
                        name: name.trim(),
                        category: (category.trim() || 'Autre') as Supplier['category'],
                        criticality: (criticality.trim() || 'Moyenne') as Criticality,
                        contactName: contactName.trim(),
                        contactEmail: contactEmail.trim(),
                        status: 'Actif',
                        securityScore: 0,
                        assessment: {
                            hasIso27001: false, hasGdprPolicy: false, hasEncryption: false,
                            hasBcp: false, hasIncidentProcess: false, lastAssessmentDate: new Date().toISOString()
                        },
                        isICTProvider: false,
                        supportsCriticalFunction: false,
                        doraCriticality: 'None',
                        owner: user.displayName || 'Importé',
                        ownerId: user.uid,
                        createdAt: new Date().toISOString()
                    };
                    batch.set(newRef, sanitizeData(newSupplierData));
                    count++;
                }
            });
            await batch.commit();
            await logAction(user, 'IMPORT', 'Supplier', `Import CSV de ${count} fournisseurs`);
            addToast(t('suppliers.toastImported', { count }), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useSuppliers.importSuppliers');
            throw error;
        }
    }, [user, addToast, t]);

    const checkDependencies = useCallback(async (id: string) => {
        if (!user?.organizationId) return { controls: 0, risks: 0, details: '' };
        try {
            const controlQuery = query(collection(db, 'controls'), where('organizationId', '==', user.organizationId), where('relatedSupplierIds', 'array-contains', id));
            const riskQuery = query(collection(db, 'risks'), where('organizationId', '==', user.organizationId), where('relatedSupplierIds', 'array-contains', id));

            const [controlsSnap, risksSnap] = await Promise.all([
                getDocs(controlQuery),
                getDocs(riskQuery)
            ]);

            const controlNames = controlsSnap.docs.slice(0, 3).map(d => d.data().code).join(', ');
            const riskNames = risksSnap.docs.slice(0, 3).map(d => d.data().threat || 'Risque').join(', ');

            let details = "";
            if (!controlsSnap.empty) details += `\n- ${controlsSnap.size} contrôle(s) (${controlNames}...)`;
            if (!risksSnap.empty) details += `\n- ${risksSnap.size} risque(s) (${riskNames}...)`;

            return {
                controls: controlsSnap.size,
                risks: risksSnap.size,
                details
            };
        } catch (error) {
            ErrorLogger.warn(error instanceof Error ? error.message : String(error), 'useSuppliers.checkDependencies');
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
