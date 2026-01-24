import React from 'react';

import { Sparkles, AlertTriangle, ShieldCheck, RefreshCw, Activity } from '../../ui/Icons';
import { BrainCircuit } from '../../ui/Icons';
import { GlassCard } from '../../ui/GlassCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAIGemini } from '../../../hooks/useAIGemini';
import { useAIAnalysisPersistence } from '../../../hooks/dashboard/useAIAnalysisPersistence';
import { useNavigate } from 'react-router-dom';
import { AI_PROMPTS } from '../../../config/prompts';

interface DashboardStatsProps {
    stats: {
        totalRisks: number;
        highRisks: number;
        criticalRisks: number;
        compliance: number;
        financialRisk: number;
        assetValue: number;
    };
    loading: boolean;
    complianceScore: number;
    activeIncidentsCount: number;
    topRisks: { name: string; score: number }[];
    activeIncidents?: { title: string }[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
    stats,
    loading,
    complianceScore,
    activeIncidentsCount,
    topRisks,
    activeIncidents
}) => {
    // Fallback if prop is missing but exists in stats
    const effectiveComplianceScore = complianceScore ?? stats.compliance ?? 0;
    const { generateContent, loading: aiLoading } = useAIGemini();
    const [aiSummary, setAiSummary] = React.useState<string | null>(null);
    const { storedSummary, saveSummary, clearSummary } = useAIAnalysisPersistence();

    // Memoize the prompt to avoid effect loops/re-runs when array references change
    const prompt = React.useMemo(() => AI_PROMPTS.dashboard_executive_summary({
        score: effectiveComplianceScore,
        incidents: activeIncidentsCount,
        risks: topRisks.length,
        topRisks: topRisks.map(r => r.name),
        financial: stats.financialRisk,
        recentIncidents: activeIncidents?.map(i => i.title).join(', ') || 'Aucun'
    }), [effectiveComplianceScore, activeIncidentsCount, topRisks, stats.financialRisk, activeIncidents]);

    // Effect to handle generation logic
    React.useEffect(() => {
        if (loading) return;

        // If we have a valid stored summary, use it
        if (storedSummary) {
            setAiSummary(storedSummary);
            return;
        }

        // Only generate if we have a prompt and no summary
        generateContent(prompt).then((response: string | null) => {
            if (response) {
                setAiSummary(response);
                saveSummary(response);
            }
        });
    }, [loading, storedSummary, prompt, generateContent, saveSummary]);

    const handleManualRefresh = () => {
        clearSummary(); // Clear storage to force regeneration
        setAiSummary(null); // Clear local state to show loading/trigger effect
    };


    const navigate = useNavigate();

    return (
        <div className="flex flex-col gap-6 mb-8">
            {/* AI Summary Card */}
            <GlassCard
                className="w-full group rounded-4xl p-0"
                hoverEffect={true}
                gradientOverlay={true}
            >
                {/* Background Effects */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                <div className="p-6 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 shadow-sm shadow-brand-500/10">
                                <BrainCircuit className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                                    Sentinel AI Analysis
                                </h3>
                                <p className="text-xs font-medium text-brand-600/80 dark:text-brand-400/80">
                                    Synthèse de posture temps réel
                                </p>
                            </div>
                        </div>
                        {/* Manual Refresh Button */}
                        <button
                            onClick={handleManualRefresh}
                            disabled={aiLoading || !aiSummary}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-brand-500 disabled:opacity-50 disabled:cursor-not-allowed group/refresh"
                            title="Actualiser l'analyse"
                        >
                            <RefreshCw className={`w-4 h-4 ${aiLoading ? 'animate-spin text-brand-500' : 'group-hover/refresh:rotate-180 transition-transform duration-500'}`} />
                        </button>
                    </div>

                    <div className="relative z-10 min-h-[100px]">
                        {aiLoading && !aiSummary ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 py-4">
                                <Sparkles className="w-6 h-6 text-brand-500 animate-pulse" />
                                <span className="text-xs font-medium text-muted-foreground animate-pulse">Analyse de vos données en cours...</span>
                            </div>
                        ) : aiSummary ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        strong: ({ ...props }) => <span className="font-bold text-slate-800 dark:text-white" {...props} />,
                                        ul: ({ ...props }) => <ul className="space-y-1 my-2 list-none pl-0" {...props} />,
                                        li: ({ ...props }) => (
                                            <li className="flex items-start gap-2 text-sm pl-1" {...props}>
                                                <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-500 shrink-0" />
                                                <span className="flex-1">{props.children}</span>
                                            </li>
                                        ),
                                        p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />
                                    }}
                                >
                                    {aiSummary}
                                </ReactMarkdown>
                                <div className="mt-3 flex items-center justify-end">
                                    <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                        Généré par Sentinel AI
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">Données insuffisantes pour l'analyse.</p>
                        )}
                    </div>
                </div>
            </GlassCard>

            {/* Consolidated Health Overview Card */}
            <GlassCard
                className="w-full group rounded-4xl p-0"
                hoverEffect={true}
                gradientOverlay={true}
            >
                <div className="p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                                <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                                    Santé Globale
                                </h3>
                                <p className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">
                                    Indicateurs de performance clés
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                        {/* 1. Risk Metric */}
                        <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group/item" onClick={() => navigate('/risks')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wider">Risques</span>
                                <AlertTriangle className="w-4 h-4 text-orange-500 group-hover/item:text-orange-400 transition-colors" />
                            </div>
                            <div className="flex items-end gap-2 mt-auto">
                                <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalRisks}</span>
                                <span className="text-xs font-medium text-red-500 mb-1.5">{stats.criticalRisks} critiques</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div
                                    className="bg-red-500 h-full rounded-full"
                                    style={{ width: `${Math.min(100, (stats.criticalRisks / (stats.totalRisks || 1)) * 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* 2. Compliance Metric */}
                        <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group/item" onClick={() => navigate('/compliance')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wider">Conformité</span>
                                <ShieldCheck className={`w-4 h-4 transition-colors ${effectiveComplianceScore >= 80 ? 'text-emerald-500 group-hover/item:text-emerald-400' :
                                    effectiveComplianceScore >= 50 ? 'text-amber-500 group-hover/item:text-amber-400' :
                                        'text-red-500 group-hover/item:text-red-400'
                                    }`} />
                            </div>
                            <div className="flex items-center justify-between mt-auto gap-4">
                                <div className="relative w-16 h-16 flex items-center justify-center">
                                    {/* Background Circle */}
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
                                        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-700" />
                                        <circle
                                            cx="32" cy="32" r="28"
                                            stroke="currentColor" strokeWidth="4" fill="transparent"
                                            strokeDasharray={175.92}
                                            strokeDashoffset={175.92 - (175.92 * effectiveComplianceScore) / 100}
                                            className={`${effectiveComplianceScore >= 80 ? 'text-emerald-500' :
                                                effectiveComplianceScore >= 50 ? 'text-amber-500' :
                                                    'text-red-500'
                                                } transition-all duration-1000 ease-out`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <span className="absolute text-sm font-bold text-slate-900 dark:text-white">{effectiveComplianceScore}%</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 dark:text-muted-foreground">Score</div>
                                    <div className={`text-sm font-bold ${effectiveComplianceScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                                        effectiveComplianceScore >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                            'text-red-600 dark:text-red-400'
                                        }`}>
                                        {effectiveComplianceScore >= 80 ? 'Excellente' :
                                            effectiveComplianceScore >= 50 ? 'Moyenne' :
                                                'Faible'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Financial Metric */}
                        <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group/item" onClick={() => navigate('/risks')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wider">Financier</span>
                                <Activity className="w-4 h-4 text-blue-500 group-hover/item:text-blue-400 transition-colors" />
                            </div>
                            <div className="mt-auto">
                                <div className="text-xl font-bold text-slate-900 dark:text-white truncate" title={new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}>
                                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: "compact" }).format(stats.financialRisk)}
                                </div>
                                <span className="text-xs font-medium text-blue-500 cursor-help" title="Calculé sur la base de l'exposition au risque et de la valeur des actifs (Top 20 risques).">* Exposition estimée</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div
                                    className="bg-blue-500 h-full rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(5, (stats.financialRisk / (stats.assetValue || 1)) * 100))}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
