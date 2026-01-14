import { useMemo } from 'react';
import { Incident, Criticality } from '../../types';

export const useIncidentStats = (incidents: Incident[]) => {
    return useMemo(() => {
        const total = incidents.length;
        const openCount = incidents.filter(i => i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const resolvedCount = incidents.filter(i => i.status === 'Fermé' || i.status === 'Résolu').length;
        const criticalCount = incidents.filter(i => i.severity === Criticality.CRITICAL).length;

        let totalResolutionHours = 0;
        let resolvedWithTimes = 0;

        incidents.forEach(inc => {
            if (inc.dateReported && inc.dateResolved) {
                const start = new Date(inc.dateReported).getTime();
                const end = new Date(inc.dateResolved).getTime();
                if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
                    const diffHours = (end - start) / (1000 * 60 * 60);
                    totalResolutionHours += diffHours;
                    resolvedWithTimes++;
                }
            }
        });

        const avgMttrHours = resolvedWithTimes > 0 ? Math.round(totalResolutionHours / resolvedWithTimes) : null;
        const criticalRatio = total > 0 ? Math.round((criticalCount / total) * 100) : null;

        return {
            total,
            open: openCount,
            resolved: resolvedCount,
            avgMttrHours,
            criticalRatio,
        };
    }, [incidents]);
};
