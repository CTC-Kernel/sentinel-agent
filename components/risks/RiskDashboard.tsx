import React from 'react';
import { Risk } from '../../types';
import { AlertTriangle, TrendingUp, TrendingDown, ShieldAlert, Target, CheckCircle2 } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';

interface RiskDashboardProps {
    risks: Risk[];
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({ risks }) => {
    // Calculate metrics
    const totalRisks = risks.length;
    const criticalRisks = risks.filter(r => r.score >= 15).length;
    const highRisks = risks.filter(r => r.score >= 10 && r.score < 15).length;
    const mediumRisks = risks.filter(r => r.score >= 5 && r.score < 10).length;
    const lowRisks = risks.filter(r => r.score < 5).length;

    const treatedRisks = risks.filter(r => r.strategy !== 'Accepter').length;
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
        const cat = (risk as any).category || 'Autre';
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
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Risks */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Risques</span>
                        <ShieldAlert className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalRisks}</div>
                    <div className="text-xs text-slate-500 mt-1">{treatedRisks} traités</div>
                </div>

                {/* Critical Risks */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-2xl border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Critiques</span>
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-3xl font-bold text-red-700 dark:text-red-400">{criticalRisks}</div>
                    <div className="text-xs text-red-600 dark:text-red-500 mt-1">Score ≥ 15</div>
                </div>

                {/* Average Score */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Score Moyen</span>
                        <Target className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{avgScore.toFixed(1)}</div>
                    <div className="text-xs text-slate-500 mt-1">Résiduel: {avgResidual.toFixed(1)}</div>
                </div>

                {/* Risk Reduction */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Réduction</span>
                        {riskReduction > 0 ? <TrendingDown className="h-5 w-5 text-green-600" /> : <TrendingUp className="h-5 w-5 text-red-600" />}
                    </div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-400">{riskReduction.toFixed(0)}%</div>
                    <div className="text-xs text-green-600 dark:text-green-500 mt-1">Efficacité traitements</div>
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
                                labelLine={false}
                                label={({ name, value }) => `${name}: ${value}`}
                                outerRadius={90}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {distributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Category Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Distribution par Catégorie</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={categoryChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip />
                            <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Risk Matrix */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 lg:col-span-2">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Matrice des Risques (Probabilité × Impact)</h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" dataKey="likelihood" name="Probabilité" domain={[0, 5]} stroke="#64748b" />
                            <YAxis type="number" dataKey="impact" name="Impact" domain={[0, 5]} stroke="#64748b" />
                            <ZAxis type="number" dataKey="score" range={[50, 400]} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Risques" data={matrixData} fill="#3b82f6" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {/* Treatment Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 lg:col-span-2">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Stratégies de Traitement</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={treatmentData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" stroke="#64748b" />
                            <YAxis dataKey="name" type="category" stroke="#64748b" />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8b5cf6" />
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
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{(risk as any).category || 'Non catégorisé'}</p>
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
