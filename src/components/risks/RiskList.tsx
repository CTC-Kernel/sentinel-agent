import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Clock, Edit, Trash2 } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Risk, Asset } from '../../types';
import { slideUpVariants } from '../ui/animationVariants';

interface RiskListProps {
    risks: Risk[];
    loading: boolean;
    canEdit: boolean;
    assets: Asset[];
    onEdit: (risk: Risk) => void;
    onDelete: (id: string, name: string) => void;
    onBulkDelete: (ids: string[]) => void;
    onSelect: (risk: Risk) => void;
}

export const RiskList: React.FC<RiskListProps> = ({
    risks, loading, canEdit, assets, onEdit, onDelete, onBulkDelete, onSelect
}) => {

    // Helper to get asset name (could be passed down or use memoized map)
    const getAssetName = (id?: string) => assets.find(a => a.id === id)?.name || 'Actif inconnu';

    const getRiskLevel = (score: number) => {
        if (score >= 15) return { label: 'Critique', status: 'error' as const };
        if (score >= 10) return { label: 'Élevé', status: 'warning' as const };
        if (score >= 5) return { label: 'Moyen', status: 'info' as const };
        return { label: 'Faible', status: 'success' as const };
    };

    const getSLAStatus = (risk: Risk) => {
        if (risk.strategy === 'Accepter' || !risk.treatmentDeadline) return null;
        if (risk.status === 'Fermé') return null;

        const deadline = new Date(risk.treatmentDeadline);
        const now = new Date();
        const diffTime = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { status: 'overdue', days: Math.abs(diffDays), label: `Retard ${Math.abs(diffDays)}j`, color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800' };
        if (diffDays <= 7) return { status: 'warning', days: diffDays, label: `J-${diffDays}`, color: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800' };
        return { status: 'ok', days: diffDays, label: `${diffDays}j`, color: 'text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-white/10' };
    };

    return (
        <motion.div variants={slideUpVariants} className="glass-panel w-full max-w-full rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="relative z-10">
                <DataTable
                    columns={[
                        {
                            header: 'Menace',
                            accessorKey: 'threat',
                            cell: ({ row }) => (
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center mr-4 text-slate-600 dark:text-slate-300">
                                        <ShieldAlert className="h-5 w-5" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.threat}</div>
                                        <div className="text-xs text-slate-600 font-medium">{row.original.owner || 'Non assigné'}</div>
                                    </div>
                                </div>
                            ),
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
                            accessorFn: (row) => getAssetName(row.assetId),
                            cell: ({ row }) => (
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                    {getAssetName(row.original.assetId)}
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
                                    <Badge status={row.original.status === 'Ouvert' ? 'error' : row.original.status === 'En cours' ? 'warning' : 'success'} variant="outline">
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
                                <div className="flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}>
                                    {canEdit && (
                                        <>
                                            <CustomTooltip content="Modifier le risque">
                                                <button onClick={() => onEdit(row.original)} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all">
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                            </CustomTooltip>
                                            <CustomTooltip content="Supprimer le risque">
                                                <button onClick={() => onDelete(row.original.id, row.original.threat)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </CustomTooltip>
                                        </>
                                    )}
                                </div>
                            ),
                        },
                    ]}
                    data={risks}
                    selectable={canEdit}
                    onRowClick={(risk) => onSelect(risk)}
                    searchable={false}
                    exportable={false}
                    loading={loading}
                    onBulkDelete={onBulkDelete}
                    emptyState={
                        <EmptyState
                            icon={ShieldAlert}
                            title="Aucun risque identifié"
                            description="Votre registre de risques est parfaitement clean. Commencez par ajouter une nouvelle menace."
                            actionLabel="Créer un risque"
                            onAction={() => window.dispatchEvent(new CustomEvent('open-risk-modal'))} // Assuming we have an event listener or we can pass a prop for creation
                            color="emerald"
                        />
                    }
                />
            </div>
        </motion.div>
    );
};
