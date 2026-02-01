import { z } from 'zod';

export const profileSchema = z.object({
    displayName: z.string().trim().min(1, 'Display name is required').max(100, 'Name is too long'),
    department: z.string().trim().max(100, 'Department is too long').optional(),
    role: z.enum(['admin', 'rssi', 'direction', 'project_manager', 'auditor', 'user', 'super_admin', 'certifier']),
    shodanApiKey: z.string().trim().optional(),
    hibpApiKey: z.string().trim().optional(),
    safeBrowsingApiKey: z.string().trim().optional(),
    notificationPreferences: z.object({
        risks: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() }),
        audits: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() }),
        tasks: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() }),
        system: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() })
    }).optional()
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export const passwordSchema = z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirmation must be at least 6 characters')
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export type PasswordFormData = z.infer<typeof passwordSchema>;

// LEI validation: 20 alphanumeric characters (ISO 17442)
const leiRegex = /^[A-Z0-9]{20}$/;
// ISO 3166-1 alpha-2 country codes for EU member states (DORA scope)
const euCountryCodes = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'] as const;

export const organizationSchema = z.object({
    orgName: z.string().trim().min(1, 'Organization name is required').max(100, 'Name is too long'),
    address: z.string().trim().optional(),
    vatNumber: z.string().trim().optional(),
    contactEmail: z.string().trim().email("Invalid email").optional().or(z.literal('')),
    // DORA Compliance fields (Article 3 - Entity identification)
    lei: z.string().trim()
        .regex(leiRegex, 'LEI must be exactly 20 alphanumeric characters (ISO 17442)')
        .optional()
        .or(z.literal('')),
    country: z.enum(euCountryCodes).optional(),
    aiSettings: z.object({
        enabled: z.boolean(),
        consentGiven: z.boolean(),
        dataSanitization: z.boolean()
    }).optional()
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;

export const aiSettingsSchema = z.object({
    geminiCredential: z.string().trim().optional()
});

export type AISettingsFormData = z.infer<typeof aiSettingsSchema>;
