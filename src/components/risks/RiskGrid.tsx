import React, { useState } from 'react';
import { RiskCalculator } from '../../utils/RiskCalculator';

import { Server, TrendingDown, TrendingUp, ArrowRight, Clock, LucideIcon, ShieldAlert, Edit, Trash2 } from '../ui/Icons';
import { CardSkeleton } from '../ui/Skeleton';
import { Badge } from '../ui/Badge';
import { SafeHTML } from '../ui/SafeHTML';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/button';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Risk, Asset } from '../../types';
import { GlassCard } from '../ui/GlassCard';

interface RiskGridProps {
    risks: Risk[];
    loading: boolean;
    onSelect: (risk: Risk) => void;
    assets: Asset[];
    emptyStateIcon: LucideIcon; // Generic icon component
    emptyStateTitle: string;
    emptyStateDescription: string;
    onEmptyStateAction?: () => void;
    emptyStateActionLabel?: string;
    onEdit?: (risk: Risk) => void;
    onDelete?: (id: string, name: string) => void;
    canEdit?: boolean;
}

export const RiskGrid: React.FC<RiskGridProps> = ({
    risks, loading, onSelect, assets, emptyStateIcon, emptyStateTitle, emptyStateDescription, onEmptyStateAction, emptyStateActionLabel,
    onEdit, onDelete, canEdit
}) => {
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    const handleDelete = React.useCallback(async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (deletingIds.has(id) || !onDelete) return;

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

    const getAssetName = (id?: string) => assets.find(a => a.id === id)?.name || 'Actif inconnu';

    const isReviewOverdue = (risk: Risk) => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return !risk.lastReviewDate || new Date(risk.lastReviewDate) < oneYearAgo;
    };

    const getSLAStatus = (risk: Risk) => {
        if (risk.strategy === 'Accepter' || !risk.treatmentDeadline) return null;
        if (risk.status === 'Fermé') return null;

        const deadline = new Date(risk.treatmentDeadline);
        const now = new Date();
        const diffTime = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { status: 'overdue', days: Math.abs(diffDays), label: `Retard ${Math.abs(diffDays)} j`, color: 'text-error-text bg-error-bg border-error-border/50' };
        if (diffDays <= 7) return { status: 'warning', days: diffDays, label: `J - ${diffDays} `, color: 'text-warning-text bg-warning-bg border-warning-border/50' };
        return { status: 'ok', days: diffDays, label: `${diffDays} j`, color: 'text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-white/10 shadow-sm shadow-black/5' };
    };

    if (loading) return <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 animate-fade-in"><div className="col-span-full"><CardSkeleton count={3} /></div></div>;

    if (risks.length === 0) {
        return (
            <div className="col-span-full animate-fade-in">
                <EmptyState
                    icon={emptyStateIcon || ShieldAlert}
                    title={emptyStateTitle || "Aucun risque identifié"}
                    description={emptyStateDescription || "Identifiez et évaluez les risques pour protéger votre organisation."}
                    actionLabel={emptyStateActionLabel}
                    onAction={onEmptyStateAction}
                />
            </div>
        );
    }

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 animate-fade-in">
            {risks.map(risk => {
                const level = {
                    label: RiskCalculator.getCriticalityLabel(risk.score),
                    status: RiskCalculator.getBadgeStatus(risk.score)
                };
                const residualScore = risk.residualScore || risk.score;
                const isMitigated = residualScore < risk.score;
                const trend = risk.previousScore && risk.score > risk.previousScore ? 'up' : risk.previousScore && risk.score < risk.previousScore ? 'down' : 'stable';

                return (
                    <GlassCard
                        key={risk.id}
                        onClick={() => onSelect(risk)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(risk);
                            }
                        }}
                        className="group p-6 rounded-3xl flex flex-col h-full relative"
                        hoverEffect={true}
                    >

                        {/* Hover Overlay with Actions */}
                        <div className="absolute top-4 right-4 z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                            {canEdit && onEdit && (
                                <CustomTooltip content="Modifier">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 w-8 p-0 bg-white/90 dark:bg-white/10 shadow-sm backdrop-blur-sm hover:text-brand-600 transition-all hover:scale-110 rounded-xl"
                                        onClick={(e) => { e.stopPropagation(); onEdit(risk); }}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </CustomTooltip>
                            )}
                            {canEdit && onDelete && (
                                <CustomTooltip content={deletingIds.has(risk.id) ? "Suppression..." : "Supprimer"}>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 w-8 p-0 bg-white/90 dark:bg-white/10 shadow-sm backdrop-blur-sm hover:text-error-text transition-all hover:scale-110 rounded-xl"
                                        onClick={(e) => handleDelete(e, risk.id, risk.threat)}
                                        disabled={deletingIds.has(risk.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CustomTooltip>
                            )}
                        </div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-5">
                                <div className="flex items-center gap-2">
                                    <Badge status={level.status} variant="soft" size="sm">
                                        {level.label} {risk.score}
                                    </Badge>
                                    {trend === 'up' && <span className="text-error-text" title="En hausse"><TrendingUp className="h-4 w-4" /></span>}
                                    {trend === 'down' && <span className="text-success-text" title="En baisse"><TrendingDown className="h-4 w-4" /></span>}
                                    {isMitigated && (<><ArrowRight className="w-3 h-3 text-slate-500" /><div className="px-2.5 py-1 text-[10px] font-bold rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800">Résiduel: {residualScore}</div></>)}
                                </div>
                            </div>
                            <div className="mb-4 flex-1">
                                <div className="flex items-center mb-3">
                                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 mr-2.5"><Server className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide truncate">{getAssetName(risk.assetId)}</span>
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mb-2 line-clamp-2">{risk.threat}</h4>
                                <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-500/5 dark:bg-white/5 p-3 rounded-2xl inline-block w-full border border-slate-200/50 dark:border-white/5">
                                    <span className="font-bold text-xs uppercase text-slate-500 block mb-1">Vulnérabilité</span>
                                    <SafeHTML content={risk.vulnerability || ''} className="line-clamp-3" />
                                </div>
                            </div>
                            <div className="space-y-3 pt-4 border-t border-dashed border-gray-200 dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1.5 items-start">
                                        <span className="text-xs font-medium text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{risk.strategy}</span>
                                        {(() => {
                                            const sla = getSLAStatus(risk);
                                            if (sla) return (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold ${sla.color}`}>
                                                    <Clock className="w-3 h-3 mr-1" /> {sla.label}
                                                </span>
                                            )
                                            return null;
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {risk.treatment?.slaStatus && risk.treatment.status !== 'Terminé' && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${risk.treatment.slaStatus === 'Breached' ? 'bg-red-100 text-red-700 border-red-200' :
                                                risk.treatment.slaStatus === 'At Risk' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                    'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                }`}>
                                                SLA: {risk.treatment.slaStatus}
                                            </span>
                                        )}
                                        <Badge
                                            status={risk.status === 'Ouvert' ? 'error' : risk.status === 'En cours' ? 'warning' : 'success'}
                                            variant="outline"
                                        >
                                            {risk.status}
                                        </Badge>
                                    </div>
                                </div>
                                {isReviewOverdue(risk) && (
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-[10px] font-bold">
                                            <Clock className="h-3 w-3 mr-1" /> Revue en retard
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </GlassCard>
                );
            })}
        </div>
    );
};
