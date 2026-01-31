import { z } from 'zod';
import i18n from '../i18n';
import { RISK_STATUSES, TREATMENT_STATUSES } from '../types/risks';
import { FRAMEWORKS } from '../constants/frameworks';
import { RISK_ACCEPTANCE_THRESHOLD } from '../constants/RiskConstants';

export const riskSchema = z.object({
    assetId: z.string().optional(),
    threat: z.string().trim().min(3, i18n.t('validation.minLength', { min: 3 })).max(500, i18n.t('validation.maxLength', { max: 500 })),
    scenario: z.string().trim().max(5000, i18n.t('validation.maxLength', { max: 5000 })).optional(),
    framework: z.enum(FRAMEWORKS).optional(),
    vulnerability: z.string().trim().min(3, i18n.t('validation.minLength', { min: 3 })).max(500, i18n.t('validation.maxLength', { max: 500 })),
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
    status: z.enum(RISK_STATUSES),
    owner: z.string().optional(),
    ownerId: z.string().optional(),
    mitigationControlIds: z.array(z.string()).optional(),
    affectedProcessIds: z.array(z.string()).optional(),
    relatedSupplierIds: z.array(z.string()).optional(),
    relatedProjectIds: z.array(z.string()).optional(),

    // V2: SLA & Treatment (Root Level for indexing)
    treatmentDeadline: z.string().optional(),
    treatmentOwnerId: z.string().optional(),
    /** @deprecated Use treatment.status instead */
    treatmentStatus: z.enum(TREATMENT_STATUSES).optional(),

    treatment: z.object({
        strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']).optional(),
        description: z.string().trim().optional(),
        ownerId: z.string().optional(),
        dueDate: z.string().optional(),
        completedDate: z.string().optional(),
        status: z.enum(TREATMENT_STATUSES).optional(),
        slaStatus: z.enum(['On Track', 'At Risk', 'Breached']).optional(),
        estimatedCost: z.number().optional()
    }).optional(),
    justification: z.string().trim().optional(),
    isSecureStorage: z.boolean().optional(),
    aiAnalysis: z.object({
        type: z.string(),
        response: z.record(z.string(), z.unknown()),
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
    message: i18n.t('risks.validation_residual'),
    path: ["residualImpact"] // Show error on this field
}).refine((data) => {
    // Validate that Justification is present if Risk is Accepted and Criticality is High
    const score = data.probability * data.impact;
    if (data.strategy === 'Accepter' && score >= RISK_ACCEPTANCE_THRESHOLD) {
        return !!data.justification && data.justification.trim().length > 10;
    }
    return true;
}, {
    message: i18n.t('risks.validation_justification'),
    path: ["justification"]
});

export type RiskFormData = z.infer<typeof riskSchema>;
