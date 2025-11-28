import { z } from 'zod';

export const businessProcessSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    description: z.string().min(1, "La description est requise"),
    owner: z.string().min(1, "Le responsable est requis"),
    rto: z.string().min(1, "Le RTO est requis"),
    rpo: z.string().min(1, "Le RPO est requis"),
    priority: z.enum(['Critique', 'Élevée', 'Moyenne', 'Faible']),
    supportingAssetIds: z.array(z.string()).optional(),
    drpDocumentId: z.string().optional(),
    lastTestDate: z.string().optional(),
    relatedRiskIds: z.array(z.string()).optional(),
    supplierIds: z.array(z.string()).optional(),
    recoveryTasks: z.array(z.object({
        id: z.string(),
        title: z.string().min(1, "Le titre est requis"),
        description: z.string().optional(),
        owner: z.string().min(1, "Le responsable est requis"),
        duration: z.string().min(1, "La durée est requise"),
        order: z.number()
    })).optional()
});

export type BusinessProcessFormData = z.infer<typeof businessProcessSchema>;

export const bcpDrillSchema = z.object({
    processId: z.string().min(1, "Le processus est requis"),
    date: z.string().min(1, "La date est requise"),
    type: z.enum(['Tabletop', 'Simulation', 'Bascule réelle']),
    result: z.enum(['Succès', 'Succès partiel', 'Échec']),
    notes: z.string().optional(),
});

export type BcpDrillFormData = z.infer<typeof bcpDrillSchema>;
