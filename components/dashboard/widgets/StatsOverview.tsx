import React from 'react';
import { Siren, ShieldAlert, TrendingUp, Euro } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';

interface StatCardProps {
    title: string;
    value: string | number | null;
    icon: React.ElementType;
    trend?: string;
    colorClass: string;
    delay?: string;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, colorClass, delay, onClick }) => (
    <div
        onClick={onClick}
        className={`relative group glass-panel p-6 rounded-[2rem] hover:shadow-apple transition-all duration-500 hover:-translate-y-1 overflow-hidden cursor-pointer ${delay || ''}`}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>
        <div className="flex flex-col h-full justify-between relative z-10">
            <div className="flex justify-between items-start mb-6">
                <div
                    className={`p-3.5 rounded-[1.2rem] ${colorClass} bg-opacity-10 ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm group-hover:scale-110 transition-transform duration-500`}
                >
                    <Icon className={`h-6 w-6 ${colorClass.replace('bg-', 'text-')}`} strokeWidth={2} />
                </div>
                {trend && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20 shadow-sm">
                    {trend}
                </span>}
            </div>
            <div>
                {value === null ? <Skeleton className="h-10 w-16 mb-1 rounded-xl" /> : <h3 className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-white font-display">{value}</h3>}
                <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mt-1 tracking-wide">{title}</p>
            </div>
        </div>
    </div>
);

interface StatsOverviewProps {
    stats: any;
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, loading, navigate, t }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title={t('dashboard.activeIncidents')} value={loading ? null : stats.activeIncidents} icon={Siren} colorClass="bg-red-500 text-red-500" trend={stats.activeIncidents > 0 ? "Urgent" : undefined} delay="delay-0" onClick={() => navigate('/incidents')} />
            <StatCard title={t('dashboard.criticalRisks')} value={loading ? null : stats.highRisks} icon={ShieldAlert} colorClass="bg-orange-500 text-orange-500" delay="delay-75" onClick={() => navigate('/risks')} />
            <StatCard title={t('dashboard.financialExposure')} value={loading ? null : `${new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}`} icon={TrendingUp} colorClass="bg-red-600 text-red-600" trend={stats.financialRisk > 100000 ? "Critique" : undefined} delay="delay-100" onClick={() => navigate('/risks')} />
            <StatCard title={t('dashboard.assetValue')} value={loading ? null : `${new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.assetValue)}`} icon={Euro} colorClass="bg-indigo-500 text-indigo-500" delay="delay-150" onClick={() => navigate('/assets')} />
        </div>
    );
};
