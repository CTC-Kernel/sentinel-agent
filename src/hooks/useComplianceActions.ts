import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Control, UserProfile, Framework } from '../types';
import { AuditLogService } from '../services/auditLogService';
import { logAction } from '../services/logger';
import { toast } from '@/lib/toast';
import { controlSchema } from '../schemas/controlSchema';
import { z } from 'zod';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission } from '../utils/permissions';

export const useComplianceActions = (user: UserProfile | null) => {
    const [updating, setUpdating] = useState(false);

    const updateControl = async (controlId: string, updates: Partial<Control>, successMessage?: string, skipValidation = false, controlOrganizationId?: string) => {
        setUpdating(true);
        try {
            // SECURITY: Check authorization - only admin/rssi can modify controls
            if (!hasPermission(user, 'Control', 'update')) {
                ErrorLogger.warn('Unauthorized control update attempt', 'useComplianceActions.updateControl', {
                    metadata: { attemptedBy: user?.uid, targetControl: controlId }
                });
                toast.error("Vous n'avez pas les droits pour modifier ce contrôle");
                return false;
            }

            // SECURITY: IDOR protection - verify control belongs to user's organization
            if (controlOrganizationId && controlOrganizationId !== user?.organizationId) {
                ErrorLogger.warn('IDOR attempt: control update across organizations', 'useComplianceActions.updateControl', {
                    metadata: { attemptedBy: user?.uid, targetControl: controlId, targetOrg: controlOrganizationId, callerOrg: user?.organizationId }
                });
                toast.error("Contrôle non trouvé");
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
                    const firstError = result.error.issues[0]?.message || "Erreur de validation";
                    toast.error(firstError);
                    return false;
                }
            }

            const ref = doc(db, 'controls', controlId);
            await updateDoc(ref, sanitizeData({
                ...updates,
                updatedAt: serverTimestamp(),
                lastUpdatedBy: user?.uid
            }));
            if (successMessage) toast.success(successMessage);
            return true;
        } catch (_error) {
            if (_error instanceof z.ZodError) {
                const zodError = _error;
                if (zodError.issues && zodError.issues.length > 0) {
                    toast.error(zodError.issues[0].message);
                } else {
                    toast.error("Erreur de validation");
                }
            } else {
                toast.error("Erreur lors de la mise à jour");
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
        const success = await updateControl(control.id, { status: newStatus }, "Statut mis à jour", false, control.organizationId);
        if (success && user) {
            await AuditLogService.logStatusChange(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                control.name,
                control.status,
                newStatus
            );
        }
    };

    const handleAssign = async (control: Control, userId: string) => {
        const success = await updateControl(control.id, { assigneeId: userId }, "Responsable assigné", false, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { assigneeId: control.assigneeId },
                { assigneeId: userId },
                control.name
            );
        }
    };

    // Safe cast via unknown if needed, or rely on Firebase handling
    const handleLinkAsset = async (control: Control, assetId: string) => {
        const success = await updateControl(control.id, { relatedAssetIds: arrayUnion(assetId) as unknown as string[] }, "Actif lié", true, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { relatedAssetIds: control.relatedAssetIds },
                { relatedAssetIds: [...(control.relatedAssetIds || []), assetId] },
                control.name
            );
        }
    };

    const handleUnlinkAsset = async (control: Control, assetId: string) => {
        const success = await updateControl(control.id, { relatedAssetIds: arrayRemove(assetId) as unknown as string[] }, "Lien supprimé", true, control.organizationId);
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
        const success = await updateControl(control.id, { relatedSupplierIds: arrayUnion(supplierId) as unknown as string[] }, "Fournisseur lié", true, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { relatedSupplierIds: control.relatedSupplierIds },
                { relatedSupplierIds: [...(control.relatedSupplierIds || []), supplierId] },
                control.name
            );
        }
    };

    const handleUnlinkSupplier = async (control: Control, supplierId: string) => {
        await updateControl(control.id, { relatedSupplierIds: arrayRemove(supplierId) as unknown as string[] }, "Lien supprimé", true, control.organizationId);
    };

    const handleLinkProject = async (control: Control, projectId: string) => {
        const success = await updateControl(control.id, { relatedProjectIds: arrayUnion(projectId) as unknown as string[] }, "Projet lié", true, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { relatedProjectIds: control.relatedProjectIds },
                { relatedProjectIds: [...(control.relatedProjectIds || []), projectId] },
                control.name
            );
        }
    };

    const handleUnlinkProject = async (control: Control, projectId: string) => {
        await updateControl(control.id, { relatedProjectIds: arrayRemove(projectId) as unknown as string[] }, "Lien supprimé", true, control.organizationId);
    };

    const handleLinkDocument = async (control: Control, documentId: string) => {
        const success = await updateControl(control.id, { evidenceIds: arrayUnion(documentId) as unknown as string[] }, "Document lié", true, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { evidenceIds: control.evidenceIds },
                { evidenceIds: [...(control.evidenceIds || []), documentId] },
                control.name
            );
        }
    };

    const handleUnlinkDocument = async (control: Control, documentId: string) => {
        await updateControl(control.id, { evidenceIds: arrayRemove(documentId) as unknown as string[] }, "Lien supprimé", true, control.organizationId);
    };

    const updateJustification = async (control: Control, text: string) => {
        const success = await updateControl(control.id, { justification: text }, "Justification enregistrée", false, control.organizationId);
        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { justification: control.justification },
                { justification: text },
                control.name
            );
        }
    };

    const handleApplicabilityChange = async (control: Control, isApplicable: boolean) => {
        const newStatus = isApplicable ? 'Non commencé' : 'Non applicable';
        const newApplicability = isApplicable ? 'Applicable' : 'Non applicable';

        const success = await updateControl(control.id, {
            status: newStatus,
            applicability: newApplicability
        }, `Contrôle marqué comme ${newApplicability}`, false, control.organizationId);

        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { status: control.status, applicability: control.applicability },
                { status: newStatus, applicability: newApplicability },
                control.name
            );
        }
    };

    // Cross-framework mapping handlers
    const handleMapFramework = async (control: Control, frameworkId: Framework) => {
        // Don't map if it's the primary framework or already mapped
        if (control.framework === frameworkId) {
            toast.info("Ce référentiel est déjà le référentiel principal");
            return;
        }
        if (control.mappedFrameworks?.includes(frameworkId)) {
            toast.info("Ce référentiel est déjà mappé");
            return;
        }

        const success = await updateControl(control.id, {
            mappedFrameworks: arrayUnion(frameworkId) as unknown as Framework[]
        }, "Référentiel mappé", true, control.organizationId);

        if (success && user) {
            await AuditLogService.logUpdate(
                user.organizationId || '',
                { id: user.uid, name: user.displayName || '', email: user.email || '' },
                'control',
                control.id,
                { mappedFrameworks: control.mappedFrameworks },
                { mappedFrameworks: [...(control.mappedFrameworks || []), frameworkId] },
                control.name
            );
        }
    };

    const handleUnmapFramework = async (control: Control, frameworkId: Framework) => {
        const success = await updateControl(control.id, {
            mappedFrameworks: arrayRemove(frameworkId) as unknown as Framework[]
        }, "Mapping supprimé", true, control.organizationId);

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
                toast.error("Vous n'avez pas les droits pour créer un risque");
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
            toast.success("Risque créé avec succès");
            logAction(user, 'CREATE_RISK', 'risk', `Created risk ${riskData.threat}`, undefined, ref.id);
            return ref.id;
        } catch {
            toast.error("Erreur lors de la création du risque");
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
                toast.error("Vous n'avez pas les droits pour créer un audit");
                return null;
            }

            const { addDoc, collection } = await import('firebase/firestore');
            const ref = await addDoc(collection(db, 'audits'), sanitizeData({
                ...auditData,
                organizationId: user?.organizationId, // Ensure org isolation
                status: 'Planned',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: user?.uid
            }));
            toast.success("Audit planifié avec succès");
            logAction(user, 'CREATE_AUDIT', 'audit', `Created audit ${auditData.name}`, undefined, ref.id);
            return ref.id;
        } catch {
            toast.error("Erreur lors de la création de l'audit");
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
