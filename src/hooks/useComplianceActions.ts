import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Control, UserProfile, Framework } from '../types';
import { AuditLogService } from '../services/auditLogService';
import { logAction } from '../services/logger';
import { getDiff } from '../utils/diffUtils';
import { toast } from '@/lib/toast';
import { controlSchema } from '../schemas/controlSchema';
import { z } from 'zod';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission } from '../utils/permissions';
import { useStore } from '../store';

export const useComplianceActions = (user: UserProfile | null) => {
    const { t } = useStore();
    const [updating, setUpdating] = useState(false);

    const updateControl = async (controlId: string, updates: Partial<Control>, successMessage?: string, skipValidation = false, controlOrganizationId?: string, oldData?: Control) => {
        setUpdating(true);
        try {
            // SECURITY: Check authorization - only admin/rssi can modify controls
            if (!hasPermission(user, 'Control', 'update')) {
                ErrorLogger.warn('Unauthorized control update attempt', 'useComplianceActions.updateControl', {
                    metadata: { attemptedBy: user?.uid, targetControl: controlId }
                });
                toast.error(t('compliance.noEditPermission') || "Vous n'avez pas les droits pour modifier ce contrôle");
                return false;
            }

            // SECURITY: IDOR protection - verify control belongs to user's organization
            // If controlOrganizationId is not provided, fetch it from Firestore
            let resolvedOrgId = controlOrganizationId;
            if (!resolvedOrgId) {
                const { getDoc } = await import('firebase/firestore');
                const controlDoc = await getDoc(doc(db, 'controls', controlId));
                resolvedOrgId = controlDoc.data()?.organizationId as string | undefined;
            }
            if (!resolvedOrgId || resolvedOrgId !== user?.organizationId) {
                ErrorLogger.warn('IDOR attempt: control update across organizations', 'useComplianceActions.updateControl', {
                    metadata: { attemptedBy: user?.uid, targetControl: controlId, targetOrg: resolvedOrgId, callerOrg: user?.organizationId }
                });
                toast.error(t('compliance.controlNotFound') || "Contrôle non trouvé");
                return false;
            }

            // Validate updates against schema (partial) - more permissive
            // Only validate if we have actual updates to validate AND we are not skipping validation
            if (!skipValidation && Object.keys(updates).length > 0) {
                const partialSchema = controlSchema.partial();
                const result = partialSchema.safeParse(updates);
                if (!result.success) {
                    // Log validation errors for debugging
                    ErrorLogger.warn('Control validation failed', 'useComplianceActions.updateControl', {
                        metadata: {
                            controlId,
                            updates,
                            errors: result.error.issues
                        }
                    });
                    // Return first validation error or generic message
                    const firstError = result.error.issues[0]?.message || t('errors.validationError') || "Erreur de validation";
                    toast.error(firstError);
                    return false;
                }
            }

            const ref = doc(db, 'controls', controlId);
            const sanitizedUpdates = sanitizeData({
                ...updates,
                updatedAt: serverTimestamp(),
                lastUpdatedBy: user?.uid
            });

            await updateDoc(ref, sanitizedUpdates);

            if (user) {
                const changes = oldData ? getDiff(updates as unknown as Record<string, unknown>, oldData as unknown as Record<string, unknown>) : [];
                logAction(
                    user,
                    'UPDATE_CONTROL',
                    'Control',
                    `Mise à jour contrôle: ${oldData?.name || controlId}`,
                    undefined,
                    controlId,
                    undefined,
                    changes.length > 0 ? changes : undefined
                );
            }

            if (successMessage) toast.success(successMessage);
            return true;
        } catch (_error) {
            if (_error instanceof z.ZodError) {
                const zodError = _error;
                if (zodError.issues && zodError.issues.length > 0) {
                    toast.error(zodError.issues[0].message);
                } else {
                    toast.error(t('errors.validationError') || "Erreur de validation");
                }
            } else {
                toast.error(t('errors.updateFailed') || "Erreur lors de la mise à jour");
                ErrorLogger.error(_error, 'useComplianceActions.updateControl', {
                    metadata: { controlId, updates }
                });
            }
            return false;
        } finally {
            setUpdating(false);
        }
    };

    const handleStatusChange = async (control: Control, newStatus: Control['status']) => {
        const statusMessages: Record<string, string> = {
            'Implémenté': t('compliance.statusUpdated.implemented', { defaultValue: 'Statut mis à jour. Prochaine étape : ajoutez des preuves.' }),
            'En revue': t('compliance.statusUpdated.review', { defaultValue: 'Statut mis à jour. Prochaine étape : vérifiez les risques liés.' }),
        };
        const message = statusMessages[newStatus] || t('compliance.statusUpdated.default', { defaultValue: 'Statut mis à jour' });
        const success = await updateControl(control.id, { status: newStatus }, message, false, control.organizationId);
        if (success && user) {
            const changes = getDiff({ status: newStatus }, { status: control.status });
            await logAction(
                user,
                'UPDATE_STATUS',
                'Control',
                `Statut contrôle [${control.name}]: ${control.status} -> ${newStatus}`,
                undefined,
                control.id,
                undefined,
                changes
            );
        }
    };

    const handleAssign = async (control: Control, userId: string) => {
        const success = await updateControl(control.id, { assigneeId: userId }, t('compliance.assigneeAssigned') || "Responsable assigné", false, control.organizationId);
        if (success && user) {
            const changes = getDiff({ assigneeId: userId }, { assigneeId: control.assigneeId });
            await logAction(
                user,
                'ASSIGN_CONTROL',
                'Control',
                `Responsable assigné pour [${control.name}]`,
                undefined,
                control.id,
                undefined,
                changes
            );
        }
    };

    // Safe cast via unknown if needed, or rely on Firebase handling
    const handleLinkAsset = async (control: Control, assetId: string) => {
        const newAssetIds = [...(control.relatedAssetIds || []), assetId];
        const success = await updateControl(control.id, { relatedAssetIds: arrayUnion(assetId) as unknown as string[] }, t('compliance.assetLinked') || "Actif lié", true, control.organizationId);
        if (success && user) {
            const changes = getDiff({ relatedAssetIds: newAssetIds }, { relatedAssetIds: control.relatedAssetIds || [] });
            await logAction(
                user,
                'LINK_ASSET',
                'Control',
                `Actif lié au contrôle [${control.name}]`,
                undefined,
                control.id,
                undefined,
                changes
            );
        }
    };

    const handleUnlinkAsset = async (control: Control, assetId: string) => {
        const success = await updateControl(control.id, { relatedAssetIds: arrayRemove(assetId) as unknown as string[] }, t('compliance.linkRemoved') || "Lien supprimé", true, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { relatedAssetIds: control.relatedAssetIds },
                { relatedAssetIds: control.relatedAssetIds?.filter(id => id !== assetId) },
                control.name
            );
        }
    };

    const handleLinkSupplier = async (control: Control, supplierId: string) => {
        const newSupplierIds = [...(control.relatedSupplierIds || []), supplierId];
        const success = await updateControl(control.id, { relatedSupplierIds: arrayUnion(supplierId) as unknown as string[] }, t('compliance.supplierLinked') || "Fournisseur lié", true, control.organizationId);
        if (success && user) {
            const changes = getDiff({ relatedSupplierIds: newSupplierIds }, { relatedSupplierIds: control.relatedSupplierIds || [] });
            await logAction(
                user,
                'LINK_SUPPLIER',
                'Control',
                `Fournisseur lié au contrôle [${control.name}]`,
                undefined,
                control.id,
                undefined,
                changes
            );
        }
    };

    const handleUnlinkSupplier = async (control: Control, supplierId: string) => {
        const success = await updateControl(control.id, { relatedSupplierIds: arrayRemove(supplierId) as unknown as string[] }, t('compliance.linkRemoved') || "Lien supprimé", true, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { relatedSupplierIds: control.relatedSupplierIds },
                { relatedSupplierIds: control.relatedSupplierIds?.filter(id => id !== supplierId) },
                control.name
            );
        }
    };

    const handleLinkProject = async (control: Control, projectId: string) => {
        const newProjectIds = [...(control.relatedProjectIds || []), projectId];
        const success = await updateControl(control.id, { relatedProjectIds: arrayUnion(projectId) as unknown as string[] }, t('compliance.projectLinked') || "Projet lié", true, control.organizationId);
        if (success && user) {
            await logAction(
                user,
                'LINK_PROJECT',
                'Control',
                `Projet lié au contrôle [${control.name}]`,
                undefined,
                control.id,
                undefined,
                getDiff({ relatedProjectIds: newProjectIds }, { relatedProjectIds: control.relatedProjectIds || [] })
            );
        }
    };

    const handleUnlinkProject = async (control: Control, projectId: string) => {
        const success = await updateControl(control.id, { relatedProjectIds: arrayRemove(projectId) as unknown as string[] }, t('compliance.linkRemoved') || "Lien supprimé", true, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { relatedProjectIds: control.relatedProjectIds },
                { relatedProjectIds: control.relatedProjectIds?.filter(id => id !== projectId) },
                control.name
            );
        }
    };

    const handleLinkDocument = async (control: Control, documentId: string) => {
        const newDocIds = [...(control.evidenceIds || []), documentId];
        const success = await updateControl(control.id, { evidenceIds: arrayUnion(documentId) as unknown as string[] }, t('compliance.documentLinked') || "Document lié", true, control.organizationId);
        if (success && user) {
            await logAction(
                user,
                'LINK_DOCUMENT',
                'Control',
                `Document lié au contrôle [${control.name}]`,
                undefined,
                control.id,
                undefined,
                getDiff({ evidenceIds: newDocIds }, { evidenceIds: control.evidenceIds || [] })
            );
        }
    };

    const handleUnlinkDocument = async (control: Control, documentId: string) => {
        const success = await updateControl(control.id, { evidenceIds: arrayRemove(documentId) as unknown as string[] }, t('compliance.linkRemoved') || "Lien supprimé", true, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { evidenceIds: control.evidenceIds },
                { evidenceIds: control.evidenceIds?.filter(id => id !== documentId) },
                control.name
            );
        }
    };

    const updateJustification = async (control: Control, text: string) => {
        const success = await updateControl(control.id, { justification: text }, t('compliance.justificationSaved') || "Justification enregistrée", false, control.organizationId);
        if (success && user) {
            const changes = getDiff({ justification: text }, { justification: control.justification || '' });
            await logAction(
                user,
                'UPDATE_JUSTIFICATION',
                'Control',
                `Justification modifiée pour [${control.name}]`,
                undefined,
                control.id,
                undefined,
                changes
            );
        }
    };

    const handleApplicabilityChange = async (control: Control, isApplicable: boolean) => {
        const newStatus = isApplicable ? 'Non commencé' : 'Non applicable';
        const newApplicability = isApplicable ? 'Applicable' : 'Non applicable';

        const success = await updateControl(control.id, {
            status: newStatus,
            applicability: newApplicability
        }, t('compliance.applicabilityChanged', { status: newApplicability }) || `Contrôle marqué comme ${newApplicability}`, false, control.organizationId);

        if (success && user) {
            const changes = getDiff({ status: newStatus, applicability: newApplicability }, { status: control.status, applicability: control.applicability });
            await logAction(
                user,
                'UPDATE_APPLICABILITY',
                'Control',
                `Applicabilité modifiée pour [${control.name}]: ${newApplicability}`,
                undefined,
                control.id,
                undefined,
                changes
            );
        }
    };

    // Cross-framework mapping handlers
    const handleMapFramework = async (control: Control, frameworkId: Framework) => {
        // Don't map if it's the primary framework or already mapped
        if (control.framework === frameworkId) {
            toast.info(t('compliance.frameworkAlreadyPrimary') || "Ce référentiel est déjà le référentiel principal");
            return;
        }
        if (control.mappedFrameworks?.includes(frameworkId)) {
            toast.info(t('compliance.frameworkAlreadyMapped') || "Ce référentiel est déjà mappé");
            return;
        }

        const newMappedFrameworks = [...(control.mappedFrameworks || []), frameworkId];
        const success = await updateControl(control.id, {
            mappedFrameworks: arrayUnion(frameworkId) as unknown as Framework[]
        }, t('compliance.frameworkMapped') || "Référentiel mappé", true, control.organizationId);

        if (success && user) {
            const changes = getDiff({ mappedFrameworks: newMappedFrameworks }, { mappedFrameworks: control.mappedFrameworks || [] });
            await logAction(
                user,
                'MAP_FRAMEWORK',
                'Control',
                `Référentiel [${frameworkId}] mappé au contrôle [${control.name}]`,
                undefined,
                control.id,
                undefined,
                changes
            );
        }
    };

    const handleUnmapFramework = async (control: Control, frameworkId: Framework) => {
        const success = await updateControl(control.id, {
            mappedFrameworks: arrayRemove(frameworkId) as unknown as Framework[]
        }, t('compliance.mappingRemoved') || "Mapping supprimé", true, control.organizationId);

        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { mappedFrameworks: control.mappedFrameworks },
                { mappedFrameworks: control.mappedFrameworks?.filter(f => f !== frameworkId) },
                control.name
            );
        }
    };

    const createRisk = async (riskData: Record<string, unknown>) => {
        setUpdating(true);
        try {
            // SECURITY: Check authorization
            if (!hasPermission(user, 'Risk', 'create')) {
                ErrorLogger.warn('Unauthorized risk creation attempt', 'useComplianceActions.createRisk', {
                    metadata: { attemptedBy: user?.uid }
                });
                toast.error(t('compliance.noCreateRiskPermission') || "Vous n'avez pas les droits pour créer un risque");
                return null;
            }

            // Placeholder: Ideally import addDoc and collection at top
            const { addDoc, collection } = await import('firebase/firestore');
            const ref = await addDoc(collection(db, 'risks'), sanitizeData({
                ...riskData,
                organizationId: user?.organizationId, // Ensure org isolation
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: user?.uid
            }));
            toast.success(t('compliance.riskCreated') || "Risque créé avec succès");
            logAction(user, 'CREATE_RISK', 'risk', `Created risk ${riskData.threat}`, undefined, ref.id);
            return ref.id;
        } catch (error) {
            ErrorLogger.error(error, 'useComplianceActions.createRisk');
            toast.error(t('errors.riskCreationFailed') || "Erreur lors de la création du risque");
            return null;
        } finally {
            setUpdating(false);
        }
    };

    const createAudit = async (auditData: Record<string, unknown>) => {
        setUpdating(true);
        try {
            // SECURITY: Check authorization
            if (!hasPermission(user, 'Audit', 'create')) {
                ErrorLogger.warn('Unauthorized audit creation attempt', 'useComplianceActions.createAudit', {
                    metadata: { attemptedBy: user?.uid }
                });
                toast.error(t('compliance.noCreateAuditPermission') || "Vous n'avez pas les droits pour créer un audit");
                return null;
            }

            const { addDoc, collection } = await import('firebase/firestore');
            const ref = await addDoc(collection(db, 'audits'), sanitizeData({
                ...auditData,
                organizationId: user?.organizationId, // Ensure org isolation
                status: 'Planifié',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: user?.uid
            }));
            toast.success(t('compliance.auditPlanned') || "Audit planifié avec succès");
            logAction(user, 'CREATE_AUDIT', 'audit', `Created audit ${auditData.name}`, undefined, ref.id);
            return ref.id;
        } catch (error) {
            ErrorLogger.error(error, 'useComplianceActions.createAudit');
            toast.error(t('errors.auditCreationFailed') || "Erreur lors de la création de l'audit");
            return null;
        } finally {
            setUpdating(false);
        }
    };

    return {
        updating,
        handleStatusChange,
        handleAssign,
        handleLinkAsset,
        handleUnlinkAsset,
        handleLinkSupplier,
        handleUnlinkSupplier,
        handleLinkProject,
        handleUnlinkProject,
        handleLinkDocument,
        handleUnlinkDocument,
        updateJustification,
        handleApplicabilityChange,
        handleMapFramework,
        handleUnmapFramework,
        createRisk,
        createAudit,
        updateControl
    };
};
