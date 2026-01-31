
import React, { useMemo } from 'react';
import { Project, UserProfile } from '../../types';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { Edit, Trash2, Copy } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { RowActionsMenu, RowActionItem } from '../ui/RowActionsMenu';
import { canDeleteResource } from '../../utils/permissions';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { ClipboardList, ShieldCheck, Rocket, Building2, Siren, Target } from '../ui/Icons';

const getProjectCategoryStyles = (category: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('audit')) return { icon: ClipboardList, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800', progress: 'bg-amber-500' };
    if (cat.includes('conformité') || cat.includes('compliance')) return { icon: ShieldCheck, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800', progress: 'bg-blue-500' };
    if (cat.includes('déploiement') || cat.includes('technique')) return { icon: Rocket, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/50', progress: 'bg-emerald-500' };
    if (cat.includes('gouvernance')) return { icon: Building2, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/50', progress: 'bg-indigo-500' };
    if (cat.includes('crise')) return { icon: Siren, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-800', progress: 'bg-red-500' };
    return { icon: Target, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-white/5', border: 'border-border/40 dark:border-border/40', progress: 'bg-brand-500' };
};

import { useStore } from '../../store';

interface ProjectListProps {
    projects: Project[];
    loading: boolean;
    canEdit: boolean;
    user: UserProfile | null;
    usersList?: UserProfile[]; // Made optional to avoid immediate break, but should be passed
    onEdit: (project: Project) => void;
    onDelete: (id: string, name: string) => void;
    onDuplicate?: (project: Project) => void;
    onBulkDelete: (ids: string[]) => void;
    onSelect: (project: Project) => void;
    duplicatingIds?: Set<string>;
}

export const ProjectList: React.FC<ProjectListProps> = ({
    projects, loading, canEdit, user, usersList = [], onEdit, onDelete, onDuplicate, onBulkDelete, onSelect, duplicatingIds = new Set(),
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



    const columns = useMemo<ColumnDef<Project>[]>(() => [
        {
            accessorKey: 'name',
            header: t('projects.columns.name'),
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.name}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-1">{row.original.description}</div>
                </div>
            )
        },
        {
            accessorKey: 'category',
            header: 'Catégorie',
            meta: { className: 'hidden sm:table-cell' },
            cell: ({ row }) => {
                const styles = getProjectCategoryStyles(row.original.category || '');
                const CategoryIcon = styles.icon;
                return (
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${styles.bg} ${styles.color} border ${styles.border} shadow-sm-premium`}>
                            <CategoryIcon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {row.original.category || 'Standard'}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'manager',
            header: t('projects.columns.manager'),
            meta: { className: 'hidden lg:table-cell' },
            cell: ({ row }) => {
                const managerUser = usersList.find(u => u.uid === row.original.managerId);
                return (
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <img
                                src={getUserAvatarUrl(managerUser?.photoURL, managerUser?.role)}
                                alt={row.original.manager}
                                className="w-6 h-6 rounded-full border border-brand-200 dark:border-brand-800 object-cover"
                            />
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300 dark:text-muted-foreground">{row.original.manager}</span>
                    </div>
                );
            }
        },
        {
            id: 'members',
            header: t('projects.columns.team'),
            meta: { className: 'hidden xl:table-cell' },
            cell: ({ row }) => {
                const memberIds = row.original.members || [];
                const members = usersList.filter(u => memberIds.includes(u.uid));
                const displayMembers = members.slice(0, 3);
                const remaining = members.length - 3;

                return (
                    <div className="flex -space-x-2">
                        {displayMembers.map(m => (
                            <CustomTooltip key={m.uid} content={m.displayName || m.email}>
                                <div className="relative">
                                    <img
                                        src={getUserAvatarUrl(m.photoURL, m.role)}
                                        alt={m.displayName || 'Membre'}
                                        className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 object-cover bg-slate-100 dark:bg-slate-800"
                                    />
                                </div>
                            </CustomTooltip>
                        ))}
                        {remaining > 0 && (
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[11px] font-bold text-slate-500">
                                +{remaining}
                            </div>
                        )}
                        {memberIds.length === 0 && <span className="text-muted-foreground text-xs">-</span>}
                    </div>
                );
            }
        },
        {
            accessorKey: 'status',
            header: t('projects.columns.status'),
            meta: { className: 'hidden sm:table-cell' },
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
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => {
                const styles = getProjectCategoryStyles(row.original.category || '');
                return (
                    <div className="flex items-center gap-3 w-32">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                            <div className={`h-1.5 ${styles.progress} rounded-full shadow-sm`} style={{ width: `${row.original.progress}%` }}></div>
                        </div>
                        <span className={`text-xs font-bold ${styles.color}`}>{row.original.progress}%</span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'dueDate',
            header: t('projects.columns.dueDate'),
            meta: { className: 'hidden lg:table-cell' },
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-muted-foreground font-medium text-xs">
                    {new Date(row.original.dueDate).toLocaleDateString()}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                if (!canEdit) return null;

                const isDuplicating = duplicatingIds.has(row.original.id);
                const isDeleting = deletingIds.has(row.original.id);
                const menuItems: RowActionItem[] = [
                    {
                        label: t('projects.tooltips.edit'),
                        icon: Edit,
                        onClick: () => onEdit(row.original),
                    },
                    ...(onDuplicate ? [{
                        label: t('common.duplicate') || 'Dupliquer',
                        icon: Copy,
                        onClick: () => onDuplicate(row.original),
                        disabled: isDuplicating,
                    }] : []),
                    ...(canDeleteResource(user, 'Project') ? [{
                        label: t('projects.tooltips.delete'),
                        icon: Trash2,
                        onClick: () => handleDelete(row.original.id, row.original.name),
                        variant: 'danger' as const,
                        disabled: isDeleting,
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
    ], [canEdit, onEdit, onDuplicate, deletingIds, duplicatingIds, user, usersList, t, handleDelete]);

    return (
        <motion.div variants={slideUpVariants} className="glass-premium w-full max-w-full rounded-3xl overflow-hidden shadow-sm border border-border/40 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="relative z-10">
                <DataTable
                    columns={columns}
                    data={projects}
                    selectable={canEdit}
                    onBulkDelete={onBulkDelete}
                    onRowClick={onSelect}
                    searchable={false}
                    loading={loading}
                />
            </div>
        </motion.div>
    );
};
