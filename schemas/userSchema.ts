import { z } from 'zod';

export const userSchema = z.object({
    displayName: z.string().optional(),
    email: z.string().email("Email invalide").min(1, "L'email est requis"),
    role: z.enum(['user', 'rssi', 'auditor', 'project_manager', 'direction', 'admin']),
    department: z.string().optional()
});

export type UserFormData = z.infer<typeof userSchema>;
