/**
 * CrisisContext Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { CrisisProvider, useCrisis } from '../CrisisContext';

// Mock store
const mockUser = {
    uid: 'user-123',
    organizationId: 'org-123',
};

vi.mock('../../store', () => ({
    useStore: vi.fn(() => ({
        user: mockUser,
    })),
}));

// Mock Firebase
const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    serverTimestamp: vi.fn(() => new Date()),
}));

vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        handleErrorWithToast: vi.fn(),
    },
}));

import { useStore } from '../../store';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CrisisProvider>{children}</CrisisProvider>
);

describe('CrisisContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset useStore to default user with organizationId
        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
        } as ReturnType<typeof useStore>);

        // Default mock: call callback with empty snapshot
        mockOnSnapshot.mockImplementation((_ref, callback) => {
            callback({
                exists: () => false,
                data: () => null,
            });
            return vi.fn(); // unsubscribe function
        });

        mockSetDoc.mockResolvedValue(undefined);
    });

    describe('useCrisis hook', () => {
        it('should throw error when used outside provider', () => {
            expect(() => {
                renderHook(() => useCrisis());
            }).toThrow('useCrisis must be used within a CrisisProvider');
        });

        it('should return initial state', async () => {
            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isCrisisActive).toBe(false);
            expect(result.current.scenario).toBe('cyber');
            expect(result.current.activationStep).toBe(0);
        });

        it('should have functions available', async () => {
            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(typeof result.current.activateCrisis).toBe('function');
            expect(typeof result.current.deactivateCrisis).toBe('function');
            expect(typeof result.current.setActivationStep).toBe('function');
        });
    });

    describe('CrisisProvider', () => {
        it('should load crisis state from Firestore', async () => {
            mockOnSnapshot.mockImplementation((_ref, callback) => {
                callback({
                    exists: () => true,
                    data: () => ({
                        isActive: true,
                        scenario: 'fire',
                        startedAt: { toDate: () => new Date() },
                        activatedBy: 'user-456',
                    }),
                });
                return vi.fn();
            });

            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isCrisisActive).toBe(true);
            expect(result.current.scenario).toBe('fire');
            expect(result.current.activationStep).toBe(2);
            expect(result.current.activatedBy).toBe('user-456');
        });

        it('should set loading false when no organization', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { uid: 'user-123' }, // No organizationId
            } as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });
        });

        it('should handle snapshot error gracefully', async () => {
            mockOnSnapshot.mockImplementation((_ref, _callback, errorCallback) => {
                errorCallback(new Error('Permission denied'));
                return vi.fn();
            });

            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });
        });
    });

    describe('activateCrisis', () => {
        it('should activate crisis with scenario', async () => {
            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.activateCrisis('cyber');
            });

            expect(mockSetDoc).toHaveBeenCalled();
            const callArgs = mockSetDoc.mock.calls[0][1];
            expect(callArgs.isActive).toBe(true);
            expect(callArgs.scenario).toBe('cyber');
            expect(callArgs.activatedBy).toBe('user-123');
        });

        it('should activate with fire scenario', async () => {
            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.activateCrisis('fire');
            });

            expect(mockSetDoc).toHaveBeenCalled();
            expect(mockSetDoc.mock.calls[0][1].scenario).toBe('fire');
        });

        it('should activate with supply scenario', async () => {
            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.activateCrisis('supply');
            });

            expect(mockSetDoc).toHaveBeenCalled();
            expect(mockSetDoc.mock.calls[0][1].scenario).toBe('supply');
        });

        it('should activate with staff scenario', async () => {
            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.activateCrisis('staff');
            });

            expect(mockSetDoc).toHaveBeenCalled();
            expect(mockSetDoc.mock.calls[0][1].scenario).toBe('staff');
        });

        it('should not activate if no organizationId', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { uid: 'user-123' }, // No organizationId
            } as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.activateCrisis('cyber');
            });

            expect(mockSetDoc).not.toHaveBeenCalled();
        });

        it('should handle activation error', async () => {
            const { ErrorLogger } = await import('../../services/errorLogger');

            // Ensure user has organizationId for this test
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
            } as ReturnType<typeof useStore>);

            mockSetDoc.mockRejectedValueOnce(new Error('Database error'));

            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let error: Error | undefined;
            await act(async () => {
                try {
                    await result.current.activateCrisis('cyber');
                } catch (e) {
                    error = e as Error;
                }
            });

            expect(error?.message).toBe('Database error');
            expect(ErrorLogger.handleErrorWithToast).toHaveBeenCalled();
        });
    });

    describe('deactivateCrisis', () => {
        it('should deactivate crisis', async () => {
            // Ensure user has organizationId
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
            } as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.deactivateCrisis();
            });

            expect(mockSetDoc).toHaveBeenCalled();
            const callArgs = mockSetDoc.mock.calls[0][1];
            expect(callArgs.isActive).toBe(false);
            expect(callArgs.deactivatedBy).toBe('user-123');
            expect(mockSetDoc.mock.calls[0][2]).toEqual({ merge: true });
        });

        it('should not deactivate if no organizationId', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { uid: 'user-123' },
            } as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.deactivateCrisis();
            });

            expect(mockSetDoc).not.toHaveBeenCalled();
        });

        it('should handle deactivation error', async () => {
            const { ErrorLogger } = await import('../../services/errorLogger');

            // Ensure user has organizationId for this test
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
            } as ReturnType<typeof useStore>);

            mockSetDoc.mockRejectedValueOnce(new Error('Deactivation failed'));

            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let error: Error | undefined;
            await act(async () => {
                try {
                    await result.current.deactivateCrisis();
                } catch (e) {
                    error = e as Error;
                }
            });

            expect(error?.message).toBe('Deactivation failed');
            expect(ErrorLogger.handleErrorWithToast).toHaveBeenCalled();
        });
    });

    describe('setActivationStep', () => {
        it('should set activation step', async () => {
            const { result } = renderHook(() => useCrisis(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.activationStep).toBe(0);

            act(() => {
                result.current.setActivationStep(1);
            });

            expect(result.current.activationStep).toBe(1);

            act(() => {
                result.current.setActivationStep(2);
            });

            expect(result.current.activationStep).toBe(2);
        });
    });
});
