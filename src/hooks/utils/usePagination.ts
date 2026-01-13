import React from 'react';

// Hook for pagination logic
export const usePagination = <T,>(items: T[], initialItemsPerPage: number = 20) => {
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(initialItemsPerPage);

    const totalPages = Math.ceil(items.length / itemsPerPage);

    // Reset to page 1 if current page is out of bounds
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    const paginatedItems = React.useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return items.slice(startIndex, endIndex);
    }, [items, currentPage, itemsPerPage]);

    return {
        currentPage,
        itemsPerPage,
        totalPages,
        paginatedItems,
        setCurrentPage,
        setItemsPerPage,
        totalItems: items.length
    };
};
