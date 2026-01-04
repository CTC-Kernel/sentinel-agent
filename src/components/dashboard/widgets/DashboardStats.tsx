import React, { useState } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Siren, ShieldAlert, TrendingUp, Activity, Sparkles, RefreshCw, Bot } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { motion } from 'framer-motion';
import { aiService } from '../../../services/aiService';
import { ErrorLogger } from '../../../services/errorLogger';

import { DashboardService } from '../../../services/dashboardService';
import { useStore } from '../../../store';
import { TechCorner } from '../../ui/TechCorner';

interface StatsOverviewProps {
    stats: {
        activeIncidents: number;
        highRisks: number;
        totalRisks: number;
        financialRisk: number;
        assetValue: number;
        compliance: number;
    };
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
}

export const DashboardStats: React.FC<StatsOverviewProps> = ({ stats, loading, navigate, t }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const { user } = useStore();

    // Debug logging
    React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            // getExecutiveSummary();  <- Moving this call to a safer place or ensuring it has deps
        }
    }, [stats]);

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

    const getExecutiveSummary = async () => {
        if (!user?.organizationId) return;
        const saved = await DashboardService.getExecutiveSummary(user.organizationId);
        if (saved) {
            setSummary(saved.summary);
            checkAutoRefresh(saved.generatedAt);
        } else {
            // Only generate if we have meaningful stats
            if (stats && stats.compliance > 0) {
                generateSummary();
            } else {
                setSummary("Analyse en attente des données de conformité...");
            }
        }
    }

    const checkAutoRefresh = (lastGenerated: string) => {
        const now = new Date();
        const last = new Date(lastGenerated);

        // Target: Today at 07:00
        const today7am = new Date();
        today7am.setHours(7, 0, 0, 0);

        // If now is past 7am, and last generation was before 7am today => Refresh
        if (now > today7am && last < today7am) {
            generateSummary();
        }
    };

    const generateSummary = async () => {
        if (isGenerating || !user?.organizationId) return;

        setIsGenerating(true);
        try {
            const result = await aiService.generateExecutiveDashboardSummary({
                metrics: stats,
                healthScore,
                generatedAt: new Date().toISOString()
            });
            setSummary(result);
            await DashboardService.saveExecutiveSummary(user.organizationId, result, new Date().toISOString());

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'DashboardStats.generateSummary');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateSummary = (e: React.MouseEvent) => {
        e.stopPropagation();
        generateSummary();
    };

    // Initial load
    React.useEffect(() => {
        if (user?.organizationId && stats && !loading) {
            getExecutiveSummary();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.organizationId, stats, loading]);

    if (loading) {
        return <Skeleton className="h-24 w-full rounded-2xl" />;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel-command flex flex-col p-6 rounded-[2rem] gap-6 relative overflow-hidden group hover:shadow-blue-500/10 transition-all duration-500"
            data-tour="dashboard-reports"
        >
            <TechCorner position="top-left" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="top-right" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="bottom-left" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="bottom-right" className="opacity-0 group-hover:opacity-100" />

            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            {/* Top Section: Health Score & Metrics */}
            <div className="flex flex-col xl:flex-row gap-6 lg:gap-8 items-start xl:items-center">

                {/* Health Score Block */}
                <div className="flex xl:flex-col items-center gap-4 shrink-0 xl:border-r border-slate-200/50 dark:border-white/10 xl:pr-8 xl:mr-2">
                    <div className="relative w-24 h-24 xl:w-28 xl:h-28 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="-6 -6 68 68">
                            <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-700/50" />
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
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-2xl xl:text-3xl font-bold ${getHealthColor(healthScore)}`}>{healthScore}%</span>
                        </div>
                    </div>
                    <div className="flex flex-col xl:items-center xl:text-center">
                        <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest mb-1">{t('dashboard.healthCheck') || 'Santé Globale'}</div>
                        <div className={`text-xl font-bold ${getHealthColor(healthScore)} leading-tight`}>
                            {healthScore >= 80 ? (t('dashboard.systemHealthy') || 'Système Sain') : healthScore >= 60 ? (t('dashboard.statusReview') || 'Attention') : (t('dashboard.statusToRead') || 'Critique')}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 font-medium hidden xl:block">Mis à jour en temps réel</div>
                    </div>
                </div>

                {/* Metrics Grid - 2x2 on mobile, 4x1 on large screens */}
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                    <div
                        onClick={() => navigate('/incidents')}
                        className="flex flex-col p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/5 hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer transition-all group/card relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:opacity-100 transition-opacity transform group-hover/card:scale-110 duration-500">
                            <Siren className="w-10 h-10 text-red-500/20" />
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600 mb-2 group-hover/card:scale-110 transition-transform">
                            <Siren className="h-4 w-4" />
                        </div>
                        <div className="relative z-10">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none mb-1">{stats.activeIncidents}</div>
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('dashboard.incidents')}</div>
                        </div>
                    </div>

                    <div
                        onClick={() => navigate('/risks')}
                        className="flex flex-col p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/5 hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer transition-all group/card relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:opacity-100 transition-opacity transform group-hover/card:scale-110 duration-500">
                            <ShieldAlert className="w-10 h-10 text-orange-500/20" />
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 mb-2 group-hover/card:scale-110 transition-transform">
                            <ShieldAlert className="h-4 w-4" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-baseline gap-2">
                                <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none mb-1">{stats.totalRisks || stats.highRisks}</div>
                                {stats.highRisks > 0 && (
                                    <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                                        {stats.highRisks} !
                                    </div>
                                )}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('dashboard.risks')}</div>
                        </div>
                    </div>

                    <div
                        onClick={() => navigate('/risks')}
                        className="flex flex-col p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/5 hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer transition-all group/card relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:opacity-100 transition-opacity transform group-hover/card:scale-110 duration-500">
                            <TrendingUp className="w-10 h-10 text-blue-500/20" />
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 mb-2 group-hover/card:scale-110 transition-transform">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="relative z-10">
                            <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-none mb-1 truncate">
                                {new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Exposition</div>
                        </div>
                    </div>

                    <div
                        onClick={() => navigate('/compliance')}
                        className="flex flex-col p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/5 hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer transition-all group/card relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:opacity-100 transition-opacity transform group-hover/card:scale-110 duration-500">
                            <Activity className="w-10 h-10 text-emerald-500/20" />
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-2 group-hover/card:scale-110 transition-transform">
                            <Activity className="h-4 w-4" />
                        </div>
                        <div className="relative z-10">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white leading-none mb-1">{stats.compliance}%</div>
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Conformité</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: AI Executive Summary (Full Width) */}
            <div className="relative w-full bg-white/40 dark:bg-white/5 rounded-[1.5rem] p-5 border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col min-h-[160px] group/ai overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 via-transparent to-brand-500/5 opacity-0 group-hover/ai:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[1.5rem]" />

                {/* Decorative AI Background Image */}
                <div className="absolute -right-10 -bottom-12 w-64 h-64 opacity-5 pointer-events-none transition-opacity duration-700 group-hover/ai:opacity-10">
                    <img src="/images/IA.png" alt="" className="w-full h-full object-contain" />
                </div>

                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl shadow-lg shadow-brand-500/20">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800 dark:text-white leading-none">Sentinel AI Analysis</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Synthèse de posture temps réel</span>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerateSummary}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-3 py-1 bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 rounded-lg transition-all group/btn disabled:opacity-50 border border-slate-200/50 dark:border-white/10"
                        title="Forcer la mise à jour"
                    >
                        <RefreshCw className={`w-3 h-3 text-slate-400 group-hover/btn:text-brand-500 transition-colors ${isGenerating ? 'animate-spin' : ''}`} />
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 group-hover/btn:text-slate-700 dark:group-hover/btn:text-slate-200">Mettre à jour</span>
                    </button>
                </div>

                <div className="flex-1 relative overflow-hidden">
                    {summary ? (
                        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium animate-in fade-in duration-500 overflow-y-auto max-h-[140px] pr-2 custom-scrollbar">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ ...props }) => <p className="mb-3 last:mb-0 text-slate-600 dark:text-slate-300 leading-7 font-normal" {...props} />,
                                    ul: ({ ...props }) => <ul className="mb-4 space-y-2" {...props} />,
                                    ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-4 space-y-2 text-slate-700 dark:text-slate-300" {...props} />,
                                    li: ({ ...props }) => (
                                        <li className="flex items-start gap-2 text-slate-600 dark:text-slate-300 leading-relaxed">
                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0 opacity-80" />
                                            <span>{props.children}</span>
                                        </li>
                                    ),
                                    h1: ({ ...props }) => <h3 className="text-sm font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-3 mt-4 flex items-center gap-2 border-b border-brand-500/10 pb-2" {...props} />,
                                    h2: ({ ...props }) => <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2 mt-4 flex items-center gap-2" {...props} />,
                                    h3: ({ ...props }) => <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 mt-2" {...props} />,
                                    strong: ({ ...props }) => <strong className="font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/10 px-1 py-0.5 rounded text-[0.95em]" {...props} />,
                                    blockquote: ({ ...props }) => <blockquote className="border-l-[3px] border-brand-500/50 bg-brand-500/5 pl-4 py-2 pr-2 my-4 rounded-r-lg italic text-slate-600 dark:text-slate-300 text-sm" {...props} />
                                }}
                            >
                                {summary}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="flex flex-row items-center justify-center h-full gap-3 py-2 animate-in fade-in zoom-in-95 duration-500 opacity-60">
                            <Sparkles className="w-5 h-5 text-brand-500/40" />
                            <p className="text-sm text-slate-400 italic">
                                {isGenerating
                                    ? "Analyse de la posture de sécurité en cours..."
                                    : "Génération de l'analyse quotidienne..."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

