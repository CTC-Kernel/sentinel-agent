import { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Risk } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { useToast } from '@/contexts/ToastContext';
import { logAction } from '../../services/logger';
import { NotificationService } from '../../services/notificationService';

export const useRiskActions = (onRefresh: () => void) => {
    const { user } = useAuth();
    const { addToast } = useToast();
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
            addToast('Risque créé avec succès', 'success');
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
            addToast('Erreur lors de la création du risque', 'error');
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

            addToast('Risque mis à jour', 'success');
            onRefresh();
            return true;
        } catch (error) {
            console.error('Error updating risk:', error);
            ErrorLogger.error(error as Error, 'UPDATE_FAILED');
            addToast('Erreur lors de la mise à jour', 'error');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const deleteRisk = async (id: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce risque ?')) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, 'risks', id));
            addToast('Risque supprimé', 'success');
            onRefresh();
            return true;
        } catch (error) {
            console.error('Error deleting risk:', error);
            addToast('Erreur lors de la suppression', 'error');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const exportRisks = (risks: Risk[], format: 'csv' | 'pdf') => {
        return new Promise<void>((resolve) => {
            console.log(`Exporting ${risks.length} risks as ${format}`);
            addToast('Export démarré...', 'info');
            setTimeout(() => {
                addToast('Export terminé (simulation)', 'success');

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
        if (!confirm(`Supprimer ${ids.length} risques ?`)) return;
        setSubmitting(true);
        try {
            const batch = writeBatch(db);
            ids.forEach(id => {
                batch.delete(doc(db, 'risks', id));
            });
            await batch.commit();
            addToast(`${ids.length} risques supprimés`, 'success');
            onRefresh();
        } catch (error) {
            console.error('Bulk delete error', error);
            addToast('Erreur suppression multiple', 'error');
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
