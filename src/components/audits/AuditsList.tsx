import React, { useMemo } from 'react';
import { DataTable } from '../ui/DataTable';
import { Audit } from '../../types';
import { ColumnDef } from '@tanstack/react-table';
import { Edit, Trash2, CalendarDays, ClipboardCheck, AlertOctagon } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';

interface AuditsListProps {
    audits: Audit[];
    isLoading: boolean;
    onEdit: (audit: Audit) => void;
    onDelete: (audit: Audit) => void;
    onOpen: (audit: Audit) => void;
    canEdit: boolean;
    canDelete: boolean;
    selectedIds?: string[];
    onSelect?: (ids: string[]) => void;
}

// Helper function moved outside component to be stable
const getStatusColor = (s: string) => {
    switch (s) {
        case 'Planifié': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
        case 'En cours': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
        case 'Terminé': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
        case 'Annulé': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
        default: return 'bg-slate-100 text-slate-700';
    }
};

export const AuditsList: React.FC<AuditsListProps> = ({
    audits, isLoading, onEdit, onDelete, onOpen, canEdit, canDelete, selectedIds = [], onSelect
}) => {

    const columns = useMemo<ColumnDef<Audit>[]>(() => [
        {
            id: 'select',
            header: ({ table }) => (
                <div className="px-1">
                    <input checked={table.getIsAllPageRowsSelected()} onChange={(e) => {
                        const allIds = audits.map(a => a.id);
                        if (e.target.checked) {
                            onSelect?.(allIds);
                        } else {
                            onSelect?.([]);
                        }
                    }} // Simplified logic, ideally DataTable should handle this but we are bypassing for strict control
                        type="checkbox"
                        disabled={!onSelect}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        aria-label="Tout sélectionner"
                    />
                </div>
            ),
            cell: ({ row }) => (
                <div className="px-1">
                    <input checked={selectedIds.includes(row.original.id)} onChange={(e) => {
                        if (e.target.checked) {
                            onSelect?.([...selectedIds, row.original.id]);
                        } else {
                            onSelect?.(selectedIds.filter(id => id !== row.original.id));
                        }
                    }}
                        type="checkbox"
                        disabled={!onSelect}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Sélectionner l'audit ${row.original.name}`}
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'name',
            header: 'Audit',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <button type="button" className="text-left font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded" onClick={() => onOpen(row.original)} aria-label={`Ouvrir l'audit ${row.original.name}`}>
                        {row.original.name}
                    </button>
                    <span className="text-xs text-slate-500">{row.original.type}</span>
                </div>
            )
        },
        {
            accessorKey: 'dateScheduled',
            header: 'Date',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    <span>{row.original.dateScheduled ? new Date(row.original.dateScheduled).toLocaleDateString() : 'TBD'}</span>
                </div>
            )
        },
        {
            accessorKey: 'auditor',
            header: 'Auditeur',
            cell: ({ row }) => row.original.auditor || <span className="text-slate-400 italic">Non assigné</span>
        },
        {
            accessorKey: 'status',
            header: 'Statut',
            cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(row.original.status)}`}>
                    {row.original.status}
                </span>
            )
        },
        {
            accessorKey: 'findingsCount',
            header: 'Écarts',
            cell: ({ row }) => {
                const count = row.original.findingsCount || 0;
                return (
                    <div className={`flex items-center gap-1.5 ${count > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-slate-500'}`}>
                        <AlertOctagon className="w-4 h-4" />
                        <span>{count}</span>
                    </div>
                );
            }
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 justify-end transition-opacity">
                    <Tooltip content="Ouvrir">
                        <button type="button" onClick={() => onOpen(row.original)} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded" aria-label={`Ouvrir ${row.original.name}`}>
                            <ClipboardCheck className="w-4 h-4" />
                        </button>
                    </Tooltip>
                    {canEdit && (
                        <Tooltip content="Modifier">
                            <button type="button" onClick={() => onEdit(row.original)} className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded" aria-label={`Modifier ${row.original.name}`}>
                                <Edit className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    )}
                    {canDelete && (
                        <Tooltip content="Supprimer">
                            <button type="button" onClick={() => onDelete(row.original)} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded" aria-label={`Supprimer ${row.original.name}`}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    )}
                </div>
            )
        }
    ], [canEdit, canDelete, onEdit, onDelete, onOpen, onSelect, selectedIds, audits]);

    return (
        <DataTable
            columns={columns}
            data={audits}
            loading={isLoading}
            emptyState={
                <EmptyState
                    icon={ClipboardCheck}
                    title="Aucun audit trouvé"
                    description="Aucun audit ne correspond à vos critères."
                // No action button here as creation is usually in the page header
                />
            }
        />
    );
};
