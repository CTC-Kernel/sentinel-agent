
import React, { useMemo } from 'react';
import { Project, UserProfile } from '../../types';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { Edit, Trash2 } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { canDeleteResource } from '../../utils/permissions';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { getUserAvatarUrl } from '../../utils/avatarUtils';

import { useStore } from '../../store';

interface ProjectListProps {
    projects: Project[];
    loading: boolean;
    canEdit: boolean;
    user: UserProfile | null;
    usersList?: UserProfile[]; // Made optional to avoid immediate break, but should be passed
    onEdit: (project: Project) => void;
    onDelete: (id: string, name: string) => void;
    onBulkDelete: (ids: string[]) => void;
    onSelect: (project: Project) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
    projects, loading, canEdit, user, usersList = [], onEdit, onDelete, onBulkDelete, onSelect
}) => {
    const { t } = useStore();
    const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());

    const handleDelete = React.useCallback(async (id: string, name: string) => {
        if (deletingIds.has(id)) return;
        setDeletingIds(prev => new Set(prev).add(id));
        try {
            await onDelete(id, name);
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [deletingIds, onDelete]);

    const createDeleteHandler = React.useCallback((id: string, name: string) => (e: React.MouseEvent) => {
        e.stopPropagation();
        void handleDelete(id, name);
    }, [handleDelete]);

    const columns = useMemo<ColumnDef<Project>[]>(() => [
        {
            accessorKey: 'name',
            header: t('projects.columns.name'),
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.name}</div>
                    <div className="text-xs text-slate-600 font-medium line-clamp-1">{row.original.description}</div>
                </div>
            )
        },
        {
            accessorKey: 'manager',
            header: t('projects.columns.manager'),
            cell: ({ row }) => {
                const managerUser = usersList.find(u => u.uid === row.original.managerId);
                return (
                    <div className="flex items-center gap-2">
                        <img
                            src={getUserAvatarUrl(managerUser?.photoURL, managerUser?.role)}
                            alt={row.original.manager}
                            className="w-6 h-6 rounded-full border border-brand-200 dark:border-brand-800 object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getUserAvatarUrl(null, managerUser?.role);
                            }}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{row.original.manager}</span>
                    </div>
                );
            }
        },
        {
            id: 'members',
            header: t('projects.columns.team'),
            cell: ({ row }) => {
                const memberIds = row.original.members || [];
                const members = usersList.filter(u => memberIds.includes(u.uid));
                const displayMembers = members.slice(0, 3);
                const remaining = members.length - 3;

                return (
                    <div className="flex -space-x-2">
                        {displayMembers.map(m => (
                            <CustomTooltip key={m.uid} content={m.displayName || m.email}>
                                <img
                                    src={getUserAvatarUrl(m.photoURL, m.role)}
                                    alt={m.displayName || 'Membre'}
                                    className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 object-cover bg-slate-100 dark:bg-slate-800"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = getUserAvatarUrl(null, m.role);
                                    }}
                                />
                            </CustomTooltip>
                        ))}
                        {remaining > 0 && (
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                +{remaining}
                            </div>
                        )}
                        {memberIds.length === 0 && <span className="text-slate-400 text-xs">-</span>}
                    </div>
                );
            }
        },
        {
            accessorKey: 'status',
            header: t('projects.columns.status'),
            cell: ({ row }) => (
                <Badge status={
                    row.original.status === 'En cours' ? 'info' :
                        row.original.status === 'Terminé' ? 'success' :
                            row.original.status === 'Suspendu' ? 'error' : 'neutral'
                } variant="soft" size="sm">
                    {(() => {
                        const s = row.original.status;
                        if (s === 'En cours') return t('projects.board.inProgress');
                        if (s === 'Terminé') return t('projects.board.done');
                        if (s === 'Suspendu') return t('projects.status.suspended');
                        return s;
                    })()}
                </Badge>
            )
        },
        {
            accessorKey: 'progress',
            header: t('projects.columns.progress'),
            cell: ({ row }) => (
                <div className="flex items-center gap-3 w-32">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <div className="h-1.5 bg-brand-500 rounded-full" style={{ width: `${row.original.progress}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{row.original.progress}%</span>
                </div>
            )
        },
        {
            accessorKey: 'dueDate',
            header: t('projects.columns.dueDate'),
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                    {new Date(row.original.dueDate).toLocaleDateString()}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()} role="presentation">
                    {canEdit && (
                        <>
                            <CustomTooltip content={t('projects.tooltips.edit')}>
                                <button onClick={(e) => { e.stopPropagation(); onEdit(row.original); }} className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                    <Edit className="h-4 w-4" />
                                </button>
                            </CustomTooltip>
                            {canDeleteResource(user, 'Project') && (
                                <CustomTooltip content={deletingIds.has(row.original.id) ? "Suppression..." : t('projects.tooltips.delete')}>
                                    <button onClick={createDeleteHandler(row.original.id, row.original.name)} disabled={deletingIds.has(row.original.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed" aria-label={`Supprimer le projet ${row.original.name}`}>
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </CustomTooltip>
                            )}
                        </>
                    )}
                </div>
            )
        }
    ], [canEdit, onEdit, deletingIds, user, usersList, t, createDeleteHandler]);

    return (
        <motion.div variants={slideUpVariants} className="glass-panel w-full max-w-full rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="relative z-10">
                <DataTable
                    columns={columns}
                    data={projects}
                    selectable={true}
                    onBulkDelete={onBulkDelete}
                    onRowClick={onSelect}
                    searchable={false}
                    loading={loading}
                />
            </div>
        </motion.div>
    );
};
