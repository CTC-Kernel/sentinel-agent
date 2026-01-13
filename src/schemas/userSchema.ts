import { z } from 'zod';

export const userSchema = z.object({
    displayName: z.string().trim().max(100, "Le nom ne doit pas dépasser 100 caractères").optional(),
    email: z.string().trim().email("Email invalide").min(1, "L'email est requis"),
    role: z.enum(['user', 'rssi', 'auditor', 'project_manager', 'direction', 'admin', 'super_admin']).or(z.string()), // Allow custom role IDs
    department: z.string().trim().max(100, "Le département ne doit pas dépasser 100 caractères").optional()
});

export type UserFormData = z.infer<typeof userSchema>;
