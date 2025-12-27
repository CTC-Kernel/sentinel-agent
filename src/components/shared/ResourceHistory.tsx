import React from 'react';
import { useResourceLogs } from '../../hooks/useResourceLogs';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { History, User } from '../ui/Icons';
import { Loader2 } from '../ui/Icons';

interface ResourceHistoryProps {
    resourceId: string;
    resourceType: string;
    className?: string;
}

export const ResourceHistory: React.FC<ResourceHistoryProps> = ({ resourceId, resourceType, className }) => {
    const { logs, loading, hasMore, loadMore } = useResourceLogs(resourceType, resourceId);

    if (loading && logs.length === 0) {
        return (
            <div className="flex justify-center items-center py-8 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement de l'historique...
            </div>
        );
    }

    if (!loading && logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                <History className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucun historique disponible pour cet élément.</p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-5 w-5 text-brand-500" /> Historique des Modifications
            </h3>

            <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-8 pb-4">
                {logs.map((log) => {
                    let date: Date;
                    try {
                        const timestamp = log.timestamp as { seconds: number } | number | string | Date;
                        if (timestamp instanceof Date) {
                            date = timestamp;
                        } else if (typeof timestamp === 'object' && timestamp !== null && 'seconds' in timestamp) {
                            date = new Date(timestamp.seconds * 1000);
                        } else if (timestamp) {
                            date = new Date(timestamp);
                        } else {
                            date = new Date(); // Fallback to now or handle invalid
                        }
                    } catch {
                        date = new Date(); // Fallback
                    }

                    const isValidDate = (d: Date) => d instanceof Date && !isNaN(d.getTime());


                    return (
                        <div key={log.id} className="relative pl-6">
                            {/* Timeline Dot */}
                            <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${log.action === 'create' ? 'bg-green-500' :
                                log.action === 'delete' ? 'bg-red-500' :
                                    'bg-blue-500'
                                }`} />

                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100">
                                        {isValidDate(date) ? format(date, "d MMMM yyyy à HH:mm", { locale: fr }) : '-'}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        <span className={`font-bold uppercase text-xs mr-2 px-1.5 py-0.5 rounded ${log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                                            log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>{log.action}</span>
                                        {log.details}
                                    </p>

                                    {/* Granular Changes if available */}
                                    {log.changes && log.changes.length > 0 && (
                                        <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                                            {log.changes.map((change, idx) => (
                                                <div key={`${idx}-${change.field}`} className="flex gap-2 font-mono">
                                                    <span className="text-slate-500">{change.field}:</span>
                                                    <span className="text-red-400 line-through">{String(change.oldValue)}</span>
                                                    <span className="text-slate-400">→</span>
                                                    <span className="text-green-500">{String(change.newValue)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center text-xs text-slate-500 gap-1 mt-1 sm:mt-0">
                                    <User className="h-3 w-3" />
                                    {log.userDisplayName || log.userEmail || 'Système'}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hasMore && (
                <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full py-2 text-sm text-brand-600 hover:text-brand-700 font-medium text-center border-t border-slate-100 dark:border-white/5 pt-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                    {loading ? 'Chargement...' : 'Voir plus d\'historique'}
                </button>
            )}
        </div>
    );
};
