import React from 'react';
import { Incident, Criticality } from '../../types';
import { Badge } from '../ui/Badge';
import { Edit, Trash2, Bot } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';
import { ShieldAlert } from '../ui/Icons';
import { useStore } from '../../store';
import { Skeleton } from '../ui/Skeleton';

interface IncidentKanbanProps {
    incidents: Incident[];
    onSelect: (incident: Incident) => void;
    onEdit?: (incident: Incident) => void;
    onDelete?: (id: string) => void;
    canEdit?: boolean;
    loading?: boolean;
}

export const IncidentKanban: React.FC<IncidentKanbanProps> = React.memo(({ incidents, onSelect, onEdit, onDelete, canEdit, loading }) => {
    const { t } = useStore();

    // Group incidents by status
    const groupedIncidents = React.useMemo(() => {
        const groups: Record<string, Incident[]> = {
            'Nouveau': [],
            'Analyse': [],
            'Contenu': [],
            'Résolu': [],
            'Fermé': []
        };

        incidents.forEach(inc => {
            if (groups[inc.status]) {
                groups[inc.status].push(inc);
            } else {
                // Fallback for unknown status
                if (!groups['Nouveau']) groups['Nouveau'] = [];
                groups['Nouveau'].push(inc);
            }
        });
        return groups;
    }, [incidents]);

    // Columns definition
    const COLUMNS = React.useMemo(() => [
        { id: 'Nouveau', title: t('incidents.status.new'), color: 'bg-indigo-500' },
        { id: 'Analyse', title: t('incidents.status.analysis'), color: 'bg-blue-500' },
        { id: 'Contenu', title: t('incidents.status.containment'), color: 'bg-amber-500' },
        { id: 'Résolu', title: t('incidents.status.resolved'), color: 'bg-emerald-500' },
        { id: 'Fermé', title: t('incidents.status.closed'), color: 'bg-slate-500' }
    ], [t]);

    const getSeverityLabel = (s: Criticality) => {
        switch (s) {
            case Criticality.CRITICAL: return t('incidents.severity.critical');
            case Criticality.HIGH: return t('incidents.severity.high');
            case Criticality.MEDIUM: return t('incidents.severity.medium');
            case Criticality.LOW: return t('incidents.severity.low');
            default: return s;
        }
    };

    return (
        <div className="flex h-full gap-6 overflow-x-auto pb-6">
            {COLUMNS.map(column => (
                <div key={column.id} className="min-w-[280px] sm:min-w-[320px] max-w-[280px] sm:max-w-[320px] flex flex-col h-full rounded-3xl bg-background/40 backdrop-blur-md border border-border/40">
                    {/* Column Header */}
                    <div className="p-4 border-b border-white/20 flex items-center justify-between sticky top-0 bg-inherit rounded-t-2xl z-10 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${column.color}`} />
                            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 dark:text-white">{column.title}</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-secondary/50 text-xs font-bold text-slate-600 dark:text-muted-foreground border border-border/20">
                            {loading ? '-' : (groupedIncidents[column.id]?.length || 0)}
                        </span>
                    </div>

                    {/* Column Content */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
                        {loading ? (
                            // Loading Skeletons
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="bg-white dark:bg-white/5 p-4 rounded-xl border border-white/10 shadow-sm space-y-3">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-4 w-16 rounded-full" />
                                        <Skeleton className="h-3 w-12 rounded" />
                                    </div>
                                    <Skeleton className="h-4 w-3/4 rounded" />
                                    <div className="flex justify-between pt-2">
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                        <Skeleton className="h-5 w-16 rounded" />
                                    </div>
                                </div>
                            ))
                        ) : groupedIncidents[column.id]?.length === 0 ? (
                            <div className="h-32 flex items-center justify-center">
                                <EmptyState
                                    compact
                                    icon={ShieldAlert}
                                    title={t('incidents.empty.title')}
                                    description={t('incidents.empty.desc')}
                                    color="slate"
                                />
                            </div>
                        ) : (
                            groupedIncidents[column.id]?.map(incident => (
                                <div
                                    key={incident.id}
                                    onClick={() => onSelect(incident)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onSelect(incident);
                                        }
                                    }}
                                    className="group relative bg-background/50 dark:bg-slate-900/50 p-4 rounded-3xl border border-border/40 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden"
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Incident: ${incident.title}`}
                                >
                                    {/* Actions Overlay */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-70 transition-opacity z-10">
                                        {canEdit && onEdit && (
                                            <CustomTooltip content={t('common.edit')}>
                                                <button
                                                    aria-label={`${t('common.edit')} l'incident ${incident.title}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEdit(incident);
                                                    }}
                                                    className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-slate-500 dark:text-slate-300 hover:text-brand-600 rounded-lg shadow-sm border border-slate-200 dark:border-white/10"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </button>
                                            </CustomTooltip>
                                        )}
                                        {canEdit && onDelete && (
                                            <CustomTooltip content={t('common.delete')}>
                                                <button
                                                    aria-label={`${t('common.delete')} l'incident ${incident.title}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(incident.id);
                                                    }}
                                                    className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-slate-500 dark:text-slate-300 hover:text-red-600 rounded-lg shadow-sm border border-slate-200 dark:border-white/10"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </CustomTooltip>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-start mb-2">
                                        <Badge
                                            status={
                                                incident.severity === Criticality.CRITICAL ? 'error' :
                                                    incident.severity === Criticality.HIGH ? 'warning' :
                                                        'info'
                                            }
                                            size="sm"
                                        >
                                            {getSeverityLabel(incident.severity)}
                                        </Badge>
                                        <span className="text-[11px] text-muted-foreground font-mono">
                                            {new Date(incident.dateReported).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">
                                        {incident.title}
                                    </h4>

                                    <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            {incident.reporter?.includes('Agent') ? (
                                                <>
                                                    <div className="w-5 h-5 rounded-full bg-brand-50 flex items-center justify-center">
                                                        <Bot className="w-3 h-3 text-brand-600" />
                                                    </div>
                                                    <span className="text-brand-600 font-medium">{t('onboarding.autoScan')}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[11px] font-bold">
                                                        {incident.reporter?.charAt(0) || '?'}
                                                    </div>
                                                    <span className="truncate max-w-[80px]">{incident.reporter}</span>
                                                </>
                                            )}
                                        </div>
                                        {incident.category && (
                                            <span className="px-1.5 py-0.5 rounded-lg bg-secondary/30 border border-border/30 text-[11px]">
                                                {incident.category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
});

IncidentKanban.displayName = 'IncidentKanban';
