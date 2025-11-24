import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Download, Search } from './Icons';

export interface Column<T> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    render?: (value: any, row: T) => React.ReactNode;
    width?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    onRowClick?: (row: T) => void;
    exportable?: boolean;
    exportFilename?: string;
    searchable?: boolean;
    pageSize?: number;
    className?: string;
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    onRowClick,
    exportable = false,
    exportFilename = 'export',
    searchable = false,
    pageSize = 10,
    className = ''
}: DataTableProps<T>) {
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Filter data based on search
    const filteredData = useMemo(() => {
        if (!searchQuery) return data;

        return data.filter(row =>
            Object.values(row).some(value =>
                String(value).toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [data, searchQuery]);

    // Sort data
    const sortedData = useMemo(() => {
        if (!sortColumn) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];

            if (aVal === bVal) return 0;

            const comparison = aVal > bVal ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [filteredData, sortColumn, sortDirection]);

    // Paginate data
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, currentPage, pageSize]);

    const totalPages = Math.ceil(sortedData.length / pageSize);

    const handleSort = (columnKey: string) => {
        if (sortColumn === columnKey) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
    };

    const handleExport = () => {
        const headers = columns.map(col => col.label).join(',');
        const rows = sortedData.map(row =>
            columns.map(col => {
                const value = row[col.key as keyof T];
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(',')
        );

        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${exportFilename}.csv`;
        link.click();
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Toolbar */}
            {(searchable || exportable) && (
                <div className="flex items-center justify-between gap-4">
                    {searchable && (
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                    )}

                    {exportable && (
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                        >
                            <Download className="h-4 w-4" />
                            Exporter CSV
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
                            {columns.map((column) => (
                                <th
                                    key={String(column.key)}
                                    onClick={() => column.sortable !== false && handleSort(String(column.key))}
                                    className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${column.sortable !== false ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800' : ''
                                        }`}
                                    style={{ width: column.width }}
                                >
                                    <div className="flex items-center gap-2">
                                        {column.label}
                                        {column.sortable !== false && sortColumn === column.key && (
                                            sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {paginatedData.map((row, idx) => (
                            <tr
                                key={idx}
                                onClick={() => onRowClick?.(row)}
                                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''
                                    }`}
                            >
                                {columns.map((column) => (
                                    <td key={String(column.key)} className="px-6 py-4 text-sm text-slate-900 dark:text-white">
                                        {column.render
                                            ? column.render(row[column.key as keyof T], row)
                                            : String(row[column.key as keyof T] ?? '-')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {paginatedData.length === 0 && (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        Aucune donnée à afficher
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Affichage {(currentPage - 1) * pageSize + 1} à {Math.min(currentPage * pageSize, sortedData.length)} sur {sortedData.length} résultats
                    </p>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Précédent
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${currentPage === pageNum
                                                ? 'bg-brand-600 text-white'
                                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Suivant
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
