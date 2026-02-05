import { z } from 'zod';

export const userSchema = z.object({
 displayName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(50, "Le nom ne doit pas dépasser 50 caractères").optional(),
 email: z.string().trim().email("Email invalide").min(5, "L'email est requis"),
 role: z.enum(['user', 'rssi', 'auditor', 'project_manager', 'direction', 'admin', 'super_admin']).or(z.string()),
 department: z.string().trim().max(50, "Le département ne doit pas dépasser 50 caractères").optional()
});

export type UserFormData = z.infer<typeof userSchema>;
