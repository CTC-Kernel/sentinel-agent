import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().trim().email('Email invalide'),
    password: z.string().min(1, 'Mot de passe requis')
});

export const registerSchema = z.object({
    email: z.string().trim().email('Email invalide'),
    password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères')
});

export const resetPasswordSchema = z.object({
    email: z.string().trim().email('Email invalide')
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
