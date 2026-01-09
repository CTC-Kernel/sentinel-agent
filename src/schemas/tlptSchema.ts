import { z } from 'zod';

export const tlptSchema = z.object({
    name: z.string().min(1, 'Le nom de la campagne est requis'),
    scope: z.string().min(1, 'Le périmètre est requis'),
    methodology: z.enum(["TIBER-EU", "Red Team", "Purple Team", "Other"]),
    provider: z.string().min(1, 'Le prestataire est requis'),
    status: z.enum(["Planned", "In Progress", "Analysis", "Remediation", "Closed"]),
    startDate: z.date(),
    endDate: z.date().optional(),
    budget: z.number().optional(),
    notes: z.string().optional()
});

export type TlptFormData = z.infer<typeof tlptSchema>;
