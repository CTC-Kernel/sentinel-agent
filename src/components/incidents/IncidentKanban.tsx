
import React from 'react';
import { Incident, Criticality } from '../../types';
import { Badge } from '../ui/Badge';
import { Edit, Trash2 } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';
import { ShieldAlert } from 'lucide-react';

// Columns definition
const COLUMNS = [
    { id: 'Nouveau', title: 'Nouveau', color: 'bg-indigo-500' },
    { id: 'Analyse', title: 'Analyse', color: 'bg-blue-500' },
    { id: 'Contenu', title: 'Contenu', color: 'bg-amber-500' },
    { id: 'Résolu', title: 'Résolu', color: 'bg-emerald-500' },
    { id: 'Fermé', title: 'Fermé', color: 'bg-slate-500' }
] as const;

import { Skeleton } from '../ui/Skeleton';

// ... existing imports

interface IncidentKanbanProps {
    incidents: Incident[];
    onSelect: (incident: Incident) => void;
    onEdit?: (incident: Incident) => void;
    onDelete?: (id: string) => void;
    canEdit?: boolean;
    loading?: boolean;
}

export const IncidentKanban: React.FC<IncidentKanbanProps> = ({ incidents, onSelect, onEdit, onDelete, canEdit, loading }) => {

    // Group incidents by status
    const groupedIncidents = React.useMemo(() => {
        const groups: Record<string, Incident[]> = {};
        COLUMNS.forEach(col => groups[col.id] = []);

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

    return (
        <div className="flex h-full gap-6 overflow-x-auto pb-6">
            {COLUMNS.map(column => (
                <div key={column.id} className="min-w-[320px] max-w-[320px] flex flex-col h-full rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 backdrop-blur-md">
                    {/* Column Header */}
                    <div className="p-4 border-b border-white/20 flex items-center justify-between sticky top-0 bg-inherit rounded-t-2xl z-10 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${column.color}`} />
                            <h3 className="font-bold text-sm text-slate-800 dark:text-white">{column.title}</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300">
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
                                    title="Aucun incident"
                                    description="Tout est calme pour le moment."
                                    color="slate"
                                />
                            </div>
                        ) : (
                            groupedIncidents[column.id]?.map(incident => (
                                <div
                                    key={incident.id}
                                    onClick={() => onSelect(incident)}
                                    className="group relative bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer"
                                >
                                    {/* Actions Overlay */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        {canEdit && onEdit && (
                                            <CustomTooltip content="Modifier">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEdit(incident);
                                                    }}
                                                    className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-slate-500 hover:text-brand-600 rounded-lg shadow-sm border border-slate-200 dark:border-white/10"
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </button>
                                            </CustomTooltip>
                                        )}
                                        {canEdit && onDelete && (
                                            <CustomTooltip content="Supprimer">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(incident.id);
                                                    }}
                                                    className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-slate-500 hover:text-red-600 rounded-lg shadow-sm border border-slate-200 dark:border-white/10"
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
                                            {incident.severity}
                                        </Badge>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {new Date(incident.dateReported).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">
                                        {incident.title}
                                    </h4>

                                    <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[9px] font-bold">
                                                {incident.reporter.charAt(0)}
                                            </div>
                                            <span className="truncate max-w-[80px]">{incident.reporter}</span>
                                        </div>
                                        {incident.category && (
                                            <span className="px-1.5 py-0.5 rounded bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-[10px]">
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
};
