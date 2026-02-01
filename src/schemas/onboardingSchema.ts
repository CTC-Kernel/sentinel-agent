import { z } from 'zod';

export const onboardingSchema = z.object({
    organizationName: z.string().trim().min(1, "Le nom de l'organisation est requis").max(100),
    displayName: z.string().trim().min(1, 'Le nom complet est requis').max(100),
    department: z.string().trim().min(1, 'Le département est requis').max(100),
    role: z.enum(['admin', 'rssi', 'direction', 'project_manager', 'auditor']),
    industry: z.string().trim().min(1, 'Le secteur d\'activité est requis')
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
