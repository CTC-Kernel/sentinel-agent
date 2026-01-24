import React from 'react';
import { useSessionMetrics } from '../../hooks/useSessionMonitor';

/**
 * Composant pour afficher les métriques de session (debug)
 */
export const SessionMetricsDebug: React.FC = () => {
    const metrics = useSessionMetrics();

    if (!metrics) return null;

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    return (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-800 shadow-lg rounded-lg p-4 text-sm max-w-xs">
            <h3 className="font-semibold mb-2 text-slate-900 dark:text-white">
                Session Metrics
            </h3>
            <dl className="space-y-1 text-slate-700 dark:text-muted-foreground">
                <div className="flex justify-between">
                    <dt>Durée de session:</dt>
                    <dd className="font-mono">{formatDuration(metrics.sessionDuration)}</dd>
                </div>
                <div className="flex justify-between">
                    <dt>Activités:</dt>
                    <dd className="font-mono">{metrics.activityCount}</dd>
                </div>
                <div className="flex justify-between">
                    <dt>Temps d'inactivité:</dt>
                    <dd className="font-mono">{formatDuration(metrics.idleTime)}</dd>
                </div>
                <div className="flex justify-between">
                    <dt>Dernière activité:</dt>
                    <dd className="font-mono">
                        {new Date(metrics.lastActivity).toLocaleTimeString()}
                    </dd>
                </div>
            </dl>
        </div>
    );
};
