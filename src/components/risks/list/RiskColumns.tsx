import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Risk, Asset, UserProfile } from '../../../types';
import { ShieldAlert, Clock } from 'lucide-react';
import { Edit, Copy, Trash2 } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { RowActionsMenu, RowActionItem } from '../../ui/RowActionsMenu';
import { getRiskLevel, getSLAStatus } from '../../../utils/riskUtils';
import { getUserAvatarUrl } from '../../../utils/avatarUtils';

interface UseRiskColumnsProps {
    canEdit: boolean;
    assets: Asset[];
    users: UserProfile[];
    onEdit: (risk: Risk) => void;
    onDelete: (id: string, name: string) => void;
    onDuplicate?: (risk: Risk) => void;
    deletingIds: Set<string>;
    duplicatingIds?: Set<string>;
}

export const useRiskColumns = ({
    canEdit,
    assets,
    users,
    onEdit,
    onDelete,
    onDuplicate,
    deletingIds,
    duplicatingIds = new Set(),
}: UseRiskColumnsProps): ColumnDef<Risk>[] => {

    const getOwnerName = React.useCallback((ownerId?: string) => {
        if (!ownerId) return 'Non assigné';
        const user = users.find(u => u.uid === ownerId);
        return user ? (user.displayName || user.email) : ownerId;
    }, [users]);

    return React.useMemo(() => [
        {
            header: 'Menace',
            accessorKey: 'threat',
            cell: ({ row }) => {
                const ownerUser = users.find(u => u.uid === row.original.owner);
                return (
                    <div className="flex items-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center mr-4 text-slate-600 dark:text-slate-300 overflow-hidden">
                            {ownerUser ? (
                                <img
                                    src={getUserAvatarUrl(ownerUser.photoURL, ownerUser.role)}
                                    alt={getOwnerName(row.original.owner)}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = getUserAvatarUrl(null, ownerUser.role);
                                    }}
                                />
                            ) : (
                                <ShieldAlert className="h-5 w-5" strokeWidth={1.5} />
                            )}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.threat}</div>
                            <div className="text-xs text-slate-600 font-medium">{getOwnerName(row.original.owner)}</div>
                        </div>
                    </div>
                );
            },
        },
        {
            header: 'Vulnérabilité',
            accessorKey: 'vulnerability',
            cell: ({ row }) => (
                <div className="max-w-xs truncate" title={row.original.vulnerability}>
                    {row.original.vulnerability}
                </div>
            ),
        },
        {
            header: 'Actif',
            accessorFn: (row) => assets.find(a => a.id === row.assetId)?.name || 'Actif inconnu',
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {assets.find(a => a.id === row.original.assetId)?.name || 'Actif inconnu'}
                </span>
            ),
        },
        {
            header: 'Score',
            accessorKey: 'score',
            cell: ({ row }) => (
                <Badge status={getRiskLevel(row.original.score).status} variant="soft" size="sm">
                    {row.original.score}
                </Badge>
            ),
        },
        {
            header: 'Stratégie',
            accessorKey: 'strategy',
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {row.original.strategy}
                </span>
            ),
        },
        {
            header: 'Statut',
            accessorKey: 'status',
            cell: ({ row }) => (
                <div className="flex flex-col items-start gap-1">
                    <Badge status={row.original.status === 'Ouvert' ? 'error' : row.original.status === 'En cours' ? 'warning' : row.original.status === 'En attente de validation' ? 'info' : 'success'} variant="outline">
                        {row.original.status}
                    </Badge>

                    {(() => {
                        const sla = getSLAStatus(row.original);
                        if (sla) return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold mt-1 ${sla.color}`}>
                                <Clock className="h-3 w-3 mr-1" /> {sla.label}
                            </span>
                        );
                        return null;
                    })()}
                </div>
            ),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                if (!canEdit) return null;

                const isDeleting = deletingIds.has(row.original.id);
                const isDuplicating = duplicatingIds.has(row.original.id);

                const menuItems: RowActionItem[] = [
                    {
                        label: 'Modifier',
                        icon: Edit,
                        onClick: () => onEdit(row.original),
                    },
                    ...(onDuplicate ? [{
                        label: 'Dupliquer',
                        icon: Copy,
                        onClick: () => onDuplicate(row.original),
                        disabled: isDuplicating,
                    }] : []),
                    {
                        label: 'Supprimer',
                        icon: Trash2,
                        onClick: () => onDelete(row.original.id, row.original.threat),
                        variant: 'danger' as const,
                        disabled: isDeleting,
                    },
                ];

                return (
                    <div className="flex justify-end">
                        <RowActionsMenu
                            items={menuItems}
                            aria-label={`Actions pour ${row.original.threat}`}
                        />
                    </div>
                );
            },
        },
    ], [canEdit, assets, onEdit, onDelete, onDuplicate, deletingIds, duplicatingIds, getOwnerName, users]);
};
