import React from 'react';
import { motion } from 'framer-motion';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Audit, Finding } from '../../types';
import { AlertTriangle, Calendar, CheckCircle2, PieChart as PieChartIcon, BarChart3 as BarChartIcon } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EmptyChartState } from '../ui/EmptyChartState';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';

// Focus indicators: focus-visible:ring-2 applied globally via CSS

interface AuditDashboardProps {
    audits: Audit[];
    findings: Finding[];
    onFilterChange?: (filter: { type: string; value: string } | null) => void;
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({ audits, findings, onFilterChange }) => {
    // Metrics
    const totalAudits = audits.length;
    const openFindings = findings.filter(f => f.status === 'Ouvert').length;
    const completedAudits = audits.filter(a => a.status === 'Terminé').length;
    const complianceRate = totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 0; // Simplified metric

    const upcomingAudits = audits.filter(a => {
        if (!a.dateScheduled) return false;
        const date = new Date(a.dateScheduled);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 30;
    }).length;

    // Chart Data
    const statusData = [
        { name: 'Planifié', value: audits.filter(a => a.status === 'Planifié').length, color: '#3B82F6' },
        { name: 'En cours', value: audits.filter(a => a.status === 'En cours').length, color: '#F59E0B' },
        { name: 'Terminé', value: audits.filter(a => a.status === 'Terminé').length, color: '#10B981' },
    ].filter(d => d.value > 0);

    const findingsByType = [
        { name: 'Majeure', value: findings.filter(f => f.type === 'Majeure').length },
        { name: 'Mineure', value: findings.filter(f => f.type === 'Mineure').length },
        { name: 'Observation', value: findings.filter(f => f.type === 'Observation').length },
    ].filter(d => d.value > 0);

    if (totalAudits === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <EmptyChartState
                    message="Aucun audit pour le moment"
                    description="Commencez par planifier un audit pour voir apparaître des métriques et des analyses détaillées."
                    className="glass-premium rounded-[2.5rem] min-h-[400px]"
                    variant="default"
                    icon={<CheckCircle2 className="h-10 w-10 text-brand-500" />}
                />
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
        >
            {/* Summary Card */}
            <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group mb-8 overflow-hidden hover:shadow-apple transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>

                {/* Tech Corners */}
                <svg className="absolute top-5 left-5 w-4 h-4 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v2H2z" /><path fill="currentColor" d="M2 2v20h2V2z" /></svg>
                <svg className="absolute bottom-5 right-5 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v2H2z" /><path fill="currentColor" d="M2 2v20h2V2z" /></svg>

                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-100 dark:text-slate-800"
                            />
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * complianceRate) / 100}
                                className="text-emerald-500 transition-all duration-1000 ease-out drop-shadow-emerald-md"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{complianceRate}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 uppercase tracking-wider">Taux de Complétion</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] font-mono leading-relaxed">
                            PCT. AUDITS TERMINÉS
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/5 px-6 mx-2 relative z-10">
                    <div
                        onClick={() => onFilterChange?.(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFilterChange?.(null); } }}
                        role="button"
                        tabIndex={0}
                        aria-label="Afficher tous les audits"
                        className="cursor-pointer group/item text-center hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors p-2"
                    >
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-2 tracking-widest group-hover/item:text-brand-500 transition-colors">Total Audits</div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{totalAudits}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-2 tracking-widest">Actions Requises</div>
                        <div className={`text-3xl font-black font-mono ${openFindings > 0 ? 'text-red-500 drop-shadow-red-md' : 'text-slate-900 dark:text-white'}`}>
                            {openFindings}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-2 tracking-widest">À Venir (30j)</div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{upcomingAudits}</div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[200px] relative z-10">
                    {openFindings > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-500/10 px-4 py-3 rounded-lg border border-red-200 dark:border-red-500/20 backdrop-blur-md animate-pulse-slow">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="uppercase tracking-wide">{openFindings} actions requises</span>
                        </div>
                    )}
                    {upcomingAudits > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100/50 dark:bg-purple-500/10 px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-500/20 backdrop-blur-md">
                            <Calendar className="h-4 w-4 shrink-0" />
                            <span className="uppercase tracking-wide">{upcomingAudits} audits planifiés</span>
                        </div>
                    )}
                    {openFindings === 0 && upcomingAudits === 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/10 px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-500/20 backdrop-blur-md">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span className="uppercase tracking-wide">Système Sécurisé</span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                {/* Status Distribution */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    {/* Tech Corners Generic */}
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                    <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-brand-500" />
                        Statut des Audits
                    </h4>
                    <ResponsiveContainer width="100%" height={250}>
                        {statusData.length === 0 ? (
                            <EmptyChartState
                                variant="pie"
                                message="Aucune donnée"
                                className="scale-90"
                            />
                        ) : (
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="60%"
                                    outerRadius="80%"
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                    cornerRadius={4}
                                >
                                    {statusData.map((entry, index) => (
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
                        )}
                    </ResponsiveContainer>
                </motion.div>

                {/* Findings by Type */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    {/* Tech Corners Generic */}
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                    <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                        <BarChartIcon className="w-4 h-4 text-brand-500" />
                        Constats par Type
                    </h4>
                    <ResponsiveContainer width="100%" height={250}>
                        {findingsByType.length === 0 ? (
                            <EmptyChartState
                                variant="bar"
                                message="Aucun constat"
                                className="scale-90"
                            />
                        ) : (
                            <BarChart data={findingsByType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={'#94a3b8'} strokeOpacity={0.1} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                                    {findingsByType.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Majeure' ? '#EF4444' : entry.name === 'Mineure' ? '#F59E0B' : '#3B82F6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </motion.div>
            </div>
        </motion.div>
    );
};
