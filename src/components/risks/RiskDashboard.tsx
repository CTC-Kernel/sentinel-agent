import React, { useMemo } from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Risk, Asset } from '../../types';
import { ShieldAlert, AlertTriangle, Target, Clock, TrendingUp, Layers, PieChart as PieIcon, Activity } from '../ui/Icons';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

interface RiskDashboardProps {
    risks: Risk[];
    assets: Asset[]; // Added assets prop
    onFilterChange?: (filter: { type: 'level' | 'strategy' | 'category', value: string } | null) => void;
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({ risks, assets, onFilterChange }) => {
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
            slate: '#64748b'     // slate-500
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

    // 1. Risk Distribution by Level (Donut)
    const distributionData = [
        { name: 'Critique', value: criticalRisks, color: chartTheme.colors.critical },
        { name: 'Élevé', value: highRisks, color: chartTheme.colors.high },
        { name: 'Moyen', value: mediumRisks, color: chartTheme.colors.medium },
        { name: 'Faible', value: lowRisks, color: chartTheme.colors.low }
    ].filter(d => d.value > 0);

    // 2. Risk by Category (Radar)
    const categoryDataMap = risks.reduce((acc: Record<string, number>, risk) => {
        const cat = risk.category || 'Autre';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Normalize for Radar (needs at least 3 points usually for good look, but handled by Recharts)
    const radarData = Object.entries(categoryDataMap).map(([subject, A]) => ({ subject, A, fullMark: totalRisks }));
    if (radarData.length < 3) {
        // Fill with dummy data if not enough categories to make a nice polygon
        const existing = new Set(radarData.map(d => d.subject));
        ['Accès', 'Données', 'Infrastructure', 'Légal'].forEach(cat => {
            if (!existing.has(cat) && radarData.length < 5) radarData.push({ subject: cat, A: 0, fullMark: totalRisks });
        });
    }

    // 3. Risk by Asset Type (Bar)
    const risksByAssetType = useMemo(() => {
        const map: Record<string, number> = { 'Matériel': 0, 'Logiciel': 0, 'Données': 0, 'Service': 0, 'Humain': 0 };
        risks.forEach(r => {
            const asset = assets.find(a => a.id === r.assetId);
            if (asset && asset.type) {
                map[asset.type] = (map[asset.type] || 0) + 1;
            } else {
                map['Autre'] = (map['Autre'] || 0) + 1;
            }
        });
        return Object.entries(map)
            .filter(([, value]) => value > 0)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [risks, assets]);



    // Risk Evolution Data (Historical Trend - Keep existing logic)
    const evolutionData = React.useMemo(() => {
        if (!risks.length) return [];
        const timelines = risks.map(r => {
            const points: { date: number, score: number }[] = [];
            const currentScore = r.history && r.history.length > 0 ? r.history[0].previousScore || r.score : r.score;
            if (r.createdAt) points.push({ date: new Date(r.createdAt).getTime(), score: currentScore });
            if (r.history) {
                const sortedHistory = [...r.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                sortedHistory.forEach(h => { points.push({ date: new Date(h.date).getTime(), score: h.newScore }); });
            }
            points.push({ date: new Date().getTime(), score: r.score });
            return { id: r.id, points };
        });

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


    const uniqueId = React.useId().replace(/:/g, '');
    const areaGradientId = `area-gradient-${uniqueId}`;

    return (
        <div className="space-y-6">
            {/* Top Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => onFilterChange?.({ type: 'level', value: 'Critique' })} className="glass-panel p-5 rounded-2xl border border-white/60 dark:border-white/5 flex flex-col items-center justify-center cursor-pointer hover:shadow-apple transition-all group bg-gradient-to-br from-red-50 to-white dark:from-red-900/10 dark:to-transparent">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{criticalRisks}</span>
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mt-1">Risques Critiques</span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white/60 dark:border-white/5 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-transparent">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mb-3">
                        <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{avgScore.toFixed(1)}</span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mt-1">Score Moyen</span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white/60 dark:border-white/5 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/10 dark:to-transparent">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-3">
                        <ShieldAlert className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{Math.round(riskReduction)}%</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-1">Réduction (SLA)</span>
                </div>

                <div className="glass-panel p-5 rounded-2xl border border-white/60 dark:border-white/5 flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/10 dark:to-transparent">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-3">
                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{untreatedRisks}</span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mt-1">Non Traités</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

                {/* 1. Radar Chart: Threat Categories */}
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple transition-all duration-300">
                    <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <Target className="h-4 w-4 text-brand-500" />
                        Exposition par Catégorie
                    </h4>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid stroke={chartTheme.grid} />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: chartTheme.text, fontSize: 10 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                <Radar
                                    name="Risques"
                                    dataKey="A"
                                    stroke={chartTheme.colors.purple}
                                    fill={chartTheme.colors.purple}
                                    fillOpacity={0.3}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={false} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Donut Chart: Risk Level Distribution */}
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple transition-all duration-300">
                    <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <PieIcon className="h-4 w-4 text-brand-500" />
                        Distribution par Criticité
                    </h4>
                    <div className="h-[300px] w-full flex items-center justify-center relative">
                        {/* Center Metric */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-foreground">{totalRisks}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">Risques</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distributionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    cornerRadius={8}
                                >
                                    {distributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} cursor={false} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Bar Chart: Risks by Asset Type */}
                <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple transition-all duration-300">
                    <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-brand-500" />
                        Risques par Type d'Actif
                    </h4>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={risksByAssetType} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartTheme.grid} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke={chartTheme.text}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    width={70}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: chartTheme.cursor, radius: 4 }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} fill={chartTheme.colors.cyan}>
                                    {risksByAssetType.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? chartTheme.colors.cyan : chartTheme.colors.primary} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Area Chart: Trend */}
            <div className="glass-panel text-card-foreground p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple transition-all duration-300">
                <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-500" />
                    Tendance du Score De Risque (12 mois)
                </h4>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartTheme.colors.purple} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={chartTheme.colors.purple} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                            <XAxis dataKey="date" stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                            <YAxis stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
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
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Critical Risks Table (Optional, can be kept) - Let's keep it but cleaner */}
            {criticalRisks > 0 && (
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden">
                    <h4 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Top Risques Critiques
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {risks
                            .filter(r => r.score >= 15)
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 6)
                            .map((risk, index) => (
                                <div key={index} className="flex flex-col p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all cursor-default">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-black/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30">
                                            Score {risk.score}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{risk.treatmentDeadline ? new Date(risk.treatmentDeadline).toLocaleDateString() : 'Pas d\'échéance'}</span>
                                    </div>
                                    <h5 className="font-bold text-sm text-foreground mb-1 line-clamp-2">{risk.threat}</h5>
                                    <p className="text-xs text-muted-foreground mb-3">{risk.category || 'Général'}</p>

                                    <div className="mt-auto pt-3 border-t border-red-100 dark:border-red-800/30 flex justify-between items-center">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded
                                            ${risk.strategy === 'Atténuer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                                                risk.strategy === 'Transférer' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' :
                                                    risk.strategy === 'Éviter' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                                                        'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                                            }`}>
                                            {risk.strategy}
                                        </span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};
