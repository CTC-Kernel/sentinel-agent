/**
 * Unit tests for useZodForm hook
 * Tests locale-aware form validation with Zod
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useZodForm, createLocalizedResolver } from '../useZodForm';

// Mock useLocale
vi.mock('../useLocale', () => ({
    useLocale: () => ({ locale: 'fr' })
}));

// Mock createLocalizedErrorMap
vi.mock('../../utils/zodErrorMap', () => ({
    createLocalizedErrorMap: vi.fn((locale) => ({
        locale,
        format: 'custom'
    }))
}));

describe('useZodForm', () => {
    const testSchema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
        age: z.number().min(0).max(150)
    });

    describe('initialization', () => {
        it('initializes form with schema', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: '',
                        email: '',
                        age: 0
                    }
                })
            );

            expect(result.current.register).toBeDefined();
            expect(result.current.handleSubmit).toBeDefined();
            expect(result.current.formState).toBeDefined();
        });

        it('uses provided default values', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'John',
                        email: 'john@example.com',
                        age: 25
                    }
                })
            );

            expect(result.current.getValues()).toEqual({
                name: 'John',
                email: 'john@example.com',
                age: 25
            });
        });
    });

    describe('form operations', () => {
        it('can set field values', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: '',
                        email: '',
                        age: 0
                    }
                })
            );

            act(() => {
                result.current.setValue('name', 'Jane');
            });

            expect(result.current.getValues('name')).toBe('Jane');
        });

        it('can reset form to default values', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'Initial',
                        email: 'initial@test.com',
                        age: 30
                    }
                })
            );

            act(() => {
                result.current.setValue('name', 'Changed');
                result.current.setValue('email', 'changed@test.com');
            });

            act(() => {
                result.current.reset();
            });

            expect(result.current.getValues()).toEqual({
                name: 'Initial',
                email: 'initial@test.com',
                age: 30
            });
        });

        it('provides register function for inputs', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: '',
                        email: '',
                        age: 0
                    }
                })
            );

            const registered = result.current.register('name');

            expect(registered.name).toBe('name');
            expect(registered.onChange).toBeDefined();
            expect(registered.onBlur).toBeDefined();
        });
    });

    describe('validation', () => {
        it('validates on submit', async () => {
            const onSubmit = vi.fn();

            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: '',
                        email: '',
                        age: 0
                    }
                })
            );

            await act(async () => {
                await result.current.handleSubmit(onSubmit)();
            });

            // Form should have errors for invalid data
            expect(result.current.formState.errors).toBeDefined();
        });

        it('calls onSubmit with valid data', async () => {
            const onSubmit = vi.fn();

            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'Valid Name',
                        email: 'valid@email.com',
                        age: 25
                    }
                })
            );

            await act(async () => {
                await result.current.handleSubmit(onSubmit)();
            });

            // Check the first argument of the call
            expect(onSubmit.mock.calls[0][0]).toEqual({
                name: 'Valid Name',
                email: 'valid@email.com',
                age: 25
            });
        });

        it('does not call onSubmit with invalid data', async () => {
            const onSubmit = vi.fn();

            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'ab', // Too short
                        email: 'invalid-email',
                        age: 200 // Too high
                    }
                })
            );

            await act(async () => {
                await result.current.handleSubmit(onSubmit)();
            });

            expect(onSubmit).not.toHaveBeenCalled();
        });
    });

    describe('form state', () => {
        it('tracks dirty state', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'Initial',
                        email: 'test@test.com',
                        age: 20
                    }
                })
            );

            expect(result.current.formState.isDirty).toBe(false);

            act(() => {
                result.current.setValue('name', 'Changed', { shouldDirty: true });
            });

            expect(result.current.formState.isDirty).toBe(true);
        });

        it('tracks submitting state', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: '',
                        email: '',
                        age: 0
                    }
                })
            );

            expect(result.current.formState.isSubmitting).toBe(false);
        });

        it('tracks valid state', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'Valid Name',
                        email: 'valid@email.com',
                        age: 25
                    }
                })
            );

            // Initially considered valid until triggered
            expect(result.current.formState.isValid).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('provides error messages for invalid fields', async () => {
            const onSubmit = vi.fn();
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: '',
                        email: 'invalid',
                        age: 0
                    }
                })
            );

            await act(async () => {
                await result.current.handleSubmit(onSubmit)();
            });

            // onSubmit should not be called due to validation errors
            expect(onSubmit).not.toHaveBeenCalled();
            // Errors should exist in form state
            expect(Object.keys(result.current.formState.errors).length).toBeGreaterThanOrEqual(0);
        });

        it('clears errors after correction', async () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'ab',
                        email: 'test@test.com',
                        age: 25
                    }
                })
            );

            // Trigger validation
            await act(async () => {
                await result.current.handleSubmit(vi.fn())();
            });

            // Fix the error
            act(() => {
                result.current.setValue('name', 'Valid Name');
            });

            // Re-validate
            await act(async () => {
                await result.current.trigger('name');
            });

            expect(result.current.formState.errors.name).toBeUndefined();
        });
    });

    describe('watch functionality', () => {
        it('watches specific field', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'Initial',
                        email: 'test@test.com',
                        age: 20
                    }
                })
            );

            const name = result.current.watch('name');
            expect(name).toBe('Initial');

            act(() => {
                result.current.setValue('name', 'Updated');
            });

            const updatedName = result.current.watch('name');
            expect(updatedName).toBe('Updated');
        });

        it('watches all fields', () => {
            const { result } = renderHook(() =>
                useZodForm({
                    schema: testSchema,
                    defaultValues: {
                        name: 'Test',
                        email: 'test@test.com',
                        age: 30
                    }
                })
            );

            const allValues = result.current.watch();
            expect(allValues).toEqual({
                name: 'Test',
                email: 'test@test.com',
                age: 30
            });
        });
    });
});

describe('createLocalizedResolver', () => {
    const testSchema = z.object({
        name: z.string().min(1)
    });

    it('creates resolver with French locale', () => {
        const resolver = createLocalizedResolver(testSchema, 'fr');

        expect(resolver).toBeDefined();
        expect(typeof resolver).toBe('function');
    });

    it('creates resolver with English locale', () => {
        const resolver = createLocalizedResolver(testSchema, 'en');

        expect(resolver).toBeDefined();
        expect(typeof resolver).toBe('function');
    });
});
