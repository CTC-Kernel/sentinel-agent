import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Risk, Asset, UserProfile, Control } from '../../../types';
import { ShieldAlert, Clock, Shield, CheckCircle, ShieldCheck, Share2, XCircle, FileText, AlertTriangle, CreditCard, Globe } from '../../ui/Icons';
import { Edit, Copy, Trash2 } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { DraftBadge } from '../../ui/DraftBadge';
import { RowActionsMenu, RowActionItem } from '../../ui/RowActionsMenu';
import { getRiskLevel, getSLAStatus, CONTROL_STATUS_WEIGHTS } from '../../../utils/riskUtils';
import { getUserAvatarUrl } from '../../../utils/avatarUtils';
import { RISK_DRAFT_STATUS } from '../../../utils/riskDraftSchema';

interface UseRiskColumnsProps {
    canEdit: boolean;
    assets: Asset[];
    users: UserProfile[];
    controls?: Control[];
    onEdit: (risk: Risk) => void;
    onDelete: (id: string, name: string) => void;
    onDuplicate?: (risk: Risk) => void;
    deletingIds: Set<string>;
    duplicatingIds?: Set<string>;
}

/**
 * Calculate mitigation coverage for a risk based on linked controls
 */
function getMitigationCoverage(risk: Risk, controls: Control[]): { count: number; coverage: number } {
    const linkedIds = risk.mitigationControlIds || [];
    if (linkedIds.length === 0) return { count: 0, coverage: 0 };

    const linkedControls = linkedIds
        .map(id => controls.find(c => c.id === id))
        .filter((c): c is Control => c !== undefined);

    if (linkedControls.length === 0) return { count: linkedIds.length, coverage: 0 };

    const effectiveScore = linkedControls.reduce((sum, ctrl) => {
        return sum + (CONTROL_STATUS_WEIGHTS[ctrl.status] ?? 0);
    }, 0);

    const coverage = Math.min(Math.round((effectiveScore / linkedControls.length) * 100), 100);
    return { count: linkedControls.length, coverage };
}

const getStrategyStyles = (strategy: string) => {
    switch (strategy) {
        case 'Accepter':
            return {
                icon: CheckCircle,
                color: 'text-slate-600 dark:text-slate-400',
                bg: 'bg-slate-100 dark:bg-slate-800',
                border: 'border-slate-200 dark:border-white/10',
                badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            };
        case 'Atténuer':
            return {
                icon: ShieldCheck,
                color: 'text-blue-600 dark:text-blue-400',
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                border: 'border-blue-100 dark:border-blue-800/50',
                badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-100 dark:border-blue-800'
            };
        case 'Transférer':
            return {
                icon: Share2,
                color: 'text-purple-600 dark:text-purple-400',
                bg: 'bg-purple-50 dark:bg-purple-900/20',
                border: 'border-purple-100 dark:border-purple-800/50',
                badge: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-100 dark:border-purple-800'
            };
        case 'Éviter':
            return {
                icon: XCircle,
                color: 'text-red-600 dark:text-red-400',
                bg: 'bg-red-50 dark:bg-red-900/20',
                border: 'border-red-100 dark:border-red-800/50',
                badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-100 dark:border-red-800'
            };
        default:
            return {
                icon: Shield,
                color: 'text-slate-600 dark:text-slate-400',
                bg: 'bg-slate-100 dark:bg-slate-800',
                border: 'border-slate-200 dark:border-white/10',
                badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            };
    }
};

const getCategoryStyles = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('financier')) return { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (cat.includes('opérationnel')) return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' };
    if (cat.includes('juridique') || cat.includes('compliance')) return { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' };
    if (cat.includes('cyber') || cat.includes('sécurité')) return { icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' };
    if (cat.includes('réputation')) return { icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' };
    return { icon: ShieldAlert, color: 'text-slate-600', bg: 'bg-slate-50' };
};

export const useRiskColumns = ({
    canEdit,
    assets,
    users,
    controls = [],
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
            header: 'Catégorie',
            accessorKey: 'category',
            cell: ({ row }) => {
                const category = row.original.category;
                if (!category) {
                    return <span className="text-xs text-slate-400 italic">Non définie</span>;
                }
                const styles = getCategoryStyles(category);
                const CategoryIcon = styles.icon;
                return (
                    <div className="flex items-center gap-2">
                        <div className={`p-1 rounded-md ${styles.bg} ${styles.color} dark:bg-white/5`}>
                            <CategoryIcon className="h-3 w-3" />
                        </div>
                        <span className="text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                            {category}
                        </span>
                    </div>
                );
            },
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
            cell: ({ row }) => {
                const styles = getStrategyStyles(row.original.strategy);
                const StrategyIcon = styles.icon;
                return (
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${styles.bg} ${styles.color} border ${styles.border}`}>
                            <StrategyIcon className="h-3.5 w-3.5" />
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-sm ${styles.badge}`}>
                            {row.original.strategy}
                        </span>
                    </div>
                );
            },
        },
        {
            header: 'Contrôles',
            id: 'controls',
            accessorFn: (row) => row.mitigationControlIds?.length || 0,
            cell: ({ row }) => {
                const { count, coverage } = getMitigationCoverage(row.original, controls);
                if (count === 0) {
                    return (
                        <span className="text-xs text-slate-400 italic">Aucun</span>
                    );
                }
                return (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{count}</span>
                        </div>
                        <div className="flex items-center gap-1" title={`Couverture: ${coverage}%`}>
                            <div className="w-10 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${coverage >= 80 ? 'bg-success-text' :
                                        coverage >= 50 ? 'bg-warning-text' : 'bg-error-text'
                                        }`}
                                    style={{ width: `${coverage}%` }}
                                />
                            </div>
                        </div>
                    </div>
                );
            },
        },
        {
            header: 'Statut',
            accessorKey: 'status',
            cell: ({ row }) => {
                const isDraft = row.original.status === RISK_DRAFT_STATUS;
                return (
                    <div className="flex flex-col items-start gap-1">
                        {isDraft ? (
                            <DraftBadge showIcon size="sm" />
                        ) : (
                            <Badge status={row.original.status === 'Ouvert' ? 'error' : row.original.status === 'En cours' ? 'warning' : row.original.status === 'En attente de validation' ? 'info' : 'success'} variant="outline">
                                {row.original.status}
                            </Badge>
                        )}

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
                );
            },
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
    ], [canEdit, assets, controls, onEdit, onDelete, onDuplicate, deletingIds, duplicatingIds, getOwnerName, users]);
};
