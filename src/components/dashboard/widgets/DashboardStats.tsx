import React from 'react';

import { Sparkles, AlertTriangle, ShieldCheck, RefreshCw, Activity } from '../../ui/Icons';
import { BrainCircuit } from '../../ui/Icons';
import { PremiumCard } from '../../ui/PremiumCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAIGemini } from '../../../hooks/useAIGemini';
import { useAIAnalysisPersistence } from '../../../hooks/dashboard/useAIAnalysisPersistence';
import { Link } from 'react-router-dom';
import { AI_PROMPTS } from '../../../config/prompts';
import { useLocale } from '../../../hooks/useLocale';
import { Tooltip } from '../../ui/Tooltip';

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
 const { t, config } = useLocale();
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




 return (
 <div className="flex flex-col gap-6 mb-8">
 {/* AI Summary Card */}
 <PremiumCard glass
 className="w-full group rounded-4xl p-0"
 hover={true}
 gradientOverlay={true}
 >
 {/* Background Effects */}
 <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 dark:bg-primary/60/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
 <div className="absolute bottom-0 left-0 w-40 h-40 bg-primary/20 dark:bg-primary/60/15 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

 {/* Premium AI Background Image */}
 <div className="absolute right-0 top-0 h-full w-1/2 pointer-events-none z-0 overflow-hidden">

  <img
  src="/images/IA.png"
  alt="AI Analysis background"
  className="w-full h-full object-cover object-right opacity-20 dark:opacity-30 mix-blend-multiply dark:mix-blend-color-dodge transition-all duration-700"
  />
 </div>

 <div className="p-6 h-full flex flex-col justify-between">
  <div className="flex items-start justify-between mb-4 relative z-decorator">
  <div className="flex items-center gap-3">
  <div className="p-2.5 rounded-2xl bg-secondary/50 border border-border/40 shadow-sm">
  <BrainCircuit className="w-5 h-5 text-muted-foreground" />
  </div>
  <div>
  <h3 className="font-bold text-lg text-foreground leading-tight">
   {t('dashboard.aiAnalysis.title', { defaultValue: 'Sentinel AI Analysis' })}
  </h3>
  <p className="text-xs font-medium text-muted-foreground">
   {t('dashboard.aiAnalysis.subtitle', { defaultValue: 'Synthèse de posture temps réel' })}
  </p>
  </div>
  </div>
  {/* Manual Refresh Button */}
  <Tooltip content={aiLoading ? t('dashboard.aiAnalysis.loading', { defaultValue: 'Analyse de vos données en cours...' }) : !aiSummary ? t('dashboard.aiAnalysis.noDataToRefresh', { defaultValue: 'Aucune analyse disponible à actualiser' }) : t('dashboard.aiAnalysis.refresh', { defaultValue: 'Actualiser l\'analyse' })} position="bottom">
  <button
  onClick={handleManualRefresh}
  disabled={aiLoading || !aiSummary}
  className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-border group/refresh"
  aria-label={t('dashboard.aiAnalysis.refresh', { defaultValue: 'Actualiser l\'analyse' })}
  >
  <RefreshCw className={`w-4 h-4 ${aiLoading ? 'animate-spin text-primary' : 'group-hover/refresh:rotate-180 transition-transform duration-500'}`} />
  </button>
  </Tooltip>
  </div>

  <div className="relative z-decorator min-h-[100px]">
  {aiLoading && !aiSummary ? (
  <div className="flex flex-col items-center justify-center h-full gap-3 py-4">
  <Sparkles className="w-6 h-6 text-primary animate-pulse" />
  <span className="text-xs font-medium text-muted-foreground animate-pulse">{t('dashboard.aiAnalysis.loading', { defaultValue: 'Analyse de vos données en cours...' })}</span>
  </div>
  ) : aiSummary ? (
  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed text-sm">
  <ReactMarkdown
   remarkPlugins={[remarkGfm]}
   components={{
   strong: ({ ...props }) => <span className="font-bold text-foreground dark:text-white" {...props} />,
   ul: ({ ...props }) => <ul className="space-y-1 my-2 list-none pl-0" {...props} />,
   li: ({ ...props }) => (
   <li className="flex items-start gap-2 text-sm pl-1" {...props}>
   <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
   <span className="flex-1">{props.children}</span>
   </li>
   ),
   p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />
   }}
  >
   {aiSummary}
  </ReactMarkdown>
  <div className="mt-3 flex items-center justify-end">
   <span className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-secondary/50 border border-border/20">
   Généré par Sentinel AI
   </span>
  </div>
  </div>
  ) : (
  <p className="text-sm text-muted-foreground italic">{t('dashboard.aiAnalysis.insufficientData', { defaultValue: "Données insuffisantes pour l'analyse." })}</p>
  )}
  </div>
 </div>
 </PremiumCard>

 {/* Consolidated Health Overview Card */}
 <PremiumCard glass
 className="w-full group rounded-4xl p-0"
 hover={true}
 gradientOverlay={true}
 >
 <div className="p-6 h-full flex flex-col">
  <div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
  <div className="p-2.5 rounded-2xl bg-success/10 border border-success/20 shadow-sm shadow-success/10">
  <Activity className="w-5 h-5 text-success-text dark:text-success" />
  </div>
  <div>
  <h3 className="font-bold text-lg text-foreground leading-tight">
   Santé Globale
  </h3>
  <p className="text-xs font-medium text-success-text/80 dark:text-success/80">
   Indicateurs de performance clés
  </p>
  </div>
  </div>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
  {/* 1. Risk Metric */}
  <Link to="/risks" className="flex flex-col justify-between p-4 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-all duration-300 cursor-pointer group/item focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left outline-none" aria-label="Voir les risques">
  <div className="flex items-center justify-between mb-2">
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Risques</span>
  <AlertTriangle className="w-4 h-4 text-warning group-hover/item:text-warning/80 transition-colors" />
  </div>
  <div className="flex items-end gap-2 mt-auto">
  <span className="text-3xl font-bold text-foreground">{stats.totalRisks}</span>
  <span className="text-xs font-medium text-destructive mb-1.5">{stats.criticalRisks} critiques</span>
  </div>
  <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
  <div
   className="bg-destructive h-full rounded-full"
   style={{ width: `${Math.min(100, (stats.criticalRisks / (stats.totalRisks || 1)) * 100)}%` }}
  />
  </div>
  </Link>

  {/* 2. Compliance Metric */}
  <Link to="/compliance" className="flex flex-col justify-between p-4 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-all duration-300 cursor-pointer group/item focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left outline-none" aria-label="Voir la conformité">
  <div className="flex items-center justify-between mb-2">
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conformité</span>
  <ShieldCheck className={`w-4 h-4 transition-colors ${effectiveComplianceScore >= 75 ? 'text-success group-hover/item:text-success/80' :
   effectiveComplianceScore >= 50 ? 'text-warning group-hover/item:text-warning/80' :
   'text-destructive group-hover/item:text-destructive/80'
   }`} />
  </div>
  <div className="flex items-center justify-between mt-auto gap-4">
  <div className="relative w-16 h-16 flex items-center justify-center">
   {/* Background Circle */}
   <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
   <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted-foreground/60" />
   <circle
   cx="32" cy="32" r="28"
   stroke="currentColor" strokeWidth="4" fill="transparent"
   strokeDasharray={175.92}
   strokeDashoffset={175.92 - (175.92 * effectiveComplianceScore) / 100}
   className={`${effectiveComplianceScore >= 75 ? 'text-success' :
   effectiveComplianceScore >= 50 ? 'text-warning' :
    'text-destructive'
   } transition-all duration-1000 ease-out`}
   strokeLinecap="round"
   />
   </svg>
   <span className="absolute text-sm font-bold text-foreground">{effectiveComplianceScore}%</span>
  </div>
  <div className="text-right">
   <div className="text-xs text-muted-foreground">Score</div>
   <div className={`text-sm font-bold ${effectiveComplianceScore >= 75 ? 'text-success-text dark:text-success' :
   effectiveComplianceScore >= 50 ? 'text-warning-text dark:text-warning' :
   'text-error-text dark:text-error'
   }`}>
   {effectiveComplianceScore >= 75 ? 'Excellente' :
   effectiveComplianceScore >= 50 ? 'Moyenne' :
   'Faible'}
   </div>
  </div>
  </div>
  </Link>

  {/* 3. Financial Metric */}
  <Link to="/risks" className="flex flex-col justify-between p-4 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-all duration-300 cursor-pointer group/item focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left outline-none" aria-label="Voir l'exposition financière">
  <div className="flex items-center justify-between mb-2">
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Financier</span>
  <Activity className="w-4 h-4 text-info group-hover/item:text-info/80 transition-colors" />
  </div>
  <div className="mt-auto">
  <div className="text-xl font-bold text-foreground truncate" title={new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}>
   {new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: "compact" }).format(stats.financialRisk)}
  </div>
  <span className="text-xs font-medium text-info cursor-help" title="Calculé sur la base de l'exposition au risque et de la valeur des actifs (Top 20 risques).">* Exposition estimée</span>
  </div>
  <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
  <div
   className="bg-info h-full rounded-full"
   style={{ width: `${Math.min(100, Math.max(5, (stats.financialRisk / (stats.assetValue || 1)) * 100))}%` }}
  />
  </div>
  </Link>
  </div>
 </div>
 </PremiumCard>
 </div>
 );
};
