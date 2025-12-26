import { useCallback } from 'react';
import { collection, addDoc, deleteDoc, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { logAction } from '../services/logger';
import { BcpDrill } from '../types';
import { BusinessProcessFormData } from '../schemas/continuitySchema';

export const useContinuity = () => {
    const { user, addToast, t } = useStore();

    const addProcess = useCallback(async (data: BusinessProcessFormData) => {
        if (!user?.organizationId) return;
        try {
            const newProcess = {
                ...data,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
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
        }
    }, [user, addToast, t]);

    const updateProcess = useCallback(async (id: string, data: BusinessProcessFormData) => {
        if (!user?.organizationId) return;
        try {
            await updateDoc(doc(db, 'business_processes', id), {
                ...data,
                updatedAt: new Date().toISOString()
            });
            await logAction(user, 'UPDATE', 'BusinessProcess', `Updated process: ${data.name}`);
            addToast(t('continuity.toastUpdated'), 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useContinuity.updateProcess', 'UPDATE_FAILED');
            throw error;
        }
    }, [user, addToast, t]);

    const deleteProcess = useCallback(async (id: string) => {
        if (!user?.organizationId) return;
        try {
            await deleteDoc(doc(db, 'business_processes', id));
            await logAction(user, 'DELETE', 'BusinessProcess', `Deleted process: ${id}`);
            addToast(t('continuity.toastDeleted'), 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useContinuity.deleteProcess', 'DELETE_FAILED');
            throw error;
        }
    }, [user, addToast, t]);

    const logDrill = useCallback(async (data: Partial<BcpDrill>) => {
        if (!user?.organizationId) return;
        try {
            const batch = writeBatch(db);

            // 1. Create Drill
            const drillRef = doc(collection(db, 'bcp_drills'));
            const newDrill = {
                ...data,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString()
            };
            batch.set(drillRef, newDrill);

            // 2. Update Process lastTestDate if applicable
            if (data.processId) {
                const processRef = doc(db, 'business_processes', data.processId);
                batch.update(processRef, {
                    lastTestDate: data.date,
                    updatedAt: new Date().toISOString()
                });
            }

            await batch.commit();
            await logAction(user, 'CREATE', 'BcpDrill', `Logged drill for process: ${data.processId || 'General'}`);
            addToast(t('continuity.toastDrill'), 'success');
            return { id: drillRef.id, ...newDrill };
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useContinuity.logDrill', 'CREATE_FAILED');
            throw error;
        }
    }, [user, addToast, t]);

    return {
        addProcess,
        updateProcess,
        deleteProcess,
        logDrill
    };
};
