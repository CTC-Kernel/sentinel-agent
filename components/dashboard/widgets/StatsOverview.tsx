import React from 'react';
import { Siren, ShieldAlert, TrendingUp, Euro } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';

interface StatsOverviewProps {
    stats: {
        activeIncidents: number;
        highRisks: number;
        financialRisk: number;
        assetValue: number;
        compliance: number;
    };
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, loading, navigate, t }) => {
    // Calculate global health score based on weighted metrics
    // Compliance (40%), Incidents (30%), Risks (30%)
    const calculateHealthScore = () => {
        if (!stats) return 100;

        let score = 100;

        // Deduction for active incidents
        if (stats.activeIncidents > 0) score -= (stats.activeIncidents * 15);

        // Deduction for high risks
        if (stats.highRisks > 0) score -= (stats.highRisks * 10);

        // Deduction for compliance gap
        const complianceGap = Math.max(0, 100 - stats.compliance);
        score -= (complianceGap * 0.2); // Weighted less heavily

        return Math.max(0, Math.round(score));
    };

    const healthScore = calculateHealthScore();

    const getHealthColor = (score: number) => {
        if (score >= 80) return 'text-emerald-500';
        if (score >= 60) return 'text-orange-500';
        return 'text-red-500';
    };

    const getHealthMessage = (score: number) => {
        if (score >= 80) return t('dashboard.statusHealthy'); // "Système Sain"
        if (score >= 60) return t('dashboard.statusWarning'); // "Attention Requise"
        return t('dashboard.statusCritical'); // "État Critique"
    };

    if (loading) {
        return <Skeleton className="h-48 w-full rounded-[2rem]" />;
    }

    return (
        <div className="glass-panel p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative group overflow-hidden">
            {/* Background Gradient */}
            <div className={`absolute inset-0 opacity-5 bg-gradient-to-r from-transparent via-current to-transparent pointer-events-none ${getHealthColor(healthScore).replace('text-', 'text-')}`}></div>

            {/* Global Health Score */}
            <div className="flex items-center gap-8 relative z-10 min-w-[280px]">
                <div className="relative">
                    <svg className="w-28 h-28 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                        {/* Background Circle */}
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-slate-100 dark:text-slate-800"
                        />
                        {/* Progress Circle */}
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * healthScore) / 100}
                            strokeLinecap="round"
                            className={`${getHealthColor(healthScore)} transition-all duration-1000 ease-out shadow-lg shadow-current`}
                        />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                        <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{healthScore}%</span>
                    </div>
                </div>
                <div>
                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 px-2.5 py-1 rounded-full w-fit ${getHealthColor(healthScore).replace('text-', 'bg-').replace('500', '50')} ${getHealthColor(healthScore)} bg-opacity-10`}>
                        {getHealthMessage(healthScore)}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Score de Santé</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[180px] leading-relaxed">
                        Indicateur global basé sur vos incidents, risques et conformité.
                    </p>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-6 px-4 md:border-l border-slate-200 dark:border-white/10 md:ml-4">
                {/* Active Incidents */}
                <div
                    onClick={() => navigate('/incidents')}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer group/item transition-all duration-300 border border-transparent hover:border-red-200 dark:hover:border-red-900/30"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm group-hover/item:text-red-500 transition-colors">
                            <Siren className="h-5 w-5 text-slate-400 dark:text-slate-400 group-hover/item:text-red-500" />
                        </div>
                        {stats.activeIncidents > 0 && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Alert</span>
                        )}
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-0.5">{stats.activeIncidents}</div>
                    <div className="text-xs font-semibold text-slate-500 group-hover/item:text-red-600/70 transition-colors">{t('dashboard.activeIncidents')}</div>
                </div>

                {/* Critical Risks */}
                <div
                    onClick={() => navigate('/risks')}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-900/10 cursor-pointer group/item transition-all duration-300 border border-transparent hover:border-orange-200 dark:hover:border-orange-900/30"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm group-hover/item:text-orange-500 transition-colors">
                            <ShieldAlert className="h-5 w-5 text-slate-400 dark:text-slate-400 group-hover/item:text-orange-500" />
                        </div>
                        {stats.highRisks > 0 && (
                            <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Critique</span>
                        )}
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-0.5">{stats.highRisks}</div>
                    <div className="text-xs font-semibold text-slate-500 group-hover/item:text-orange-600/70 transition-colors">{t('dashboard.criticalRisks')}</div>
                </div>

                {/* Financial Exposure */}
                <div
                    onClick={() => navigate('/risks')}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer group/item transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-white/20"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm group-hover/item:text-blue-500 transition-colors">
                            <TrendingUp className="h-5 w-5 text-slate-400 dark:text-slate-400 group-hover/item:text-blue-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-0.5 text-nowrap">
                        {new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}
                    </div>
                    <div className="text-xs font-semibold text-slate-500">{t('dashboard.financialExposure')}</div>
                </div>

                {/* Asset Value */}
                <div
                    onClick={() => navigate('/assets')}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer group/item transition-all duration-300 border border-transparent hover:border-slate-200 dark:hover:border-white/20"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm group-hover/item:text-indigo-500 transition-colors">
                            <Euro className="h-5 w-5 text-slate-400 dark:text-slate-400 group-hover/item:text-indigo-500" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-0.5 text-nowrap">
                        {new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.assetValue)}
                    </div>
                    <div className="text-xs font-semibold text-slate-500">{t('dashboard.assetValue')}</div>
                </div>
            </div>
        </div>
    );
};
