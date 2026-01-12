/**
 * Validation Utils Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { validateField, validateForm, getValidationLabel, ValidationRule } from '../validationUtils';

describe('Validation Utils', () => {
    describe('validateField', () => {
        describe('required rule', () => {
            const rules: ValidationRule = { required: true };

            it('should return error for empty string', () => {
                expect(validateField('', rules)).toBe('Ce champ est requis');
            });

            it('should return error for whitespace only', () => {
                expect(validateField('   ', rules)).toBe('Ce champ est requis');
            });

            it('should return error for null', () => {
                expect(validateField(null, rules)).toBe('Ce champ est requis');
            });

            it('should return error for undefined', () => {
                expect(validateField(undefined, rules)).toBe('Ce champ est requis');
            });

            it('should pass for non-empty value', () => {
                expect(validateField('test', rules)).toBeUndefined();
            });
        });

        describe('optional fields', () => {
            it('should pass for empty non-required field', () => {
                const rules: ValidationRule = { minLength: 5 };
                expect(validateField('', rules)).toBeUndefined();
            });

            it('should pass for null non-required field', () => {
                const rules: ValidationRule = { pattern: /^[A-Z]+$/ };
                expect(validateField(null, rules)).toBeUndefined();
            });
        });

        describe('minLength rule', () => {
            const rules: ValidationRule = { minLength: 5 };

            it('should fail for short string', () => {
                expect(validateField('abc', rules)).toBe('Minimum 5 caractères requis');
            });

            it('should pass for exact length', () => {
                expect(validateField('abcde', rules)).toBeUndefined();
            });

            it('should pass for longer string', () => {
                expect(validateField('abcdefgh', rules)).toBeUndefined();
            });
        });

        describe('maxLength rule', () => {
            const rules: ValidationRule = { maxLength: 10 };

            it('should fail for long string', () => {
                expect(validateField('12345678901', rules)).toBe('Maximum 10 caractères autorisés');
            });

            it('should pass for exact length', () => {
                expect(validateField('1234567890', rules)).toBeUndefined();
            });

            it('should pass for shorter string', () => {
                expect(validateField('12345', rules)).toBeUndefined();
            });
        });

        describe('pattern rule', () => {
            const rules: ValidationRule = { pattern: /^[A-Z]{3}-\d{3}$/ };

            it('should fail for non-matching pattern', () => {
                expect(validateField('abc-123', rules)).toBe('Format invalide');
            });

            it('should pass for matching pattern', () => {
                expect(validateField('ABC-123', rules)).toBeUndefined();
            });
        });

        describe('email rule', () => {
            const rules: ValidationRule = { email: true };

            it('should fail for invalid email', () => {
                expect(validateField('not-an-email', rules)).toBe('Email invalide');
            });

            it('should fail for email without domain', () => {
                expect(validateField('test@', rules)).toBe('Email invalide');
            });

            it('should fail for email with spaces', () => {
                expect(validateField('test @test.com', rules)).toBe('Email invalide');
            });

            it('should pass for valid email', () => {
                expect(validateField('user@example.com', rules)).toBeUndefined();
            });

            it('should pass for email with subdomain', () => {
                expect(validateField('user@mail.example.com', rules)).toBeUndefined();
            });
        });

        describe('url rule', () => {
            const rules: ValidationRule = { url: true };

            it('should fail for invalid url', () => {
                expect(validateField('not-a-url', rules)).toBe('URL invalide');
            });

            it('should fail for ftp url', () => {
                expect(validateField('ftp://example.com', rules)).toBe('URL invalide');
            });

            it('should pass for http url', () => {
                expect(validateField('http://example.com', rules)).toBeUndefined();
            });

            it('should pass for https url', () => {
                expect(validateField('https://example.com', rules)).toBeUndefined();
            });

            it('should pass for url with path', () => {
                expect(validateField('https://example.com/path/to/page', rules)).toBeUndefined();
            });
        });

        describe('numeric min/max rules', () => {
            it('should fail when below min', () => {
                const rules: ValidationRule = { min: 10 };
                expect(validateField(5, rules)).toBe('Valeur minimum : 10');
            });

            it('should pass when at min', () => {
                const rules: ValidationRule = { min: 10 };
                expect(validateField(10, rules)).toBeUndefined();
            });

            it('should fail when above max', () => {
                const rules: ValidationRule = { max: 100 };
                expect(validateField(150, rules)).toBe('Valeur maximum : 100');
            });

            it('should pass when at max', () => {
                const rules: ValidationRule = { max: 100 };
                expect(validateField(100, rules)).toBeUndefined();
            });

            it('should pass within range', () => {
                const rules: ValidationRule = { min: 0, max: 10 };
                expect(validateField(5, rules)).toBeUndefined();
            });
        });

        describe('custom rule', () => {
            it('should fail when custom validator returns false', () => {
                const rules: ValidationRule = {
                    custom: (val) => val === 'specific'
                };
                expect(validateField('other', rules)).toBe('Valeur invalide');
            });

            it('should pass when custom validator returns true', () => {
                const rules: ValidationRule = {
                    custom: (val) => val === 'specific'
                };
                expect(validateField('specific', rules)).toBeUndefined();
            });
        });

        describe('custom messages', () => {
            it('should use custom message when provided', () => {
                const rules: ValidationRule = {
                    required: true,
                    message: 'Custom required message'
                };
                expect(validateField('', rules)).toBe('Custom required message');
            });
        });
    });

    describe('validateForm', () => {
        it('should return isValid true for valid form', () => {
            const data = { name: 'John', email: 'john@example.com' };
            const rules = {
                name: { required: true, minLength: 2 },
                email: { required: true, email: true }
            };

            const result = validateForm(data, rules);

            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual({});
        });

        it('should return isValid false for invalid form', () => {
            const data = { name: '', email: 'invalid' };
            const rules = {
                name: { required: true },
                email: { email: true }
            };

            const result = validateForm(data, rules);

            expect(result.isValid).toBe(false);
            expect(result.errors.name).toBe('Ce champ est requis');
            expect(result.errors.email).toBe('Email invalide');
        });

        it('should only include fields with errors', () => {
            const data = { name: 'John', email: 'invalid' };
            const rules = {
                name: { required: true },
                email: { email: true }
            };

            const result = validateForm(data, rules);

            expect(result.errors).not.toHaveProperty('name');
            expect(result.errors).toHaveProperty('email');
        });

        it('should handle empty rules', () => {
            const data = { name: 'John' };
            const rules = {};

            const result = validateForm(data, rules);

            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual({});
        });
    });

    describe('getValidationLabel', () => {
        it('should return French required label', () => {
            expect(getValidationLabel('fr', 'required')).toBe('Ce champ est requis');
        });

        it('should return French invalid label', () => {
            expect(getValidationLabel('fr', 'invalid')).toBe('Valeur invalide');
        });

        it('should return English required label', () => {
            expect(getValidationLabel('en', 'required')).toBe('This field is required');
        });

        it('should return English invalid label', () => {
            expect(getValidationLabel('en', 'invalid')).toBe('Invalid value');
        });
    });
});
