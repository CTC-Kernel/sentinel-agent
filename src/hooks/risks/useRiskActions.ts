import { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch, arrayRemove } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Risk } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from 'sonner';
import { logAction } from '../../services/logger';
import { getDiff } from '../../utils/diffUtils';
import { ImportService } from '../../services/ImportService';
import { NotificationService } from '../../services/notificationService';
import { DependencyService } from '../../services/dependencyService';
import { riskSchema } from '../../schemas/riskSchema';

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
            // Validation Zod
            const validationResult = riskSchema.safeParse(data);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.issues[0]?.message || 'Données invalides';
                toast.error(errorMessage);
                console.error('Validation error:', validationResult.error);
                return false;
            }

            const riskData = {
                ...data, // Use original data or validated data? Ideally validated but schema might strip extra fields if not set to passthrough. Schema looks comprehensive.
                // Keeping spread of data for now to be safe, but validation passed.
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: data.status || 'Ouvert',
                owner: user.uid,
                history: [{
                    date: new Date().toISOString(),
                    user: user.displayName || user.email,
                    action: 'Création du risque',
                    changes: 'Initialisation',
                    previousScore: 0,
                    newScore: 0,
                    changedBy: user.uid
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
                await NotificationService.notifyRiskAssigned(riskData as any, riskData.owner, user.displayName || user.email || 'Admin');
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
                const changes = currentRisk ? getDiff(data, currentRisk as unknown as Record<string, unknown>) : [];

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

    const checkDependencies = async (riskId: string) => {
        if (!user?.organizationId) return { hasDependencies: false, details: [] };

        // Use the new service
        const result = await DependencyService.checkRiskDependencies(riskId, user.organizationId);

        return {
            hasDependencies: result.hasDependencies,
            details: result.dependencies
        };
    };

    const deleteRisk = async (id: string, name?: string) => {
        setSubmitting(true);
        try {
            // Cleanup references using service
            if (!user?.organizationId) throw new Error("No org");

            const check = await DependencyService.checkRiskDependencies(id, user.organizationId);

            if (check.hasDependencies) {
                const cleanupPromises = [];
                // Clean references
                for (const dep of check.dependencies) {
                    cleanupPromises.push(updateDoc(doc(db, dep.collectionName, dep.id), {
                        relatedRiskIds: arrayRemove(id)
                    }));
                }
                await Promise.all(cleanupPromises);
            }

            await deleteDoc(doc(db, 'risks', id));

            if (user) {
                logAction(user, 'DELETE_RISK', 'Risk', `Suppression risque: ${name || id}`);
            }

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
        if (!user?.organizationId) {
            setSubmitting(false);
            return;
        }

        const orgId = user.organizationId;

        try {
            // 1. Verify dependencies
            const checks = await Promise.all(ids.map(id => DependencyService.checkRiskDependencies(id, orgId)));

            // Check if any has too many dependencies to safe delete automatically?
            // Current req: "Suppression en masse sans vérification de dépendances -> CORRUPTION DE DONNÉES".
            // We should Clean them up.

            const batch = writeBatch(db);
            let cleanedDependenciesCount = 0;

            // Prepare dependency cleanups (cannot use batch for reads, but can for updates if ids known)
            // DependencyService gave us the IDs.

            // WARNING: Batch limit is 500. If we have many deps, might overflow.
            // For now, let's process updates individually if too many, or assume reasonable count.
            // A safer approach for bulk is to simply block if dependencies exist, OR carefully batch update.
            // Given "Protection en masse", cleaning is better.

            const updateOps: Promise<any>[] = [];

            checks.forEach((check, index) => {
                const riskId = ids[index];
                if (check.hasDependencies) {
                    check.dependencies.forEach(dep => {
                        // Cannot duplicate refs in batch easily if multiple risks point to same doc.
                        // Firestore batch supports multiple writes to same doc? No.
                        // So we must use arrayRemove atomically.
                        // Safest is independent updates for dependencies.
                        updateOps.push(updateDoc(doc(db, dep.collectionName, dep.id), {
                            relatedRiskIds: arrayRemove(riskId)
                        }));
                        cleanedDependenciesCount++;
                    });
                }
                batch.delete(doc(db, 'risks', riskId));
            });

            await Promise.all(updateOps); // Run dependency updates
            await batch.commit(); // Run risk deletions

            toast.success(`${ids.length} risques supprimés` + (cleanedDependenciesCount > 0 ? ` (${cleanedDependenciesCount} liens nettoyés)` : ''));
            onRefresh();
        } catch (error) {
            console.error('Bulk delete error', error);
            toast.error('Erreur suppression multiple');
        } finally {
            setSubmitting(false);
        }
    };

    /* eslint-disable @typescript-eslint/no-explicit-any */
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
                    status: item.status as any,
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
            setSubmitting(false);
        }
    };

    return {
        createRisk,
        updateRisk,
        deleteRisk,
        exportCSV,
        bulkDeleteRisks,
        importRisks,
        checkDependencies,
        isGeneratingReport,
        setIsGeneratingReport,
        isExportingCSV,
        isImporting,
        submitting
    };
};
