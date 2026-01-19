import React, { useMemo } from 'react';
import { DataTable } from '../ui/DataTable';
import { Audit, UserProfile } from '../../types';
import { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, ClipboardCheck, AlertOctagon } from '../ui/Icons';
import { Edit, Trash2, Copy } from '../ui/Icons';
import { RowActionsMenu, RowActionItem } from '../ui/RowActionsMenu';
import { EmptyState } from '../ui/EmptyState';
import { getUserAvatarUrl } from '../../utils/avatarUtils';

interface AuditsListProps {
    audits: Audit[];
    isLoading: boolean;
    onEdit: (audit: Audit) => void;
    onDelete: (audit: Audit) => void;
    onDuplicate?: (audit: Audit) => void;
    onOpen: (audit: Audit) => void;
    canEdit: boolean;
    canDelete: boolean;
    selectedIds?: string[];
    onSelect?: (ids: string[]) => void;
    users?: UserProfile[];
    duplicatingIds?: Set<string>;
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
    audits, isLoading, onEdit, onDelete, onDuplicate, onOpen, canEdit, canDelete, selectedIds = [], onSelect, users, duplicatingIds = new Set(),
}) => {

    const columns = useMemo<ColumnDef<Audit>[]>(() => [
        {
            id: 'select',
            header: ({ table }) => {
                const isAllSelected = table.getIsAllPageRowsSelected();
                const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
                    const allIds = audits.map(a => a.id);
                    onSelect?.(e.target.checked ? allIds : []);
                };
                return (
                    <div className="px-1">
                        <input checked={isAllSelected} onChange={handleSelectAll}
                            type="checkbox" disabled={!onSelect} aria-label="Tout sélectionner"
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                    </div>
                );
            },
            cell: ({ row }) => {
                const isSelected = selectedIds.includes(row.original.id);
                const handleSelectRow = (e: React.ChangeEvent<HTMLInputElement>) => {
                    if (e.target.checked) {
                        onSelect?.([...selectedIds, row.original.id]);
                    } else {
                        onSelect?.(selectedIds.filter(id => id !== row.original.id));
                    }
                };
                return (
                    <div className="px-1">
                        <input checked={isSelected} onChange={handleSelectRow}
                            type="checkbox" disabled={!onSelect} aria-label={`Sélectionner l'audit ${row.original.name}`}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                    </div>
                );
            },
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
            cell: ({ row }) => {
                const auditorName = row.original.auditor;
                if (!auditorName) return <span className="text-slate-400 italic">Non assigné</span>;

                const auditorUser = users?.find(u => u.displayName === auditorName || u.email === auditorName);

                return (
                    <div className="flex items-center gap-2">
                        <img
                            src={getUserAvatarUrl(auditorUser?.photoURL, auditorUser?.role)}
                            alt={auditorName}
                            className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 object-cover bg-slate-100 dark:bg-slate-800"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getUserAvatarUrl(null, auditorUser?.role);
                            }}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{auditorName}</span>
                    </div>
                );
            }
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
            cell: ({ row }) => {
                const isDuplicating = duplicatingIds.has(row.original.id);
                const menuItems: RowActionItem[] = [
                    {
                        label: 'Ouvrir',
                        icon: ClipboardCheck,
                        onClick: () => onOpen(row.original),
                    },
                    ...(canEdit ? [{
                        label: 'Modifier',
                        icon: Edit,
                        onClick: () => onEdit(row.original),
                    }] : []),
                    ...(onDuplicate && canEdit ? [{
                        label: 'Dupliquer',
                        icon: Copy,
                        onClick: () => onDuplicate(row.original),
                        disabled: isDuplicating,
                    }] : []),
                    ...(canDelete ? [{
                        label: 'Supprimer',
                        icon: Trash2,
                        onClick: () => onDelete(row.original),
                        variant: 'danger' as const,
                    }] : []),
                ];

                return (
                    <div className="flex justify-end">
                        <RowActionsMenu
                            items={menuItems}
                            aria-label={`Actions pour ${row.original.name}`}
                        />
                    </div>
                );
            }
        }
    ], [canEdit, canDelete, onEdit, onDelete, onDuplicate, onOpen, onSelect, selectedIds, audits, users, duplicatingIds]);

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
