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
import { Button } from './button';
import { cn } from '../../lib/utils';
import { Skeleton } from './Skeleton';

import { Tooltip } from './Tooltip';
import { ConfirmModal } from './ConfirmModal';


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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Add selection column if selectable
    const tableColumns = useMemo(() => {
        if (!selectable) return columns;

        const selectionColumn: ColumnDef<TData, unknown> = {
            id: 'select',
            header: ({ table }) => (
                <div className="px-1" onClick={(e) => e.stopPropagation()} role="presentation">
                    <input
                        id="select-all-rows"
                        aria-label="Sélectionner toutes les lignes"
                        checked={table.getIsAllPageRowsSelected()}
                        onChange={table.getToggleAllPageRowsSelectedHandler()}
                        name="select-all-rows"
                        type="checkbox"
                        className="rounded border-slate-300/50 dark:border-white/20 text-brand-600 focus:ring-brand-500/20 w-4 h-4 cursor-pointer bg-white/50 dark:bg-white/5 transition-colors"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="px-1" onClick={(e) => e.stopPropagation()} role="presentation">
                    <input
                        id={`select-row-${row.id}`}
                        aria-label={`Sélectionner la ligne ${row.index + 1}`}
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                        name={`select-row-${row.id}`}
                        type="checkbox"
                        disabled={!row.getCanSelect()}
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
                            aria-label="Rechercher"
                            value={globalFilter ?? ''}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            type="text"
                            placeholder="Rechercher..."
                            className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none backdrop-blur-sm transition-all"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Bulk Actions */}
                    {selectable && selectedIds.length > 0 && onBulkDelete && (
                        <Tooltip content="Supprimer la sélection">
                            <Button
                                aria-label="Supprimer la sélection"
                                onClick={() => setShowDeleteConfirm(true)}
                                variant="destructive"
                                size="sm"
                                className="flex items-center gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Supprimer ({selectedIds.length})
                            </Button>
                        </Tooltip>
                    )}

                    {exportable && (
                        <Tooltip content="Exporter en CSV">
                            <Button
                                aria-label="Exporter les données en CSV"
                                onClick={handleExport}
                                variant="secondary"
                                size="sm"
                                className="flex items-center gap-2 font-bold"
                            >
                                <Download className="h-4 w-4" />
                                Exporter CSV
                            </Button>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto rounded-4xl glass-premium overflow-hidden">
                <table
                    className="w-full"
                    role="table"
                    aria-label={exportFilename || "Tableau de données"}
                    aria-rowcount={table.getFilteredRowModel().rows.length}
                    aria-colcount={table.getAllColumns().length}
                >
                    <caption className="sr-only">
                        {exportFilename ? `Tableau de ${exportFilename}` : "Tableau de données"} avec {data.length} éléments, triable et filtrable
                    </caption>
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
                                <tr key={`skeleton-row-${i}`}>
                                    {tableColumns.map((_, j) => (
                                        <td key={`skeleton-cell-${j}`} className="px-3 py-3 sm:px-6 sm:py-4">
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
                            <Button
                                aria-label="Page précédente"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                                variant="outline"
                                size="icon"
                                className="w-10 h-10 rounded-2xl"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
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
                                    <Button
                                        key={pageNum}
                                        aria-label={`Page ${pageNum}`}
                                        aria-current={currentPage === pageNum ? 'page' : undefined}
                                        onClick={() => table.setPageIndex(pageNum - 1)}
                                        variant={currentPage === pageNum ? 'default' : 'outline'}
                                        size="icon"
                                        className={cn(
                                            "w-10 h-10 rounded-xl font-bold transition-colors",
                                            currentPage !== pageNum && "hover:bg-slate-50 dark:hover:bg-slate-700"
                                        )}
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                        </div>

                        <Tooltip content="Page suivante">
                            <Button
                                aria-label="Page suivante"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                                variant="outline"
                                size="icon"
                                className="w-10 h-10 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            )}
            {
                onBulkDelete && (
                    <ConfirmModal
                        isOpen={showDeleteConfirm}
                        onClose={() => setShowDeleteConfirm(false)}
                        onConfirm={() => {
                            onBulkDelete(selectedIds);
                            setRowSelection({});
                            setShowDeleteConfirm(false);
                        }}
                        title="Suppression multiple"
                        message={`Voulez-vous vraiment supprimer les ${selectedIds.length} éléments sélectionnés ? Cette action est irréversible.`}
                        confirmText="Supprimer"
                        type="danger"
                    />
                )
            }
        </div >
    );
}
