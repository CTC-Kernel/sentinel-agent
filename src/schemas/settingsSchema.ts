import { z } from 'zod';

export const profileSchema = z.object({
    displayName: z.string().min(1, 'Le nom d\'affichage est requis'),
    department: z.string().optional(),
    role: z.enum(['admin', 'rssi', 'direction', 'project_manager', 'auditor', 'user', 'super_admin']),
    shodanApiKey: z.string().optional(),
    hibpApiKey: z.string().optional(),
    safeBrowsingApiKey: z.string().optional(),
    notificationPreferences: z.object({
        risks: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() }),
        audits: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() }),
        tasks: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() }),
        system: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() })
    }).optional()
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export const passwordSchema = z.object({
    newPassword: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
    confirmPassword: z.string().min(6, 'La confirmation doit faire au moins 6 caractères')
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
});

export type PasswordFormData = z.infer<typeof passwordSchema>;

export const organizationSchema = z.object({
    orgName: z.string().min(1, 'Le nom de l\'organisation est requis'),
    address: z.string().optional(),
    vatNumber: z.string().optional(),
    contactEmail: z.string().email("Email invalide").optional().or(z.literal(''))
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;
