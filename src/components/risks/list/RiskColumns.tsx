import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Risk, Asset, UserProfile } from '../../../types';
import { ShieldAlert, Clock, Edit, Trash2 } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/button';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { getRiskLevel, getSLAStatus } from '../../../utils/riskUtils';
import { getUserAvatarUrl } from '../../../utils/avatarUtils';

interface UseRiskColumnsProps {
    canEdit: boolean;
    assets: Asset[];
    users: UserProfile[];
    onEdit: (risk: Risk) => void;
    onDelete: (id: string, name: string) => void;
    deletingIds: Set<string>;
}

export const useRiskColumns = ({
    canEdit,
    assets,
    users,
    onEdit,
    onDelete,
    deletingIds
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
            cell: ({ row }) => (
                <div className="flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()} role="presentation">
                    {canEdit && (
                        <>
                            <CustomTooltip content="Modifier le risque">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onEdit(row.original)}
                                    className="h-8 w-8 p-0"
                                >
                                    <Edit className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                </Button>
                            </CustomTooltip>
                            <CustomTooltip content={deletingIds.has(row.original.id) ? "Suppression..." : "Supprimer le risque"}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDelete(row.original.id, row.original.threat)}
                                    disabled={deletingIds.has(row.original.id)}
                                    className="h-8 w-8 p-0 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    aria-label={`Supprimer le risque ${row.original.threat}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CustomTooltip>
                        </>
                    )}
                </div>
            ),
        },
    ], [canEdit, assets, onEdit, onDelete, deletingIds, getOwnerName, users]);
};
