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
        { id: 'Nouveau', title: t('incidents.status.new'), statusColor: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]' },
        { id: 'Analyse', title: t('incidents.status.analysis'), statusColor: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' },
        { id: 'Contenu', title: t('incidents.status.containment'), statusColor: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' },
        { id: 'Résolu', title: t('incidents.status.resolved'), statusColor: 'bg-emerald-500 shadow-[0_0_8_rgba(16,185,129,0.4)]' },
        { id: 'Fermé', title: t('incidents.status.closed'), statusColor: 'bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.4)]' }
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
        <div className="flex h-full gap-6 overflow-x-auto pb-6 custom-scrollbar px-1">
            {COLUMNS.map(column => (
                <div key={column.id || 'unknown'} className="min-w-[280px] sm:min-w-[320px] max-w-[280px] sm:max-w-[320px] flex flex-col h-full rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-border/40 shadow-premium">
                    {/* Column Header */}
                    <div className="p-4 border-b border-border/20 flex items-center justify-between sticky top-0 bg-background/40 rounded-t-xl z-20 backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${column.statusColor}`} />
                            <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">{column.title}</h3>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-muted/10 text-[10px] font-black text-muted-foreground border border-border/40 transition-all duration-normal ease-apple">
                            {loading ? '-' : (groupedIncidents[column.id]?.length || 0)}
                        </span>
                    </div>

                    {/* Column Content */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
                        {loading ? (
                            // Loading Skeletons
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="bg-background/40 p-4 rounded-xl border border-border/40 shadow-sm space-y-3">
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
                                    key={incident.id || 'unknown'}
                                    onClick={() => onSelect(incident)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onSelect(incident);
                                        }
                                    }}
                                    className="group relative bg-background/80 p-4 rounded-xl border border-border/40 shadow-premium hover:shadow-xl hover:scale-[1.02] transition-all duration-normal ease-apple cursor-pointer overflow-hidden ring-1 ring-transparent hover:ring-primary/20"
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Incident: ${incident.title}`}
                                >
                                    {/* Actions Overlay */}
                                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-normal ease-apple z-10 translate-y-1 group-hover:translate-y-0">
                                        {canEdit && onEdit && (
                                            <CustomTooltip content={t('common.edit')}>
                                                <button
                                                    aria-label={`${t('common.edit')} l'incident ${incident.title}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEdit(incident);
                                                    }}
                                                    className="p-1.5 bg-background/90 text-muted-foreground hover:text-primary rounded-lg shadow-sm border border-border/40 transition-colors"
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
                                                    className="p-1.5 bg-background/90 text-muted-foreground hover:text-destructive rounded-lg shadow-sm border border-border/40 transition-colors"
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
                                            variant="soft"
                                            className="font-bold"
                                        >
                                            {getSeverityLabel(incident.severity)}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold">
                                            {new Date(incident.dateReported).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-foreground text-sm leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors duration-normal ease-apple">
                                        {incident.title}
                                    </h4>

                                    <div className="flex items-center justify-between mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            {incident.reporter?.includes('Agent') ? (
                                                <>
                                                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 transition-colors group-hover:bg-primary/20">
                                                        <Bot className="w-3 h-3 text-primary" />
                                                    </div>
                                                    <span className="text-primary">{t('onboarding.autoScan')}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-5 h-5 rounded-full bg-muted/10 flex items-center justify-center text-[10px] border border-border/40">
                                                        {incident.reporter?.charAt(0) || '?'}
                                                    </div>
                                                    <span className="truncate max-w-[80px]">{incident.reporter}</span>
                                                </>
                                            )}
                                        </div>
                                        {incident.category && (
                                            <span className="px-2 py-0.5 rounded-lg bg-muted/5 border border-border/40 tracking-widest transition-colors group-hover:border-border/60">
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
