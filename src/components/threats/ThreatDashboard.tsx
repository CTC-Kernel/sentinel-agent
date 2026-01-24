import React from 'react';
import { Threat } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AlertTriangle, Shield, Activity } from '../ui/Icons';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';
import { SENTINEL_PALETTE, SEVERITY_COLORS, CHART_AXIS_COLORS } from '../../theme/chartTheme';

interface ThreatDashboardProps {
    threats: Threat[];
}

export const ThreatDashboard: React.FC<ThreatDashboardProps> = ({ threats }) => {
    // Stats
    const stats = {
        total: threats.length,
        critical: threats.filter(t => t.severity === 'Critical').length,
        ransomware: threats.filter(t => t.type === 'Ransomware').length,
        malware: threats.filter(t => t.type === 'Malware').length,
    };

    // Stable timestamp for calculations
    const [now] = React.useState(() => Date.now());

    // Threat Types Data for Bar Chart
    const typeData = React.useMemo(() => {
        const types: Record<string, number> = {};
        threats.forEach(t => {
            const type = t.type || 'Unknown';
            types[type] = (types[type] || 0) + 1;
        });
        return Object.entries(types)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5) // Top 5
            .map(([name, value]) => ({ name, value }));
    }, [threats]);

    // Activity Trend (Real Data)
    const activityData = React.useMemo(() => {
        const last24h = new Date(now - 24 * 60 * 60 * 1000);
        const buckets: Record<string, number> = {};

        // Initialize buckets for fixed 4-hour blocks
        for (let i = 0; i < 24; i += 4) {
            const key = i.toString().padStart(2, '0') + ':00';
            buckets[key] = 0;
        }

        threats.forEach(t => {
            const date = t.timestamp ? new Date(t.timestamp) : new Date(t.date);
            if (date >= last24h) {
                // Find closest 4h bucket
                const hours = date.getHours();
                const bucketHour = Math.floor(hours / 4) * 4;
                const key = bucketHour.toString().padStart(2, '0') + ':00';
                if (buckets[key] !== undefined) buckets[key]++;
            }
        });

        return Object.entries(buckets).map(([time, value]) => ({ time, value }));
    }, [threats, now]);

    return (
        <div className="space-y-6">
            {/* KPI Cards Consolidated (Threat Intel Style) */}
            <div className="glass-premium p-6 md:p-8 rounded-5xl flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

                <div className="space-y-2 relative z-10">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        Menaces en temps réel
                    </p>
                    <div className="flex items-baseline gap-3">
                        <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                            {stats.total}
                        </p>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actives (24h)</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto relative z-10">
                    {/* Critical Threats Card */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-red-50/50 dark:hover:bg-red-900/20">
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Critiques</span>
                            <div className="p-1.5 rounded-lg bg-red-100/50 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.critical}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Priorité haute</p>
                        </div>
                    </div>

                    {/* Ransomware Card */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-brand-50/50 dark:hover:bg-brand-900/20">
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">Ransomware</span>
                            <div className="p-1.5 rounded-lg bg-brand-100/50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400">
                                <Shield className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {stats.ransomware}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Campagnes</p>
                        </div>
                    </div>

                    {/* Malware Card */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-orange-50/50 dark:hover:bg-orange-900/20">
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">Malware</span>
                            <div className="p-1.5 rounded-lg bg-orange-100/50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                                <Activity className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {stats.malware}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Détectés</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Threat Types */}
                <div className="glass-panel p-4 sm:p-6 rounded-4xl border border-white/10">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-6">Top Types de Menaces</h3>
                    <div className="h-[250px] w-full">
                        {typeData.length === 0 ? (
                            <EmptyChartState
                                variant="bar"
                                message="Aucune menace"
                                description="Aucune menace détectée pour le moment."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={typeData} layout="vertical" margin={{ left: 40, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={`rgba(255,255,255,${CHART_AXIS_COLORS.gridOpacity})`} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 12 }}
                                        width={100}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar dataKey="value" fill={SENTINEL_PALETTE.info} radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Activity Trend */}
                <div className="glass-panel p-4 sm:p-6 rounded-4xl border border-white/10">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-6">Volume d'Activité (24h)</h3>
                    <div className="h-[250px] w-full">
                        {activityData.every(d => d.value === 0) ? (
                            <EmptyChartState
                                variant="line"
                                message="Aucune activité"
                                description="Aucune activité détectée ces dernières 24h."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activityData}>
                                    <defs>
                                        <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={`rgba(255,255,255,${CHART_AXIS_COLORS.gridOpacity})`} />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 12 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area type="monotone" dataKey="value" stroke={SEVERITY_COLORS.critical} strokeWidth={3} fillOpacity={1} fill="url(#colorActivity)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
