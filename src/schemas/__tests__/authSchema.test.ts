/**
 * Unit tests for authSchema.ts
 * Tests validation of authentication forms
 */

import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema, resetPasswordSchema } from '../authSchema';

describe('loginSchema', () => {
    const validLogin = {
        email: 'user@example.com',
        password: 'password123'
    };

    describe('required fields', () => {
        it('accepts valid login data', () => {
            const result = loginSchema.safeParse(validLogin);
            expect(result.success).toBe(true);
        });

        it('rejects missing email', () => {
            const { email: _email, ...data } = validLogin;
            const result = loginSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing password', () => {
            const { password: _password, ...data } = validLogin;
            const result = loginSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('email validation', () => {
        it('accepts valid email formats', () => {
            const emails = [
                'user@example.com',
                'user.name@example.com',
                'user+tag@example.co.uk',
                'user123@sub.domain.org'
            ];

            emails.forEach(email => {
                const result = loginSchema.safeParse({ ...validLogin, email });
                expect(result.success).toBe(true);
            });
        });

        it('rejects invalid email formats', () => {
            const invalidEmails = [
                'invalid',
                'invalid@',
                '@example.com',
                'invalid@.com',
                'invalid @example.com'
            ];

            invalidEmails.forEach(email => {
                const result = loginSchema.safeParse({ ...validLogin, email });
                expect(result.success).toBe(false);
            });
        });

        it('trims whitespace from email', () => {
            const result = loginSchema.safeParse({
                ...validLogin,
                email: '  user@example.com  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('user@example.com');
            }
        });
    });

    describe('password validation', () => {
        it('accepts any non-empty password', () => {
            const result = loginSchema.safeParse({
                ...validLogin,
                password: 'a'
            });
            expect(result.success).toBe(true);
        });

        it('rejects empty password', () => {
            const result = loginSchema.safeParse({
                ...validLogin,
                password: ''
            });
            expect(result.success).toBe(false);
        });
    });
});

describe('registerSchema', () => {
    // Password must be: 8+ chars, 1 uppercase, 1 digit, 1 special char
    const validRegister = {
        email: 'newuser@example.com',
        password: 'SecurePass123!'
    };

    describe('required fields', () => {
        it('accepts valid register data', () => {
            const result = registerSchema.safeParse(validRegister);
            expect(result.success).toBe(true);
        });

        it('rejects missing email', () => {
            const { email: _email, ...data } = validRegister;
            const result = registerSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing password', () => {
            const { password: _password, ...data } = validRegister;
            const result = registerSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('email validation', () => {
        it('accepts valid email', () => {
            const result = registerSchema.safeParse(validRegister);
            expect(result.success).toBe(true);
        });

        it('rejects invalid email', () => {
            const result = registerSchema.safeParse({
                ...validRegister,
                email: 'invalid-email'
            });
            expect(result.success).toBe(false);
        });

        it('trims whitespace from email', () => {
            const result = registerSchema.safeParse({
                ...validRegister,
                email: '  user@example.com  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('user@example.com');
            }
        });
    });

    describe('password validation', () => {
        it('accepts password meeting all requirements (8+ chars, uppercase, digit, special)', () => {
            const result = registerSchema.safeParse({
                ...validRegister,
                password: 'Abcdefg1!'
            });
            expect(result.success).toBe(true);
        });

        it('rejects password shorter than 8 characters', () => {
            const result = registerSchema.safeParse({
                ...validRegister,
                password: 'Abc1!xy'
            });
            expect(result.success).toBe(false);
        });

        it('rejects password without uppercase letter', () => {
            const result = registerSchema.safeParse({
                ...validRegister,
                password: 'abcdefg1!'
            });
            expect(result.success).toBe(false);
        });

        it('rejects password without digit', () => {
            const result = registerSchema.safeParse({
                ...validRegister,
                password: 'Abcdefgh!'
            });
            expect(result.success).toBe(false);
        });

        it('rejects password without special character', () => {
            const result = registerSchema.safeParse({
                ...validRegister,
                password: 'Abcdefg12'
            });
            expect(result.success).toBe(false);
        });

        it('accepts long passwords with all requirements', () => {
            const result = registerSchema.safeParse({
                ...validRegister,
                password: 'A' + 'a'.repeat(97) + '1!'
            });
            expect(result.success).toBe(true);
        });
    });
});

describe('resetPasswordSchema', () => {
    describe('email validation', () => {
        it('accepts valid email', () => {
            const result = resetPasswordSchema.safeParse({
                email: 'user@example.com'
            });
            expect(result.success).toBe(true);
        });

        it('rejects missing email', () => {
            const result = resetPasswordSchema.safeParse({});
            expect(result.success).toBe(false);
        });

        it('rejects invalid email', () => {
            const result = resetPasswordSchema.safeParse({
                email: 'invalid-email'
            });
            expect(result.success).toBe(false);
        });

        it('rejects empty email', () => {
            const result = resetPasswordSchema.safeParse({
                email: ''
            });
            expect(result.success).toBe(false);
        });

        it('trims whitespace from email', () => {
            const result = resetPasswordSchema.safeParse({
                email: '  user@example.com  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('user@example.com');
            }
        });
    });
});
