import { z } from 'zod';

export const onboardingSchema = z.object({
    organizationName: z.string().min(1, "Le nom de l'organisation est requis"),
    displayName: z.string().min(1, 'Le nom complet est requis'),
    department: z.string().min(1, 'Le département est requis'),
    role: z.enum(['admin', 'rssi', 'direction', 'project_manager', 'auditor']),
    industry: z.string().min(1, 'Le secteur est requis')
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
