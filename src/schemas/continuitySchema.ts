import { z } from 'zod';

export const businessProcessSchema = z.object({
 name: z.string().trim().min(1, "Le nom est requis").max(100, "Le nom est trop long"),
 description: z.string().trim().min(1, "La description est requise").max(2000, "La description est trop longue"),
 owner: z.string().trim().min(1, "Le propriétaire est requis"),
 rto: z.string().trim().min(1, "Le RTO est requis").max(20),
 rpo: z.string().trim().min(1, "Le RPO est requis").max(20),
 priority: z.enum(['Critique', 'Élevée', 'Moyenne', 'Faible']),
 supportingAssetIds: z.array(z.string()).optional(),
 drpDocumentId: z.string().optional(),
 lastTestDate: z.string().optional(),
 relatedRiskIds: z.array(z.string()).optional(),
 supplierIds: z.array(z.string()).optional(),
 recoveryTasks: z.array(z.object({
 id: z.string(),
 title: z.string().trim().min(1, "Le titre est requis").max(100),
 description: z.string().trim().optional(),
 owner: z.string().trim().min(1, "Le propriétaire est requis"),
 duration: z.string().trim().min(1, "La durée est requise"),
 order: z.number()
 })).optional()
});

export type BusinessProcessFormData = z.infer<typeof businessProcessSchema>;

export const bcpDrillSchema = z.object({
 processId: z.string().min(1, "Le processus est requis"),
 date: z.string().min(1, "La date est requise"),
 type: z.enum(['Tabletop', 'Simulation', 'Bascule réelle', 'Full Scale', 'Call Tree']),
 result: z.enum(['Succès', 'Succès partiel', 'Échec']),
 notes: z.string().trim().optional(),
});

export type BcpDrillFormData = z.infer<typeof bcpDrillSchema>;

export const strategySchema = z.object({
 title: z.string().trim().min(1, 'Le titre est requis').max(100, 'Le titre est trop long'),
 type: z.enum(['Active-Active', 'Active-Passive', 'Cold Standby', 'Cloud DR', 'Backup Only']),
 rto: z.string().trim().min(1, 'Le RTO est requis').max(20, 'Le RTO est trop long'),
 rpo: z.string().trim().min(1, 'Le RPO est requis').max(20, 'Le RPO est trop long'),
 description: z.string().trim().optional(),
 linkedAssets: z.array(z.string()).optional()
});

export type StrategyFormData = z.infer<typeof strategySchema>;

export const warRoomMessageSchema = z.object({
 content: z.string().trim().min(1, "Le message ne peut pas être vide")
});

export type WarRoomMessageFormData = z.infer<typeof warRoomMessageSchema>;

export const recoveryPlanSchema = z.object({
 title: z.string().trim().min(1, "Le titre est requis").max(150),
 type: z.enum(['IT System', 'Business Process', 'Facility', 'Crisis Comm']),
 rto: z.string().trim().min(1, "Le RTO est requis"),
 rpo: z.string().trim().min(1, "Le RPO est requis"),
 description: z.string().trim().optional(),
 strategyId: z.string().optional(),
 linkedAssetIds: z.array(z.string()).optional(),
 triggers: z.array(z.string()).optional(),
 status: z.enum(['Draft', 'Active', 'Archived', 'Testing']).default('Draft'),
 ownerId: z.string().min(1, "Le propriétaire est requis"),
 steps: z.array(z.object({
 id: z.string(),
 title: z.string().min(1, "Le titre de l'étape est requis"),
 description: z.string().optional(),
 assignedRole: z.string().optional(),
 estimatedDuration: z.number().min(0).default(0),
 isCritical: z.boolean().default(false)
 })).optional()
});

export type RecoveryPlanFormData = z.infer<typeof recoveryPlanSchema>;
