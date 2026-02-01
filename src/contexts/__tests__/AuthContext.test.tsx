/**
 * AuthContext Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../AuthContext';
import { AuthContext } from '../AuthContextDefinition';

// Mock Firebase Auth
const mockOnIdTokenChanged = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithPopup = vi.fn();


vi.mock('firebase/auth', () => ({
    onIdTokenChanged: (...args: unknown[]) => mockOnIdTokenChanged(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
    OAuthProvider: vi.fn().mockImplementation(() => ({})),
    TotpMultiFactorGenerator: {
        generateSecret: vi.fn(),
        assertionForEnrollment: vi.fn(),
    },
    multiFactor: vi.fn(() => ({
        getSession: vi.fn(),
        enroll: vi.fn(),
        unenroll: vi.fn(),
        enrolledFactors: [],
    })),
}));

// Mock Firebase Firestore
const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    serverTimestamp: vi.fn(() => new Date()),
    enableNetwork: vi.fn(),
    disableNetwork: vi.fn(),
}));

// Mock Firebase Functions
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({})),
}));

// Mock Firebase instance
vi.mock('../../firebase', () => ({
    auth: {
        currentUser: null,
    },
    db: {},
    functions: {},
    isAppCheckFailed: false,
    onAppCheckRecovery: vi.fn(() => vi.fn()),
}));

// Mock store
const mockSetUser = vi.fn();
const mockSetOrganization = vi.fn();
const mockSetTheme = vi.fn();

vi.mock('../../store', () => ({
    useStore: Object.assign(
        vi.fn((selector?: (s: unknown) => unknown) => {
            const state = {
                user: null,
                setUser: mockSetUser,
                setOrganization: mockSetOrganization,
                setTheme: mockSetTheme,
            };
            return selector ? selector(state) : state;
        }),
        {
            getState: () => ({
                user: null,
            }),
        }
    ),
}));

// Mock services
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        handleErrorWithToast: vi.fn(),
    },
}));

vi.mock('../../services/accountService', () => ({
    AccountService: {
        updateProfile: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../services/e2eAuthService', () => ({
    E2EAuthService: {
        isE2EMode: vi.fn(() => false),
        validateE2EUser: vi.fn(() => false),
        getE2EUser: vi.fn(() => null),
        createMockOrganization: vi.fn(() => null),
        createMockFirebaseUser: vi.fn(() => null),
    },
}));

// Import useAuth from definition
const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: no user logged in
        mockOnIdTokenChanged.mockImplementation((_auth, callback) => {
            callback(null);
            return vi.fn(); // unsubscribe
        });

        mockSignOut.mockResolvedValue(undefined);
        mockSetDoc.mockResolvedValue(undefined);
        mockUpdateDoc.mockResolvedValue(undefined);
    });

    describe('useAuth hook', () => {
        it('should throw error when used outside provider', () => {
            expect(() => {
                renderHook(() => useAuth());
            }).toThrow('useAuth must be used within an AuthProvider');
        });

        it('should return initial state when no user', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.user).toBeNull();
            expect(result.current.firebaseUser).toBeNull();
            expect(result.current.isAdmin).toBe(false);
        });

        it('should have logout function available', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(typeof result.current.logout).toBe('function');
        });

        it('should have refreshSession function available', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(typeof result.current.refreshSession).toBe('function');
        });

        it('should have MFA functions available', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(typeof result.current.enrollMFA).toBe('function');
            expect(typeof result.current.verifyMFA).toBe('function');
            expect(typeof result.current.unenrollMFA).toBe('function');
        });

        it('should have loginWithSSO function available', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(typeof result.current.loginWithSSO).toBe('function');
        });
    });

    describe('logout', () => {
        it('should call Firebase signOut', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.logout();
            });

            expect(mockSignOut).toHaveBeenCalled();
        });

        it('should clear user state on logout', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.logout();
            });

            expect(mockSetUser).toHaveBeenCalledWith(null);
        });
    });

    describe('loginWithSSO', () => {
        it('should call signInWithPopup with provider', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.loginWithSSO('microsoft.com');
            });

            expect(mockSignInWithPopup).toHaveBeenCalled();
        });
    });

    describe('isBlocked state', () => {
        it('should have dismissBlockerError function', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(typeof result.current.dismissBlockerError).toBe('function');
        });

        it('should initially not be blocked', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isBlocked).toBe(false);
        });
    });

    describe('user authentication flow', () => {
        it('should set loading to true initially', () => {
            // Quick check during initial render
            let capturedLoading = false;

            mockOnIdTokenChanged.mockImplementation((_auth, callback) => {
                // Don't call callback immediately to check loading state
                setTimeout(() => callback(null), 100);
                return vi.fn();
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            // Loading should be true initially
            capturedLoading = result.current.loading;
            expect(capturedLoading).toBe(true);
        });

        it('should handle user login with profile', async () => {
            const mockUser = {
                uid: 'user-123',
                email: 'test@example.com',
                displayName: 'Test User',
                emailVerified: true,
            };

            mockOnIdTokenChanged.mockImplementation((_auth, callback) => {
                callback(mockUser);
                return vi.fn();
            });

            mockOnSnapshot.mockImplementation((_ref, callback) => {
                callback({
                    exists: () => true,
                    data: () => ({
                        uid: 'user-123',
                        email: 'test@example.com',
                        displayName: 'Test User',
                        role: 'admin',
                        organizationId: 'org-123',
                    }),
                });
                return vi.fn();
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(mockSetUser).toHaveBeenCalled();
        });

        it('should create profile if not exists', async () => {
            const mockUser = {
                uid: 'new-user-123',
                email: 'new@example.com',
                displayName: 'New User',
                emailVerified: false,
            };

            mockOnIdTokenChanged.mockImplementation((_auth, callback) => {
                callback(mockUser);
                return vi.fn();
            });

            mockOnSnapshot.mockImplementation((_ref, callback) => {
                callback({
                    exists: () => false,
                    data: () => null,
                });
                return vi.fn();
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // setDoc should be called to create the profile
            expect(mockSetDoc).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should have error state available', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.error).toBeNull();
        });

        it('should have profileError state available', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.profileError).toBeNull();
        });
    });

    describe('claimsSynced state', () => {
        it('should expose claimsSynced', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(typeof result.current.claimsSynced).toBe('boolean');
        });
    });
});
