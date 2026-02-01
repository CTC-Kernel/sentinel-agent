import { z } from 'zod';

const passwordValidation = z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Doit contenir une majuscule (ex. A, B, C)')
    .regex(/[0-9]/, 'Doit contenir un chiffre (ex. 1, 2, 3)')
    .regex(/[^A-Za-z0-9]/, 'Doit contenir un caractère spécial (ex. @, #, !)');

export const loginSchema = z.object({
    email: z.string().trim().email('Format d\'email invalide'),
    password: z.string().min(1, 'Le mot de passe est requis')
});

export const registerSchema = z.object({
    email: z.string().trim().email('Format d\'email invalide'),
    password: passwordValidation
});

export const resetPasswordSchema = z.object({
    email: z.string().trim().email('Format d\'email invalide')
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
