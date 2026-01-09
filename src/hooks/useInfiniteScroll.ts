import { useState, useEffect, useRef, useCallback } from 'react';

// Infinite Scroll Hook using Intersection Observer
export const useInfiniteScroll = (
    loadMore: () => void,
    hasMore: boolean
) => {
    const [isFetching, setIsFetching] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);

    // Callback ref for the sentinel element
    const lastElementRef = useCallback((node: HTMLElement | null) => {
        if (isFetching) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setIsFetching(true);
                loadMore();
            }
        });

        if (node) observer.current.observe(node);
    }, [isFetching, hasMore, loadMore]);

    // Reset fetching state when hasMore changes or after timeout/external signal
    // For now, we assume loadMore drives state changes externally or we just toggle it briefly?
    // Actually, usually setIsFetching(false) happens when data arrives.
    // The previous implementation used setTimeout(..., 1000).
    // We'll mimic that behavior for compatibility if loadMore is synchronous.
    // Ideally loadMore returns a promise.

    useEffect(() => {
        if (isFetching) {
            const timer = setTimeout(() => {
                setIsFetching(false);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isFetching]);

    return { isFetching, lastElementRef };
};
