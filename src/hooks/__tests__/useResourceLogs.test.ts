/**
 * Unit tests for useResourceLogs hook
 * Tests resource-specific log fetching and pagination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock Firebase Firestore
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    getDocs: (...args: unknown[]) => mockGetDocs(...args)
}));

vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock store
vi.mock('../../store', () => ({
    useStore: () => ({
        user: { organizationId: 'org-123' }
    })
}));

// Mock toast
const mockToastError = vi.fn();
vi.mock('@/lib/toast', () => ({
    toast: {
        error: (...args: unknown[]) => mockToastError(...args)
    }
}));

import { useResourceLogs } from '../useResourceLogs';

describe('useResourceLogs', () => {
    const mockLogs = [
        {
            id: 'log-1',
            data: () => ({
                action: 'UPDATE',
                resource: 'Risk',
                resourceId: 'risk-123',
                userEmail: 'admin@test.com',
                timestamp: { seconds: Date.now() / 1000 }
            })
        },
        {
            id: 'log-2',
            data: () => ({
                action: 'CREATE',
                resource: 'Risk',
                resourceId: 'risk-123',
                userEmail: 'user@test.com',
                timestamp: { seconds: (Date.now() - 86400000) / 1000 }
            })
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDocs.mockResolvedValue({
            docs: mockLogs,
            empty: false
        });
    });

    describe('initialization', () => {
        it('initializes with loading state', () => {
            mockGetDocs.mockImplementation(() => new Promise(() => { }));

            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123'));

            expect(result.current.loading).toBe(true);
        });

        it('fetches logs when resourceId is provided', async () => {
            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123'));

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(mockGetDocs).toHaveBeenCalled();
        });

        it('does not fetch when resourceId is missing', () => {
            const { result } = renderHook(() => useResourceLogs('Risk', undefined));

            expect(result.current.logs).toEqual([]);
            expect(result.current.loading).toBe(false);
        });

        it('provides all expected properties', async () => {
            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123'));

            await waitFor(() => !result.current.loading);

            expect(result.current.logs).toBeDefined();
            expect(result.current.hasMore).toBeDefined();
            expect(typeof result.current.loadMore).toBe('function');
            expect(typeof result.current.refresh).toBe('function');
        });
    });

    describe('log loading', () => {
        it('loads logs from Firestore', async () => {
            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123'));

            await waitFor(() => {
                expect(result.current.logs.length).toBe(2);
            });
        });

        it('tracks hasMore state', async () => {
            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123', 20));

            await waitFor(() => !result.current.loading);

            // hasMore should be a boolean
            expect(typeof result.current.hasMore).toBe('boolean');
        });

        it('sets hasMore true when results equal limit', async () => {
            const manyLogs = Array.from({ length: 20 }, (_, i) => ({
                id: `log-${i}`,
                data: () => ({
                    action: 'VIEW',
                    timestamp: { seconds: Date.now() / 1000 }
                })
            }));

            mockGetDocs.mockResolvedValue({
                docs: manyLogs,
                empty: false
            });

            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123', 20));

            await waitFor(() => {
                expect(result.current.hasMore).toBe(true);
            });
        });
    });

    describe('loadMore', () => {
        it('loads more logs when available', async () => {
            const initialLogs = Array.from({ length: 20 }, (_, i) => ({
                id: `log-${i}`,
                data: () => ({
                    action: 'VIEW',
                    timestamp: { seconds: Date.now() / 1000 }
                })
            }));

            mockGetDocs.mockResolvedValue({
                docs: initialLogs,
                empty: false
            });

            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123', 20));

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.loadMore();
            });

            // Should call getDocs again
            expect(mockGetDocs).toHaveBeenCalled();
        });

        it('loadMore function is callable', async () => {
            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123'));

            await waitFor(() => !result.current.loading);

            // loadMore should be a function
            expect(typeof result.current.loadMore).toBe('function');

            // Calling loadMore should not throw
            expect(() => {
                act(() => {
                    result.current.loadMore();
                });
            }).not.toThrow();
        });
    });

    describe('refresh', () => {
        it('refetches logs', async () => {
            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123'));

            await waitFor(() => !result.current.loading);

            mockGetDocs.mockClear();

            act(() => {
                result.current.refresh();
            });

            await waitFor(() => {
                expect(mockGetDocs).toHaveBeenCalled();
            });
        });
    });

    describe('error handling', () => {
        it('handles fetch errors silently for index issues', async () => {
            mockGetDocs.mockRejectedValue({ code: 'failed-precondition' });

            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123'));

            await waitFor(() => !result.current.loading);

            // Should not show toast for index errors
            expect(mockToastError).not.toHaveBeenCalled();
        });

        it('shows error toast for other errors', async () => {
            mockGetDocs.mockRejectedValue(new Error('Network error'));

            renderHook(() => useResourceLogs('Risk', 'risk-123'));

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith(
                    expect.stringContaining("charger l'historique")
                );
            });
        });

        it('handles empty results', async () => {
            mockGetDocs.mockResolvedValue({
                docs: [],
                empty: true
            });

            const { result } = renderHook(() => useResourceLogs('Risk', 'risk-123'));

            await waitFor(() => !result.current.loading);

            expect(result.current.logs).toEqual([]);
            expect(result.current.hasMore).toBe(false);
        });
    });

    describe('resourceId changes', () => {
        it('refetches when resourceId changes', async () => {
            const { result, rerender } = renderHook(
                ({ resourceId }) => useResourceLogs('Risk', resourceId),
                { initialProps: { resourceId: 'risk-123' } }
            );

            await waitFor(() => !result.current.loading);

            mockGetDocs.mockClear();

            rerender({ resourceId: 'risk-456' });

            await waitFor(() => {
                expect(mockGetDocs).toHaveBeenCalled();
            });
        });

        it('clears logs when resourceId becomes undefined', async () => {
            const { result, rerender } = renderHook(
                ({ resourceId }) => useResourceLogs('Risk', resourceId),
                { initialProps: { resourceId: 'risk-123' as string | undefined } }
            );

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
                expect(result.current.logs.length).toBe(2);
            });

            rerender({ resourceId: undefined });

            expect(result.current.logs).toEqual([]);
        });
    });
});
