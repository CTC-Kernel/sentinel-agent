import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Risk } from '../../types';
import { CHART_STYLES, SENTINEL_PALETTE } from '../../theme/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';

interface RiskResidualChartProps {
    risks: Risk[];
}

export const RiskResidualChart: React.FC<RiskResidualChartProps> = ({ risks }) => {
    // Aggregation: Avg Inherent vs Avg Residual by Category
    const data = React.useMemo(() => {
        const categories = Array.from(new Set(risks.map(r => r.category || 'Majeur')));
        return categories.map(cat => {
            const catRisks = risks.filter(r => (r.category || 'Majeur') === cat);
            const total = catRisks.length;
            const avgInherent = catRisks.reduce((sum, r) => sum + r.score, 0) / total;
            const avgResidual = catRisks.reduce((sum, r) => sum + (r.residualScore || r.score), 0) / total; // Fallback to score if no residual

            return {
                name: cat,
                Inhérent: parseFloat(avgInherent.toFixed(1)),
                Résiduel: parseFloat(avgResidual.toFixed(1)),
                Reduction: ((avgInherent - avgResidual) / avgInherent * 100).toFixed(0) + '%'
            };
        }).sort((a, b) => b.Inhérent - a.Inhérent).slice(0, 6); // Top 6 categories
    }, [risks]);

    const hasData = data.length > 0 && data.some(d => d.Inhérent > 0 || d.Résiduel > 0);

    if (!hasData) {
        return <EmptyChartState variant="bar" message="Pas de données d'analyse" description="Déclarez des risques et leurs scores pour voir la réduction." />;
    }

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                        <linearGradient id="inherentGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.8} />
                            <stop offset="100%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.3} />
                        </linearGradient>
                        <linearGradient id="residualGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SENTINEL_PALETTE.tertiary} stopOpacity={0.8} />
                            <stop offset="100%" stopColor={SENTINEL_PALETTE.tertiary} stopOpacity={0.3} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid {...CHART_STYLES.grid} vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="name" {...CHART_STYLES.axis} {...CHART_STYLES.xAxis} tick={{ fill: 'currentColor', opacity: 0.7 }} />
                    <YAxis {...CHART_STYLES.axis} tick={{ fill: 'currentColor', opacity: 0.7 }} />
                    <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                        wrapperStyle={{ outline: 'none' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar
                        dataKey="Inhérent"
                        fill="url(#inherentGradient)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                        animationDuration={1500}
                    />
                    <Bar
                        dataKey="Résiduel"
                        fill="url(#residualGradient)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                        animationDuration={1500}
                        animationBegin={300}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
