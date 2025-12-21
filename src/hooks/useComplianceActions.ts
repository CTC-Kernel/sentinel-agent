import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Control, UserProfile } from '../types';
import { logAction } from '../services/logger';
import { toast } from 'sonner';

export const useComplianceActions = (user: UserProfile | null) => {
    const [updating, setUpdating] = useState(false);

    const updateControl = async (controlId: string, updates: Partial<Control>, successMessage?: string) => {
        setUpdating(true);
        try {
            const ref = doc(db, 'controls', controlId);
            await updateDoc(ref, {
                ...updates,
                updatedAt: serverTimestamp(),
                lastUpdatedBy: user?.uid
            });
            if (successMessage) toast.success(successMessage);
            return true;
        } catch (error) {
            console.error("Update failed", error);
            toast.error("Erreur lors de la mise à jour");
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

    const handleLinkAsset = async (control: Control, assetId: string) => {
        const success = await updateControl(control.id, { relatedAssetIds: arrayUnion(assetId) as any }, "Actif lié");
        if (success) {
            logAction(user, 'LINK_ASSET', 'control', `Linked asset ${assetId}`, undefined, control.id);
        }
    };

    const handleUnlinkAsset = async (control: Control, assetId: string) => {
        await updateControl(control.id, { relatedAssetIds: arrayRemove(assetId) as any }, "Lien supprimé");
    };

    const handleLinkSupplier = async (control: Control, supplierId: string) => {
        await updateControl(control.id, { relatedSupplierIds: arrayUnion(supplierId) as any }, "Fournisseur lié");
    };

    const handleUnlinkSupplier = async (control: Control, supplierId: string) => {
        await updateControl(control.id, { relatedSupplierIds: arrayRemove(supplierId) as any }, "Lien supprimé");
    };

    const handleLinkProject = async (control: Control, projectId: string) => {
        const success = await updateControl(control.id, { relatedProjectIds: arrayUnion(projectId) as any }, "Projet lié");
        if (success) {
            logAction(user, 'LINK_PROJECT', 'control', `Linked project ${projectId}`, undefined, control.id);
        }
    };

    const handleUnlinkProject = async (control: Control, projectId: string) => {
        await updateControl(control.id, { relatedProjectIds: arrayRemove(projectId) as any }, "Lien supprimé");
    };

    const handleLinkDocument = async (control: Control, documentId: string) => {
        const success = await updateControl(control.id, { evidenceIds: arrayUnion(documentId) as any }, "Document lié");
        if (success) {
            logAction(user, 'LINK_DOCUMENT', 'control', `Linked document ${documentId}`, undefined, control.id);
        }
    };

    const handleUnlinkDocument = async (control: Control, documentId: string) => {
        await updateControl(control.id, { evidenceIds: arrayRemove(documentId) as any }, "Lien supprimé");
    };

    const updateJustification = async (control: Control, text: string) => {
        await updateControl(control.id, { justification: text }, "Justification enregistrée");
    };

    const createRisk = async (riskData: any) => {
        setUpdating(true);
        try {
            // Placeholder: Ideally import addDoc and collection at top
            const { addDoc, collection } = await import('firebase/firestore');
            const ref = await addDoc(collection(db, 'risks'), {
                ...riskData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: user?.uid
            });
            toast.success("Risque créé avec succès");
            logAction(user, 'CREATE_RISK', 'risk', `Created risk ${riskData.threat}`, undefined, ref.id);
            return ref.id;
        } catch (error) {
            console.error("Creation failed", error);
            toast.error("Erreur lors de la création du risque");
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
        createRisk,
        updateControl
    };
};
