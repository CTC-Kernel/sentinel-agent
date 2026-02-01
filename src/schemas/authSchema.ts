import { z } from 'zod';

const passwordValidation = z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter (e.g. A, B, C)')
    .regex(/[0-9]/, 'Must include a digit (e.g. 1, 2, 3)')
    .regex(/[^A-Za-z0-9]/, 'Must include a special character (e.g. @, #, !)');

export const loginSchema = z.object({
    email: z.string().trim().email('Invalid email format'),
    password: z.string().min(1, 'Password is required')
});

export const registerSchema = z.object({
    email: z.string().trim().email('Invalid email format'),
    password: passwordValidation
});

export const resetPasswordSchema = z.object({
    email: z.string().trim().email('Invalid email format')
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
