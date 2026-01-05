import React from 'react';
import { Risk } from '../../types';
import { ShieldAlert, AlertTriangle, TrendingUp, Layers, Activity } from '../ui/Icons';
import { RISK_ACCEPTANCE_THRESHOLD } from '../../constants/RiskConstants';
import { motion } from 'framer-motion';
import { RiskHeatmap } from './RiskHeatmap';
import { RiskResidualChart } from './RiskResidualChart';
import { RiskTreatmentChart } from './RiskTreatmentChart';
import { RiskKPICard } from './dashboard/RiskKPICard';

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
        <div className="space-y-6">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RiskKPICard
                    title="Risques Critiques"
                    value={criticalRisks}
                    subtext="Risques Critiques"
                    icon={ShieldAlert}
                    color="red"
                    delay={0.1}
                />
                <RiskKPICard
                    title="Au-dessus de l'appétence"
                    value={risksAboveAppetite}
                    subtext="Au-dessus de l'appétence"
                    icon={AlertTriangle}
                    color="orange"
                    delay={0.2}
                />
                <RiskKPICard
                    title="Score Moyen"
                    value={avgScore.toFixed(1)}
                    subtext="Score Moyen"
                    icon={TrendingUp}
                    color="blue"
                    chip={{
                        label: `${riskReduction > 0 ? '-' : ''}${riskReduction.toFixed(0)}%`,
                        color: 'emerald'
                    }}
                    delay={0.3}
                />
                <RiskKPICard
                    title="Total Risques"
                    value={totalRisks}
                    subtext="Total Risques"
                    icon={Activity}
                    color="purple"
                    delay={0.4}
                />
            </div>

            {/* Charts Row 1: Heatmap + Treatment */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Heatmap (Replacing Evolution) */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/10 bg-white/50 dark:bg-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        Cartographie des Risques (Heatmap)
                    </h3>
                    <RiskHeatmap risks={risks} />
                </motion.div>

                {/* Treatment Progress (Replacing Donut) */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/10 bg-white/50 dark:bg-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-emerald-500" />
                        Avancement des Traitements
                    </h3>
                    <RiskTreatmentChart risks={risks} />
                </motion.div>
            </div>

            {/* Row 2: Inherent vs Residual (Full Width) */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 glass-premium p-8 rounded-[2.5rem] relative overflow-hidden min-h-[350px]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="p-2 bg-brand-500/10 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Réduction du Risque (Inhérent vs Résiduel)</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Impact des mesures de sécurité par catégorie</p>
                    </div>
                </div>

                <div className="h-[250px] w-full relative z-10">
                    <RiskResidualChart risks={risks} />
                </div>
            </div>

            {/* Top Critical Risks Table */}
            {
                criticalRisks > 0 && (
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
                                .filter(r => r.score >= 10)
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
                )
            }
        </div >
    );
};

