import { useState, useEffect } from 'react';

// Infinite Scroll Hook
export const useInfiniteScroll = (
    loadMore: () => void,
    hasMore: boolean,
    threshold = 100
) => {
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (
                window.innerHeight + document.documentElement.scrollTop >=
                document.documentElement.offsetHeight - threshold
            ) {
                if (!isFetching && hasMore) {
                    setIsFetching(true);
                    loadMore();
                    setTimeout(() => setIsFetching(false), 1000);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [loadMore, hasMore, isFetching, threshold]);

    return { isFetching };
};
