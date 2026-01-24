import { z } from 'zod';

const passwordValidation = z
    .string()
    .min(8, '8 caractères minimum')
    .regex(/[A-Z]/, 'Ajoutez une majuscule (ex: A, B, C)')
    .regex(/[0-9]/, 'Ajoutez un chiffre (ex: 1, 2, 3)')
    .regex(/[^A-Za-z0-9]/, 'Ajoutez un caractère spécial (ex: @, #, !)');

export const loginSchema = z.object({
    email: z.string().trim().email('Format invalide (ex: nom@entreprise.com)'),
    password: z.string().min(1, 'Mot de passe requis')
});

export const registerSchema = z.object({
    email: z.string().trim().email('Format invalide (ex: nom@entreprise.com)'),
    password: passwordValidation
});

export const resetPasswordSchema = z.object({
    email: z.string().trim().email('Format invalide (ex: nom@entreprise.com)')
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
