import { z } from 'zod';

export const findingSchema = z.object({
    description: z.string().min(10, "La description doit contenir au moins 10 caractères"),
    type: z.enum(['Majeure', 'Mineure', 'Opportunité', 'Observation']),
    status: z.enum(['Ouvert', 'Fermé']),
    relatedControlId: z.string().optional(),
    evidenceIds: z.array(z.string()).optional()
});

export type FindingFormData = z.infer<typeof findingSchema>;
