import { z } from 'zod';

export const treatmentActionSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
    description: z.string().trim().max(1000, 'Description is too long').optional(),
    ownerId: z.string().optional(),
    deadline: z.string().optional(),
    status: z.enum(['À faire', 'En cours', 'Terminé']).default('À faire')
});

export type TreatmentActionFormData = z.infer<typeof treatmentActionSchema>;
