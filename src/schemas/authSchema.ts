import { z } from 'zod';

const passwordValidation = z
    .string()
    .min(8, 'Le mot de passe doit faire au moins 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule requise')
    .regex(/[0-9]/, 'Au moins un chiffre requis')
    .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial requis');

export const loginSchema = z.object({
    email: z.string().trim().email('Email invalide'),
    password: z.string().min(1, 'Mot de passe requis')
});

export const registerSchema = z.object({
    email: z.string().trim().email('Email invalide'),
    password: passwordValidation
});

export const resetPasswordSchema = z.object({
    email: z.string().trim().email('Email invalide')
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
