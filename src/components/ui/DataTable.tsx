import { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    ColumnDef,
    SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, Download, Search, ChevronLeft, ChevronRight, Trash2 } from './Icons';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';
import { Tooltip } from './Tooltip';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onRowClick?: (row: TData) => void;
    exportable?: boolean;
    exportFilename?: string;
    searchable?: boolean;
    selectable?: boolean;
    onBulkDelete?: (selectedIds: string[]) => void;
    pageSize?: number;
    className?: string;
    loading?: boolean;
    emptyState?: React.ReactNode;
}

export function DataTable<TData extends { id: string }, TValue>({
    columns,
    data,
    onRowClick,
    exportable = false,
    exportFilename = 'export',
    searchable = false,
    selectable = false,
    onBulkDelete,
    pageSize = 10,
    className,
    loading = false,
    emptyState,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

    // Add selection column if selectable
    const tableColumns = useMemo(() => {
        if (!selectable) return columns;

        const selectionColumn: ColumnDef<TData, unknown> = {
            id: 'select',
            header: ({ table }) => (
                <div className="px-1" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={table.getIsAllPageRowsSelected()}
                        onChange={table.getToggleAllPageRowsSelectedHandler()}
                        aria-label="Sélectionner toutes les lignes"
                        className="rounded border-slate-300/50 dark:border-white/20 text-brand-600 focus:ring-brand-500/20 w-4 h-4 cursor-pointer bg-white/50 dark:bg-white/5 transition-colors"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="px-1" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={row.getIsSelected()}
                        disabled={!row.getCanSelect()}
                        onChange={row.getToggleSelectedHandler()}
                        aria-label={`Sélectionner la ligne ${row.index + 1}`}
                        className="rounded border-slate-300/50 dark:border-white/20 text-brand-600 focus:ring-brand-500/20 w-4 h-4 cursor-pointer bg-white/50 dark:bg-white/5 transition-colors"
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        };

        return [selectionColumn, ...columns];
    }, [columns, selectable]);

    const tableOptions = useMemo(() => ({
        data,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            globalFilter,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize,
            },
        },
        getRowId: (row: TData) => row.id, // Important for selection to return IDs
    }), [data, tableColumns, sorting, globalFilter, rowSelection, pageSize]);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable(tableOptions);

    const handleExport = () => {
        const headers = columns.map((col) => (col.header as string) || '').join(',');
        const rows = table.getCoreRowModel().rows.map((row) =>
            row.getVisibleCells().map((cell) => {
                const value = cell.getValue();
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

    const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id]);

    return (
        <div className={cn("space-y-4 min-w-0", className)}>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {searchable && (
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={globalFilter ?? ''}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-[#0B1120]/40 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none backdrop-blur-sm transition-all"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Bulk Actions */}
                    {selectable && selectedIds.length > 0 && onBulkDelete && (
                        <Tooltip content="Supprimer la sélection">
                            <button
                                onClick={() => onBulkDelete(selectedIds)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors animate-fade-in"
                            >
                                <Trash2 className="h-4 w-4" />
                                Supprimer ({selectedIds.length})
                            </button>
                        </Tooltip>
                    )}

                    {exportable && (
                        <Tooltip content="Exporter en CSV">
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                            >
                                <Download className="h-4 w-4" />
                                Exporter CSV
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto rounded-4xl glass-panel overflow-hidden">
                <table className="w-full">
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="border-b border-slate-200/50 dark:border-white/5 bg-slate-50/30 dark:bg-white/5">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getToggleSortingHandler()}
                                            className={cn(
                                                "px-3 py-4 sm:px-6 sm:py-5 text-left text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap transition-colors",
                                                header.column.getCanSort() && "cursor-pointer hover:bg-white/40 dark:hover:bg-white/5 hover:text-brand-600 dark:hover:text-brand-400",
                                                header.id === 'select' && "w-[50px] px-2 sm:px-4"
                                            )}
                                            style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                                        >
                                            <div className="flex items-center gap-2">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {{
                                                    asc: <ChevronUp className="h-3 w-3 text-brand-600" />,
                                                    desc: <ChevronDown className="h-3 w-3 text-brand-600" />,
                                                }[header.column.getIsSorted() as string] ?? null}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    {tableColumns.map((_, j) => (
                                        <td key={j} className="px-3 py-3 sm:px-6 sm:py-4">
                                            <Skeleton className="h-4 w-full" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : table.getRowModel().rows.length > 0 ? (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    onClick={(e) => {
                                        // Don't trigger row click if clicking checkbox
                                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                                        onRowClick?.(row.original);
                                    }}
                                    className={cn(
                                        "transition-all duration-200 border-l-2 border-l-transparent",
                                        onRowClick && "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/5 hover:border-l-brand-600 dark:hover:border-l-brand-500",
                                        row.getIsSelected() && "bg-brand-50/50 dark:bg-brand-900/20 border-l-brand-600 dark:border-l-brand-500"
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-3 py-4 sm:px-6 sm:py-4 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={tableColumns.length} className="p-0">
                                    {emptyState || (
                                        <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                                                <Search className="h-8 w-8 opacity-20" />
                                            </div>
                                            <p className="font-medium">Aucune donnée à afficher</p>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Affichage {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} à {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length)} sur {data.length} résultats
                    </p>

                    <div className="flex gap-2">
                        <Tooltip content="Page précédente">
                            <button
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                                className="w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/10 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                        </Tooltip>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
                                const currentPage = table.getState().pagination.pageIndex + 1;
                                const totalPages = table.getPageCount();
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
                                        onClick={() => table.setPageIndex(pageNum - 1)}
                                        className={cn(
                                            "w-10 h-10 rounded-xl text-sm font-bold transition-colors",
                                            currentPage === pageNum
                                                ? "bg-brand-600 text-white"
                                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700"
                                        )}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <Tooltip content="Page suivante">
                            <button
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                                className="p-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors backdrop-blur-sm"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </Tooltip>
                    </div>
                </div>
            )}
        </div>
    );
}
