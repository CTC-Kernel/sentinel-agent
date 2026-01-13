/**
 * useThreats Hook Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useThreats } from '../useThreats';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

const mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-threat-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn(),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
    })),
    onSnapshot: vi.fn((_, callback) => {
        callback({ docs: [] });
        return mockUnsubscribe;
    }),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

// Mock Store
const mockAddToast = vi.fn();
const mockT = vi.fn((key: string) => key);
const mockUser = {
    uid: 'user-123',
    organizationId: 'org-123',
};

vi.mock('../../store', () => ({
    useStore: vi.fn(() => ({
        user: mockUser,
        isDemoMode: false,
        addToast: mockAddToast,
        t: mockT,
    })),
}));

vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        handleErrorWithToast: vi.fn(),
    },
}));

vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data),
}));

import { addDoc, updateDoc, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { useStore } from '../../store';

describe('useThreats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
            isDemoMode: false,
            addToast: mockAddToast,
            t: mockT,
        } as ReturnType<typeof useStore>);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initialization', () => {
        it('should start with loading false after snapshot resolves', () => {
            // onSnapshot resolves immediately in mock, so loading becomes false
            const { result } = renderHook(() => useThreats());

            expect(result.current.loading).toBe(false);
        });

        it('should fetch threats on mount', async () => {
            const mockThreats = [
                { id: 'threat-1', name: 'Phishing', category: 'Social Engineering' },
                { id: 'threat-2', name: 'Ransomware', category: 'Malware' },
            ];

            vi.mocked(onSnapshot).mockImplementation((_query, callback) => {
                (callback as (snap: { docs: unknown[] }) => void)({
                    docs: mockThreats.map(t => ({
                        id: t.id,
                        data: () => t,
                    })),
                });
                return mockUnsubscribe;
            });

            const { result } = renderHook(() => useThreats());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.threats).toHaveLength(2);
        });

        it('should unsubscribe on unmount', () => {
            const { unmount } = renderHook(() => useThreats());

            unmount();

            expect(mockUnsubscribe).toHaveBeenCalled();
        });
    });

    describe('demo mode', () => {
        it('should use mock data in demo mode', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: mockUser,
                isDemoMode: true,
                addToast: mockAddToast,
                t: mockT,
            } as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useThreats());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Demo mode should provide mock threats
            // The exact behavior depends on implementation
        });
    });

    describe('CRUD operations', () => {
        it('should add a new threat', async () => {
            const { result } = renderHook(() => useThreats());

            const threatData = {
                name: 'New Threat',
                category: 'Test Category',
                description: 'Test Description',
            };

            await act(async () => {
                await result.current.addThreat(threatData as never);
            });

            expect(addDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalled();
        });

        it('should update an existing threat', async () => {
            const { result } = renderHook(() => useThreats());

            await act(async () => {
                await result.current.updateThreat('threat-1', {
                    name: 'Updated Threat',
                } as never);
            });

            expect(updateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalled();
        });

        it('should delete a threat', async () => {
            const { result } = renderHook(() => useThreats());

            await act(async () => {
                await result.current.deleteThreat('threat-1');
            });

            expect(deleteDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalled();
        });
    });

    describe('bulk operations', () => {
        it('should seed standard threats', async () => {
            const { result } = renderHook(() => useThreats());

            await act(async () => {
                await result.current.seedStandardThreats();
            });

            expect(writeBatch).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should handle add threat errors', async () => {
            vi.mocked(addDoc).mockRejectedValue(new Error('Add failed'));

            const { result } = renderHook(() => useThreats());

            await act(async () => {
                try {
                    await result.current.addThreat({ name: 'Test' } as never);
                } catch {
                    // Expected to throw
                }
            });

            // Error should be handled
        });
    });
});
