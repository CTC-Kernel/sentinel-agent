import React from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Risk } from '../../types';
import { ShieldAlert, AlertTriangle, Target, Clock } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';

interface RiskDashboardProps {
    risks: Risk[];
    onFilterChange?: (filter: { type: 'level' | 'strategy' | 'category', value: string } | null) => void;
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({ risks, onFilterChange }) => {
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
        { name: 'Critique', value: criticalRisks, color: '#ef4444' },
        { name: 'Élevé', value: highRisks, color: '#f97316' },
        { name: 'Moyen', value: mediumRisks, color: '#eab308' },
        { name: 'Faible', value: lowRisks, color: '#22c55e' }
    ];

    // Risk distribution by category
    const categoryData = risks.reduce((acc, risk) => {
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

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden group mb-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>

                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90">
                            <circle
                                className="text-slate-100 dark:text-slate-800"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                            <circle
                                className={`${riskReduction >= 50 ? 'text-emerald-500' : riskReduction >= 20 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={276}
                                strokeDashoffset={276 - (276 * riskReduction) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{Math.round(riskReduction)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Réduction du Risque</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px]">
                            Efficacité globale des stratégies de traitement.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                    <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onFilterChange?.(null)}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <ShieldAlert className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{totalRisks}</div>
                    </div>
                    <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onFilterChange?.({ type: 'level', value: 'Critique' })}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <AlertTriangle className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critiques</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{criticalRisks}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score Moy.</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{avgScore.toFixed(1)}</div>
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Distribution par Niveau</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={distributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
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
                                formatter={(value) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Category Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Distribution par Catégorie</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                            <XAxis
                                dataKey="name"
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                                tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.4 }} />
                            <Bar dataKey="value" fill="#3b82f6" name="Nombre de risques" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Risk Matrix */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 lg:col-span-2">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Matrice des Risques (Probabilité × Impact)</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                            <XAxis
                                type="number"
                                dataKey="likelihood"
                                name="Probabilité"
                                domain={[0, 5]}
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                                dy={10}
                            />
                            <YAxis
                                type="number"
                                dataKey="impact"
                                name="Impact"
                                domain={[0, 5]}
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                                dx={-10}
                            />
                            <ZAxis type="number" dataKey="score" range={[100, 600]} />
                            <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Risques" data={matrixData} fill="#3b82f6" shape="circle">
                                {matrixData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={
                                        entry.score >= 15 ? '#ef4444' :
                                            entry.score >= 10 ? '#f97316' :
                                                entry.score >= 5 ? '#eab308' : '#22c55e'
                                    } />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {/* Treatment Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 lg:col-span-2">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Stratégies de Traitement</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={treatmentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} opacity={0.5} />
                            <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                width={80}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.4 }} />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                                {treatmentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={
                                        entry.name === 'Atténuer' ? '#3b82f6' :
                                            entry.name === 'Transférer' ? '#8b5cf6' :
                                                entry.name === 'Éviter' ? '#22c55e' : '#f97316'
                                    } />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Critical Risks */}
            {criticalRisks > 0 && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Top 5 Risques Critiques
                    </h4>
                    <div className="space-y-3">
                        {risks
                            .filter(r => r.score >= 15)
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 5)
                            .map((risk, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-slate-900 dark:text-white">{risk.threat}</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{risk.category || 'Non catégorisé'}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Score</div>
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
            )}
        </div>
    );
};
