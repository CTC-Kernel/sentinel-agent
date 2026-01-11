import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Control, UserProfile, Framework } from '../types';
import { logAction } from '../services/logger';
import { toast } from '@/lib/toast';
import { controlSchema } from '../schemas/controlSchema';
import { z } from 'zod';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from '../services/errorLogger';

export const useComplianceActions = (user: UserProfile | null) => {
    const [updating, setUpdating] = useState(false);

    const updateControl = async (controlId: string, updates: Partial<Control>, successMessage?: string, skipValidation = false) => {
        setUpdating(true);
        try {
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const zodError = _error as any;
                if (zodError.errors && zodError.errors.length > 0) {
                    toast.error(zodError.errors[0].message);
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
        const success = await updateControl(control.id, { status: newStatus }, "Statut mis à jour");
        if (success) {
            logAction(user, 'UPDATE_CONTROL_STATUS', 'control', `Status changed to ${newStatus}`, undefined, control.id, undefined, [{ field: 'status', oldValue: control.status, newValue: newStatus }]);
        }
    };

    const handleAssign = async (control: Control, userId: string) => {
        const success = await updateControl(control.id, { assigneeId: userId }, "Responsable assigné");
        if (success) {
            logAction(user, 'ASSIGN_CONTROL', 'control', `Assigned to user ${userId}`, undefined, control.id);
        }
    };

    // Safe cast via unknown if needed, or rely on Firebase handling
    const handleLinkAsset = async (control: Control, assetId: string) => {
        const success = await updateControl(control.id, { relatedAssetIds: arrayUnion(assetId) as unknown as string[] }, "Actif lié", true);
        if (success) {
            logAction(user, 'LINK_ASSET', 'control', `Linked asset ${assetId}`, undefined, control.id);
        }
    };

    const handleUnlinkAsset = async (control: Control, assetId: string) => {
        await updateControl(control.id, { relatedAssetIds: arrayRemove(assetId) as unknown as string[] }, "Lien supprimé", true);
    };

    const handleLinkSupplier = async (control: Control, supplierId: string) => {
        await updateControl(control.id, { relatedSupplierIds: arrayUnion(supplierId) as unknown as string[] }, "Fournisseur lié", true);
    };

    const handleUnlinkSupplier = async (control: Control, supplierId: string) => {
        await updateControl(control.id, { relatedSupplierIds: arrayRemove(supplierId) as unknown as string[] }, "Lien supprimé", true);
    };

    const handleLinkProject = async (control: Control, projectId: string) => {
        const success = await updateControl(control.id, { relatedProjectIds: arrayUnion(projectId) as unknown as string[] }, "Projet lié", true);
        if (success) {
            logAction(user, 'LINK_PROJECT', 'control', `Linked project ${projectId}`, undefined, control.id);
        }
    };

    const handleUnlinkProject = async (control: Control, projectId: string) => {
        await updateControl(control.id, { relatedProjectIds: arrayRemove(projectId) as unknown as string[] }, "Lien supprimé", true);
    };

    const handleLinkDocument = async (control: Control, documentId: string) => {
        const success = await updateControl(control.id, { evidenceIds: arrayUnion(documentId) as unknown as string[] }, "Document lié", true);
        if (success) {
            logAction(user, 'LINK_DOCUMENT', 'control', `Linked document ${documentId}`, undefined, control.id);
        }
    };

    const handleUnlinkDocument = async (control: Control, documentId: string) => {
        await updateControl(control.id, { evidenceIds: arrayRemove(documentId) as unknown as string[] }, "Lien supprimé", true);
    };

    const updateJustification = async (control: Control, text: string) => {
        const success = await updateControl(control.id, { justification: text }, "Justification enregistrée");
        if (success) {
            logAction(user, 'UPDATE_JUSTIFICATION', 'control', 'Justification updated', undefined, control.id);
        }
    };

    const handleApplicabilityChange = async (control: Control, isApplicable: boolean) => {
        const newStatus = isApplicable ? 'Non commencé' : 'Non applicable';
        const newApplicability = isApplicable ? 'Applicable' : 'Non applicable';

        const success = await updateControl(control.id, {
            status: newStatus,
            applicability: newApplicability
        }, `Contrôle marqué comme ${newApplicability}`);

        if (success) {
            logAction(user, 'UPDATE_APPLICABILITY', 'control', `Applicability changed to ${newApplicability}`, undefined, control.id, undefined,
                [{ field: 'applicability', oldValue: control.applicability, newValue: newApplicability }]
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
        }, "Référentiel mappé", true);

        if (success) {
            logAction(user, 'MAP_FRAMEWORK', 'control', `Mapped framework ${frameworkId}`, undefined, control.id);
        }
    };

    const handleUnmapFramework = async (control: Control, frameworkId: Framework) => {
        const success = await updateControl(control.id, {
            mappedFrameworks: arrayRemove(frameworkId) as unknown as Framework[]
        }, "Mapping supprimé", true);

        if (success) {
            logAction(user, 'UNMAP_FRAMEWORK', 'control', `Unmapped framework ${frameworkId}`, undefined, control.id);
        }
    };

    const createRisk = async (riskData: Record<string, unknown>) => {
        setUpdating(true);
        try {
            // Placeholder: Ideally import addDoc and collection at top
            const { addDoc, collection } = await import('firebase/firestore');
            const ref = await addDoc(collection(db, 'risks'), sanitizeData({
                ...riskData,
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
            const { addDoc, collection } = await import('firebase/firestore');
            const ref = await addDoc(collection(db, 'audits'), sanitizeData({
                ...auditData,
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
