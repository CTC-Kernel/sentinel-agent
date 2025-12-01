import React from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Audit, Finding } from '../../types';
import { ClipboardCheck, AlertTriangle, Calendar, CheckCircle2 } from '../ui/Icons';
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
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Audits */}
                <div
                    onClick={() => onFilterChange?.(null)}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Audits</span>
                        <ClipboardCheck className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalAudits}</div>
                    <div className="text-xs text-slate-500 mt-1">Campagne en cours</div>
                </div>

                {/* Open Findings */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-2xl border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Constats Ouverts</span>
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-3xl font-bold text-red-700 dark:text-red-400">{openFindings}</div>
                    <div className="text-xs text-red-600 dark:text-red-500 mt-1">Actions requises</div>
                </div>

                {/* Compliance Rate */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Taux Complétion</span>
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{complianceRate}%</div>
                    <div className="text-xs text-slate-500 mt-1">Audits terminés</div>
                </div>

                {/* Upcoming */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">À Venir (30j)</span>
                        <Calendar className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{upcomingAudits}</div>
                    <div className="text-xs text-slate-500 mt-1">Audits planifiés</div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Statut des Audits</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
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
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Constats par Type</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={findingsByType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
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
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
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
