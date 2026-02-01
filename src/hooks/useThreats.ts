import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ThreatTemplate } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { RISK_TEMPLATES } from '../data/riskTemplates';
import { hasPermission } from '../utils/permissions';

export const useThreats = () => {
    const { user, addToast, demoMode, t } = useStore();
    const [threats, setThreats] = useState<ThreatTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.organizationId) return;

        // Demo Mode Logic
        if (demoMode) {
            setLoading(true);
            import('../services/mockDataService').then(({ MockDataService }) => {
                setThreats(MockDataService.getCollection('threat_library') as ThreatTemplate[]);
                setLoading(false);
            });
            return;
        }

        setLoading(true);
        const q = query(collection(db, 'threat_library'), where('organizationId', '==', user.organizationId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ThreatTemplate));
            setThreats(items);
            setLoading(false);
        }, (err) => {
            ErrorLogger.error(err as Error, 'useThreats.subscribe');
            addToast(t('threats.toast.loadError', { defaultValue: 'Erreur lors du chargement des menaces' }), 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.organizationId, addToast, demoMode, t]);

    const addThreat = async (threat: Partial<ThreatTemplate>) => {
        if (!user?.organizationId) return;
        if (demoMode) {
            addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
            return;
        }
        if (!hasPermission(user, 'Threat', 'create')) {
            addToast(t('threats.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
            return;
        }
        try {
            const dataToSave = sanitizeData({
                ...threat,
                organizationId: user.organizationId,
                source: threat.source || 'Custom',
                createdAt: serverTimestamp()
            });
            await addDoc(collection(db, 'threat_library'), dataToSave);
            addToast(t('threats.toast.created', { defaultValue: "Menace créée" }), "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useThreats.addThreat');
            addToast(t('threats.toast.createError', { defaultValue: "Erreur lors de la création" }), "error");
            throw error;
        }
    };

    const updateThreat = async (id: string, updates: Partial<ThreatTemplate>) => {
        if (demoMode) {
            addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
            return;
        }

        // SECURITY: Check authorization
        if (!hasPermission(user, 'Threat', 'update')) {
            ErrorLogger.warn('Unauthorized threat update attempt', 'useThreats.updateThreat', {
                metadata: { attemptedBy: user?.uid, targetId: id }
            });
            addToast(t('threats.toast.noUpdatePermission', { defaultValue: "Vous n'avez pas les droits pour modifier cette menace" }), "error");
            return false;
        }

        // SECURITY: Verify threat belongs to user's organization (IDOR protection)
        const targetThreat = threats.find(t => t.id === id);
        if (!targetThreat || targetThreat.organizationId !== user?.organizationId) {
            ErrorLogger.warn('IDOR attempt: threat modification across organizations', 'useThreats.updateThreat', {
                metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: targetThreat?.organizationId, callerOrg: user?.organizationId }
            });
            addToast(t('threats.toast.notFound', { defaultValue: "Menace non trouvée" }), "error");
            return false;
        }

        try {
            // Ensure ID is not in the update payload
            const { id: _unused, ...safeUpdates } = updates;
            await updateDoc(doc(db, 'threat_library', id), sanitizeData(safeUpdates));
            addToast(t('threats.toast.updated', { defaultValue: "Menace modifiée" }), "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useThreats.updateThreat');
            addToast(t('threats.toast.updateError', { defaultValue: "Erreur lors de la modification" }), "error");
            throw error;
        }
    };

    const deleteThreat = async (id: string) => {
        if (demoMode) {
            addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
            return;
        }

        // SECURITY: Check authorization
        if (!hasPermission(user, 'Threat', 'delete')) {
            ErrorLogger.warn('Unauthorized threat deletion attempt', 'useThreats.deleteThreat', {
                metadata: { attemptedBy: user?.uid, targetId: id }
            });
            addToast(t('threats.toast.noDeletePermission', { defaultValue: "Vous n'avez pas les droits pour supprimer cette menace" }), "error");
            return false;
        }

        // SECURITY: Verify threat belongs to user's organization (IDOR protection)
        const targetThreat = threats.find(t => t.id === id);
        if (!targetThreat || targetThreat.organizationId !== user?.organizationId) {
            ErrorLogger.warn('IDOR attempt: threat deletion across organizations', 'useThreats.deleteThreat', {
                metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: targetThreat?.organizationId, callerOrg: user?.organizationId }
            });
            addToast(t('threats.toast.notFound', { defaultValue: "Menace non trouvée" }), "error");
            return false;
        }

        try {
            await deleteDoc(doc(db, 'threat_library', id));
            addToast(t('threats.toast.deleted', { defaultValue: "Menace supprimée" }), "success");
            return true;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useThreats.deleteThreat');
            addToast(t('threats.toast.deleteError', { defaultValue: "Erreur lors de la suppression" }), "error");
            throw error;
        }
    };

    const seedStandardThreats = async () => {
        if (!user?.organizationId) return;
        if (demoMode) {
            addToast(t('common.toast.demoModeUnavailable', { defaultValue: "Action non disponible en mode démo" }), "info");
            return;
        }
        if (!hasPermission(user, 'Threat', 'create')) {
            addToast(t('threats.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
            return;
        }
        try {
            const batch = writeBatch(db); // Note: RISK_TEMPLATES is small (<100), no chunk needed
            let count = 0;

            RISK_TEMPLATES.forEach(template => {
                const docRef = doc(collection(db, 'threat_library'));
                batch.set(docRef, sanitizeData({
                    ...template,
                    organizationId: user.organizationId,
                    source: 'Standard',
                    createdAt: serverTimestamp()
                }));
                count++;
            });

            await batch.commit();
            addToast(t('threats.toast.standardImported', { defaultValue: "{{count}} menaces standard importées", count }), 'success');
            return count;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useThreats.seedStandardThreats');
            addToast(t('threats.toast.importError', { defaultValue: "Erreur lors de l'import" }), "error");
            throw error;
        }
    };

    return {
        threats,
        loading,
        addThreat,
        updateThreat,
        deleteThreat,
        seedStandardThreats
    };
};
