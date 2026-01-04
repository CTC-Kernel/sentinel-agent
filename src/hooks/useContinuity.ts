import { useCallback, useState } from 'react';
import { collection, addDoc, deleteDoc, updateDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { logAction } from '../services/logger';
import { BcpDrill } from '../types';
import { BusinessProcessFormData } from '../schemas/continuitySchema';
import { ImportService } from '../services/ImportService';
import { sanitizeData } from '../utils/dataSanitizer';

export const useContinuity = () => {
    const { user, addToast, t } = useStore();
    const [loading, setLoading] = useState(false);

    const addProcess = useCallback(async (data: BusinessProcessFormData) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const newProcess = {
                ...data,
                organizationId: user.organizationId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: 'Draft',
                lastTestDate: null
            };

            const docRef = await addDoc(collection(db, 'business_processes'), newProcess);
            await logAction(user, 'CREATE', 'BusinessProcess', `Created process: ${data.name}`);
            addToast(t('continuity.toastCreated'), 'success');
            return { id: docRef.id, ...newProcess };
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useContinuity.addProcess', 'CREATE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const updateProcess = useCallback(async (id: string, data: Partial<BusinessProcessFormData>) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'business_processes', id), {
                ...data,
                updatedAt: serverTimestamp()
            });
            await logAction(user, 'UPDATE', 'BusinessProcess', `Updated process: ${data.name || id}`);
            addToast(t('continuity.toastUpdated'), 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useContinuity.updateProcess', 'UPDATE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const deleteProcess = useCallback(async (id: string) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'business_processes', id));
            await logAction(user, 'DELETE', 'BusinessProcess', `Deleted process: ${id}`);
            addToast(t('continuity.toastDeleted'), 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useContinuity.deleteProcess', 'DELETE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const addDrill = useCallback(async (data: Partial<BcpDrill>) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);

            // 1. Create Drill
            const drillRef = doc(collection(db, 'bcp_drills'));
            const newDrill = {
                ...data,
                organizationId: user.organizationId,
                createdAt: serverTimestamp()
            };
            batch.set(drillRef, newDrill);

            // 2. Update Process lastTestDate if applicable
            if (data.processId) {
                const processRef = doc(db, 'business_processes', data.processId);
                batch.update(processRef, {
                    lastTestDate: data.date,
                    updatedAt: serverTimestamp()
                });
            }

            await batch.commit();
            await logAction(user, 'CREATE', 'BcpDrill', `Logged drill for process: ${data.processId || 'General'}`);
            addToast(t('continuity.toastDrill'), 'success');
            return { id: drillRef.id, ...newDrill };
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useContinuity.addDrill', 'CREATE_FAILED');
            throw error;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const updateDrill = useCallback(async (id: string, data: Partial<BcpDrill>) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'bcp_drills', id), {
                ...data,
                updatedAt: serverTimestamp()
            });
            addToast(t('continuity.toastDrillUpdated'), 'success');
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useContinuity.updateDrill', 'UPDATE_FAILED');
            throw e;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const deleteDrill = useCallback(async (id: string) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'bcp_drills', id));
            addToast(t('continuity.toastDrillDeleted'), 'success');
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useContinuity.deleteDrill', 'DELETE_FAILED');
            throw e;
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    const importProcesses = useCallback(async (csvContent: string) => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const lines = ImportService.parseCSV(csvContent);
            if (lines.length === 0) {
                addToast("Fichier vide ou invalide", "error");
                setLoading(false);
                return;
            }

            const batch = writeBatch(db);
            let count = 0;

            for (const row of lines) {
                if (!row.Nom) continue;

                const newRef = doc(collection(db, 'business_processes'));
                const processData = {
                    organizationId: user.organizationId,
                    name: row.Nom,
                    description: row.Description || '',
                    owner: row.Responsable || user.displayName || '',
                    priority: row.Priorite || 'Medium',
                    rto: row.RTO || '4h',
                    rpo: row.RPO || '1h',
                    status: 'Draft',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastTestDate: null
                };

                batch.set(newRef, sanitizeData(processData));
                count++;
            }

            if (count > 0) {
                await batch.commit();
                await logAction(user, 'IMPORT', 'BusinessProcess', `Imported ${count} processes`);
                addToast(t('continuity.toastImported', { count }), 'success');
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useContinuity.importProcesses');
        } finally {
            setLoading(false);
        }
    }, [user, addToast, t]);

    return {
        addProcess,
        updateProcess,
        deleteProcess,
        addDrill,
        updateDrill,
        deleteDrill,
        importProcesses,
        loading
    };
};
