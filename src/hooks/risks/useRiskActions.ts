import { useState } from 'react';
import { useStore } from '../../store';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { Risk } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from '@/lib/toast';
import { logAction } from '../../services/logger';
import { getDiff } from '../../utils/diffUtils';
import { ImportService } from '../../services/ImportService';
import { NotificationService } from '../../services/notificationService';
import { DependencyService } from '../../services/dependencyService';
import { riskSchema } from '../../schemas/riskSchema';
import { FunctionsService } from '../../services/FunctionsService';
import { sanitizeData } from '../../utils/dataSanitizer';
import { canEditResource } from '../../utils/permissions';
import { UserProfile } from '../../types';
import { createRiskDraftSchema, RISK_DRAFT_STATUS, RISK_PUBLISHED_STATUS } from '../../utils/riskDraftSchema';

export const useRiskActions = (onRefresh: () => void) => {
    const { t } = useStore();
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const createRisk = async (data: Partial<Risk>) => {
        if (!user?.organizationId) return false;
        if (!canEditResource(user as UserProfile, 'Risk')) {
            toast.error(t('common.accessDenied'));
            return false;
        }

        setSubmitting(true);
        try {
            // Validation Zod
            const validationResult = riskSchema.safeParse(data);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
                toast.error(errorMessage);
                ErrorLogger.warn('Risk validation failed', 'useRiskActions.createRisk', {
                    metadata: { issues: validationResult.error.issues }
                });
                return false;
            }

            const riskData = sanitizeData({
                ...data,
                organizationId: user.organizationId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
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
            toast.success(t('common.riskCreated'));
            onRefresh();
            if (user) {
                logAction(user, 'CREATE_RISK', 'Risk', 'Risque créé');
            }

            // Notify owner if different from creator
            if (riskData.owner && riskData.owner !== user.uid) {
                await NotificationService.notifyRiskAssigned(riskData as unknown as Risk, riskData.owner, user.displayName || user.email || 'Admin');
            }
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.createRisk', 'CREATE_FAILED');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    /**
     * Save a risk as draft with relaxed validation (only threat required).
     * Sets status to 'Brouillon' automatically.
     */
    const saveRiskAsDraft = async (data: Partial<Risk>) => {
        if (!user?.organizationId) return false;
        if (!canEditResource(user as UserProfile, 'Risk')) {
            toast.error(t('common.accessDenied'));
            return false;
        }

        setSubmitting(true);
        try {
            // Validation with draft schema (only threat required)
            const draftSchema = createRiskDraftSchema('fr');
            const validationResult = draftSchema.safeParse(data);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
                toast.error(errorMessage);
                ErrorLogger.warn('Risk draft validation failed', 'useRiskActions.saveRiskAsDraft', {
                    metadata: { issues: validationResult.error.issues }
                });
                return false;
            }

            const riskData = sanitizeData({
                ...data,
                organizationId: user.organizationId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: RISK_DRAFT_STATUS, // Always 'Brouillon' for drafts
                owner: user.uid,
                history: [{
                    date: new Date().toISOString(),
                    user: user.displayName || user.email,
                    action: 'Création du brouillon',
                    changes: 'Initialisation (brouillon)',
                    previousScore: 0,
                    newScore: 0,
                    changedBy: user.uid
                }]
            });

            const docRef = await addDoc(collection(db, 'risks'), riskData);
            toast.success(t('common.draftSaved') || 'Brouillon enregistré');
            onRefresh();
            if (user) {
                logAction(user, 'CREATE_RISK_DRAFT', 'Risk', 'Brouillon de risque créé');
            }
            return docRef.id;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.saveRiskAsDraft', 'CREATE_FAILED');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    /**
     * Update an existing draft risk.
     */
    const updateRiskDraft = async (id: string, data: Partial<Risk>) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return false;
        setSubmitting(true);
        try {
            // Validation with draft schema
            const draftSchema = createRiskDraftSchema('fr');
            const validationResult = draftSchema.safeParse(data);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
                toast.error(errorMessage);
                return false;
            }

            const riskRef = doc(db, 'risks', id);
            await updateDoc(riskRef, sanitizeData({
                ...data,
                status: RISK_DRAFT_STATUS,
                updatedAt: serverTimestamp()
            }));

            if (user) {
                logAction(user, 'UPDATE_RISK_DRAFT', 'Risk', 'Brouillon de risque mis à jour', undefined, id);
            }

            toast.success(t('common.draftSaved') || 'Brouillon enregistré');
            onRefresh();
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.updateRiskDraft', 'UPDATE_FAILED');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    /**
     * Publish a draft risk - converts from 'Brouillon' to 'Ouvert'.
     * Requires full validation to succeed.
     */
    const publishDraft = async (id: string, data: Partial<Risk>, currentRisk?: Risk) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return false;
        setSubmitting(true);
        try {
            // Full validation required for publishing
            const validationResult = riskSchema.safeParse(data);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
                toast.error(errorMessage);
                ErrorLogger.warn('Risk publish validation failed', 'useRiskActions.publishDraft', {
                    metadata: { issues: validationResult.error.issues }
                });
                return false;
            }

            const riskRef = doc(db, 'risks', id);
            await updateDoc(riskRef, sanitizeData({
                ...data,
                status: RISK_PUBLISHED_STATUS, // 'Ouvert'
                updatedAt: serverTimestamp()
            }));

            if (user) {
                const changes = currentRisk ? getDiff(data, currentRisk as unknown as Record<string, unknown>) : [];
                logAction(
                    user,
                    'PUBLISH_RISK',
                    'Risk',
                    'Risque publié (brouillon → ouvert)',
                    undefined,
                    id,
                    undefined,
                    changes
                );
            }

            toast.success(t('common.published') || 'Risque publié');
            onRefresh();

            // Notify owner if different from publisher
            if (data.ownerId && data.ownerId !== user?.uid) {
                await NotificationService.notifyRiskAssigned(data as unknown as Risk, data.ownerId, user?.displayName || user?.email || 'Admin');
            }
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.publishDraft', 'UPDATE_FAILED');
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const updateRisk = async (id: string, data: Partial<Risk>, currentRisk?: Risk) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return false;
        setSubmitting(true);
        try {
            // Validation Zod (Partial for updates)
            const validationResult = riskSchema.partial().safeParse(data);
            if (!validationResult.success) {
                const errorMessage = validationResult.error.issues[0]?.message || t('common.invalidData');
                toast.error(errorMessage);
                return false;
            }

            const riskRef = doc(db, 'risks', id);
            await updateDoc(riskRef, sanitizeData({
                ...data,
                updatedAt: serverTimestamp()
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

            toast.success(t('common.riskUpdated'));
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
            // Secure Deletion (Backend enforces integrity)
            await FunctionsService.deleteResource('risks', id);

            if (user) {
                logAction(user, 'DELETE_RISK', 'Risk', `Suppression risque: ${name || id}`);
            }

            toast.success(t('common.riskDeleted'));
            onRefresh();
            return true;
        } catch (error) {
            // FunctionsService already handles detailed error messages
            const err = error as Error;
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.deleteRisk', 'DELETE_FAILED');
            // If it's a precondition error (dependencies), the toast from ErrorLogger/Service should show it?
            // FunctionsService throws with message. ErrorLogger might swallow it if generic.
            // Let's rely on FunctionsService behaving correctly or ErrorLogger showing message.
            if (err.message.includes('Impossible de supprimer')) {
                toast.error(err.message);
            }
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

                    toast.success(t('common.exportSuccess'));
                    resolve();
                } else {
                    // PDF Not implemented yet
                    toast.info('Export PDF bientôt disponible');
                    resolve();
                }
            } catch (error) {
                ErrorLogger.handleErrorWithToast(error, 'useRiskActions.exportRisks', 'UNKNOWN_ERROR');
                toast.error(t('common.exportError'));
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

        try {
            let successCount = 0;
            let blockedCount = 0;
            const errors: string[] = [];

            // Process sequentially or semi-parallel to track individual results
            // We use Promise.all to attempt all, but catch individual errors
            await Promise.all(ids.map(async (id) => {
                try {
                    await FunctionsService.deleteResource('risks', id);
                    successCount++;
                } catch (error: unknown) {
                    blockedCount++;
                    const errWithMsg = error as { message?: string } | null;
                    if (errWithMsg?.message) errors.push(errWithMsg.message);
                }
            }));

            if (successCount > 0) {
                if (user) {
                    await logAction(user, 'DELETE_RISK', 'Risk', `Suppression multiple: ${successCount} risques`);
                }
                toast.success(t('common.risksDeleted', { count: successCount }) + (blockedCount > 0 ? ` (${blockedCount} bloqués)` : ''));
                onRefresh();
            }

            if (blockedCount > 0) {
                // Show first error as example
                const firstError = errors.length > 0 ? errors[0] : 'Dépendances existantes';
                toast.error(`Certains risques n'ont pas pu être supprimés (${blockedCount}). Exemple: ${firstError}`);
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.bulkDeleteRisks', 'DELETE_FAILED');
            toast.error(t('common.bulkDeleteError'));
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

            toast.success(t('common.importSuccess', { count: importedCount }));
            onRefresh();
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useRiskActions.importRisks', 'UNKNOWN_ERROR');
            toast.error(t('common.importError') || "Erreur critique lors de l'import");
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    return {
        createRisk,
        saveRiskAsDraft,
        updateRiskDraft,
        publishDraft,
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
