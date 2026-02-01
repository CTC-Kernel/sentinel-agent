import { z } from 'zod';

export const onboardingSchema = z.object({
    organizationName: z.string().trim().min(1, "Organization name is required").max(100),
    displayName: z.string().trim().min(1, 'Full name is required').max(100),
    department: z.string().trim().min(1, 'Department is required').max(100),
    role: z.enum(['admin', 'rssi', 'direction', 'project_manager', 'auditor']),
    industry: z.string().trim().min(1, 'Industry is required')
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
