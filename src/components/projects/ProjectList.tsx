
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

interface ProjectListProps {
    projects: Project[];
    loading: boolean;
    canEdit: boolean;
    user: UserProfile | null;
    onEdit: (project: Project) => void;
    onDelete: (id: string, name: string) => void;
    onBulkDelete: (ids: string[]) => void;
    onSelect: (project: Project) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
    projects, loading, canEdit, user, onEdit, onDelete, onBulkDelete, onSelect
}) => {

    const columns = useMemo<ColumnDef<Project>[]>(() => [
        {
            accessorKey: 'name',
            header: 'Projet',
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.name}</div>
                    <div className="text-xs text-slate-600 font-medium line-clamp-1">{row.original.description}</div>
                </div>
            )
        },
        {
            accessorKey: 'manager',
            header: 'Responsable',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                        {row.original.manager.charAt(0)}
                    </div>
                    {row.original.manager}
                </div>
            )
        },
        {
            accessorKey: 'status',
            header: 'Statut',
            cell: ({ row }) => (
                <Badge status={row.original.status === 'En cours' ? 'info' : row.original.status === 'Terminé' ? 'success' : row.original.status === 'Suspendu' ? 'error' : 'neutral'} variant="soft" size="sm">
                    {row.original.status}
                </Badge>
            )
        },
        {
            accessorKey: 'progress',
            header: 'Progression',
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
            header: 'Échéance',
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {new Date(row.original.dueDate).toLocaleDateString()}
                </span>
            )
        },
        {
            header: 'Tâches',
            accessorFn: (row) => row.tasks?.length || 0,
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium ml-4">
                    {row.original.tasks?.length || 0}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                        <>
                            <CustomTooltip content="Modifier le projet">
                                <button onClick={(e) => { e.stopPropagation(); onEdit(row.original); }} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100">
                                    <Edit className="h-4 w-4" />
                                </button>
                            </CustomTooltip>
                            {canDeleteResource(user, 'Project') && (
                                <CustomTooltip content="Supprimer le projet">
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(row.original.id, row.original.name); }} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </CustomTooltip>
                            )}
                        </>
                    )}
                </div>
            )
        }
    ], [canEdit, onEdit, onDelete, user]);

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
