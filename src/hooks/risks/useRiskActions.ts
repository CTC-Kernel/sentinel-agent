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
// Duplicate import removed
import { sanitizeData } from '../../utils/dataSanitizer';
import { canEditResource } from '../../utils/permissions';
import { UserProfile } from '../../types';

export const useRiskActions = (onRefresh: () => void) => {
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const createRisk = async (data: Partial<Risk>) => {
        if (!user?.organizationId) return false;
        if (!canEditResource(user as UserProfile, 'Risk')) {
            toast.error("Permission refusée");
            return false;
        }

        setSubmitting(true);
        try {
            // Validation Zod
            const validationResult = riskSchema.safeParse(data);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.issues[0]?.message || 'Données invalides';
                toast.error(errorMessage);
                ErrorLogger.warn('Risk validation failed', 'useRiskActions.createRisk', {
                    metadata: { issues: validationResult.error.issues }
                });
                return false;
            }

            const riskData = sanitizeData({
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
                    changes: 'Initialisation',
                    previousScore: 0,
                    newScore: 0,
                    changedBy: user.uid
                }]
            });

            await addDoc(collection(db, 'risks'), riskData);
            toast.success('Risque créé avec succès');
            onRefresh();
            if (user) {
                logAction(user, 'CREATE_RISK', 'Risk', 'Risque créé');
            }

            // Notify owner if different from creator
            if (riskData.owner && riskData.owner !== user.uid) {
                await NotificationService.notifyRiskAssigned(riskData as Risk, riskData.owner, user.displayName || user.email || 'Admin');
            }
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.createRisk', 'CREATE_FAILED');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const updateRisk = async (id: string, data: Partial<Risk>, currentRisk?: Risk) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return false;
        setSubmitting(true);
        try {
            const riskRef = doc(db, 'risks', id);
            await updateDoc(riskRef, sanitizeData({
                ...data,
                updatedAt: new Date().toISOString()
            }));

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
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.updateRisk', 'UPDATE_FAILED');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const checkDependencies = async (riskId: string) => {
        if (!user?.organizationId) return { hasDependencies: false, dependencies: [] };

        // Use the new service
        const result = await DependencyService.checkRiskDependencies(riskId, user.organizationId);

        return {
            hasDependencies: result.hasDependencies,
            dependencies: result.dependencies
        };
    };

    const deleteRisk = async (id: string, name?: string) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return false;
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
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.deleteRisk', 'DELETE_FAILED');
            toast.error('Erreur lors de la suppression');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const exportRisks = (risks: Risk[], format: 'csv' | 'pdf') => {
        return new Promise<void>((resolve, reject) => {
            try {
                if (format === 'csv') {
                    // Generate CSV content
                    const headers = ['ID', 'Menace/Nom', 'Scénario', 'Statut', 'Score', 'Probabilité', 'Impact', 'Propriétaire', 'Créé le'];
                    const rows = risks.map(r => [
                        r.id,
                        `"${r.threat.replace(/"/g, '""')}"`, // Escape quotes
                        `"${(r.scenario || '').replace(/"/g, '""')}"`,
                        r.status,
                        (r.probability * r.impact).toString(),
                        r.probability.toString(),
                        r.impact.toString(),
                        r.owner || '',
                        r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'
                    ]);

                    const csvContent = [
                        headers.join(','),
                        ...rows.map(r => r.join(','))
                    ].join('\n');

                    // Create download link
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `risks_export_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    toast.success('Export CSV téléchargé');
                    resolve();
                } else {
                    // PDF Not implemented yet
                    toast.info('Export PDF bientôt disponible');
                    resolve();
                }
            } catch (error) {
                ErrorLogger.handleErrorWithToast(error, 'useRiskActions.exportRisks', 'UNKNOWN_ERROR');
                toast.error("Erreur lors de l'export");
                reject(error);
            }
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
        if (!user?.organizationId || !canEditResource(user as UserProfile, 'Risk')) {
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

            const updateOps: Promise<void>[] = [];

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

            if (user) {
                await logAction(user, 'DELETE_RISK', 'Risk', `Suppression multiple: ${ids.length} risques`);
            }

            toast.success(`${ids.length} risques supprimés` + (cleanedDependenciesCount > 0 ? ` (${cleanedDependenciesCount} liens nettoyés)` : ''));
            onRefresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.bulkDeleteRisks', 'DELETE_FAILED');
            toast.error('Erreur suppression multiple');
        } finally {
            setSubmitting(false);
        }
    };


    const importRisks = async (csvContent: string) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return false;
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
                    framework: item.framework as Risk['framework'],
                    probability: Number(item.probability) as 1 | 2 | 3 | 4 | 5,
                    impact: Number(item.impact) as 1 | 2 | 3 | 4 | 5
                });
                importedCount++;
            }

            toast.success(`${importedCount} risques importés avec succès`);
            onRefresh();
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.importRisks', 'UNKNOWN_ERROR');
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
