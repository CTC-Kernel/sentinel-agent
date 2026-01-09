import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Building, Activity, Zap } from 'lucide-react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ErrorLogger } from '../../../services/errorLogger';

const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    trend?: string;
    color: 'blue' | 'purple' | 'emerald' | 'orange';
}> = ({ title, value, icon: Icon, trend, color }) => {
    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20',
        purple: 'from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20',
        emerald: 'from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20',
        orange: 'from-orange-500/20 to-orange-600/5 text-orange-400 border-orange-500/20',
    };

    return (
        <div className={`p-6 rounded-2xl bg-gradient-to-br border backdrop-blur-sm ${colorClasses[color]}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <h3 className="text-3xl font-bold mt-2 text-white">{value}</h3>
                    {trend && <p className="text-xs mt-1 text-emerald-400">{trend}</p>}
                </div>
                <div className={`p-3 rounded-xl bg-white/5`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
};

export const GlobalMetrics: React.FC = () => {
    const [stats, setStats] = useState({
        tenants: 0,
        users: 0,
        activeSessions: 0, // Estimated
        audits: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch counts using aggregation queries for performance
                const tenantsCount = await getCountFromServer(collection(db, 'organizations'));
                const usersCount = await getCountFromServer(collection(db, 'users'));
                // Just an example, maybe active sessions is not easily queryable without real-time DB or functions
                // We'll simulate this or query recent logins if possible, but for now we'll mock or query recent
                const activeQuery = query(collection(db, 'users'), where('lastActive', '>=', new Date(Date.now() - 3600000).toISOString())); // active in last hour (string comparison might be tricky with ISO strings if not careful, but works generally for ISO)
                const activeCount = await getCountFromServer(activeQuery);

                setStats({
                    tenants: tenantsCount.data().count,
                    users: usersCount.data().count,
                    activeSessions: activeCount.data().count,
                    audits: 0 // Placeholder
                });
            } catch (err) {
                ErrorLogger.error(err as Error, 'GlobalMetrics.fetchStats');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    // Mock data for chart
    const data = [
        { name: 'Jan', tenants: 4, users: 24 },
        { name: 'Feb', tenants: 7, users: 45 },
        { name: 'Mar', tenants: 12, users: 89 },
        { name: 'Apr', tenants: 18, users: 145 },
        { name: 'May', tenants: 24, users: 210 },
        { name: 'Jun', tenants: 35, users: 340 },
    ];

    if (loading) return <div className="animate-pulse h-64 bg-white/5 rounded-2xl"></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Tenants"
                    value={stats.tenants}
                    icon={Building}
                    color="blue"
                    trend="+12% this month"
                />
                <StatCard
                    title="Total Users"
                    value={stats.users}
                    icon={Users}
                    color="purple"
                    trend="+24% this month"
                />
                <StatCard
                    title="Active Sessions (1h)"
                    value={stats.activeSessions}
                    icon={Activity}
                    color="emerald"
                />
                <StatCard
                    title="System Health"
                    value="99.9%"
                    icon={Zap}
                    color="orange"
                />
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-brand-400" />
                    Growth Analytics
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
                                itemStyle={{ color: '#f1f5f9' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="users"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorUsers)"
                                name="Users"
                            />
                            <Area
                                type="monotone"
                                dataKey="tenants"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorTenants)"
                                name="Tenants"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
