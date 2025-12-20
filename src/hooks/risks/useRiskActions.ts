import { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Risk } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from 'sonner'; // Integrated sonner
import { logAction } from '../../services/logger';
import { ImportService } from '../../services/ImportService';
import { NotificationService } from '../../services/notificationService';

export const useRiskActions = (onRefresh: () => void) => {
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const createRisk = async (data: Partial<Risk>) => {
        if (!user?.organizationId) return false;
        setSubmitting(true);
        try {
            const riskData = {
                ...data,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: data.status || 'Ouvert',
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
                await NotificationService.create(
                    { uid: riskData.owner, organizationId: user.organizationId } as any, // Cast/Struct fix for target
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

    const updateRisk = async (id: string, data: Partial<Risk>, currentRisk?: Risk) => {
        setSubmitting(true);
        try {
            const riskRef = doc(db, 'risks', id);
            await updateDoc(riskRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });

            if (user) {
                // Calculate diffs if currentRisk provided
                const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
                if (currentRisk) {
                    Object.keys(data).forEach(key => {
                        const k = key as keyof Risk;
                        if (data[k] !== currentRisk[k] && typeof data[k] !== 'object') {
                            changes.push({
                                field: k,
                                oldValue: currentRisk[k] || 'N/A',
                                newValue: data[k]
                            });
                        }
                    });
                }

                logAction(
                    user,
                    'UPDATE_RISK',
                    'Risk',
                    changes.length > 0 ? `Updated ${changes.length} fields` : `Risk updated`,
                    undefined,
                    id,
                    undefined,
                    changes
                );
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
    };

    const exportCSV = async (risks: Risk[]) => {
        setIsExportingCSV(true);
        try {
            await exportRisks(risks, 'csv');
        } finally {
            setIsExportingCSV(false);
        }
    };

    const bulkDeleteRisks = async (ids: string[]) => {
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

    const importRisks = async (csvContent: string) => {
        setIsImporting(true);
        try {
            const { data, errors } = ImportService.parseRisks(csvContent);

            if (errors.length > 0) {
                toast.error(`Erreurs de validation (${errors.length}): ${errors.slice(0, 3).join(', ')}`);
                if (data.length === 0) return false;
            }

            let importedCount = 0;
            for (const item of data) {
                // Using internal createRisk for consistency
                await createRisk({
                    ...item,
                    strategy: item.strategy as Risk['strategy'],
                    status: item.status as Risk['status'],
                    framework: item.framework as any,
                    probability: item.probability as any,
                    impact: item.impact as any
                });
                importedCount++;
            }

            toast.success(`${importedCount} risques importés avec succès`);
            onRefresh();
            return true;
        } catch (error) {
            console.error('Import error process:', error);
            toast.error("Erreur critique lors de l'import");
            return false;
        } finally {
            setIsImporting(false);
        }
    };

    return {
        createRisk,
        updateRisk,
        deleteRisk,
        exportCSV,
        bulkDeleteRisks,
        importRisks,
        isGeneratingReport,
        setIsGeneratingReport,
        isExportingCSV,
        isImporting,
        submitting
    };
};
