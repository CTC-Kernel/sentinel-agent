/**
 * Unit tests for useAuthActions hook
 * Tests authentication actions (login, register, password reset, MFA)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock Firebase Auth
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignInWithRedirect = vi.fn();
const mockGetRedirectResult = vi.fn();
const mockGetMultiFactorResolver = vi.fn();
const mockSignOut = vi.fn();

vi.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
    createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
    signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
    signInWithRedirect: (...args: unknown[]) => mockSignInWithRedirect(...args),
    signInWithCredential: vi.fn(),
    getRedirectResult: () => mockGetRedirectResult(),
    GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
    OAuthProvider: vi.fn().mockImplementation(() => ({
        addScope: vi.fn()
    })),
    getMultiFactorResolver: (...args: unknown[]) => mockGetMultiFactorResolver(...args),
    TotpMultiFactorGenerator: {
        FACTOR_ID: 'totp',
        assertionForSignIn: vi.fn()
    }
}));

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args)
}));

// Mock Firebase instance
vi.mock('../../firebase', () => ({
    auth: {
        currentUser: { email: 'test@example.com', reload: vi.fn(), emailVerified: true },
        signOut: () => mockSignOut()
    },
    functions: {}
}));

// Mock store
const mockAddToast = vi.fn();
const mockT = vi.fn((key: string) => key);
vi.mock('../../store', () => ({
    useStore: () => ({
        addToast: mockAddToast,
        t: mockT
    })
}));

// Mock error logger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        handleErrorWithToast: vi.fn()
    }
}));

// Mock auth logger
vi.mock('../../services/logger', () => ({
    logAuthAuditEvent: vi.fn().mockResolvedValue(undefined)
}));

import { useAuthActions } from '../useAuthActions';

describe('useAuthActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRedirectResult.mockResolvedValue(null);
    });

    describe('initialization', () => {
        it('initializes with default state', () => {
            const { result } = renderHook(() => useAuthActions());

            expect(result.current.loading).toBe(false);
            expect(result.current.errorMsg).toBeNull();
            expect(result.current.showMfaModal).toBe(false);
            expect(result.current.mfaLoading).toBe(false);
            expect(result.current.mfaError).toBeNull();
        });

        it('provides all expected functions', () => {
            const { result } = renderHook(() => useAuthActions());

            expect(typeof result.current.handleEmailAuth).toBe('function');
            expect(typeof result.current.handleGoogleLogin).toBe('function');
            expect(typeof result.current.handleAppleLogin).toBe('function');
            expect(typeof result.current.handlePasswordReset).toBe('function');
            expect(typeof result.current.handleMfaVerification).toBe('function');
            expect(typeof result.current.checkEmailVerification).toBe('function');
            expect(typeof result.current.sendVerificationEmail).toBe('function');
            expect(typeof result.current.logout).toBe('function');
        });
    });

    describe('handleEmailAuth - Login', () => {
        it('successfully logs in with email and password', async () => {
            mockSignInWithEmailAndPassword.mockResolvedValue({ user: { email: 'test@example.com' } });

            const { result } = renderHook(() => useAuthActions());

            let success: boolean;
            await act(async () => {
                success = await result.current.handleEmailAuth(
                    { email: 'test@example.com', password: 'password123' },
                    true
                );
            });

            expect(success!).toBe(true);
            expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('auth.success', 'success');
        });

        it('handles invalid credentials error', async () => {
            mockSignInWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-credential' });

            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleEmailAuth(
                    { email: 'test@example.com', password: 'wrong' },
                    true
                );
            });

            expect(result.current.errorMsg).toBe('auth.errors.invalid');
        });

        it('sets loading state during authentication', async () => {
            let resolveFn: (value: unknown) => void;
            mockSignInWithEmailAndPassword.mockImplementation(() =>
                new Promise(resolve => {
                    resolveFn = resolve;
                })
            );

            const { result } = renderHook(() => useAuthActions());

            const authPromise = act(async () => {
                await result.current.handleEmailAuth(
                    { email: 'test@example.com', password: 'password' },
                    true
                );
            });

            // Wait for loading to complete
            resolveFn!({ user: {} });
            await authPromise;

            expect(result.current.loading).toBe(false);
        });
    });

    describe('handleEmailAuth - Register', () => {
        it('successfully registers a new user', async () => {
            mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: { email: 'new@example.com' } });

            const { result } = renderHook(() => useAuthActions());

            let success: boolean;
            await act(async () => {
                success = await result.current.handleEmailAuth(
                    { email: 'new@example.com', password: 'password123' },
                    false
                );
            });

            expect(success!).toBe(true);
            expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('auth.created', 'success');
        });

        it('handles email already in use error', async () => {
            mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });

            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleEmailAuth(
                    { email: 'existing@example.com', password: 'password' },
                    false
                );
            });

            expect(result.current.errorMsg).toBe('auth.errors.emailInUse');
        });

        it('handles weak password error', async () => {
            mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/weak-password' });

            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleEmailAuth(
                    { email: 'new@example.com', password: '123' },
                    false
                );
            });

            expect(result.current.errorMsg).toBe('auth.errors.weak');
        });
    });

    describe('handleGoogleLogin', () => {
        it('opens popup for Google login on web', async () => {
            mockSignInWithPopup.mockResolvedValue({ user: { email: 'google@example.com' } });

            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleGoogleLogin();
            });

            expect(mockSignInWithPopup).toHaveBeenCalled();
        });

        it('handles popup blocked error with redirect fallback', async () => {
            mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
            mockSignInWithRedirect.mockResolvedValue(undefined);

            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleGoogleLogin();
            });

            expect(mockAddToast).toHaveBeenCalledWith('auth.redirectingGoogle', 'info');
            expect(mockSignInWithRedirect).toHaveBeenCalled();
        });

        it('sets loading state during Google login', async () => {
            mockSignInWithPopup.mockResolvedValue({ user: {} });

            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleGoogleLogin();
            });

            expect(result.current.loading).toBe(false);
        });
    });

    describe('handleAppleLogin', () => {
        it('opens popup for Apple login on web', async () => {
            mockSignInWithPopup.mockResolvedValue({ user: { email: 'apple@example.com' } });

            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleAppleLogin();
            });

            expect(mockSignInWithPopup).toHaveBeenCalled();
        });
    });

    describe('handlePasswordReset', () => {
        it('sends password reset email', async () => {
            const mockCallable = vi.fn().mockResolvedValue({});
            mockHttpsCallable.mockReturnValue(mockCallable);

            const { result } = renderHook(() => useAuthActions());

            let success: boolean;
            await act(async () => {
                success = await result.current.handlePasswordReset({ email: 'test@example.com' });
            });

            expect(success!).toBe(true);
            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'requestPasswordReset');
            expect(mockAddToast).toHaveBeenCalledWith('auth.resetSent', 'success');
        });

        it('handles password reset error', async () => {
            const mockCallable = vi.fn().mockRejectedValue(new Error('Reset failed'));
            mockHttpsCallable.mockReturnValue(mockCallable);

            const { result } = renderHook(() => useAuthActions());

            let success: boolean;
            await act(async () => {
                success = await result.current.handlePasswordReset({ email: 'invalid@example.com' });
            });

            expect(success!).toBe(false);
        });
    });

    describe('handleMfaVerification', () => {
        it('does nothing without resolver', async () => {
            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleMfaVerification('123456');
            });

            expect(result.current.mfaLoading).toBe(false);
        });

        it('does nothing without code', async () => {
            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.handleMfaVerification('');
            });

            expect(result.current.mfaLoading).toBe(false);
        });
    });

    describe('checkEmailVerification', () => {
        it('returns true when email is verified', async () => {
            const { result } = renderHook(() => useAuthActions());

            let verified: boolean;
            await act(async () => {
                verified = await result.current.checkEmailVerification();
            });

            expect(verified!).toBe(true);
        });
    });

    describe('logout', () => {
        it('calls signOut and shows success toast', async () => {
            mockSignOut.mockResolvedValue(undefined);

            // Mock window.location
            const originalLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: { href: '' },
                writable: true,
                configurable: true
            });

            const { result } = renderHook(() => useAuthActions());

            await act(async () => {
                await result.current.logout();
            });

            expect(mockSignOut).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('auth.logoutSuccess', 'success');

            // Restore
            Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
        });
    });

    describe('setErrorMsg', () => {
        it('can clear error message', () => {
            const { result } = renderHook(() => useAuthActions());

            act(() => {
                result.current.setErrorMsg('Some error');
            });

            expect(result.current.errorMsg).toBe('Some error');

            act(() => {
                result.current.setErrorMsg(null);
            });

            expect(result.current.errorMsg).toBeNull();
        });
    });

    describe('MFA modal state', () => {
        it('can toggle MFA modal visibility', () => {
            const { result } = renderHook(() => useAuthActions());

            expect(result.current.showMfaModal).toBe(false);

            act(() => {
                result.current.setShowMfaModal(true);
            });

            expect(result.current.showMfaModal).toBe(true);

            act(() => {
                result.current.setShowMfaModal(false);
            });

            expect(result.current.showMfaModal).toBe(false);
        });
    });

    describe('redirect result handling', () => {
        it('handles successful redirect result', async () => {
            mockGetRedirectResult.mockResolvedValue({
                user: { email: 'redirect@example.com' }
            });

            // Mock window.location
            const originalLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: { hash: '' },
                writable: true,
                configurable: true
            });

            renderHook(() => useAuthActions());

            await waitFor(() => {
                expect(mockAddToast).toHaveBeenCalledWith('auth.success', 'success');
            });

            Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
        });
    });
});
