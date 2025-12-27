import { db } from '../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDocs, query, where, writeBatch, limit, serverTimestamp } from 'firebase/firestore';
import { ProcessingActivity, UserProfile, SystemLog } from '../types';
import { ErrorLogger } from './errorLogger';
import { logAction } from './logger';
import { sanitizeData } from '../utils/dataSanitizer';
import { SupplierService } from './SupplierService';
import { DPIA_TEMPLATE } from '../data/dpiatemplate';

export const PrivacyService = {
    async fetchActivities(organizationId: string): Promise<ProcessingActivity[]> {
        try {
            const q = query(collection(db, 'processing_activities'), where('organizationId', '==', organizationId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Handle potential Timestamp to string conversion if needed, though sanitizeData typically handles inputs.
                    // If data.createdAt is a Timestamp, we might want to convert it.
                    // For now, type assertion is used.
                } as ProcessingActivity;
            });
        } catch (error) {
            ErrorLogger.error(error, 'PrivacyService.fetchActivities');
            return [];
        }
    },

    async createActivity(activity: Omit<ProcessingActivity, 'id'>, user: UserProfile): Promise<string> {
        try {
            // Use serverTimestamp for createdAt/updatedAt
            // We need to allow dates to be ServerTimestamp in Firestore but string in UI.
            // sanitizeData might convert Date objects to string, but we want serverTimestamp marker.
            // We will pass logic: overwrite createdAt/updatedAt with serverTimestamp()
            const activityData = {
                ...sanitizeData(activity),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'processing_activities'), activityData);

            await logAction(
                user,
                'CREATE',
                'Privacy',
                `Création du traitement: ${activity.name}`,
                undefined,
                docRef.id
            );
            return docRef.id;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'PrivacyService.createActivity');
            throw error;
        }
    },

    async updateActivity(id: string, updates: Partial<ProcessingActivity>, user: UserProfile): Promise<void> {
        try {
            const docRef = doc(db, 'processing_activities', id);
            await updateDoc(docRef, { ...sanitizeData(updates), updatedAt: serverTimestamp() });

            await logAction(
                user,
                'UPDATE',
                'Privacy',
                `Mise à jour du traitement: ${updates.name || id}`,
                undefined,
                id
            );
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'PrivacyService.updateActivity');
            throw error;
        }
    },

    async deleteActivity(id: string, activityName: string, user: UserProfile): Promise<void> {
        try {
            await deleteDoc(doc(db, 'processing_activities', id));
            await logAction(
                user,
                'DELETE',
                'Privacy',
                `Suppression du traitement: ${activityName}`,
                undefined,
                id
            );
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'PrivacyService.deleteActivity');
            throw error;
        }
    },

    async importActivities(activities: Omit<ProcessingActivity, 'id'>[], user: UserProfile): Promise<number> {
        const batch = writeBatch(db);
        let count = 0;

        for (const act of activities) {
            const ref = doc(collection(db, 'processing_activities'));
            batch.set(ref, {
                ...sanitizeData(act),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            count++;
        }

        if (count > 0) {
            await batch.commit();
            await logAction(
                user,
                'IMPORT',
                'Privacy',
                `Import CSV de ${count} traitements`
            );
        }
        return count;
    },

    async fetchActivityHistory(organizationId: string, activityId: string, activityName?: string): Promise<SystemLog[]> {
        try {
            const logsRef = collection(db, 'system_logs');
            // We fetch last 50 logs for org and filter manually because of complex OR query limitations
            const q = query(
                logsRef,
                where('organizationId', '==', organizationId),
                limit(100)
            );
            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => doc.data() as SystemLog);

            return logs.filter(l =>
                (l.resource === 'Privacy' && l.resourceId === activityId) ||
                (activityName && l.details?.includes(activityName))
            ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        } catch (error) {
            ErrorLogger.error(error, 'PrivacyService.fetchHistory');
            return [];
        }
    },

    // DPIA Logic
    async startDPIA(activity: ProcessingActivity, user: UserProfile): Promise<string> {
        if (!user.organizationId) throw new Error("Organization ID missing");
        try {
            // 1. Ensure DPIA Template exists
            const templateRef = doc(db, 'questionnaire_templates', DPIA_TEMPLATE.id);
            // 'system' orgId is for templates shared across system, but here we merge it.
            // setDoc usually requires permissions. If this fails due to rules, we might need a Service Account or Cloud Function.
            // Assuming current user works if allowed.
            // We use 'organizationId: system' maybe problematic if user is not admin of system?
            // Actually DPIA_TEMPLATE might be static or user-owned.
            // Let's assume user.organizationId for the template copy if needed, or check logic.
            // The original logic used 'system', let's stick to it but wrap in try/catch.

            await setDoc(templateRef, { ...DPIA_TEMPLATE, organizationId: user.organizationId }, { merge: Boolean(true) });

            // 2. Create Assessment
            const responseId = await SupplierService.createAssessment(
                user.organizationId,
                activity.id,
                activity.name,
                DPIA_TEMPLATE
            );

            // 3. Update Activity
            await updateDoc(doc(db, 'processing_activities', activity.id), {
                hasDPIA: true,
                updatedAt: serverTimestamp()
            });

            return responseId;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'PrivacyService.startDPIA');
            throw error;
        }
    },

    async findDPIAResponseId(activityId: string): Promise<string | null> {
        const q = query(
            collection(db, 'questionnaire_responses'),
            where('supplierId', '==', activityId),
            where('templateId', '==', DPIA_TEMPLATE.id)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            docs.sort((a: { sentDate: string }, b: { sentDate: string }) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());
            return docs[0].id;
        }
        return null;
    }
};
