import React from 'react';
import { Audit, Finding } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, CheckCircle2 } from '../ui/Icons';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';
import { FINDING_COLORS } from '../../theme/chartTheme';
import { PremiumCard } from '../ui/PremiumCard';

interface SingleAuditStatsProps {
    audit: Audit;
    findings: Finding[];
}

export const SingleAuditStats: React.FC<SingleAuditStatsProps> = ({ findings }) => {
    // Metrics
    const openFindings = findings.filter(f => f.status === 'Ouvert').length;
    const closedFindings = findings.filter(f => f.status === 'Fermé').length;
    const totalFindings = findings.length;

    const completionRate = totalFindings > 0 ? Math.round((closedFindings / totalFindings) * 100) : 0;

    // Health score weighted by finding severity
    const healthScore = (() => {
        const openList = findings.filter(f => f.status === 'Ouvert');
        if (openList.length === 0) return 100;
        const penalty = openList.reduce((acc, f) => {
            if (f.type === 'Majeure') return acc + 20;
            if (f.type === 'Mineure') return acc + 10;
            if (f.type === 'Observation') return acc + 5;
            return acc + 2; // Opportunité or other
        }, 0);
        return Math.max(0, 100 - penalty);
    })();

    const findingsByType = [
        { name: 'Majeure', value: findings.filter(f => f.type === 'Majeure').length, color: FINDING_COLORS.majeure },
        { name: 'Mineure', value: findings.filter(f => f.type === 'Mineure').length, color: FINDING_COLORS.mineure },
        { name: 'Observation', value: findings.filter(f => f.type === 'Observation').length, color: FINDING_COLORS.observation },
        { name: 'Opportunité', value: findings.filter(f => f.type === 'Opportunité').length, color: FINDING_COLORS.opportunite },
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Score Card */}
                <PremiumCard glass
                    className="p-6 relative overflow-hidden group"
                    gradientOverlay={true}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-2xl -mr-16 -mt-16 transition-opacity group-hover:opacity-70 pointer-events-none" />
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Santé de l'audit</h4>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-4xl font-black text-slate-900 dark:text-white">
                            {healthScore}%
                        </span>
                        <span className="text-sm text-muted-foreground mb-1 font-medium">Score estimé</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 relative z-10">
                        Pondéré par sévérité : Majeure (-20), Mineure (-10), Observation (-5).
                    </p>
                </PremiumCard>

                {/* Findings Summary */}
                <PremiumCard glass className="p-6 relative overflow-hidden">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">État des Constats</h4>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-2xl font-bold">{openFindings}</span>
                                <span className="text-xs font-medium uppercase text-rose-600/70">Ouverts</span>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-2xl font-bold">{closedFindings}</span>
                                <span className="text-xs font-medium uppercase text-emerald-600/70">Traités</span>
                            </div>
                        </div>
                    </div>
                </PremiumCard>

                {/* Completion Rate */}
                <PremiumCard glass className="p-6 relative overflow-hidden flex items-center justify-between">
                    <div className="relative z-10">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Progression</h4>
                        <p className="text-sm text-muted-foreground">Des actions de remédiation</p>
                    </div>
                    <div className="relative z-10">
                        <svg className="w-20 h-20 transform -rotate-90">
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={226} strokeDashoffset={226 - (226 * completionRate) / 100} className="text-blue-500 transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200">
                            {completionRate}%
                        </div>
                    </div>
                </PremiumCard>
            </div>

            {/* Distribution Chart */}
            <PremiumCard glass className="p-6">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-6">Répartition par Sévérité</h4>
                <div className="h-[200px] w-full relative z-10">
                    {findings.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                            <PieChart>
                                <Pie
                                    data={findingsByType}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="60%"
                                    outerRadius="80%"
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {findingsByType.map((entry, index) => (
                                        <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChartState
                            variant="pie"
                            message="Aucune donnée"
                            description="Aucune donnée à afficher"
                            className="scale-90"
                        />
                    )}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center mt-4 relative z-10">
                    {findingsByType.map((item) => (
                        <div key={item.name || 'unknown'} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">
                                {item.name} ({item.value})
                            </span>
                        </div>
                    ))}
                </div>
            </PremiumCard>
        </div>
    );
};
