import { z } from 'zod';

export const tlptSchema = z.object({
    name: z.string().trim().min(1, 'Le nom de la campagne est requis').max(100, 'Le nom est trop long'),
    scope: z.string().trim().min(1, 'Le périmètre est requis').max(500, 'Le périmètre est trop long'),
    methodology: z.enum(["TIBER-EU", "Red Team", "Purple Team", "Other"]),
    provider: z.string().trim().min(1, 'Le prestataire est requis').max(100, 'Le nom du prestataire est trop long'),
    status: z.enum(["Planned", "In Progress", "Analysis", "Remediation", "Closed"]),
    startDate: z.date(),
    endDate: z.date().optional(),
    budget: z.number().min(0).optional(),
    notes: z.string().trim().max(2000, 'Les notes sont trop longues').optional()
});

export type TlptFormData = z.infer<typeof tlptSchema>;
