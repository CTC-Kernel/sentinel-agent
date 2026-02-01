import { z } from 'zod';

export const tlptSchema = z.object({
    name: z.string().trim().min(1, 'Campaign name is required').max(100, 'Name is too long'),
    scope: z.string().trim().min(1, 'Scope is required').max(500, 'Scope is too long'),
    methodology: z.enum(["TIBER-EU", "Red Team", "Purple Team", "Other"]),
    provider: z.string().trim().min(1, 'Provider is required').max(100, 'Provider name is too long'),
    status: z.enum(["Planned", "In Progress", "Analysis", "Remediation", "Closed"]),
    startDate: z.date(),
    endDate: z.date().optional(),
    budget: z.number().min(0).optional(),
    notes: z.string().trim().max(2000, 'Notes are too long').optional()
});

export type TlptFormData = z.infer<typeof tlptSchema>;
