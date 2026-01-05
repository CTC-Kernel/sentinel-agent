import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, ShieldCheck, RefreshCw, Activity } from 'lucide-react';
import { BrainCircuit } from '../../ui/Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAIGemini } from '../../../hooks/useAIGemini';
import { useAIAnalysisPersistence } from '../../../hooks/dashboard/useAIAnalysisPersistence';

interface DashboardStatsProps {
    stats: {
        totalRisks: number;
        highRisks: number;
        compliance: number;
        financialRisk: number;
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
    const { generateContent, loading: aiLoading } = useAIGemini();
    const [aiSummary, setAiSummary] = React.useState<string | null>(null);
    const { storedSummary, saveSummary, clearSummary } = useAIAnalysisPersistence();

    // Effect to handle generation logic
    React.useEffect(() => {
        if (loading) return;

        // If we have a valid stored summary, use it
        if (storedSummary) {
            setAiSummary(storedSummary);
            return;
        }

        // Otherwise generate new one
        const prompt = `
            Analyse cette posture de cybersécurité pour un rapport exécutif (synthèse courte, max 3-4 phrases percutantes) :
            - Score Global : ${complianceScore}%
            - Incidents Actifs : ${activeIncidentsCount}
            - Risques Critiques : ${topRisks.length} (Top: ${topRisks.map(r => r.name).join(', ')})
            - Risque Financier : ${stats.financialRisk}€
            - Incidents récents : ${activeIncidents?.map(i => i.title).join(', ') || 'Aucun'}

            Format attendu : Markdown riche (gras, puces).
            Ton : Professionnel, direct, orienté action.
            Structure :
            1. **État Global** : Résumé en 1 phrase.
            2. **Priorités** : 2 points d'attention majeurs.
            3. **Recommandation** : 1 action immédiate.
        `;

        generateContent(prompt).then((response: string | null) => {
            if (response) {
                setAiSummary(response);
                saveSummary(response);
            }
        });
    }, [loading, complianceScore, activeIncidentsCount, stats.financialRisk, storedSummary]);

    const handleManualRefresh = () => {
        clearSummary(); // Clear storage to force regeneration
        setAiSummary(null); // Clear local state to show loading/trigger effect
    };

    const navigate = (path: string) => {
        window.location.hash = path;
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* AI Summary Card - Spans 2 cols */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="md:col-span-2 relative group overflow-hidden rounded-[2rem] p-[1px]"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500/50 via-purple-500/50 to-brand-500/50 animate-shine opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                <div className="glass-premium relative h-full rounded-[2rem] p-6 flex flex-col justify-between overflow-hidden">
                    {/* Background Effects */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

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
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-brand-500 disabled:opacity-50 disabled:cursor-not-allowed group/refresh"
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
                                        strong: ({ node, ...props }) => <span className="font-bold text-slate-800 dark:text-white" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="space-y-1 my-2 list-none pl-0" {...props} />,
                                        li: ({ node, ...props }) => (
                                            <li className="flex items-start gap-2 text-sm pl-1" {...props}>
                                                <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-500 shrink-0" />
                                                <span className="flex-1">{props.children}</span>
                                            </li>
                                        ),
                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />
                                    }}
                                >
                                    {aiSummary}
                                </ReactMarkdown>
                                <div className="mt-3 flex items-center justify-end">
                                    <span className="text-[10px] font-medium text-muted-foreground/60 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                        Généré par Sentinel AI
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">Données insuffisantes pour l'analyse.</p>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Middle Section: Global Risk (1/4) */}
            <div className="relative group overflow-hidden rounded-[2rem] p-[1px]">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-orange-500/20 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="glass-premium relative h-full rounded-[2rem] p-6 flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            {activeIncidentsCount} Critiques
                        </span>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                            {stats.totalRisks}
                        </div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Risques Identifiés</p>
                    </div>
                    <div
                        onClick={() => navigate('/risks')}
                        className="mt-4 flex items-center gap-2 text-xs font-bold text-red-500 cursor-pointer hover:underline"
                    >
                        Voir les risques <Activity className="w-3 h-3" />
                    </div>
                </div>
            </div>

            {/* Right Section: Compliance (1/4) */}
            <div className="relative group overflow-hidden rounded-[2rem] p-[1px]">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="glass-premium relative h-full rounded-[2rem] p-6 flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            Top 5%
                        </span>
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                            {complianceScore}%
                        </div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Score Conformité</p>
                    </div>
                    <div
                        onClick={() => navigate('/compliance')}
                        className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-500 cursor-pointer hover:underline"
                    >
                        Voir conformité <Activity className="w-3 h-3" />
                    </div>
                </div>
            </div>
        </div>
    );
};
