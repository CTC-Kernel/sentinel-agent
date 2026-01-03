import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  MoreHorizontal,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Column<T> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface EnhancedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
  searchable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  pagination?: {
    pageSize: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  };
}

export function EnhancedTable<T extends Record<string, unknown>>({
  data,
  columns,
  className = '',
  searchable = true,
  filterable = true,
  exportable = true,
  pagination
}: EnhancedTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const [searchQuery, setSearchQuery] = useState('');
  // const filters: Record<string, string> = {}; // Filters removed
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Filters removed as they were not implemented correctly
    // Object.entries(filters).forEach...

    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchQuery, sortConfig]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!pagination) return processedData;

    const startIndex = pagination.currentPage * pagination.pageSize;
    return processedData.slice(startIndex, startIndex + pagination.pageSize);
  }, [processedData, pagination]);

  const handleSort = (key: keyof T) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map((row, index) => (row as { id?: string | number }).id ?? index)));
    }
  };

  const handleSelectRow = (id: string | number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleExport = () => {
    const csv = [
      columns.map(col => col.title).join(','),
      ...processedData.map(row =>
        columns.map(col => {
          const value = row[col.key];
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )}

          {filterable && (
            <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Filter className="w-4 h-4" />
              Filtres
            </button>
          )}

          {exportable && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter
            </button>
          )}
        </div>

        {selectedRows.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>{selectedRows.size} sélectionné(s)</span>
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-red-500 hover:text-red-600"
            >
              Effacer
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <th className="w-12 p-4">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                </th>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={cn(
                      "p-4 text-left font-medium text-slate-700 dark:text-slate-300",
                      column.sortable && "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                    onClick={() => column.sortable && handleSort(column.key)}
                    style={{ width: column.width }}
                  >
                    <div className="flex items-center gap-2">
                      {column.title}
                      {column.sortable && (
                        <div className="flex flex-col">
                          <ArrowUp
                            className={cn(
                              "w-3 h-3",
                              sortConfig.key === column.key && sortConfig.direction === 'asc'
                                ? "text-brand-500"
                                : "text-slate-400"
                            )}
                          />
                          <ArrowDown
                            className={cn(
                              "w-3 h-3 -mt-1",
                              sortConfig.key === column.key && sortConfig.direction === 'desc'
                                ? "text-brand-500"
                                : "text-slate-400"
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-12 p-4"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, index) => {
                const rowId = (row as { id?: string | number }).id ?? index;
                return (
                  <motion.tr
                    key={rowId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(rowId)}
                        onChange={() => handleSelectRow(rowId)}
                        className="rounded border-slate-300 dark:border-slate-600"
                      />
                    </td>
                    {columns.map((column) => (
                      <td key={String(column.key)} className="p-4">
                        {column.render ? column.render(row[column.key], row) : (row[column.key] as React.ReactNode)}
                      </td>
                    ))}
                    <td className="p-4">
                      <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {processedData.length} résultat(s) • Page {pagination.currentPage + 1} sur {Math.ceil(processedData.length / pagination.pageSize)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 0}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50"
            >
              Précédent
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.ceil(processedData.length / pagination.pageSize) }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => pagination.onPageChange(index)}
                  className={cn(
                    "px-3 py-1 rounded",
                    index === pagination.currentPage
                      ? "bg-brand-500 text-white"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  )}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === Math.ceil(processedData.length / pagination.pageSize) - 1}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
