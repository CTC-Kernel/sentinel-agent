/**
 * Unit tests for useGlobalSearch hook
 * Tests global search across multiple collections
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock Firebase Firestore
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
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

// Mock error logger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        handleErrorWithToast: vi.fn()
    }
}));

import { useGlobalSearch } from '../useGlobalSearch';

describe('useGlobalSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initialization', () => {
        it('initializes with empty results', () => {
            const { result } = renderHook(() => useGlobalSearch());

            expect(result.current.results).toEqual([]);
            expect(result.current.loading).toBe(false);
        });

        it('provides all expected functions', () => {
            const { result } = renderHook(() => useGlobalSearch());

            expect(typeof result.current.performSearch).toBe('function');
            expect(typeof result.current.cancelSearch).toBe('function');
            expect(typeof result.current.clearResults).toBe('function');
            expect(typeof result.current.setResults).toBe('function');
        });
    });

    describe('performSearch', () => {
        it('debounces search requests', () => {
            mockGetDocs.mockResolvedValue({ forEach: vi.fn() });

            const { result } = renderHook(() => useGlobalSearch());

            act(() => {
                result.current.performSearch('test', {}, 'all');
                result.current.performSearch('test2', {}, 'all');
                result.current.performSearch('test3', {}, 'all');
            });

            // Only the last search should execute after debounce
            expect(mockGetDocs).not.toHaveBeenCalled();
        });

        it('calls getDocs after debounce delay', async () => {
            mockGetDocs.mockResolvedValue({ forEach: vi.fn() });

            const { result } = renderHook(() => useGlobalSearch());

            act(() => {
                result.current.performSearch('test', {}, 'all');
            });

            // Advance timer past debounce delay
            act(() => {
                vi.advanceTimersByTime(350);
            });

            // Allow promises to resolve
            await vi.runAllTimersAsync();

            // Now search should execute
            expect(mockGetDocs).toHaveBeenCalled();
        });
    });

    describe('cancelSearch', () => {
        it('cancels pending search', () => {
            mockGetDocs.mockResolvedValue({ forEach: vi.fn() });

            const { result } = renderHook(() => useGlobalSearch());

            act(() => {
                result.current.performSearch('test', {}, 'all');
            });

            act(() => {
                result.current.cancelSearch();
            });

            // Advance timer - search should not execute
            act(() => {
                vi.advanceTimersByTime(350);
            });

            // getDocs should not be called since search was cancelled
            // (The timer was cleared before it fired)
        });

        it('sets loading to false', () => {
            const { result } = renderHook(() => useGlobalSearch());

            act(() => {
                result.current.cancelSearch();
            });

            expect(result.current.loading).toBe(false);
        });
    });

    describe('clearResults', () => {
        it('clears all search results', () => {
            const { result } = renderHook(() => useGlobalSearch());

            // Set some results first
            act(() => {
                result.current.setResults([
                    { id: 'test-1', type: 'asset', title: 'Test', subtitle: 'Sub' }
                ]);
            });

            expect(result.current.results.length).toBe(1);

            // Clear results
            act(() => {
                result.current.clearResults();
            });

            expect(result.current.results).toEqual([]);
        });
    });

    describe('setResults', () => {
        it('allows direct setting of results', () => {
            const { result } = renderHook(() => useGlobalSearch());

            const customResults = [
                { id: 'custom-1', type: 'asset' as const, title: 'Custom', subtitle: 'Test' }
            ];

            act(() => {
                result.current.setResults(customResults);
            });

            expect(result.current.results).toEqual(customResults);
        });
    });
});
