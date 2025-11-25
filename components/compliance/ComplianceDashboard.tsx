import React, { useEffect, useState } from 'react';
import { Control } from '../../types';
import { CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { StatsService } from '../../services/statsService';
import { useStore } from '../../store';
import { ChartTooltip } from '../ui/ChartTooltip';

interface ComplianceDashboardProps {
    controls: Control[];
    onFilterChange?: (status: string | null) => void;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ controls, onFilterChange }) => {
    const { user } = useStore();
    const [trend, setTrend] = useState<number | undefined>(undefined);

    useEffect(() => {
        const fetchTrend = async () => {
            if (!user?.organizationId) return;
            try {
                // Get last 30 days history
                const history = await StatsService.getHistory(user.organizationId, 30);
                if (history.length >= 2) {
                    const current = history[history.length - 1].metrics.complianceRate;
                    const previous = history[0].metrics.complianceRate; // Compare with 30 days ago (or oldest available)
                    setTrend(Math.round(current - previous));
                }
            } catch (error) {
                console.error('Failed to fetch compliance trend:', error);
            }
        };
        fetchTrend();
    }, [user?.organizationId]);

    // Calculate metrics
    // Calculate metrics
    const totalControls = controls.length;
    const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
    const inProgressControls = controls.filter(c => c.status === 'Partiel').length;
    const notImplementedControls = controls.filter(c => c.status === 'Non commencé').length;
    const notApplicableControls = controls.filter(c => c.status === 'Non applicable').length;

    const complianceRate = totalControls > 0 ? (implementedControls / totalControls * 100) : 0;
    const progressRate = totalControls > 0 ? ((implementedControls + inProgressControls) / totalControls * 100) : 0;

    // Status distribution
    const statusData = [
        { name: 'Implémenté', value: implementedControls, color: '#22c55e' },
        { name: 'Partiel', value: inProgressControls, color: '#eab308' },
        { name: 'Non commencé', value: notImplementedControls, color: '#ef4444' },
        { name: 'Non applicable', value: notApplicableControls, color: '#94a3b8' }
    ];

    // Group by Annex A domain
    const domainData = controls.reduce((acc, control) => {
        const domain = control.code.split('.')[0]; // A.5, A.6, etc.
        if (!acc[domain]) {
            acc[domain] = { total: 0, implemented: 0, inProgress: 0 };
        }
        acc[domain].total++;
        if (control.status === 'Implémenté') acc[domain].implemented++;
        if (control.status === 'Partiel') acc[domain].inProgress++;
        return acc;
    }, {} as Record<string, { total: number; implemented: number; inProgress: number }>);

    const domainChartData = Object.entries(domainData).map(([domain, data]) => ({
        domain,
        rate: (data.implemented / data.total * 100).toFixed(0),
        total: data.total,
        implemented: data.implemented
    }));

    // Radar chart data for domains
    const radarData = Object.entries(domainData).map(([domain, data]) => ({
        domain: domain,
        score: (data.implemented / data.total * 100)
    }));

    // Critical controls (high priority)
    const criticalControls = controls.filter(c =>
        c.status !== 'Implémenté' &&
        (c.code.includes('A.5.') || c.code.includes('A.8.') || c.code.includes('A.12.'))
    );

    return (
        <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Compliance Rate */}
                <div
                    onClick={() => onFilterChange?.('Implémenté')}
                    className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-800 cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Conformité</span>
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="text-3xl font-bold text-green-700 dark:text-green-400">{complianceRate.toFixed(0)}%</div>
                        {trend !== undefined && (
                            <div className={`text-xs font-bold mb-1.5 px-1.5 py-0.5 rounded-md ${trend >= 0 ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' : 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'}`}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-500 mt-1">{implementedControls}/{totalControls} contrôles</div>
                </div>

                {/* In Progress */}
                <div
                    onClick={() => onFilterChange?.('Partiel')}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">En Cours</span>
                        <Clock className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{inProgressControls}</div>
                    <div className="text-xs text-slate-500 mt-1">{((inProgressControls / totalControls) * 100).toFixed(0)}% du total</div>
                </div>

                {/* Not Implemented */}
                <div
                    onClick={() => onFilterChange?.('Non commencé')}
                    className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-2xl border border-red-200 dark:border-red-800 cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-400">À Implémenter</span>
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-3xl font-bold text-red-700 dark:text-red-400">{notImplementedControls}</div>
                    <div className="text-xs text-red-600 dark:text-red-500 mt-1">Priorité haute</div>
                </div>

                {/* Progress Rate */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Progression</span>
                        <TrendingUp className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{progressRate.toFixed(0)}%</div>
                    <div className="text-xs text-slate-500 mt-1">Implémenté + En cours</div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6 uppercase tracking-wider">Distribution par Statut</h4>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
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
                </div>

                {/* Domain Progress */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6 uppercase tracking-wider">Conformité par Domaine (Annexe A)</h4>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={domainChartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                                <XAxis
                                    dataKey="domain"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} />
                                <Bar dataKey="rate" name="Taux %" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30}>
                                    {domainChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={parseInt(entry.rate) >= 80 ? '#22c55e' : parseInt(entry.rate) >= 50 ? '#eab308' : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Radar Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 lg:col-span-2 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6 uppercase tracking-wider">Vue Radar - Maturité par Domaine</h4>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                                <PolarAngleAxis dataKey="domain" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} />
                                <Radar
                                    name="Conformité %"
                                    dataKey="score"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fill="#3b82f6"
                                    fillOpacity={0.2}
                                />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend formatter={(value) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-1">{value}</span>} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Critical Controls Not Implemented */}
            {criticalControls.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Contrôles Critiques à Implémenter ({criticalControls.length})
                    </h4>
                    <div className="space-y-3">
                        {criticalControls.slice(0, 5).map((control, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800">
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{control.code} - {control.name}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-1">{control.description}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-xs font-bold ${control.status === 'Partiel' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                    'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                    }`}>
                                    {control.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Domain Details */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Détail par Domaine ISO 27001</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(domainData).map(([domain, data]) => {
                        const rate = (data.implemented / data.total * 100);
                        return (
                            <div key={domain} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-900 dark:text-white">{domain}</span>
                                    <span className="text-xs font-bold text-slate-500">{data.implemented}/{data.total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                                    <div
                                        className={`h-2 rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                        style={{ width: `${rate}%` }}
                                    ></div>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {rate.toFixed(0)}% conformité
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
