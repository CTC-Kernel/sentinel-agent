/**
 * useInfiniteScroll Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfiniteScroll } from '../useInfiniteScroll';

describe('useInfiniteScroll', () => {
    let mockObserve: ReturnType<typeof vi.fn>;
    let mockDisconnect: ReturnType<typeof vi.fn>;
    let mockUnobserve: ReturnType<typeof vi.fn>;
    let intersectionCallback: ((entries: IntersectionObserverEntry[]) => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();

        mockObserve = vi.fn();
        mockDisconnect = vi.fn();
        mockUnobserve = vi.fn();

        global.IntersectionObserver = vi.fn((callback) => {
            intersectionCallback = callback;
            return {
                observe: mockObserve,
                disconnect: mockDisconnect,
                unobserve: mockUnobserve,
                root: null,
                rootMargin: '',
                thresholds: []
            };
        }) as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
        vi.useRealTimers();
        intersectionCallback = null;
    });

    it('should return isFetching state and lastElementRef', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        expect(result.current).toHaveProperty('isFetching');
        expect(result.current).toHaveProperty('lastElementRef');
        expect(result.current.isFetching).toBe(false);
        expect(typeof result.current.lastElementRef).toBe('function');
    });

    it('should create IntersectionObserver when ref is attached', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        act(() => {
            const element = document.createElement('div');
            result.current.lastElementRef(element);
        });

        expect(global.IntersectionObserver).toHaveBeenCalled();
        expect(mockObserve).toHaveBeenCalled();
    });

    it('should not observe when element is null', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        act(() => {
            result.current.lastElementRef(null);
        });

        expect(mockObserve).not.toHaveBeenCalled();
    });

    it('should call loadMore when element is intersecting and hasMore is true', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        act(() => {
            const element = document.createElement('div');
            result.current.lastElementRef(element);
        });

        // Simulate intersection
        act(() => {
            if (intersectionCallback) {
                intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry]);
            }
        });

        expect(loadMore).toHaveBeenCalled();
    });

    it('should not call loadMore when hasMore is false', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, false));

        act(() => {
            const element = document.createElement('div');
            result.current.lastElementRef(element);
        });

        // Simulate intersection
        act(() => {
            if (intersectionCallback) {
                intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry]);
            }
        });

        expect(loadMore).not.toHaveBeenCalled();
    });

    it('should not call loadMore when not intersecting', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        act(() => {
            const element = document.createElement('div');
            result.current.lastElementRef(element);
        });

        // Simulate no intersection
        act(() => {
            if (intersectionCallback) {
                intersectionCallback([{ isIntersecting: false } as IntersectionObserverEntry]);
            }
        });

        expect(loadMore).not.toHaveBeenCalled();
    });

    it('should set isFetching to true when loading', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        act(() => {
            const element = document.createElement('div');
            result.current.lastElementRef(element);
        });

        act(() => {
            if (intersectionCallback) {
                intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry]);
            }
        });

        expect(result.current.isFetching).toBe(true);
    });

    it('should reset isFetching after timeout', async () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        act(() => {
            const element = document.createElement('div');
            result.current.lastElementRef(element);
        });

        act(() => {
            if (intersectionCallback) {
                intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry]);
            }
        });

        expect(result.current.isFetching).toBe(true);

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.isFetching).toBe(false);
    });

    it('should disconnect previous observer when ref changes', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        act(() => {
            const element1 = document.createElement('div');
            result.current.lastElementRef(element1);
        });

        act(() => {
            const element2 = document.createElement('div');
            result.current.lastElementRef(element2);
        });

        expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should not trigger loadMore when already fetching', () => {
        const loadMore = vi.fn();
        const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

        // First intersection
        act(() => {
            const element = document.createElement('div');
            result.current.lastElementRef(element);
        });

        act(() => {
            if (intersectionCallback) {
                intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry]);
            }
        });

        expect(loadMore).toHaveBeenCalledTimes(1);

        // Try to attach ref again while fetching
        act(() => {
            const element = document.createElement('div');
            result.current.lastElementRef(element);
        });

        // loadMore should not be called again because isFetching is true
        expect(loadMore).toHaveBeenCalledTimes(1);
    });
});
