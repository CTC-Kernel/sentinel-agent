import { z } from 'zod';

export const riskSchema = z.object({
    assetId: z.string().min(1, "L'actif est requis"),
    threat: z.string().min(3, "La menace doit contenir au moins 3 caractères"),
    scenario: z.string().optional(),
    framework: z.enum(['ISO27001', 'ISO22301', 'ISO27005', 'NIS2', 'DORA', 'GDPR', 'SOC2', 'HDS', 'PCI_DSS', 'NIST_CSF', 'OWASP', 'EBIOS', 'COBIT', 'ITIL']).optional(),
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
    relatedProjectIds: z.array(z.string()).optional(),
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
    isSecureStorage: z.boolean().optional(),
    aiAnalysis: z.object({
        type: z.string(),
        response: z.record(z.string(), z.any()),
        timestamp: z.string()
    }).optional().nullable(),
}).refine((data) => {
    // Validate that Residual Risk is not higher than Inherent Risk (Gross)
    // Only check if residual values are present
    if (data.residualProbability && data.residualImpact) {
        const initialScore = data.probability * data.impact;
        const residualScore = data.residualProbability * data.residualImpact;
        return residualScore <= initialScore;
    }
    return true;
}, {
    message: "Le risque résiduel (cible) ne peut pas être supérieur au risque brut (inhérent). Vérifiez vos évaluations.",
    path: ["residualImpact"] // Show error on this field
});

export type RiskFormData = z.infer<typeof riskSchema>;
