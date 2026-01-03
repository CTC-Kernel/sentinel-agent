import React from 'react';
import { Siren, ShieldAlert, TrendingUp, Activity } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { motion } from 'framer-motion';

import { TechCorner } from '../../ui/TechCorner';

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

export const DashboardStats: React.FC<StatsOverviewProps> = ({ stats, loading, navigate, t }) => {
    const calculateHealthScore = () => {
        if (!stats) return 100;
        let score = 100;
        if (stats.activeIncidents > 0) score -= (stats.activeIncidents * 15);
        if (stats.highRisks > 0) score -= (stats.highRisks * 10);
        const complianceGap = Math.max(0, 100 - stats.compliance);
        score -= (complianceGap * 0.2);
        return Math.max(0, Math.round(score));
    };

    const healthScore = calculateHealthScore();

    const getHealthColor = (score: number) => {
        if (score >= 80) return 'text-emerald-500';
        if (score >= 60) return 'text-orange-500';
        return 'text-red-500';
    };

    if (loading) {
        return <Skeleton className="h-24 w-full rounded-2xl" />;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel-command flex flex-col md:flex-row items-center justify-between p-4 md:px-8 rounded-[1.5rem] gap-6 md:gap-12 relative overflow-hidden group hover:shadow-blue-500/15 hover:shadow-[0_0_30px_-5px] transition-shadow duration-500"
            data-tour="dashboard-reports"
        >
            <TechCorner position="top-left" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="top-right" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="bottom-left" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="bottom-right" className="opacity-0 group-hover:opacity-100" />

            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            {/* Health Score - Compact */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="-6 -6 68 68">
                        <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted-foreground/10" />
                        <circle
                            cx="28"
                            cy="28"
                            r="26"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="transparent"
                            strokeDasharray={healthScore === 100 ? 'none' : 163.36}
                            strokeDashoffset={163.36 - (163.36 * healthScore) / 100}
                            strokeLinecap="round"
                            className={`${getHealthColor(healthScore)} transition-all duration-1000 ease-out`}
                        />
                    </svg>
                    <span className={`absolute text-xs sm:text-sm font-black ${getHealthColor(healthScore)}`}>{healthScore}%</span>
                </div>
                <div className="flex flex-col">
                    <div className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5 whitespace-nowrap">{t('dashboard.healthCheck') || 'Santé Globale'}</div>
                    <div className={`text-xs sm:text-sm font-bold ${getHealthColor(healthScore)} whitespace-nowrap`}>
                        {healthScore >= 80 ? (t('dashboard.systemHealthy') || 'Système Sain') : healthScore >= 60 ? (t('dashboard.statusReview') || 'Attention') : (t('dashboard.statusToRead') || 'Critique')}
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-10 bg-border/60" />

            {/* Metrics Ribbon */}
            <div className="flex-1 w-full grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-6">
                <div
                    onClick={() => navigate('/incidents')}
                    className="flex flex-col md:flex-row items-center md:items-start gap-3 cursor-pointer group rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 text-center md:text-left"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/incidents');
                        }
                    }}
                >
                    <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 group-hover:bg-red-500/20 transition-colors shadow-sm">
                        <Siren className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground leading-none mb-1">{stats.activeIncidents}</div>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('dashboard.incidents')}</div>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/risks')}
                    className="flex flex-col md:flex-row items-center md:items-start gap-3 cursor-pointer group rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 text-center md:text-left"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/risks');
                        }
                    }}
                >
                    <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 group-hover:bg-orange-500/20 transition-colors shadow-sm">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground leading-none mb-1">{stats.highRisks}</div>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('dashboard.risks')}</div>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/risks')}
                    className="flex flex-col md:flex-row items-center md:items-start gap-3 cursor-pointer group rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 text-center md:text-left"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/risks');
                        }
                    }}
                >
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20 transition-colors shadow-sm">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground leading-none mb-1">
                            {new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}
                        </div>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Exposition</div>
                    </div>
                </div>

                <div
                    onClick={() => navigate('/compliance')}
                    className="flex flex-col md:flex-row items-center md:items-start gap-3 cursor-pointer group rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 text-center md:text-left"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate('/compliance');
                        }
                    }}
                >
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20 transition-colors shadow-sm">
                        <Activity className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground leading-none mb-1">{stats.compliance}%</div>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Conformité</div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
