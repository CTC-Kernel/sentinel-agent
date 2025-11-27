import { z } from 'zod';

export const riskSchema = z.object({
    assetId: z.string().min(1, "L'actif est requis"),
    threat: z.string().min(3, "La menace doit contenir au moins 3 caractères"),
    vulnerability: z.string().min(3, "La vulnérabilité doit contenir au moins 3 caractères"),
    probability: z.number().min(1).max(5),
    impact: z.number().min(1).max(5),
    residualProbability: z.number().min(1).max(5).optional(),
    residualImpact: z.number().min(1).max(5).optional(),
    strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']),
    status: z.enum(['Ouvert', 'En cours', 'Fermé']),
    ownerId: z.string().optional(),
    mitigationControlIds: z.array(z.string()).optional(),
});

export type RiskFormData = z.infer<typeof riskSchema>;
