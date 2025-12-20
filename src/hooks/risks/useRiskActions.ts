import { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Risk } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from 'sonner'; // Integrated sonner
import { logAction } from '../../services/logger';
import { NotificationService } from '../../services/notificationService';

export const useRiskActions = (onRefresh: () => void) => {
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    const createRisk = async (data: Partial<Risk>) => {
        if (!user?.organizationId) return;
        setSubmitting(true);
        try {
            const riskData = {
                ...data,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'Ouvert',
                owner: user.uid,
                history: [{
                    date: new Date().toISOString(),
                    user: user.displayName || user.email,
                    action: 'Création du risque',
                    changes: 'Initialisation'
                }]
            };

            await addDoc(collection(db, 'risks'), riskData);
            toast.success('Risque créé avec succès');
            onRefresh();
            if (user) {
                logAction(user, 'CREATE_RISK', 'Risk', 'Risque créé');
            }

            // Notify owner if different from creator
            if (riskData.owner && riskData.owner !== user.uid) {
                // We need to fetch owner details potentially, or just trust the ID for the notification service which handles it?
                // NotificationService.create takes a UserProfile... wait, create takes 'user' to GET organizationId.
                // But we want to send TO the owner.
                // We should use a method that sends to a target userID.
                // NotificationService.create uses 'user.uid' as target 'userId'.
                // So we need to construct a target user object or use a different method.
                // The service has `create(user, ...)` where user is the TARGET.
                // So we can pass { uid: riskData.owner, organizationId: user.organizationId } as the target.

                await NotificationService.create(
                    { uid: riskData.owner, organizationId: user.organizationId },
                    'info',
                    'Nouveau Risque Assigné',
                    `Un nouveau risque vous a été assigné par ${user.displayName}`,
                    '/risks'
                );
            }
            return true;
        } catch (error) {
            console.error('Error creating risk:', error);
            ErrorLogger.error(error as Error, 'CREATE_FAILED');
            toast.error('Erreur lors de la création du risque');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const updateRisk = async (id: string, data: Partial<Risk>) => {
        setSubmitting(true);
        try {
            const riskRef = doc(db, 'risks', id);
            await updateDoc(riskRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });

            if (data.status && user) {
                logAction(user, 'UPDATE_RISK_STATUS', 'Risk', `Status updated to ${data.status}`);
            }


            toast.success('Risque mis à jour');
            onRefresh();
            return true;
        } catch (error) {
            console.error('Error updating risk:', error);
            ErrorLogger.error(error as Error, 'UPDATE_FAILED');
            toast.error('Erreur lors de la mise à jour');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const deleteRisk = async (id: string) => {
        // Confirmation is now handled by the UI component (ConfirmModal)
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, 'risks', id));
            toast.success('Risque supprimé');
            onRefresh();
            return true;
        } catch (error) {
            console.error('Error deleting risk:', error);
            toast.error('Erreur lors de la suppression');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const exportRisks = (risks: Risk[], _format: 'csv' | 'pdf') => {
        return new Promise<void>((resolve) => {

            toast.info('Export démarré...');
            setTimeout(() => {
                toast.success('Export terminé (simulation)');

                if (user?.uid && user?.organizationId) {
                    NotificationService.create(
                        user,
                        'success',
                        'Export terminé',
                        `L'export de ${risks.length} risques est prêt au téléchargement.`,
                        '/risks'
                    ).catch(e => console.error(e));
                }
                resolve();
            }, 1000);
        });
    }

    const exportCSV = async (risks: Risk[]) => {
        setIsExportingCSV(true);
        try {
            await exportRisks(risks, 'csv');
        } finally {
            setIsExportingCSV(false);
        }
    };

    const bulkDeleteRisks = async (ids: string[]) => {
        // Confirmation handled by UI
        setSubmitting(true);
        try {
            const batch = writeBatch(db);
            ids.forEach(id => {
                batch.delete(doc(db, 'risks', id));
            });
            await batch.commit();
            toast.success(`${ids.length} risques supprimés`);
            onRefresh();
        } catch (error) {
            console.error('Bulk delete error', error);
            toast.error('Erreur suppression multiple');
        } finally {
            setSubmitting(false);
        }
    };

    return {
        createRisk,
        updateRisk,
        deleteRisk,
        exportCSV,
        bulkDeleteRisks,
        isGeneratingReport,
        setIsGeneratingReport,
        isExportingCSV,
        submitting
    };
};
