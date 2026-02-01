import { z } from 'zod';

export const userSchema = z.object({
    displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name must not exceed 50 characters").optional(),
    email: z.string().trim().email("Invalid email").min(5, "Email is required"),
    role: z.enum(['user', 'rssi', 'auditor', 'project_manager', 'direction', 'admin', 'super_admin']).or(z.string()),
    department: z.string().trim().max(50, "Department must not exceed 50 characters").optional()
});

export type UserFormData = z.infer<typeof userSchema>;
