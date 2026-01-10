import React from 'react';
import { Risk } from '../../types';
import { ShieldAlert, AlertTriangle, Activity, Layers, TrendingUp } from '../ui/Icons';
import { RISK_ACCEPTANCE_THRESHOLD } from '../../constants/RiskConstants';
import { motion } from 'framer-motion';
import { RiskHeatmap } from './RiskHeatmap';
import { RiskResidualChart } from './RiskResidualChart';
import { RiskTreatmentChart } from './RiskTreatmentChart';

interface RiskDashboardProps {
    risks: Risk[];
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({ risks }) => {
    // Calculate metrics
    const totalRisks = risks.length;
    const criticalRisks = risks.filter(r => r.score >= 10).length;
    const risksAboveAppetite = risks.filter(r => (r.residualScore || r.score) > RISK_ACCEPTANCE_THRESHOLD).length;

    const avgScore = risks.length > 0 ? risks.reduce((sum, r) => sum + r.score, 0) / risks.length : 0;
    const avgResidual = risks.length > 0 ? risks.reduce((sum, r) => sum + ((r.residualProbability || 0) * (r.residualImpact || 0)), 0) / risks.length : 0;
    const riskReduction = avgScore > 0 ? ((avgScore - avgResidual) / avgScore * 100) : 0;

    return (
        <div className="space-y-6" role="region" aria-label="Tableau de bord des risques">
            {/* KPI Cards Consolidated (Risk Style) */}
            <div className="glass-premium p-6 md:p-8 rounded-[2.5rem] flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group transition-all hover:shadow-apple-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

                <div className="space-y-2 relative z-10">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse w-2 h-2" aria-hidden="true" />
                        Vue globale des risques
                    </p>
                    <div className="flex items-baseline gap-3">
                        <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                            {totalRisks}
                        </p>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Risques identifiés</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto relative z-10">
                    {/* Critical Risks Card */}
                    <div
                        className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-red-50/50 dark:hover:bg-red-900/20 focus-within:ring-2 focus-within:ring-red-500"
                        tabIndex={0}
                        aria-label={`${criticalRisks} Risques Critiques`}
                    >
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-red-700 dark:text-red-300">Critiques</span>
                            <div className="p-1.5 rounded-lg bg-red-100/50 dark:bg-red-500/20 text-red-600 dark:text-red-400" aria-hidden="true">
                                <ShieldAlert className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{criticalRisks}</p>
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Score ≥ 10</p>
                        </div>
                    </div>

                    {/* Above Appetite Card */}
                    <div
                        className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-orange-50/50 dark:hover:bg-orange-900/20 focus-within:ring-2 focus-within:ring-orange-500"
                        tabIndex={0}
                        aria-label={`${risksAboveAppetite} Risques Hors Appétence`}
                    >
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-700 dark:text-orange-300">Hors Appétence</span>
                            <div className="p-1.5 rounded-lg bg-orange-100/50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400" aria-hidden="true">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {risksAboveAppetite}
                            </p>
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{`> Seuil accept.`}</p>
                        </div>
                    </div>

                    {/* Avg Score Card */}
                    <div
                        className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 focus-within:ring-2 focus-within:ring-indigo-500"
                        tabIndex={0}
                        aria-label={`Score Moyen: ${avgScore.toFixed(1)}`}
                    >
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Score Moyen</span>
                            <div className="p-1.5 rounded-lg bg-indigo-100/50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" aria-hidden="true">
                                <Activity className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {avgScore.toFixed(1)}
                                </p>
                                {riskReduction > 0 && (
                                    <span
                                        className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded"
                                        aria-label={`Réduction de ${riskReduction.toFixed(0)}%`}
                                    >
                                        -{riskReduction.toFixed(0)}%
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tendance</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row 1: Heatmap + Treatment */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Heatmap */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }} // Reduced delay for snappier feel
                    className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/10 bg-white/50 dark:bg-white/5 shadow-sm hover:shadow-apple transition-shadow duration-300"
                    aria-label="Graphique Heatmap des risques"
                >
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" aria-hidden="true" />
                        Cartographie des Risques (Heatmap)
                    </h3>
                    <RiskHeatmap risks={risks} />
                </motion.div>

                {/* Treatment Progress */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }} // Staggered
                    className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/10 bg-white/50 dark:bg-white/5 shadow-sm hover:shadow-apple transition-shadow duration-300"
                    aria-label="Graphique d'avancement des traitements"
                >
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-emerald-500" aria-hidden="true" />
                        Avancement des Traitements
                    </h3>
                    <RiskTreatmentChart risks={risks} />
                </motion.div>
            </div>

            {/* Row 2: Inherent vs Residual (Full Width) */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 glass-premium p-8 rounded-[2.5rem] relative overflow-hidden min-h-[350px] transition-all hover:shadow-apple-lg">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="p-2 bg-brand-500/10 rounded-lg" aria-hidden="true">
                        <TrendingUp className="h-5 w-5 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Réduction du Risque (Inhérent vs Résiduel)</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Impact des mesures de sécurité par catégorie</p>
                    </div>
                </div>

                <div className="h-[250px] w-full relative z-10" aria-label="Graphique de réduction du risque">
                    <RiskResidualChart risks={risks} />
                </div>
            </div>

            {/* Top Critical Risks Table */}
            {
                criticalRisks > 0 && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 glass-premium p-8 rounded-[2.5rem] relative overflow-hidden transition-all hover:shadow-apple-lg">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-red-500/10 rounded-lg" aria-hidden="true">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Top Risques Critiques</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Actions prioritaires requises</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Liste des risques critiques">
                            {risks
                                .filter(r => r.score >= 10)
                                .sort((a, b) => b.score - a.score)
                                .slice(0, 6)
                                .map((risk, index) => (
                                    <div
                                        key={`risk-card-${index}`}
                                        className="flex flex-col p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all cursor-pointer group focus:ring-2 focus:ring-red-500 focus:outline-none"
                                        role="listitem"
                                        tabIndex={0}
                                        aria-label={`Risque critique: ${risk.threat}, Score ${risk.score}`}
                                    >
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
                )
            }
        </div >
    );
};

