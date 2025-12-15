import React from 'react';
import { Siren, ShieldAlert, TrendingUp, Activity } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { motion } from 'framer-motion';

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
            className="glass-panel flex flex-col md:flex-row items-center justify-between p-4 md:px-8 border border-white/60 dark:border-white/10 rounded-[1.5rem] shadow-sm gap-6 md:gap-12 relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            {/* Health Score - Compact */}
            <div className="flex items-center gap-4 min-w-[180px]">
                <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted-foreground/10" />
                        <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={163.36} strokeDashoffset={163.36 - (163.36 * healthScore) / 100} strokeLinecap="round" className={`${getHealthColor(healthScore)} transition-all duration-1000 ease-out`} />
                    </svg>
                    <span className={`absolute text-sm font-black ${getHealthColor(healthScore)}`}>{healthScore}%</span>
                </div>
                <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Santé Globale</div>
                    <div className={`text-sm font-bold ${getHealthColor(healthScore)}`}>
                        {healthScore >= 80 ? 'Système Sain' : healthScore >= 60 ? 'Attention' : 'Critique'}
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-10 bg-border/60" />

            {/* Metrics Ribbon */}
            <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                <div onClick={() => navigate('/incidents')} className="flex items-center gap-3 cursor-pointer group">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-600 group-hover:bg-red-500/20 transition-colors">
                        <Siren className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-foreground leading-none">{stats.activeIncidents}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{t('dashboard.incidents')}</div>
                    </div>
                </div>

                <div onClick={() => navigate('/risks')} className="flex items-center gap-3 cursor-pointer group">
                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 group-hover:bg-orange-500/20 transition-colors">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-foreground leading-none">{stats.highRisks}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{t('dashboard.risks')}</div>
                    </div>
                </div>

                <div onClick={() => navigate('/risks')} className="flex items-center gap-3 cursor-pointer group">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20 transition-colors">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-foreground leading-none">
                            {new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Exposition</div>
                    </div>
                </div>

                <div onClick={() => navigate('/compliance')} className="flex items-center gap-3 cursor-pointer group">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20 transition-colors">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-foreground leading-none">{stats.compliance}%</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Conformité</div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
