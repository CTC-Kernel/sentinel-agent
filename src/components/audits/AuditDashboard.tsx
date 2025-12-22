import React from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Audit, Finding } from '../../types';
import { AlertTriangle, Calendar, CheckCircle2 } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] shadow-lg border border-white/60 dark:border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group mb-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>
                {/* Global Score */}
                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-10 p-4">
                    {/* Tech Corners */}
                    <svg className="absolute top-0 left-0 w-8 h-8 text-slate-900/20 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v2H2z" /><path fill="currentColor" d="M2 2v20h2V2z" /></svg>
                    <svg className="absolute bottom-0 right-0 w-8 h-8 text-slate-900/20 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v2H2z" /><path fill="currentColor" d="M2 2v20h2V2z" /></svg>

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
                                className="text-emerald-500 transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">{complianceRate}%</span>
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
                    <div onClick={() => onFilterChange?.(null)} className="cursor-pointer group/item text-center">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-2 tracking-widest group-hover/item:text-brand-500 transition-colors">Total Audits</div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{totalAudits}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-2 tracking-widest">Actions Requises</div>
                        <div className={`text-3xl font-black font-mono ${openFindings > 0 ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-slate-900 dark:text-white'}`}>
                            {openFindings}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-2 tracking-widest">À Venir (30j)</div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{upcomingAudits}</div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[180px] relative z-10">
                    {openFindings > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-500/10 px-4 py-3 rounded-lg border border-red-200 dark:border-red-500/20 backdrop-blur-md">
                            <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
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
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 shadow-lg dark:shadow-none relative overflow-hidden group">
                    {/* Tech Corners Generic */}
                    <svg className="absolute top-4 left-4 w-4 h-4 text-slate-500/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-4 right-4 w-4 h-4 text-slate-500/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-4 left-4 w-4 h-4 text-slate-500/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-4 right-4 w-4 h-4 text-slate-500/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 uppercase tracking-widest pl-2 border-l-2 border-brand-500">Statut des Audits</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={85}
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
                    </ResponsiveContainer>
                </div>

                {/* Findings by Type */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 shadow-lg dark:shadow-none relative overflow-hidden group">
                    {/* Tech Corners Generic */}
                    <svg className="absolute top-4 left-4 w-4 h-4 text-slate-500/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-4 right-4 w-4 h-4 text-slate-500/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-4 left-4 w-4 h-4 text-slate-500/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-4 right-4 w-4 h-4 text-slate-500/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 uppercase tracking-widest pl-2 border-l-2 border-red-500">Constats par Type</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={findingsByType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={'hsl(var(--border) / 0.6)'} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                cursor={{ fill: 'hsl(var(--muted-foreground) / 0.12)' }}
                            />
                            <Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={30}>
                                {findingsByType.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Majeure' ? '#EF4444' : entry.name === 'Mineure' ? '#F59E0B' : '#3B82F6'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
