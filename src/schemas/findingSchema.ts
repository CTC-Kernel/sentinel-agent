import { z } from 'zod';
import { FINDING_TYPES, FINDING_SEVERITIES, FINDING_STATUSES } from '../types/audits';

export const findingSchema = z.object({
    description: z.string().min(10, "Description must be at least 10 characters"),
    type: z.enum(FINDING_TYPES),
    severity: z.enum(FINDING_SEVERITIES),
    status: z.enum(FINDING_STATUSES),
    relatedControlId: z.string().optional(),
    evidenceIds: z.array(z.string()).optional(),
    ownerId: z.string().optional(),
    dueDate: z.string().optional(),
    recommendation: z.string().max(2000, "Recommendation must not exceed 2000 characters").optional()
});

export type FindingFormData = z.infer<typeof findingSchema>;
