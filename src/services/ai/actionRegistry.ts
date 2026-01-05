
import { AssetService } from '../assetService';
import { UserProfile } from '../../types';
import { z } from 'zod';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAction } from '../logger';
import { canEditResource, canDeleteResource } from '../../utils/permissions';

export enum AIActionType {
    CREATE_ASSET = 'CREATE_ASSET',
    UPDATE_RISK = 'UPDATE_RISK',
    BULK_DELETE_ASSETS = 'BULK_DELETE_ASSETS',
}

export interface AIActionPayload {
    [key: string]: unknown;
}

export interface AIActionDefinition {
    type: AIActionType;
    label: string;
    description: string;
    schema: z.ZodSchema;
    requiredPermission: string; // Used for UI hints mainly, execute() does authoritative check
    execute: (payload: AIActionPayload, user: UserProfile) => Promise<string | void>;
}

// Schemas
const CreateAssetSchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(['Matériel', 'Logiciel', 'Données', 'Service', 'Humain']),
    criticality: z.enum(['Faible', 'Moyenne', 'Élevée', 'Critique']).optional().default('Moyenne'),
    description: z.string().optional()
});

const UpdateRiskSchema = z.object({
    id: z.string().min(1, "ID required"),
    status: z.enum(['Nouveau', 'Ouvert', 'Traité', 'Accepté', 'Transféré']).optional(),
    probability: z.number().min(1).max(5).optional(),
    impact: z.number().min(1).max(5).optional(),
    description: z.string().optional()
});

const BulkDeleteAssetsSchema = z.object({
    assetIds: z.array(z.string()).min(1, "At least one ID required")
});

export const ActionRegistry: Record<AIActionType, AIActionDefinition> = {
    [AIActionType.CREATE_ASSET]: {
        type: AIActionType.CREATE_ASSET,
        label: "Créer un Actif",
        description: "Crée un nouvel actif dans l'inventaire.",
        schema: CreateAssetSchema,
        requiredPermission: 'assets:write',
        execute: async (payload, user) => {
            const data = CreateAssetSchema.parse(payload);
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const assetData: any = {
                name: data.name,
                type: data.type,
                confidentiality: data.criticality,
                integrity: data.criticality,
                availability: data.criticality,
                owner: user.email || 'Admin',
                location: 'Siège',
                organizationId: user.organizationId,
                department: 'IT',
                status: 'En service'
            };

            await AssetService.create(assetData, user);
            return `L'actif **${data.name}** a été créé avec succès.`;
        }
    },
    [AIActionType.UPDATE_RISK]: {
        type: AIActionType.UPDATE_RISK,
        label: "Mettre à jour un Risque",
        description: "Modifie le statut, la probabilité ou l'impact d'un risque.",
        schema: UpdateRiskSchema,
        requiredPermission: 'risks:write',
        execute: async (payload, user) => {
            // Manual RBAC Check
            if (!canEditResource(user, 'Risk', undefined, user.organizationId)) {
                throw new Error("Permission refusée pour modifier les risques.");
            }

            const data = UpdateRiskSchema.parse(payload);
            const riskRef = doc(db, 'risks', data.id);

            const updates: any = {
                updatedAt: serverTimestamp()
            };
            if (data.status) updates.status = data.status;
            if (data.probability) updates.probability = data.probability;
            if (data.impact) updates.impact = data.impact;
            if (data.description) updates.description = data.description;

            await updateDoc(riskRef, updates);
            await logAction(user, 'UPDATE', 'Risk', `Mise à jour Risque via IA: ${data.id}`);

            return `Le risque a été mis à jour (Statut: ${data.status || 'Inchangé'}).`;
        }
    },
    [AIActionType.BULK_DELETE_ASSETS]: {
        type: AIActionType.BULK_DELETE_ASSETS,
        label: "Suppression Multiple (Actifs)",
        description: "Supprime définitivement plusieurs actifs sélectionnés.",
        schema: BulkDeleteAssetsSchema,
        requiredPermission: 'assets:delete',
        execute: async (payload, user) => {
            // Manual RBAC Check
            if (!canDeleteResource(user, 'Asset', undefined, user.organizationId)) {
                throw new Error("Permission refusée pour supprimer des actifs.");
            }

            const data = BulkDeleteAssetsSchema.parse(payload);
            await AssetService.bulkDelete(data.assetIds, user);

            return `${data.assetIds.length} actifs ont été supprimés.`;
        }
    }
};

export const AIActionExecutor = {
    validate: (type: AIActionType, payload: unknown) => {
        const action = ActionRegistry[type];
        if (!action) throw new Error(`Action ${type} not found`);
        return action.schema.parse(payload);
    },

    execute: async (type: AIActionType, payload: unknown, user: UserProfile) => {
        const action = ActionRegistry[type];
        if (!action) throw new Error(`Action ${type} not found`);
        return await action.execute(payload as AIActionPayload, user);
    }
};
