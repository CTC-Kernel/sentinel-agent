import React from 'react';
import { Threat } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Globe, AlertTriangle, Shield, Activity } from '../ui/Icons';
import { ChartTooltip } from '../ui/ChartTooltip';

interface ThreatDashboardProps {
    threats: Threat[];
}

export const ThreatDashboard: React.FC<ThreatDashboardProps> = ({ threats }) => {
    // Stats
    const stats = {
        total: threats.length,
        critical: threats.filter(t => t.severity === 'Critical').length,
        ransomware: threats.filter(t => t.type === 'Ransomware').length,
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

        // Initialize buckets for last 6 4-hour blocks to show a 24h trend
        for (let i = 0; i <= 24; i += 4) {
            const d = new Date(now - (24 - i) * 60 * 60 * 1000);
            const key = d.getHours().toString().padStart(2, '0') + ':00';
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
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                        <Globe className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Activité Globale</p>
                        <p className="text-sm font-bold text-red-500 uppercase">ÉLEVÉE</p>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-brand-500/10 rounded-xl text-brand-500">
                        <Activity className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Total Menaces</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Critiques</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.critical}</p>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                        <Shield className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Ransomware</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.ransomware}</p>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Threat Types */}
                <div className="glass-panel p-6 rounded-[2rem] border border-white/10">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Top Types de Menaces</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={typeData} layout="vertical" margin={{ left: 40, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.1)" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    width={100}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Trend */}
                <div className="glass-panel p-6 rounded-[2rem] border border-white/10">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Volume d'Activité (24h)</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activityData}>
                                <defs>
                                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorActivity)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
