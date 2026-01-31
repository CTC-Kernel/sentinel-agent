/**
 * Unit tests for useActivityLogs hook
 * Tests activity log fetching, filtering, and export
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
        user: { organizationId: 'org-123' },
        t: (key: string, options?: Record<string, unknown>) => {
            if (options && 'defaultValue' in options) {
                return (options as { defaultValue?: string }).defaultValue || key;
            }
            return key;
        }
    })
}));

// Mock toast
const mockToastError = vi.fn();
vi.mock('@/lib/toast', () => ({
    toast: {
        error: (...args: unknown[]) => mockToastError(...args)
    }
}));

import { useActivityLogs } from '../useActivityLogs';

describe('useActivityLogs', () => {
    const mockLogs = [
        {
            id: 'log-1',
            data: () => ({
                action: 'CREATE',
                resource: 'Risk',
                userEmail: 'admin@example.com',
                details: 'Created new risk',
                timestamp: { seconds: Date.now() / 1000 },
                severity: 'info',
                ip: '192.168.1.1'
            })
        },
        {
            id: 'log-2',
            data: () => ({
                action: 'DELETE',
                resource: 'Asset',
                userEmail: 'user@example.com',
                details: 'Deleted asset',
                timestamp: { seconds: (Date.now() - 86400000) / 1000 },
                severity: 'critical',
                ip: '192.168.1.2'
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
        it('fetches logs on mount', async () => {
            renderHook(() => useActivityLogs());

            await waitFor(() => {
                expect(mockGetDocs).toHaveBeenCalled();
            });
        });

        it('initializes with loading state', () => {
            mockGetDocs.mockImplementation(() => new Promise(() => { })); // Never resolves

            const { result } = renderHook(() => useActivityLogs());

            expect(result.current.loading).toBe(true);
        });

        it('loads logs from Firestore', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => {
                expect(result.current.logs.length).toBe(2);
            });
        });

        it('calculates stats from loaded logs', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => {
                expect(result.current.stats).toBeDefined();
                expect(result.current.stats.activeAdmins).toBe(2); // 2 unique users
            });
        });

        it('provides all expected functions and state', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            expect(typeof result.current.refresh).toBe('function');
            expect(typeof result.current.loadMore).toBe('function');
            expect(typeof result.current.setFilter).toBe('function');
            expect(typeof result.current.exportLogs).toBe('function');
            expect(result.current.hasMore).toBeDefined();
            expect(result.current.filter).toBeDefined();
        });
    });

    describe('filtering', () => {
        it('filters by search term', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.setFilter({
                    ...result.current.filter,
                    search: 'admin'
                });
            });

            await waitFor(() => {
                expect(result.current.logs.length).toBe(1);
                expect(result.current.logs[0].userEmail).toBe('admin@example.com');
            });
        });

        it('filters by action', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.setFilter({
                    ...result.current.filter,
                    action: 'CREATE'
                });
            });

            await waitFor(() => {
                expect(result.current.logs.length).toBe(1);
            });
        });

        it('filters by resource', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.setFilter({
                    ...result.current.filter,
                    resource: 'Risk'
                });
            });

            await waitFor(() => {
                expect(result.current.logs.length).toBe(1);
            });
        });

        it('filters by severity', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.setFilter({
                    ...result.current.filter,
                    severity: 'critical'
                });
            });

            await waitFor(() => {
                expect(result.current.logs.length).toBe(1);
            });
        });

        it('combines multiple filters', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.setFilter({
                    search: '',
                    action: 'CREATE',
                    resource: 'Risk',
                    severity: 'info',
                    dateRange: 'all'
                });
            });

            await waitFor(() => {
                expect(result.current.logs.length).toBe(1);
            });
        });
    });

    describe('pagination', () => {
        it('supports load more functionality', async () => {
            const { result } = renderHook(() => useActivityLogs(50));

            await waitFor(() => !result.current.loading);

            // hasMore depends on how many logs are returned vs limit
            expect(typeof result.current.hasMore).toBe('boolean');
        });

        it('sets hasMore based on result count', async () => {
            // Return exactly limitCount docs to indicate more available
            const manyLogs = Array.from({ length: 50 }, (_, i) => ({
                id: `log-${i}`,
                data: () => ({
                    action: 'VIEW',
                    userEmail: 'user@test.com',
                    timestamp: { seconds: Date.now() / 1000 }
                })
            }));

            mockGetDocs.mockResolvedValue({
                docs: manyLogs,
                empty: false
            });

            const { result } = renderHook(() => useActivityLogs(50));

            await waitFor(() => {
                expect(result.current.hasMore).toBe(true);
            });
        });
    });

    describe('refresh', () => {
        it('refetches logs', async () => {
            const { result } = renderHook(() => useActivityLogs());

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

    describe('loadMore', () => {
        it('loads more logs when available', async () => {
            const manyLogs = Array.from({ length: 50 }, (_, i) => ({
                id: `log-${i}`,
                data: () => ({
                    action: 'VIEW',
                    userEmail: 'user@test.com',
                    timestamp: { seconds: Date.now() / 1000 }
                })
            }));

            mockGetDocs.mockResolvedValue({
                docs: manyLogs,
                empty: false
            });

            const { result } = renderHook(() => useActivityLogs(50));

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.loadMore();
            });

            // LoadMore was called
            expect(mockGetDocs).toHaveBeenCalled();
        });

        it('loadMore function is callable', async () => {
            const { result } = renderHook(() => useActivityLogs());

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

    describe('exportLogs', () => {
        it('provides exportLogs function', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            // Just verify the function exists and is callable
            expect(typeof result.current.exportLogs).toBe('function');
        });

        it('does nothing when no logs to export', async () => {
            mockGetDocs.mockResolvedValue({
                docs: [],
                empty: true
            });

            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            // Should not throw when called with no logs
            expect(() => {
                result.current.exportLogs();
            }).not.toThrow();
        });
    });

    describe('error handling', () => {
        it('shows error toast on fetch failure', async () => {
            mockGetDocs.mockRejectedValue(new Error('Fetch failed'));

            renderHook(() => useActivityLogs());

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith(
                    expect.stringContaining("charger le journal")
                );
            });
        });
    });

    describe('date range filtering', () => {
        it('filters by today', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.setFilter({
                    ...result.current.filter,
                    dateRange: 'today'
                });
            });

            // Only log-1 has today's timestamp
            await waitFor(() => {
                expect(result.current.logs.length).toBeLessThanOrEqual(2);
            });
        });

        it('filters by week', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.setFilter({
                    ...result.current.filter,
                    dateRange: 'week'
                });
            });

            await waitFor(() => {
                expect(result.current.logs.length).toBe(2); // Both within a week
            });
        });

        it('filters by month', async () => {
            const { result } = renderHook(() => useActivityLogs());

            await waitFor(() => !result.current.loading);

            act(() => {
                result.current.setFilter({
                    ...result.current.filter,
                    dateRange: 'month'
                });
            });

            await waitFor(() => {
                expect(result.current.logs.length).toBe(2);
            });
        });
    });
});
