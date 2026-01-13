/**
 * useTeamManagement Hook Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTeamManagement } from '../useTeamManagement';

// Mock dependencies
const mockAddToast = vi.fn();
const mockUser = {
    uid: 'user-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    organizationName: 'Test Org',
    displayName: 'Admin User',
    role: 'admin',
};

vi.mock('../../store', () => ({
    useStore: vi.fn(() => ({
        user: mockUser,
        addToast: mockAddToast,
        demoMode: false,
    })),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

// Mock Firebase
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetCountFromServer = vi.fn();
const mockHttpsCallable = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: () => mockAddDoc(),
    getDocs: () => mockGetDocs(),
    deleteDoc: () => mockDeleteDoc(),
    updateDoc: () => mockUpdateDoc(),
    doc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    serverTimestamp: vi.fn(() => new Date()),
    getCountFromServer: () => mockGetCountFromServer(),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: () => mockHttpsCallable,
}));

vi.mock('../../firebase', () => ({
    db: {},
    functions: {},
}));

vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        handleErrorWithToast: vi.fn(),
    },
}));

vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data),
}));

vi.mock('../../services/emailService', () => ({
    sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/emailTemplates', () => ({
    getInvitationTemplate: vi.fn(() => '<html>Invitation</html>'),
}));

vi.mock('../../services/logger', () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/subscriptionService', () => ({
    SubscriptionService: {
        checkLimit: vi.fn().mockResolvedValue(true),
    },
}));

vi.mock('../../services/ImportService', () => ({
    ImportService: {
        parseCSV: vi.fn(() => []),
    },
}));

import { useStore } from '../../store';
import { SubscriptionService } from '../../services/subscriptionService';
import { ImportService } from '../../services/ImportService';

describe('useTeamManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock responses
        mockGetDocs.mockResolvedValue({
            docs: [],
        });

        mockGetCountFromServer.mockResolvedValue({
            data: () => ({ count: 0 }),
        });

        mockAddDoc.mockResolvedValue({ id: 'new-doc-id' });
        mockDeleteDoc.mockResolvedValue(undefined);
        mockUpdateDoc.mockResolvedValue(undefined);
    });

    describe('initialization', () => {
        it('should initialize with empty users list', async () => {
            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.users).toEqual([]);
            expect(result.current.joinRequests).toEqual([]);
        });

        it('should fetch users on mount', async () => {
            mockGetDocs.mockResolvedValue({
                docs: [
                    {
                        id: 'user-1',
                        data: () => ({
                            email: 'user1@example.com',
                            displayName: 'User 1',
                            role: 'user',
                            organizationId: 'org-123',
                        }),
                    },
                ],
            });

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(mockGetDocs).toHaveBeenCalled();
        });

        it('should not fetch when no organizationId', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { uid: 'user-123' }, // No organizationId
                addToast: mockAddToast,
                demoMode: false,
            } as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useTeamManagement());

            // Should not have called getDocs for users query
            expect(result.current.users).toEqual([]);
        });
    });

    describe('inviteUser', () => {
        beforeEach(() => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: false,
            } as unknown as ReturnType<typeof useStore>);
        });

        it('should invite a user successfully', async () => {
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.inviteUser({
                    email: 'newuser@example.com',
                    displayName: 'New User',
                    role: 'user',
                    department: 'IT',
                });
                expect(success).toBe(true);
            });

            expect(mockAddDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Invitation envoyée par email', 'success');
        });

        it('should return LIMIT_REACHED when at user limit', async () => {
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(false);

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.inviteUser({
                    email: 'newuser@example.com',
                    displayName: 'New User',
                    role: 'user',
                    department: 'IT',
                });
                expect(success).toBe('LIMIT_REACHED');
            });
        });

        it('should return false when no organizationId', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { uid: 'user-123' }, // No organizationId
                addToast: mockAddToast,
                demoMode: false,
            } as unknown as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useTeamManagement());

            await act(async () => {
                const success = await result.current.inviteUser({
                    email: 'test@example.com',
                    displayName: 'Test',
                    role: 'user',
                    department: '',
                });
                expect(success).toBe(false);
            });
        });

        it('should handle invite error', async () => {
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);
            mockAddDoc.mockRejectedValue(new Error('Database error'));

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.inviteUser({
                    email: 'newuser@example.com',
                    displayName: 'New User',
                    role: 'user',
                    department: 'IT',
                });
                expect(success).toBe(false);
            });

            expect(mockAddToast).toHaveBeenCalledWith('Erreur invitation', 'error');
        });
    });

    describe('updateUser', () => {
        beforeEach(() => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: false,
            } as unknown as ReturnType<typeof useStore>);
        });

        it('should update user successfully', async () => {
            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.updateUser(
                    'user-1',
                    { role: 'admin', displayName: 'Updated Name' },
                    false
                );
                expect(success).toBe(true);
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Utilisateur mis à jour', 'success');
        });

        it('should not update pending users', async () => {
            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.updateUser(
                    'pending-1',
                    { role: 'admin' },
                    true // isPending
                );
                expect(success).toBeUndefined();
            });

            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        it('should handle update error', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.updateUser(
                    'user-1',
                    { role: 'admin' },
                    false
                );
                expect(success).toBe(false);
            });

            expect(mockAddToast).toHaveBeenCalledWith('Erreur mise à jour', 'error');
        });
    });

    describe('deleteUser', () => {
        beforeEach(() => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: false,
            } as unknown as ReturnType<typeof useStore>);
        });

        it('should delete active user', async () => {
            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.deleteUser({
                    uid: 'user-1',
                    email: 'user@example.com',
                    isPending: false,
                } as never);
                expect(success).toBe(true);
            });

            expect(mockDeleteDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Utilisateur supprimé', 'info');
        });

        it('should delete pending invitation', async () => {
            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.deleteUser({
                    uid: 'invite-1',
                    email: 'invite@example.com',
                    isPending: true,
                } as never);
                expect(success).toBe(true);
            });

            expect(mockDeleteDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Invitation annulée', 'info');
        });

        it('should handle delete error', async () => {
            mockDeleteDoc.mockRejectedValue(new Error('Delete failed'));

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.deleteUser({
                    uid: 'user-1',
                    email: 'user@example.com',
                    isPending: false,
                } as never);
                expect(success).toBe(false);
            });

            expect(mockAddToast).toHaveBeenCalledWith('Erreur suppression', 'error');
        });
    });

    describe('checkDependencies', () => {
        beforeEach(() => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: false,
            } as unknown as ReturnType<typeof useStore>);
        });

        it('should return empty array when no dependencies', async () => {
            mockGetDocs.mockResolvedValue({ empty: true, docs: [], size: 0 });

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const deps = await result.current.checkDependencies('user-1');
                expect(deps).toEqual([]);
            });
        });

        it('should return dependencies list when user has resources', async () => {
            // First set up for initial fetch (returns empty)
            mockGetDocs.mockResolvedValue({ docs: [], empty: true, size: 0 });

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Now set up mocks for checkDependencies calls
            mockGetDocs
                .mockResolvedValueOnce({ empty: false, size: 3, docs: [{}, {}, {}] }) // assets
                .mockResolvedValueOnce({ empty: false, size: 2, docs: [{}, {}] }) // risks
                .mockResolvedValueOnce({ empty: true, size: 0, docs: [] }); // documents

            await act(async () => {
                const deps = await result.current.checkDependencies('user-1');
                expect(deps.length).toBeGreaterThan(0);
                // Check that we got asset and risk dependencies
                expect(deps.some(d => d.includes('actif'))).toBe(true);
                expect(deps.some(d => d.includes('risque'))).toBe(true);
            });
        });
    });

    describe('approveRequest', () => {
        beforeEach(() => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: false,
            } as unknown as ReturnType<typeof useStore>);
        });

        it('should approve join request successfully', async () => {
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);
            mockHttpsCallable.mockResolvedValue({ data: {} });

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.approveRequest({
                    id: 'request-1',
                    displayName: 'John Doe',
                } as never);
                expect(success).toBe(true);
            });

            expect(mockHttpsCallable).toHaveBeenCalledWith({ requestId: 'request-1' });
            expect(mockAddToast).toHaveBeenCalledWith('Accès approuvé pour John Doe', 'success');
        });

        it('should return LIMIT_REACHED when at limit', async () => {
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(false);

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.approveRequest({
                    id: 'request-1',
                    displayName: 'John Doe',
                } as never);
                expect(success).toBe('LIMIT_REACHED');
            });
        });

        it('should handle approval error', async () => {
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);
            mockHttpsCallable.mockRejectedValue(new Error('Approval failed'));

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.approveRequest({
                    id: 'request-1',
                    displayName: 'John Doe',
                } as never);
                expect(success).toBe(false);
            });

            expect(mockAddToast).toHaveBeenCalledWith("Erreur lors de l'approbation", 'error');
        });
    });

    describe('rejectRequest', () => {
        beforeEach(() => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: false,
            } as unknown as ReturnType<typeof useStore>);
        });

        it('should reject request successfully', async () => {
            mockHttpsCallable.mockResolvedValue({ data: {} });

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.rejectRequest({
                    id: 'request-1',
                } as never);
                expect(success).toBe(true);
            });

            expect(mockAddToast).toHaveBeenCalledWith('Demande refusée', 'info');
        });

        it('should handle rejection error', async () => {
            mockHttpsCallable.mockRejectedValue(new Error('Rejection failed'));

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                const success = await result.current.rejectRequest({
                    id: 'request-1',
                } as never);
                expect(success).toBe(false);
            });

            expect(mockAddToast).toHaveBeenCalledWith('Erreur lors du refus', 'error');
        });
    });

    describe('importUsers', () => {
        beforeEach(() => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: false,
            } as unknown as ReturnType<typeof useStore>);
        });

        it('should show error for empty CSV', async () => {
            vi.mocked(ImportService.parseCSV).mockReturnValue([]);

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.importUsers('');
            });

            expect(mockAddToast).toHaveBeenCalledWith('Fichier vide ou invalide', 'error');
        });

        it('should import users from CSV', async () => {
            vi.mocked(ImportService.parseCSV).mockReturnValue([
                { Email: 'user1@example.com', Nom: 'User 1', Role: 'user', Departement: 'IT' },
                { Email: 'user2@example.com', Nom: 'User 2', Role: 'admin', Departement: 'HR' },
            ]);
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.importUsers('email,name\nuser1@example.com,User 1');
            });

            // Should have tried to add documents
            expect(mockAddDoc).toHaveBeenCalled();
        });

        it('should handle import with limit reached', async () => {
            vi.mocked(ImportService.parseCSV).mockReturnValue([
                { Email: 'user1@example.com', Nom: 'User 1', Role: 'user' },
            ]);
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(false);

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.importUsers('email\nuser1@example.com');
            });

            expect(mockAddToast).toHaveBeenCalledWith(
                expect.stringContaining('Limite du plan atteinte'),
                'info'
            );
        });

        it('should skip rows without email', async () => {
            vi.mocked(ImportService.parseCSV).mockReturnValue([
                { Nom: 'No Email User' }, // No email
                { Email: 'valid@example.com', Nom: 'Valid User' },
            ]);
            vi.mocked(SubscriptionService.checkLimit).mockResolvedValue(true);

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.importUsers('name\nNo Email User');
            });

            // Only one user should be processed
            expect(mockAddDoc).toHaveBeenCalledTimes(1);
        });
    });

    describe('demo mode', () => {
        it('should use mock data in demo mode', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: true,
            } as unknown as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useTeamManagement());

            // In demo mode, should not call actual Firebase
            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            }, { timeout: 2000 });
        });

        it('should handle invite in demo mode', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                addToast: mockAddToast,
                demoMode: true,
            } as unknown as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useTeamManagement());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            }, { timeout: 2000 });

            await act(async () => {
                const success = await result.current.inviteUser({
                    email: 'demo@example.com',
                    displayName: 'Demo User',
                    role: 'user',
                    department: 'Demo',
                });
                expect(success).toBe(true);
            });

            expect(mockAddToast).toHaveBeenCalledWith('team.invite.success', 'success');
        });
    });
});
