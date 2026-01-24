import React, { useMemo } from 'react';
import { useActivityLogs } from '../../hooks/useActivityLogs';
import { Loader2, History, ArrowRight, User } from '../ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AuditTrailProps {
    resourceId: string;
    resourceType?: string; // Optional filtering by type if needed
    className?: string;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ resourceId, className }) => {
    // We use the existing hook but need to filter client-side for now 
    // Optimization: ideally update hook to accept resourceId in query
    const { logs, loading } = useActivityLogs(100);

    const resourceLogs = useMemo(() => {
        return logs.filter(log =>
            log.resourceId === resourceId ||
            (log.metadata?.resourceId === resourceId)
        );
    }, [logs, resourceId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement de l'historique...
            </div>
        );
    }

    if (resourceLogs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <History className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">Aucun historique disponible pour cet élément.</p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-4 w-4 text-brand-500" /> Piste d'Audit ({resourceLogs.length})
            </h3>

            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-6 sm:space-y-8">
                {resourceLogs.map((log) => (
                    <div key={log.id} className="relative pl-6">
                        {/* Dot */}
                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 shadow-sm" />

                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {log.action}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {(() => {
                                        try {
                                            const ts = log.timestamp as { seconds: number } | number | string | Date;
                                            let d: Date;
                                            if (ts instanceof Date) d = ts;
                                            else if (typeof ts === 'object' && ts && 'seconds' in ts) d = new Date(ts.seconds * 1000);
                                            else if (ts) d = new Date(ts);
                                            else return '-';

                                            return !isNaN(d.getTime()) ? format(d, "d MMM yyyy 'à' HH:mm", { locale: fr }) : '-';
                                        } catch { return '-'; }
                                    })()}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-muted-foreground">
                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                    <User className="h-3 w-3" />
                                </div>
                                {log.userDisplayName || log.userEmail}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg p-3 text-sm">
                            <p className="text-slate-700 dark:text-slate-300 mb-2">{log.details}</p>

                            {/* Granular Changes (Diffs) */}
                            {log.changes && log.changes.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10 mt-2">
                                    {log.changes.map((change, idx) => (
                                        <div key={`${idx}-${change.field}`} className="flex items-center gap-2 text-xs">
                                            <span className="font-mono text-slate-500 w-24 truncate text-right">{change.field}</span>
                                            <span className="px-1.5 py-0.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded line-through">
                                                {String(change.oldValue === undefined || change.oldValue === '' ? 'Empty' : change.oldValue)}
                                            </span>
                                            <ArrowRight className="h-3 w-3 text-slate-400" />
                                            <span className="px-1.5 py-0.5 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 rounded font-medium">
                                                {String(change.newValue)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
