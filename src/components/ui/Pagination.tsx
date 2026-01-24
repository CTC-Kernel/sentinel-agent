
import React from 'react';
import { ChevronRight, ChevronDown } from './Icons';
import { Button } from './button';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange?: (itemsPerPage: number) => void;
    itemsPerPageOptions?: number[];
    showItemsPerPage?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    itemsPerPageOptions = [20, 50, 100],
    showItemsPerPage = true
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            pages.push(totalPages);
        }

        return pages;
    };

    if (totalItems === 0) {
        return null;
    }

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 glass-premium rounded-2xl border border-white/60 dark:border-white/5">
            <div className="flex items-center gap-4">
                <p className="text-sm text-slate-600 dark:text-muted-foreground font-medium">
                    {startItem} à {endItem} sur {totalItems}
                </p>

                {showItemsPerPage && onItemsPerPageChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-500 font-medium">Afficher:</span>
                        <div className="relative">
                            <select
                                value={itemsPerPage}
                                onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                                className="appearance-none bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 pr-8 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus-visible:ring-brand-500 outline-none cursor-pointer"
                            >
                                {itemsPerPageOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1">
                <Button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    size="icon"
                    variant="ghost"
                    className="rounded-xl disabled:opacity-30"
                    aria-label="Page précédente"
                >
                    <ChevronRight className="h-4 w-4 rotate-180 text-slate-600 dark:text-slate-400" />
                </Button>

                <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, index) => {
                        if (page === '...') {
                            return (
                                <span key={`ellipsis-${index}`} className="px-3 py-1.5 text-slate-500 dark:text-slate-600 font-medium">
                                    ...
                                </span>
                            );
                        }

                        const pageNum = page as number;
                        const isActive = pageNum === currentPage;

                        return (
                            <Button
                                key={pageNum}
                                onClick={() => onPageChange(pageNum)}
                                variant={isActive ? 'default' : 'ghost'}
                                className={`min-w-[36px] px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${isActive
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                                    : 'text-slate-600 dark:text-slate-400'
                                    }`}
                            >
                                {pageNum}
                            </Button>
                        );
                    })}
                </div>

                <Button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    size="icon"
                    variant="ghost"
                    className="rounded-xl disabled:opacity-30"
                    aria-label="Page suivante"
                >
                    <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </Button>
            </div>
        </div>
    );
};

