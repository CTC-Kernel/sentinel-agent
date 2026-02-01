import { z } from 'zod';

export const businessProcessSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
    description: z.string().trim().min(1, "Description is required").max(2000, "Description is too long"),
    owner: z.string().trim().min(1, "Owner is required"),
    rto: z.string().trim().min(1, "RTO is required").max(20),
    rpo: z.string().trim().min(1, "RPO is required").max(20),
    priority: z.enum(['Critique', 'Élevée', 'Moyenne', 'Faible']),
    supportingAssetIds: z.array(z.string()).optional(),
    drpDocumentId: z.string().optional(),
    lastTestDate: z.string().optional(),
    relatedRiskIds: z.array(z.string()).optional(),
    supplierIds: z.array(z.string()).optional(),
    recoveryTasks: z.array(z.object({
        id: z.string(),
        title: z.string().trim().min(1, "Title is required").max(100),
        description: z.string().trim().optional(),
        owner: z.string().trim().min(1, "Owner is required"),
        duration: z.string().trim().min(1, "Duration is required"),
        order: z.number()
    })).optional()
});

export type BusinessProcessFormData = z.infer<typeof businessProcessSchema>;

export const bcpDrillSchema = z.object({
    processId: z.string().min(1, "Process is required"),
    date: z.string().min(1, "Date is required"),
    type: z.enum(['Tabletop', 'Simulation', 'Bascule réelle', 'Full Scale', 'Call Tree']),
    result: z.enum(['Succès', 'Succès partiel', 'Échec']),
    notes: z.string().trim().optional(),
});

export type BcpDrillFormData = z.infer<typeof bcpDrillSchema>;

export const strategySchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(100, 'Title is too long'),
    type: z.enum(['Active-Active', 'Active-Passive', 'Cold Standby', 'Cloud DR', 'Backup Only']),
    rto: z.string().trim().min(1, 'RTO is required').max(20, 'RTO is too long'),
    rpo: z.string().trim().min(1, 'RPO is required').max(20, 'RPO is too long'),
    description: z.string().trim().optional(),
    linkedAssets: z.array(z.string()).optional()
});

export type StrategyFormData = z.infer<typeof strategySchema>;

export const warRoomMessageSchema = z.object({
    content: z.string().trim().min(1, "Message cannot be empty")
});

export type WarRoomMessageFormData = z.infer<typeof warRoomMessageSchema>;

export const recoveryPlanSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(150),
    type: z.enum(['IT System', 'Business Process', 'Facility', 'Crisis Comm']),
    rto: z.string().trim().min(1, "RTO is required"),
    rpo: z.string().trim().min(1, "RPO is required"),
    description: z.string().trim().optional(),
    strategyId: z.string().optional(),
    linkedAssetIds: z.array(z.string()).optional(),
    triggers: z.array(z.string()).optional(),
    status: z.enum(['Draft', 'Active', 'Archived', 'Testing']).default('Draft'),
    ownerId: z.string().min(1, "Owner is required"),
    steps: z.array(z.object({
        id: z.string(),
        title: z.string().min(1, "Step title is required"),
        description: z.string().optional(),
        assignedRole: z.string().optional(),
        estimatedDuration: z.number().min(0).default(0),
        isCritical: z.boolean().default(false)
    })).optional()
});

export type RecoveryPlanFormData = z.infer<typeof recoveryPlanSchema>;
