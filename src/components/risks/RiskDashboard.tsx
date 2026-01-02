import React, { useMemo } from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Risk, Asset } from '../../types';
import { ShieldAlert, AlertTriangle, Target, Clock, TrendingUp, Layers, PieChart as PieIcon, Activity } from '../ui/Icons';
import { EmptyChartState } from '../ui/EmptyChartState';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ReferenceLine
} from 'recharts';
import { RISK_ACCEPTANCE_THRESHOLD } from '../../constants/RiskConstants';
import { motion } from 'framer-motion';

interface RiskDashboardProps {
    risks: Risk[];
    assets: Asset[];
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

    // Risks above appetite threshold
    const risksAboveAppetite = risks.filter(r => (r.residualScore || r.score) > RISK_ACCEPTANCE_THRESHOLD).length;

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
            // Use last day of the month to include risks created during the month
            const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            const timestamp = d.getTime();
            let totalScore = 0;
            let count = 0;
            timelines.forEach(t => {
                // Check if risk existed at that time (creation date <= timestamp)
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-max p-1">

            {/* 1. Critical Risks Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => onFilterChange?.({ type: 'level', value: 'Critique' })}
                className="glass-premium p-6 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:shadow-apple transition-all group relative overflow-hidden h-48"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"></div>
                <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ring-1 ring-red-500/20">
                    <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{criticalRisks}</span>
                <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mt-2 font-mono">Critiques</span>
            </motion.div>

            {/* 2. Appetite Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`glass-premium p-6 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden h-48 transition-all group hover:shadow-apple ${risksAboveAppetite > 0 ? 'border-orange-500/20' : ''}`}
            >
                <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none transition-opacity opacity-30 group-hover:opacity-70 ${risksAboveAppetite > 0 ? 'bg-orange-500/20' : 'bg-indigo-500/10'}`}></div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ring-1 transition-transform duration-300 group-hover:scale-110 ${risksAboveAppetite > 0 ? 'bg-orange-100 dark:bg-orange-500/20 ring-orange-500/20' : 'bg-indigo-100 dark:bg-indigo-500/20 ring-indigo-500/20'}`}>
                    <Activity className={`h-7 w-7 ${risksAboveAppetite > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                </div>
                <span className={`text-5xl font-black tracking-tighter ${risksAboveAppetite > 0 ? 'text-orange-700 dark:text-orange-100' : 'text-slate-800 dark:text-white'}`}>{risksAboveAppetite}</span>
                <span className={`text-xs font-bold uppercase tracking-widest mt-2 font-mono ${risksAboveAppetite > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    Hors Appétence
                </span>
            </motion.div>

            {/* 3. Reduction Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-premium p-6 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden h-48 transition-all group hover:shadow-apple"
            >
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mb-16 pointer-events-none transition-opacity opacity-30 group-hover:opacity-70"></div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4 ring-1 ring-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                    <ShieldAlert className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{Math.round(riskReduction)}%</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-2 font-mono">Réduction</span>
            </motion.div>

            {/* 4. Untreated Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-premium p-6 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden h-48 transition-all group hover:shadow-apple"
            >
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none transition-opacity opacity-30 group-hover:opacity-70"></div>
                <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-4 ring-1 ring-amber-500/20 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{untreatedRisks}</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-2 font-mono">Non Traités</span>
            </motion.div>

            {/* Row 2: Charts */}

            {/* Categories Radar - Large Box */}
            <div className="col-span-1 md:col-span-2 lg:col-span-2 glass-premium p-8 rounded-[2.5rem] relative overflow-hidden min-h-[400px]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-brand-500/10 rounded-lg">
                        <Target className="h-5 w-5 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Exposition par Catégorie</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Distribution par nature de risque</p>
                    </div>
                </div>
                <div className="h-[300px] w-full">
                    {radarData.length === 0 || radarData.every(d => d.A === 0) ? (
                        <EmptyChartState
                            variant="radar"
                            message="Aucune catégorie"
                            description="Les risques n'ont pas encore été catégorisés."
                        />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid stroke={chartTheme.grid} />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: chartTheme.text, fontSize: 11, fontWeight: 500 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                <Radar
                                    name="Risques"
                                    dataKey="A"
                                    stroke={chartTheme.colors.purple}
                                    fill={chartTheme.colors.purple}
                                    fillOpacity={0.4}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={false} />
                            </RadarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Distribution Pie & Asset Bar - Right Column Stack */}
            <div className="col-span-1 md:col-span-2 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Pie Chart */}
                <div className="glass-premium p-6 rounded-[2.5rem] relative overflow-hidden flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <PieIcon className="h-4 w-4 text-brand-500" />
                        <span className="font-mono text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider">Criticité</span>
                    </div>
                    <div className="flex-1 min-h-[250px] relative">
                        {distributionData.length === 0 ? (
                            <EmptyChartState
                                variant="pie"
                                message="Aucun risque"
                                description="Aucun risque n'a été identifié."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        cornerRadius={6}
                                        stroke="none"
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} cursor={false} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        formatter={(value) => <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                        {/* Centered Total */}
                        {distributionData.length > 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                <span className="text-3xl font-black text-slate-800 dark:text-white">{totalRisks}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bar Chart */}
                <div className="glass-premium p-6 rounded-[2.5rem] relative overflow-hidden flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <Layers className="h-4 w-4 text-brand-500" />
                        <span className="font-mono text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider">Par Actif</span>
                    </div>
                    <div className="flex-1 min-h-[250px]">
                        {risksByAssetType.length === 0 ? (
                            <EmptyChartState
                                variant="bar"
                                message="Aucun actif"
                                description="Liez des actifs pour voir la répartition."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={risksByAssetType} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartTheme.grid} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        stroke={chartTheme.text}
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        width={60}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: chartTheme.cursor, radius: 4 }} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} fill={chartTheme.colors.cyan}>
                                        {risksByAssetType.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? chartTheme.colors.cyan : chartTheme.colors.primary} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

            </div>

            {/* Full Width Trend */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 glass-premium p-8 rounded-[2.5rem] relative overflow-hidden min-h-[350px]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="p-2 bg-brand-500/10 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Analyse Tendancielle</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Évolution du score de risque moyen sur 12 mois</p>
                    </div>
                </div>

                <div className="h-[250px] w-full relative z-10">
                    {evolutionData.length === 0 ? (
                        <EmptyChartState
                            variant="line"
                            message="Historique vide"
                            description="L'évolution s'affichera avec le temps."
                        />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartTheme.colors.purple} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={chartTheme.colors.purple} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                                <XAxis dataKey="date" stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                                <YAxis stroke={chartTheme.text} fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3', stroke: chartTheme.cursor }} />
                                <ReferenceLine
                                    y={RISK_ACCEPTANCE_THRESHOLD}
                                    stroke={chartTheme.colors.critical}
                                    strokeDasharray="3 3"
                                    label={{
                                        value: 'Seuil Max',
                                        position: 'insideTopRight',
                                        fill: chartTheme.colors.critical,
                                        fontSize: 10
                                    }}
                                />
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
                    )}
                </div>
            </div>

            {/* Top Critical Risks Table */}
            {criticalRisks > 0 && (
                <div className="col-span-1 md:col-span-2 lg:col-span-4 glass-premium p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Top Risques Critiques</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Actions prioritaires requises</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {risks
                            .filter(r => r.score >= 15)
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 6)
                            .map((risk, index) => (
                                <div key={`risk-card-${index}`} className="flex flex-col p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all cursor-default group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                            Score {risk.score}
                                        </span>
                                        <span className="text-[10px] text-slate-500">{risk.treatmentDeadline ? new Date(risk.treatmentDeadline).toLocaleDateString() : 'Pas d\'échéance'}</span>
                                    </div>
                                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1 line-clamp-2 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">{risk.threat}</h5>
                                    <p className="text-xs text-slate-500 mb-3 line-clamp-1">{risk.category || 'Général'}</p>

                                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md
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
