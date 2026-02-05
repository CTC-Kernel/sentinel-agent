import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Award, Bot } from '../../ui/Icons';
import { Tooltip } from '../../ui/Tooltip';
import { Control } from '../../../types';
import {
 CONTROL_STATUS,
 isActionableStatus,
 calculateControlsScore
} from '../../../constants/complianceConfig';
import { useAgentResultsByControl } from '../../../hooks/useAgentData';

interface ComplianceScoreCardProps {
 controls: Control[];
 currentFramework: string;
 trend?: number;
 onFilterChange?: (status: string | null) => void;
}

export const ComplianceScoreCard: React.FC<ComplianceScoreCardProps> = ({
 controls,
 currentFramework,
 trend,
 onFilterChange
}) => {
 const { t } = useTranslation();
 const agentResults = useAgentResultsByControl(currentFramework);

 // Calculate metrics using centralized constants
 const metrics = React.useMemo(() => {
 const implemented = controls.filter(c => c.status === CONTROL_STATUS.IMPLEMENTED).length;
 const partial = controls.filter(c => c.status === CONTROL_STATUS.PARTIAL).length;
 const inProgress = controls.filter(c => c.status === CONTROL_STATUS.IN_PROGRESS).length;
 const notStarted = controls.filter(c => c.status === CONTROL_STATUS.NOT_STARTED).length;
 const actionable = controls.filter(c => isActionableStatus(c.status)).length;

 const score = calculateControlsScore(implemented, partial, actionable);

 const verifiedByAgent = controls.filter(c => agentResults.has(c.code)).length;

 return {
 implemented,
 partial,
 inProgress,
 notStarted,
 score,
 verifiedByAgent
 };
 }, [controls, agentResults]);

 const percentage = metrics.score;

 return (
 <div className="glass-premium p-6 md:p-8 rounded-3xl shadow-lg flex flex-col xl:flex-row gap-8 relative overflow-hidden group hover:shadow-apple transition-all duration-500">
 {/* Background pattern */}
 <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/50 -z-10" />

 <div className="flex-1 flex flex-col md:flex-row items-center gap-8 relative z-10">
 <div className="relative">
  <div className="w-32 h-32 md:w-36 md:h-36">
  <svg className="w-full h-full transform -rotate-90">
  <circle
  cx="50%"
  cy="50%"
  r="45%"
  className="stroke-border dark:stroke-foreground fill-none"
  strokeWidth="8"
  />
  <motion.circle
  initial={{ strokeDasharray: "0 1000" }}
  animate={{ strokeDasharray: `${percentage * 2.83} 1000` }}
  transition={{ duration: 1.5, ease: "easeOut" }}
  cx="50%"
  cy="50%"
  r="45%"
  className={`${percentage >= 75 ? 'stroke-success' : percentage >= 50 ? 'stroke-warning' : 'stroke-error'} fill-none`}
  strokeWidth="8"
  strokeLinecap="round"
  />
  </svg>
  <div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="text-3xl md:text-4xl font-black text-foreground">{percentage.toFixed(0)}%</span>
  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('compliance.dashboard.conformityLabel')}</span>
  </div>
  </div>
  {/* Pulsing indicator */}
  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white shadow-sm animate-pulse ${percentage >= 75 ? 'bg-success' : percentage >= 50 ? 'bg-warning' : 'bg-error'}`} />
 </div>

 <div className="text-center md:text-left">
  <h3 className="text-lg font-bold text-foreground">{t('compliance.dashboard.scoreTitle', { framework: currentFramework })}</h3>
  <p className="text-sm text-muted-foreground mt-0.5">{t('compliance.dashboard.avgCompliance')}</p>

  <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4">
  {trend !== undefined && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40">
  <div className="w-2 h-2 rounded-full bg-success" />
  <span className="text-xs font-bold text-foreground">
   {t('compliance.dashboard.vs30d')}:
   <span className="ml-1 text-primary">
   {trend > 0 ? '+' : ''}{trend}%
   </span>
  </span>
  </div>
  )}
  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-2xl border border-primary/20">
  <Award className="w-3.5 h-3.5 text-primary" />
  <span className="text-xs font-bold text-primary">
  {percentage >= 75 ? t('compliance.dashboard.excellentLevel') : percentage >= 50 ? t('compliance.dashboard.acceptableLevel') : t('compliance.dashboard.priorityActionsRequired')}
  </span>
  </div>
  </div>
 </div>
 </div>

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full xl:w-auto mt-6 xl:mt-0">
 {/* Agent Verified Controls */}
 {metrics.verifiedByAgent > 0 && (
  <Tooltip content={t('compliance.dashboard.agentTooltip', { defaultValue: 'Contrôles vérifiés automatiquement par les agents Sentinel' })} position="top">
  <div className="glass-premium p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all duration-300">
  <p className="text-[10px] font-bold text-primary uppercase tracking-tighter mb-1.5 flex items-center gap-1.5">
  <Bot className="w-3 h-3" />
  AGENT
  </p>
  <span className="text-xl font-black text-primary">{metrics.verifiedByAgent}</span>
  </div>
  </Tooltip>
 )}

 <button
  type="button"
  onClick={() => onFilterChange?.(CONTROL_STATUS.IMPLEMENTED)}
  className="glass-premium p-4 rounded-2xl border border-border/40 hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer transition-all duration-300 group/item w-full text-left"
 >
  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1.5 group-hover/item:text-primary transition-colors">
  {t('compliance.dashboard.implemented')}
  </p>
  <div className="flex items-end justify-between">
  <span className="text-xl font-black text-foreground">{metrics.implemented}</span>
  <div className="w-1.5 h-1.5 rounded-full mb-1.5 bg-primary" />
  </div>
 </button>

 <button
  type="button"
  onClick={() => onFilterChange?.(CONTROL_STATUS.PARTIAL)}
  className="glass-premium p-4 rounded-2xl border border-border/40 hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer transition-all duration-300 group/item w-full text-left"
 >
  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1.5 group-hover/item:text-warning transition-colors">
  {t('compliance.dashboard.partial')}
  </p>
  <div className="flex items-end justify-between">
  <span className="text-xl font-black text-foreground">{metrics.partial}</span>
  <div className="w-1.5 h-1.5 rounded-full mb-1.5 bg-warning" />
  </div>
 </button>

 <button
  type="button"
  onClick={() => onFilterChange?.(CONTROL_STATUS.IN_PROGRESS)}
  className="glass-premium p-4 rounded-2xl border border-border/40 hover:bg-white/60 dark:hover:bg-white/10 cursor-pointer transition-all duration-300 group/item w-full text-left"
 >
  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1.5 group-hover/item:text-primary/70 transition-colors">
  {t('compliance.dashboard.inProgress')}
  </p>
  <div className="flex items-end justify-between">
  <span className="text-xl font-black text-foreground">{metrics.inProgress}</span>
  <div className="w-1.5 h-1.5 rounded-full mb-1.5 bg-primary/60" />
  </div>
 </button>
 </div>
 </div>
 );
};
