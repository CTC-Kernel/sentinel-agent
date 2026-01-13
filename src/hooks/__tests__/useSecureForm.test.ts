/**
 * useSecureForm Hook Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSecureForm, useSecureFormWithZod, useSecureFileUpload } from '../useSecureForm';

// Mock dependencies
const mockAddToast = vi.fn();
const mockUser = { uid: 'user-123', email: 'test@example.com' };

vi.mock('../../store', () => ({
    useStore: vi.fn((selector) => {
        const state = {
            addToast: mockAddToast,
            user: mockUser,
        };
        return selector ? selector(state) : state;
    }),
}));

vi.mock('../../services/inputSanitizationService', () => ({
    InputSanitizer: {
        sanitizeString: vi.fn((str) => str?.trim() || ''),
        sanitizeObject: vi.fn((obj) => ({ ...obj })),
        sanitizeFilename: vi.fn((name) => name.replace(/[^a-zA-Z0-9.-]/g, '_')),
        detectSQLInjection: vi.fn(() => false),
        detectPathTraversal: vi.fn(() => false),
    },
}));

vi.mock('../../services/rateLimitService', () => ({
    RateLimiter: {
        checkLimit: vi.fn(() => true),
        getWaitTime: vi.fn(() => 5000),
    },
}));

vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

import { RateLimiter } from '../../services/rateLimitService';
import { InputSanitizer } from '../../services/inputSanitizationService';

describe('useSecureForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(RateLimiter.checkLimit).mockReturnValue(true);
    });

    it('should initialize with initial values', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: 'Test', email: 'test@example.com' },
                onSubmit: vi.fn(),
            })
        );

        expect(result.current.values).toEqual({ name: 'Test', email: 'test@example.com' });
        expect(result.current.errors).toEqual({});
        expect(result.current.touched).toEqual({});
        expect(result.current.isSubmitting).toBe(false);
        expect(result.current.isValid).toBe(true);
    });

    it('should handle change with sanitization', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: '' },
                onSubmit: vi.fn(),
            })
        );

        act(() => {
            result.current.handleChange('name')('New Value');
        });

        expect(result.current.values.name).toBe('New Value');
    });

    it('should handle blur and mark field as touched', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: '' },
                onSubmit: vi.fn(),
            })
        );

        act(() => {
            result.current.handleBlur('name')();
        });

        expect(result.current.touched.name).toBe(true);
    });

    it('should validate on blur when validate function provided', () => {
        const validate = vi.fn((values) => {
            const errors: Record<string, string> = {};
            if (!values.name) errors.name = 'Name required';
            return errors;
        });

        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: '' },
                onSubmit: vi.fn(),
                validate,
            })
        );

        act(() => {
            result.current.handleBlur('name')();
        });

        expect(validate).toHaveBeenCalled();
        expect(result.current.errors.name).toBe('Name required');
    });

    it('should setFieldValue with sanitization', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: '' },
                onSubmit: vi.fn(),
            })
        );

        act(() => {
            result.current.setFieldValue('name', 'Direct Value');
        });

        expect(result.current.values.name).toBe('Direct Value');
    });

    it('should setFieldError', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: '' },
                onSubmit: vi.fn(),
            })
        );

        act(() => {
            result.current.setFieldError('name', 'Custom error');
        });

        expect(result.current.errors.name).toBe('Custom error');
        expect(result.current.isValid).toBe(false);
    });

    it('should reset form to initial values', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: 'Initial' },
                onSubmit: vi.fn(),
            })
        );

        act(() => {
            result.current.handleChange('name')('Modified');
            result.current.setFieldError('name', 'Error');
        });

        expect(result.current.values.name).toBe('Modified');

        act(() => {
            result.current.resetForm();
        });

        expect(result.current.values.name).toBe('Initial');
        expect(result.current.errors).toEqual({});
        expect(result.current.touched).toEqual({});
    });

    it('should block submit when rate limited', async () => {
        vi.mocked(RateLimiter.checkLimit).mockReturnValue(false);
        vi.mocked(RateLimiter.getWaitTime).mockReturnValue(5000);

        const onSubmit = vi.fn();
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: 'Test' },
                onSubmit,
            })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(onSubmit).not.toHaveBeenCalled();
        expect(mockAddToast).toHaveBeenCalledWith(
            'Trop de requêtes. Veuillez patienter 5 secondes.',
            'error'
        );
    });

    it('should block submit when validation fails', async () => {
        const onSubmit = vi.fn();
        const validate = () => ({ name: 'Name required' });

        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: '' },
                onSubmit,
                validate,
            })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(onSubmit).not.toHaveBeenCalled();
        expect(result.current.errors.name).toBe('Name required');
        expect(mockAddToast).toHaveBeenCalledWith(
            'Veuillez corriger les erreurs du formulaire',
            'error'
        );
    });

    it('should submit successfully', async () => {
        const onSubmit = vi.fn();

        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: 'Test' },
                onSubmit,
            })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(onSubmit).toHaveBeenCalled();
        expect(result.current.isSubmitting).toBe(false);
    });

    it('should prevent default on form event', async () => {
        const onSubmit = vi.fn();
        const mockEvent = { preventDefault: vi.fn() };

        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: 'Test' },
                onSubmit,
            })
        );

        await act(async () => {
            await result.current.handleSubmit(mockEvent as unknown as React.FormEvent);
        });

        expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle submit error with onError callback', async () => {
        const submitError = new Error('Submit failed');
        const onSubmit = vi.fn().mockRejectedValue(submitError);
        const onError = vi.fn();

        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: 'Test' },
                onSubmit,
                onError,
            })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(onError).toHaveBeenCalledWith(submitError);
    });

    it('should show toast on submit error without onError', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));

        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: 'Test' },
                onSubmit,
            })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(mockAddToast).toHaveBeenCalledWith(
            'Une erreur est survenue lors de la soumission',
            'error'
        );
    });

    it('should detect SQL injection and log warning', async () => {
        const { ErrorLogger } = await import('../../services/errorLogger');
        vi.mocked(InputSanitizer.detectSQLInjection).mockReturnValue(true);

        const onSubmit = vi.fn();
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { query: "'; DROP TABLE users;--" },
                onSubmit,
            })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(ErrorLogger.warn).toHaveBeenCalledWith(
            'SQL injection attempt detected in form',
            'useSecureForm',
            expect.any(Object)
        );
    });

    it('should detect path traversal and log warning', async () => {
        const { ErrorLogger } = await import('../../services/errorLogger');
        vi.mocked(InputSanitizer.detectPathTraversal).mockReturnValue(true);

        const onSubmit = vi.fn();
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { path: '../../../etc/passwd' },
                onSubmit,
            })
        );

        await act(async () => {
            await result.current.handleSubmit();
        });

        expect(ErrorLogger.warn).toHaveBeenCalledWith(
            'Path traversal attempt detected in form',
            'useSecureForm',
            expect.any(Object)
        );
    });

    it('should clear field error when touched field changes', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { name: '' },
                onSubmit: vi.fn(),
            })
        );

        // Touch the field first
        act(() => {
            result.current.handleBlur('name')();
        });

        // Set an error
        act(() => {
            result.current.setFieldError('name', 'Error');
        });

        expect(result.current.errors.name).toBe('Error');

        // Change the field value
        act(() => {
            result.current.handleChange('name')('New value');
        });

        expect(result.current.errors.name).toBeUndefined();
    });

    it('should handle array values in sanitization', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { tags: [] as string[] },
                onSubmit: vi.fn(),
            })
        );

        act(() => {
            result.current.handleChange('tags')(['tag1', 'tag2']);
        });

        expect(result.current.values.tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle object values in sanitization', () => {
        const { result } = renderHook(() =>
            useSecureForm({
                initialValues: { metadata: {} as Record<string, unknown> },
                onSubmit: vi.fn(),
            })
        );

        act(() => {
            result.current.handleChange('metadata')({ key: 'value' });
        });

        expect(result.current.values.metadata).toEqual({ key: 'value' });
    });
});

describe('useSecureFormWithZod', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(RateLimiter.checkLimit).mockReturnValue(true);
    });

    it('should validate with Zod schema', () => {
        const mockSchema = {
            parse: vi.fn(),
            safeParse: vi.fn(() => ({
                success: false,
                error: {
                    errors: [
                        { path: ['email'], message: 'Invalid email' },
                    ],
                },
            })),
        };

        const { result } = renderHook(() =>
            useSecureFormWithZod({
                schema: mockSchema,
                initialValues: { email: 'invalid' },
                onSubmit: vi.fn(),
            })
        );

        // Trigger validation via blur
        act(() => {
            result.current.handleBlur('email')();
        });

        expect(mockSchema.safeParse).toHaveBeenCalled();
        expect(result.current.errors.email).toBe('Invalid email');
    });

    it('should return empty errors when Zod validation passes', () => {
        const mockSchema = {
            parse: vi.fn(),
            safeParse: vi.fn(() => ({
                success: true,
                data: { email: 'valid@example.com' },
            })),
        };

        const { result } = renderHook(() =>
            useSecureFormWithZod({
                schema: mockSchema,
                initialValues: { email: 'valid@example.com' },
                onSubmit: vi.fn(),
            })
        );

        act(() => {
            result.current.handleBlur('email')();
        });

        expect(result.current.errors).toEqual({});
    });

    it('should handle nested path in Zod errors on submit', async () => {
        const mockSchema = {
            parse: vi.fn(),
            safeParse: vi.fn(() => ({
                success: false,
                error: {
                    errors: [
                        { path: ['address', 'city'], message: 'City required' },
                    ],
                },
            })),
        };

        const onSubmit = vi.fn();
        const { result } = renderHook(() =>
            useSecureFormWithZod({
                schema: mockSchema,
                initialValues: { address: { city: '' } },
                onSubmit,
            })
        );

        // Submit triggers full validation which will set nested path errors
        await act(async () => {
            await result.current.handleSubmit();
        });

        // Validation was called
        expect(mockSchema.safeParse).toHaveBeenCalled();
        // Submit should be blocked due to validation errors
        expect(onSubmit).not.toHaveBeenCalled();
        // The error key should be 'address.city' (path joined with dots)
        expect(result.current.errors['address.city']).toBe('City required');
    });
});

describe('useSecureFileUpload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(RateLimiter.checkLimit).mockReturnValue(true);
    });

    it('should initialize with default state', () => {
        const { result } = renderHook(() =>
            useSecureFileUpload({
                onUpload: vi.fn(),
            })
        );

        expect(result.current.isUploading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(typeof result.current.handleUpload).toBe('function');
    });

    it('should reject file when rate limited', async () => {
        vi.mocked(RateLimiter.checkLimit).mockReturnValue(false);
        vi.mocked(RateLimiter.getWaitTime).mockReturnValue(10000);

        const onUpload = vi.fn();
        const { result } = renderHook(() =>
            useSecureFileUpload({ onUpload })
        );

        const file = new File(['content'], 'test.txt', { type: 'text/plain' });

        await act(async () => {
            await result.current.handleUpload(file);
        });

        expect(onUpload).not.toHaveBeenCalled();
        expect(result.current.error).toContain("Trop d'uploads");
    });

    it('should reject file exceeding max size', async () => {
        const onUpload = vi.fn();
        const { result } = renderHook(() =>
            useSecureFileUpload({
                onUpload,
                maxSize: 1024, // 1KB
            })
        );

        // Create a file larger than 1KB
        const largeContent = 'a'.repeat(2048);
        const file = new File([largeContent], 'large.txt', { type: 'text/plain' });

        await act(async () => {
            await result.current.handleUpload(file);
        });

        expect(onUpload).not.toHaveBeenCalled();
        expect(result.current.error).toContain('Fichier trop volumineux');
    });

    it('should reject file with disallowed type', async () => {
        const onUpload = vi.fn();
        const { result } = renderHook(() =>
            useSecureFileUpload({
                onUpload,
                allowedTypes: ['image/png', 'image/jpeg'],
            })
        );

        const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });

        await act(async () => {
            await result.current.handleUpload(file);
        });

        expect(onUpload).not.toHaveBeenCalled();
        expect(result.current.error).toContain('Type de fichier non autorisé');
    });

    it('should upload file successfully', async () => {
        const onUpload = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            useSecureFileUpload({ onUpload })
        );

        const file = new File(['content'], 'test.txt', { type: 'text/plain' });

        await act(async () => {
            await result.current.handleUpload(file);
        });

        expect(onUpload).toHaveBeenCalled();
        expect(result.current.error).toBeNull();
        expect(mockAddToast).toHaveBeenCalledWith('Fichier uploadé avec succès', 'success');
    });

    it('should sanitize filename before upload', async () => {
        const onUpload = vi.fn().mockResolvedValue(undefined);
        vi.mocked(InputSanitizer.sanitizeFilename).mockReturnValue('sanitized_file.txt');

        const { result } = renderHook(() =>
            useSecureFileUpload({ onUpload })
        );

        const file = new File(['content'], '../dangerous/file.txt', { type: 'text/plain' });

        await act(async () => {
            await result.current.handleUpload(file);
        });

        // Check that a sanitized file was passed to onUpload
        expect(onUpload).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'sanitized_file.txt' })
        );
    });

    it('should handle upload error', async () => {
        const onUpload = vi.fn().mockRejectedValue(new Error('Upload failed'));
        const { result } = renderHook(() =>
            useSecureFileUpload({ onUpload })
        );

        const file = new File(['content'], 'test.txt', { type: 'text/plain' });

        await act(async () => {
            await result.current.handleUpload(file);
        });

        expect(result.current.error).toContain("Erreur lors de l'upload");
        expect(result.current.isUploading).toBe(false);
    });

    it('should allow file when type is in allowed list', async () => {
        const onUpload = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            useSecureFileUpload({
                onUpload,
                allowedTypes: ['image/png'],
            })
        );

        const file = new File(['content'], 'image.png', { type: 'image/png' });

        await act(async () => {
            await result.current.handleUpload(file);
        });

        expect(onUpload).toHaveBeenCalled();
    });

    it('should allow any type when allowedTypes is empty', async () => {
        const onUpload = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            useSecureFileUpload({
                onUpload,
                allowedTypes: [],
            })
        );

        const file = new File(['content'], 'anything.xyz', { type: 'application/octet-stream' });

        await act(async () => {
            await result.current.handleUpload(file);
        });

        expect(onUpload).toHaveBeenCalled();
    });
});
