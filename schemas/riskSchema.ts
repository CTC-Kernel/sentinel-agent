import { z } from 'zod';

export const riskSchema = z.object({
    assetId: z.string().min(1, "L'actif est requis"),
    threat: z.string().min(3, "La menace doit contenir au moins 3 caractères"),
    vulnerability: z.string().min(3, "La vulnérabilité doit contenir au moins 3 caractères"),
    probability: z.number().min(1).max(5),
    impact: z.number().min(1).max(5),
    residualProbability: z.number().optional(),
    residualImpact: z.number().optional(),
    residualScore: z.number().optional(),
    mitreTechniques: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string()
    })).optional(),
    strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']),
    status: z.enum(['Ouvert', 'En cours', 'Fermé']),
    owner: z.string().optional(),
    ownerId: z.string().optional(),
    mitigationControlIds: z.array(z.string()).optional(),
    affectedProcessIds: z.array(z.string()).optional(),
    relatedSupplierIds: z.array(z.string()).optional(),
    treatment: z.object({
        strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']).optional(),
        description: z.string().optional(),
        ownerId: z.string().optional(),
        dueDate: z.string().optional(),
        completedDate: z.string().optional(),
        status: z.enum(['Planifié', 'En cours', 'Terminé', 'Retard']).optional(),
        slaStatus: z.enum(['On Track', 'At Risk', 'Breached']).optional(),
        estimatedCost: z.number().optional()
    }).optional(),
    justification: z.string().optional(),
    isSecureStorage: z.boolean().optional()
});

export type RiskFormData = z.infer<typeof riskSchema>;
