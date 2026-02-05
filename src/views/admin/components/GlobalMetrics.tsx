import React, { useEffect, useState } from 'react';
import { Users, Building, Activity, Zap } from '../../../components/ui/Icons';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ErrorLogger } from '../../../services/errorLogger';
import {
 AreaChart,
 Area,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer
} from 'recharts';

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
 <div className={`p-6 rounded-3xl bg-gradient-to-br border backdrop-blur-sm border-border/40 shadow-apple-sm ${colorClasses[color]}`}>
 <div className="flex items-start justify-between">
 <div>
  <p className="text-sm font-medium text-muted-foreground">{title}</p>
  <h3 className="text-3xl font-bold mt-2 text-white">{value}</h3>
  {trend && <p className="text-xs mt-1 text-emerald-400">{trend}</p>}
 </div>
 <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 shadow-inner`}>
  <Icon className="w-6 h-6" />
 </div>
 </div>
 </div>
 );
};

const chartData = [
 { name: 'Jan', value: 400 },
 { name: 'Feb', value: 300 },
 { name: 'Mar', value: 600 },
 { name: 'Apr', value: 800 },
 { name: 'May', value: 500 },
 { name: 'Jun', value: 700 }, // Mock data
];

export const GlobalMetrics: React.FC = () => {
 const [stats, setStats] = useState({
 tenants: 0,
 users: 0,
 activeSessions: 0,
 });
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchStats = async () => {
 try {
 const tenantsCount = await getCountFromServer(collection(db, 'organizations'));
 const usersCount = await getCountFromServer(collection(db, 'users'));
 const activeQuery = query(collection(db, 'users'), where('lastActive', '>=', new Date(Date.now() - 3600000).toISOString()));
 const activeCount = await getCountFromServer(activeQuery);

 setStats({
  tenants: tenantsCount.data().count,
  users: usersCount.data().count,
  activeSessions: activeCount.data().count,
 });
 } catch (err) {
 ErrorLogger.error(err as Error, 'GlobalMetrics.fetchStats');
 } finally {
 setLoading(false);
 }
 };
 fetchStats();
 }, []);

 if (loading) return <div className="animate-pulse h-64 bg-white/5 rounded-3xl border border-border/40"></div>;

 return (
 <div className="space-y-6 animate-fade-in">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <StatCard
  title="Total Tenants"
  value={stats.tenants}
  icon={Building}
  trend="+12% this month"
  color="blue"
 />
 <StatCard
  title="Total Users"
  value={stats.users}
  icon={Users}
  trend="+24% this month"
  color="purple"
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

 <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
 <h3 className="text-lg font-semibold text-white mb-6">Growth Analytics</h3>
 <div className="h-[300px] w-full">
  <ResponsiveContainer width="100%" height="100%">
  <AreaChart data={chartData}>
  <defs>
  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
   <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
   <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
  </linearGradient>
  </defs>
  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" vertical={false} />
  <XAxis
  dataKey="name"
  stroke="hsl(var(--muted-foreground))"
  fontSize={12}
  tickLine={false}
  axisLine={false}
  />
  <YAxis
  stroke="hsl(var(--muted-foreground))"
  fontSize={12}
  tickLine={false}
  axisLine={false}
  tickFormatter={(value) => `${value}`}
  />
  <Tooltip
  contentStyle={{
   backgroundColor: 'hsl(var(--foreground))',
   border: '1px solid hsl(var(--border))',
   borderRadius: '8px',
  }}
  itemStyle={{ color: 'hsl(var(--border))' }}
  />
  <Area
  type="monotone"
  dataKey="value"
  stroke="hsl(var(--primary))"
  strokeWidth={2}
  fillOpacity={1}
  fill="url(#colorValue)"
  />
  </AreaChart>
  </ResponsiveContainer>
 </div>
 </div>
 </div>
 );
};
