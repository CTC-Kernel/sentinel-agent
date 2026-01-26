import { useState, useEffect, useRef, useCallback } from 'react';

// Infinite Scroll Hook using Intersection Observer
// FIXED: Race condition - observer now uses ref for isFetching to prevent multiple loadMore calls
export const useInfiniteScroll = (
    loadMore: () => void,
    hasMore: boolean
) => {
    const [isFetching, setIsFetching] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);
    const isFetchingRef = useRef(false);

    // Keep ref in sync with state
    useEffect(() => {
        isFetchingRef.current = isFetching;
    }, [isFetching]);

    // Callback ref for the sentinel element
    // FIXED: Use ref to check isFetching inside observer callback to avoid stale closure
    const lastElementRef = useCallback((node: HTMLElement | null) => {
        // Always disconnect previous observer first
        if (observer.current) {
            observer.current.disconnect();
            observer.current = null;
        }

        // Don't observe if no more items or already fetching
        if (!hasMore) return;

        observer.current = new IntersectionObserver(
            (entries) => {
                // Use ref to get current value, not stale closure
                if (entries[0].isIntersecting && !isFetchingRef.current && hasMore) {
                    isFetchingRef.current = true;
                    setIsFetching(true);
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        if (node) observer.current.observe(node);
    }, [hasMore, loadMore]); // Removed isFetching from deps - use ref instead

    // Reset fetching state after timeout (safety net)
    useEffect(() => {
        if (isFetching) {
            const timer = setTimeout(() => {
                isFetchingRef.current = false;
                setIsFetching(false);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isFetching]);

    // Cleanup observer on unmount
    useEffect(() => {
        return () => {
            if (observer.current) {
                observer.current.disconnect();
                observer.current = null;
            }
        };
    }, []);

    return { isFetching, lastElementRef, setIsFetching };
};
