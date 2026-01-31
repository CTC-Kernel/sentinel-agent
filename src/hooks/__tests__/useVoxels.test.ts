/**
 * Unit tests for useVoxels hook
 * Tests multi-collection data fetching for 3D visualization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock Firebase Firestore
const mockGetDocs = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOnSnapshot = vi.fn((_q: unknown, _onNext: unknown, _onError?: unknown) => mockUnsubscribe);
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: (q: unknown) => mockGetDocs(q),
    onSnapshot: (q: unknown, onNext: unknown, onError?: unknown) => mockOnSnapshot(q, onNext, onError),
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

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        warn: vi.fn(),
        handleErrorWithToast: vi.fn()
    }
}));

import { useVoxels } from '../useVoxels';

// TODO: Tests need updating - hook now uses onSnapshot instead of getDocs
describe.skip('useVoxels', () => {
    const createMockDocs = (items: Array<{ id: string; [key: string]: unknown }>) => ({
        docs: items.map(item => ({
            id: item.id,
            data: () => item
        }))
    });

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock getDocs to return different data based on collection
        mockGetDocs.mockImplementation(() => Promise.resolve(createMockDocs([
            { id: 'item-1', name: 'Item 1' },
            { id: 'item-2', name: 'Item 2' }
        ])));
    });

    describe('initialization', () => {
        it('initializes with loading state', () => {
            mockGetDocs.mockImplementation(() => new Promise(() => {}));

            const { result } = renderHook(() => useVoxels());

            expect(result.current.loading).toBe(true);
        });

        it('provides all expected data properties', async () => {
            const { result } = renderHook(() => useVoxels());

            await waitFor(() => !result.current.loading);

            expect(result.current.assets).toBeDefined();
            expect(result.current.risks).toBeDefined();
            expect(result.current.projects).toBeDefined();
            expect(result.current.audits).toBeDefined();
            expect(result.current.incidents).toBeDefined();
            expect(result.current.suppliers).toBeDefined();
            expect(result.current.controls).toBeDefined();
            expect(typeof result.current.refresh).toBe('function');
        });
    });

    describe('data fetching', () => {
        it('fetches all collections in parallel', async () => {
            const { result } = renderHook(() => useVoxels());

            await waitFor(() => !result.current.loading);

            // Should call getDocs 7 times (one for each collection)
            expect(mockGetDocs).toHaveBeenCalledTimes(7);
        });

        it('populates all data arrays', async () => {
            const { result } = renderHook(() => useVoxels());

            await waitFor(() => !result.current.loading);

            // Data should be arrays (length depends on mock implementation)
            expect(Array.isArray(result.current.assets)).toBe(true);
            expect(Array.isArray(result.current.risks)).toBe(true);
            expect(Array.isArray(result.current.projects)).toBe(true);
            expect(Array.isArray(result.current.audits)).toBe(true);
            expect(Array.isArray(result.current.incidents)).toBe(true);
            expect(Array.isArray(result.current.suppliers)).toBe(true);
            expect(Array.isArray(result.current.controls)).toBe(true);
        });

    });

    describe('refresh', () => {
        it('refetches all data', async () => {
            const { result } = renderHook(() => useVoxels());

            await waitFor(() => !result.current.loading);

            const initialCallCount = mockGetDocs.mock.calls.length;

            act(() => {
                result.current.refresh();
            });

            await waitFor(() => {
                expect(mockGetDocs.mock.calls.length).toBe(initialCallCount + 7);
            });
        });
    });

    describe('error handling', () => {
        it('handles fetch errors gracefully', async () => {
            mockGetDocs.mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => useVoxels());

            await waitFor(() => !result.current.loading);

            // Should complete without throwing
            // Failed collections should return empty arrays
            expect(result.current.assets).toEqual([]);
            expect(result.current.risks).toEqual([]);
        });

        it('sets loading to false eventually', async () => {
            mockGetDocs.mockRejectedValue(new Error('All failed'));

            const { result } = renderHook(() => useVoxels());

            // Wait for loading to complete
            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            }, { timeout: 5000 });
        });
    });

    describe('no user organization', () => {
        it('returns empty data when no organizationId', async () => {
            vi.doMock('../../store', () => ({
                useStore: () => ({user: null,
        t: (key: string, options?: Record<string, unknown>) => {
            if (options && 'defaultValue' in options) {
                return (options as { defaultValue?: string }).defaultValue || key;
            }
            return key;
        }})
            }));

            // Without orgId, data should remain empty
            // This is tested indirectly through the hook behavior
        });
    });

    describe('data integrity', () => {
        it('returns data with correct structure', async () => {
            const { result } = renderHook(() => useVoxels());

            await waitFor(() => !result.current.loading);

            // All arrays should be present
            expect(Array.isArray(result.current.assets)).toBe(true);
            expect(Array.isArray(result.current.risks)).toBe(true);
            expect(Array.isArray(result.current.projects)).toBe(true);
            expect(Array.isArray(result.current.audits)).toBe(true);
            expect(Array.isArray(result.current.incidents)).toBe(true);
            expect(Array.isArray(result.current.suppliers)).toBe(true);
            expect(Array.isArray(result.current.controls)).toBe(true);
        });
    });
});
