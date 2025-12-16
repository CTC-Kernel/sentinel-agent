import React from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Risk } from '../../types';
import { ShieldAlert, AlertTriangle, Target, Clock, TrendingUp } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis, AreaChart, Area } from 'recharts';

interface RiskDashboardProps {
    risks: Risk[];
    onFilterChange?: (filter: { type: 'level' | 'strategy' | 'category', value: string } | null) => void;
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({ risks, onFilterChange }) => {
    // Premium Chart Theme
    const chartTheme = {
        grid: 'hsl(var(--border) / 0.2)', // Ultra subtle grid
        text: 'hsl(var(--muted-foreground) / 0.7)',
        cursor: 'hsl(var(--muted-foreground) / 0.1)',
        colors: {
            critical: '#ef4444', // red-500
            high: '#f97316',     // orange-500
            medium: '#eab308',   // yellow-500
            low: '#22c55e',      // green-500
            primary: '#3b82f6',  // blue-500
            purple: '#8b5cf6',   // violet-500
            cyan: '#06b6d4',     // cyan-500
        }
    };

    // Calculate metrics
    const totalRisks = risks.length;
    const criticalRisks = risks.filter(r => r.score >= 15).length;
    const highRisks = risks.filter(r => r.score >= 10 && r.score < 15).length;
    const mediumRisks = risks.filter(r => r.score >= 5 && r.score < 10).length;
    const lowRisks = risks.filter(r => r.score < 5).length;
    const untreatedRisks = risks.filter(r => r.strategy === 'Accepter').length;

    const avgScore = risks.length > 0 ? risks.reduce((sum, r) => sum + r.score, 0) / risks.length : 0;
    const avgResidual = risks.length > 0 ? risks.reduce((sum, r) => sum + ((r.residualProbability || 0) * (r.residualImpact || 0)), 0) / risks.length : 0;
    const riskReduction = avgScore > 0 ? ((avgScore - avgResidual) / avgScore * 100) : 0;

    // Risk distribution by level
    const distributionData = [
        { name: 'Critique', value: criticalRisks, color: chartTheme.colors.critical },
        { name: 'Élevé', value: highRisks, color: chartTheme.colors.high },
        { name: 'Moyen', value: mediumRisks, color: chartTheme.colors.medium },
        { name: 'Faible', value: lowRisks, color: chartTheme.colors.low }
    ];

    // Risk distribution by category
    const categoryData = risks.reduce((acc: Record<string, number>, risk) => {
        const cat = risk.category || 'Autre';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const categoryChartData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));

    // Risk matrix data for scatter plot
    const matrixData = risks.map(r => ({
        name: r.threat.substring(0, 30) + '...',
        likelihood: r.probability,
        impact: r.impact,
        score: r.score,
        status: r.status
    }));

    // Treatment distribution
    const treatmentData = [
        { name: 'Atténuer', value: risks.filter(r => r.strategy === 'Atténuer').length },
        { name: 'Transférer', value: risks.filter(r => r.strategy === 'Transférer').length },
        { name: 'Éviter', value: risks.filter(r => r.strategy === 'Éviter').length },
        { name: 'Accepter', value: risks.filter(r => r.strategy === 'Accepter').length }
    ];

    // Risk Evolution Data (Historical Trend)
    const evolutionData = React.useMemo(() => {
        if (!risks.length) return [];

        const timelines = risks.map(r => {
            const points: { date: number, score: number }[] = [];

            // Initial assumption: risk started at 0 score or creation score
            const currentScore = r.history && r.history.length > 0 ? r.history[0].previousScore || r.score : r.score;

            if (r.createdAt) {
                points.push({ date: new Date(r.createdAt).getTime(), score: currentScore });
            }

            if (r.history) {
                const sortedHistory = [...r.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                sortedHistory.forEach(h => {
                    points.push({ date: new Date(h.date).getTime(), score: h.newScore });
                });
            }
            // Current state
            points.push({ date: new Date().getTime(), score: r.score });

            return { id: r.id, points };
        });

        // Sample every month for the last 12 months
        const chartData = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const timestamp = d.getTime();

            let totalScore = 0;
            let count = 0;

            timelines.forEach(t => {
                if (t.points.length > 0 && timestamp >= t.points[0].date) {
                    const validPoints = t.points.filter(p => p.date <= timestamp);
                    if (validPoints.length > 0) {
                        const lastPoint = validPoints[validPoints.length - 1];
                        totalScore += lastPoint.score;
                        count++;
                    }
                }
            });

            if (count > 0) {
                chartData.push({
                    date: d.toLocaleDateString('fr-FR', { month: 'short' }),
                    avgScore: parseFloat((totalScore / count).toFixed(1)),
                });
            }
        }
        return chartData;
    }, [risks]);


    // Unique IDs for gradients
    const areaGradientId = React.useId();
    const barGradientBlueId = React.useId();

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative group mb-10 overflow-hidden shadow-sm hover:shadow-apple transition-all duration-500 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-100 opacity-70"></div>
                </div>

                {/* Global Score Metric */}
                <div className="flex items-center gap-6 relative z-decorator">
                    <div className="relative group/ring">
                        <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                            <circle
                                className="text-slate-100 dark:text-slate-800"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="48"
                                cy="48"
                            />
                            <circle
                                className={`${riskReduction >= 50 ? 'text-emerald-500' : riskReduction >= 20 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * riskReduction) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="48"
                                cy="48"
                                style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-foreground">{Math.round(riskReduction)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Réduction du Risque</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px]">
                            Efficacité globale des stratégies de traitement.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-border px-6 mx-2">
                    <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onFilterChange?.(null)}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <ShieldAlert className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</div>
                        </div>
                        <div className="text-xl font-black text-foreground">{totalRisks}</div>
                    </div>
                    <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onFilterChange?.({ type: 'level', value: 'Critique' })}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <AlertTriangle className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Critiques</div>
                        </div>
                        <div className="text-xl font-black text-foreground">{criticalRisks}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score Moy.</div>
                        </div>
                        <div className="text-xl font-black text-foreground">{avgScore.toFixed(1)}</div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[180px]">
                    <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Non Traités</span>
                        </div>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400">{untreatedRisks}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">En Cours</span>
                        </div>
                        <span className="text-sm font-black text-blue-700 dark:text-blue-400">{risks.filter(r => r.treatment?.slaStatus === 'On Track').length}</span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Evolution Chart (NEW) */}
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 lg:col-span-2 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-decorator h-[280px] w-full min-h-[280px]">
                        <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-brand-500" />
                            Évolution du Score Moyen (12 derniers mois)
                        </h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartTheme.colors.purple} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={chartTheme.colors.purple} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                                <XAxis
                                    dataKey="date"
                                    stroke={chartTheme.text}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                />
                                <YAxis
                                    stroke={chartTheme.text}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3', stroke: chartTheme.cursor }} />
                                <Area
                                    type="monotone"
                                    dataKey="avgScore"
                                    stroke={chartTheme.colors.purple}
                                    fillOpacity={1}
                                    fill={`url(#${areaGradientId})`}
                                    strokeWidth={3}
                                    name="Score Moyen"
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Risk Distribution */}
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-decorator h-[280px] w-full min-h-[280px]">
                        <h4 className="text-sm font-bold text-foreground mb-4">Distribution par Niveau</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <defs>
                                    {distributionData.map((entry, index) => (
                                        <linearGradient key={`grad-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                            <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <Pie
                                    data={distributionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {distributionData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={`url(#pieGradient-${index})`} style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.2))' }} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} cursor={false} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wide">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Category Distribution */}
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-decorator h-[280px] w-full min-h-[280px]">
                        <h4 className="text-sm font-bold text-foreground mb-4">Distribution par Catégorie</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={barGradientBlueId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={chartTheme.colors.primary} stopOpacity={1} />
                                        <stop offset="100%" stopColor={chartTheme.colors.cyan} stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke={chartTheme.text}
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                    interval={0}
                                    tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 8)}..` : value}
                                />
                                <YAxis
                                    stroke={chartTheme.text}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    dx={-10}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: chartTheme.cursor, radius: 4 }} />
                                <Bar dataKey="value" fill={`url(#${barGradientBlueId})`} name="Nombre de risques" radius={[6, 6, 0, 0]} barSize={24} animationDuration={1000} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Risk Matrix */}
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 lg:col-span-2 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-decorator h-[350px] w-full min-h-[350px]">
                        <h4 className="text-sm font-bold text-foreground mb-4">Matrice des Risques (Probabilité × Impact)</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                                <XAxis
                                    type="number"
                                    dataKey="likelihood"
                                    name="Probabilité"
                                    domain={[0, 5]}
                                    stroke={chartTheme.text}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={{ stroke: chartTheme.grid }}
                                    dy={10}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="impact"
                                    name="Impact"
                                    domain={[0, 5]}
                                    stroke={chartTheme.text}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={{ stroke: chartTheme.grid }}
                                    dx={-10}
                                />
                                <ZAxis type="number" dataKey="score" range={[100, 600]} />
                                <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                                <Scatter name="Risques" data={matrixData} shape="circle">
                                    {matrixData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={
                                            entry.score >= 15 ? chartTheme.colors.critical :
                                                entry.score >= 10 ? chartTheme.colors.high :
                                                    entry.score >= 5 ? chartTheme.colors.medium : chartTheme.colors.low
                                        }
                                            style={{ filter: `drop-shadow(0 0 6px ${entry.score >= 15 ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.1)'})` }}
                                        />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Treatment Distribution */}
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 lg:col-span-2 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-decorator h-[250px] w-full min-h-[250px]">
                        <h4 className="text-sm font-bold text-foreground mb-4">Stratégies de Traitement</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={treatmentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                                <XAxis type="number" stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke={chartTheme.text}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    width={80}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: chartTheme.cursor, radius: 4 }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} animationDuration={1000}>
                                    {treatmentData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={
                                            entry.name === 'Atténuer' ? chartTheme.colors.primary :
                                                entry.name === 'Transférer' ? chartTheme.colors.purple :
                                                    entry.name === 'Éviter' ? chartTheme.colors.low : chartTheme.colors.high
                                        } />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top Critical Risks */}
            {criticalRisks > 0 && (
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-decorator">
                        <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Top 5 Risques Critiques
                        </h4>
                        <div className="space-y-3">
                            {risks
                                .filter(r => r.score >= 15)
                                .sort((a, b) => b.score - a.score)
                                .slice(0, 5)
                                .map((risk, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors cursor-default">
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-foreground">{risk.threat}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{risk.category || 'Non catégorisé'}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-xs text-muted-foreground">Score</div>
                                                <div className="text-lg font-bold text-red-600 dark:text-red-400">{risk.score}</div>
                                            </div>
                                            <div className={`px-3 py-1 rounded-lg text-xs font-bold ${risk.strategy === 'Atténuer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                                                risk.strategy === 'Transférer' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                                                    risk.strategy === 'Éviter' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                                        'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                                                }`}>
                                                {risk.strategy}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
