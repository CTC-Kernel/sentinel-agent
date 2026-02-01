import { z } from 'zod';
import { FINDING_TYPES, FINDING_SEVERITIES, FINDING_STATUSES } from '../types/audits';

export const findingSchema = z.object({
    description: z.string().min(10, "La description doit contenir au moins 10 caractères"),
    type: z.enum(FINDING_TYPES),
    severity: z.enum(FINDING_SEVERITIES),
    status: z.enum(FINDING_STATUSES),
    relatedControlId: z.string().optional(),
    evidenceIds: z.array(z.string()).optional(),
    ownerId: z.string().optional(),
    dueDate: z.string().optional(),
    recommendation: z.string().max(2000, "La recommandation ne doit pas dépasser 2000 caractères").optional()
});

export type FindingFormData = z.infer<typeof findingSchema>;
