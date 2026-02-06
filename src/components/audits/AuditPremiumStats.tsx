import React, { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
 RadialBarChart,
 RadialBar,
 ResponsiveContainer
} from 'recharts';
import { SENTINEL_PALETTE } from '../../theme/chartTheme';
import { Audit } from '../../types';
import {
 ClipboardCheck,
 Calendar,
 AlertOctagon,
 TrendingUp,
 Target,
 Activity
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { useLocale } from '@/hooks/useLocale';

interface AuditPremiumStatsProps {
 audits: Audit[];
 findingsCount: number;
}

// Tech corner decoration
const TechCorners: React.FC<{ className?: string }> = ({ className }) => (
 <div className={cn("pointer-events-none", className)}>
 <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
 <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
 <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
 <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
 </div>
);

export const AuditPremiumStats: React.FC<AuditPremiumStatsProps> = ({ audits, findingsCount }) => {
 const { t } = useLocale();
 const uid = useId();
 const auditGlowId = `auditGlow-${uid}`;
 const stats = useMemo(() => {
 const total = audits.length;
 const completed = audits.filter(a => a.status === 'Terminé' || a.status === 'Validé').length;
 const inProgress = audits.filter(a => a.status === 'En cours').length;
 const planned = audits.filter(a => a.status === 'Planifié').length;
 const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

 // Upcoming audits (within 30 days)
 const upcoming = audits.filter(a => {
 if (!a.dateScheduled) return false;
 const date = new Date(a.dateScheduled);
 const now = new Date();
 const diffTime = date.getTime() - now.getTime();
 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 return diffDays > 0 && diffDays <= 30;
 }).length;

 return { total, completed, inProgress, planned, complianceRate, upcoming };
 }, [audits]);

 // Gauge data
 const gaugeData = useMemo(() => [{
 name: 'Réalisation',
 value: stats.complianceRate,
 fill: stats.complianceRate >= 80 ? SENTINEL_PALETTE.success :
 stats.complianceRate >= 50 ? SENTINEL_PALETTE.warning : SENTINEL_PALETTE.danger
 }], [stats.complianceRate]);

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden mb-6"
 >
 <TechCorners />

 {/* SVG Definitions */}
 <svg width="0" height="0" className="absolute">
 <defs>
  <filter id={auditGlowId} x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
  <feMerge>
  <feMergeNode in="coloredBlur" />
  <feMergeNode in="SourceGraphic" />
  </feMerge>
  </filter>
 </defs>
 </svg>

 <div className="flex flex-col lg:flex-row lg:items-center gap-6">
 {/* Gauge Section */}
 <div className="flex-shrink-0 flex items-center gap-4">
  <div className="relative w-32 h-32">
  <ResponsiveContainer width="100%" height="100%" >
  <RadialBarChart
  cx="50%"
  cy="50%"
  innerRadius="70%"
  outerRadius="100%"
  barSize={10}
  data={gaugeData}
  startAngle={180}
  endAngle={-180}
  >
  <RadialBar
   background={{ fill: 'hsl(var(--muted))' }}
   dataKey="value"
   cornerRadius={10}
   style={{ filter: `url(#${auditGlowId})` }}
  />
  </RadialBarChart>
  </ResponsiveContainer>
  <div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="text-2xl font-black text-foreground">
  {stats.complianceRate}%
  </span>
  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
  {t('audits.stats.completion', { defaultValue: 'Réalisation' })}
  </span>
  </div>
  </div>
  <div className="hidden sm:block">
  <div className="flex items-center gap-2 mb-1">
  <TrendingUp className="w-4 h-4 text-primary" />
  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
  {t('audits.stats.auditProgram', { defaultValue: 'Programme Audit' })}
  </span>
  </div>
  <p className="text-xs text-muted-foreground max-w-[180px]">
  {stats.complianceRate >= 80 ? t('audits.stats.excellentProgress', { defaultValue: 'Excellente progression' }) :
  stats.complianceRate >= 50 ? t('audits.stats.progressInProgress', { defaultValue: 'Progression en cours' }) : t('audits.stats.attentionRequired', { defaultValue: 'Attention requise' })}
  </p>
  </div>
 </div>

 {/* Divider */}
 <div className="hidden lg:block w-px h-20 bg-gradient-to-b from-transparent via-border to-transparent" />

 {/* Stats Grid */}
 <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
  {/* Total Audits */}
  <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 group hover:scale-[1.02] transition-transform">
  <div className="flex items-center justify-between mb-2">
  <div className="p-2 bg-primary/10 rounded-3xl">
  <Target className="w-4 h-4 text-primary" />
  </div>
  </div>
  <div className="text-2xl font-black text-foreground">
  {stats.total}
  </div>
  <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
  {t('audits.stats.plannedAudits', { defaultValue: 'Audits Planifiés' })}
  </div>
  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
  <motion.div
  initial={{ width: 0 }}
  animate={{ width: '100%' }}
  transition={{ duration: 0.8, ease: "easeOut" }}
  className="h-full bg-primary rounded-full"
  />
  </div>
  </div>

  {/* Completed */}
  <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 group hover:scale-[1.02] transition-transform">
  <div className="flex items-center justify-between mb-2">
  <div className="p-2 bg-success-bg rounded-3xl">
  <ClipboardCheck className="w-4 h-4 text-success-500" />
  </div>
  </div>
  <div className="text-2xl font-black text-foreground">
  {stats.completed}
  </div>
  <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
  {t('audits.stats.completed', { defaultValue: 'Terminés' })}
  </div>
  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
  <motion.div
  initial={{ width: 0 }}
  animate={{ width: `${(stats.completed / Math.max(stats.total, 1)) * 100}%` }}
  transition={{ duration: 0.8, ease: "easeOut" }}
  className="h-full bg-success-500 rounded-full"
  />
  </div>
  </div>

  {/* Upcoming 30 days */}
  <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 group hover:scale-[1.02] transition-transform">
  <div className="flex items-center justify-between mb-2">
  <div className="p-2 bg-info-bg rounded-3xl">
  <Calendar className="w-4 h-4 text-info-500" />
  </div>
  </div>
  <div className="text-2xl font-black text-foreground">
  {stats.upcoming}
  </div>
  <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
  {t('audits.stats.upcoming30days', { defaultValue: 'Prochains (30j)' })}
  </div>
  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
  <motion.div
  initial={{ width: 0 }}
  animate={{ width: `${Math.min((stats.upcoming / Math.max(stats.total, 1)) * 100, 100)}%` }}
  transition={{ duration: 0.8, ease: "easeOut" }}
  className="h-full bg-info-500 rounded-full"
  />
  </div>
  </div>

  {/* Findings */}
  <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 group hover:scale-[1.02] transition-transform">
  <div className="flex items-center justify-between mb-2">
  <div className={cn(
  "p-2 rounded-3xl",
  findingsCount > 0 ? "bg-red-50" : "bg-success-bg"
  )}>
  <AlertOctagon className={cn(
   "w-4 h-4",
   findingsCount > 0 ? "text-red-500" : "text-success-500"
  )} />
  </div>
  {findingsCount > 0 && (
  <span className="flex h-2 w-2">
   <span className="animate-ping absolute h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
   <span className="relative rounded-full h-2 w-2 bg-red-500"></span>
  </span>
  )}
  </div>
  <div className={cn(
  "text-2xl font-black",
  findingsCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
  )}>
  {findingsCount}
  </div>
  <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
  {t('audits.stats.nonConformities', { defaultValue: 'Non-conformités' })}
  </div>
  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
  <motion.div
  initial={{ width: 0 }}
  animate={{ width: findingsCount > 0 ? '100%' : '0%' }}
  transition={{ duration: 0.8, ease: "easeOut" }}
  className={cn(
   "h-full rounded-full",
   findingsCount > 0 ? "bg-red-500" : "bg-success-500"
  )}
  />
  </div>
  </div>
 </div>
 </div>

 {/* Bottom activity indicator */}
 <div className="mt-4 pt-4 border-t border-border/40 dark:border-white/5 flex items-center justify-between">
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Activity className="w-3.5 h-3.5" />
  <span>{stats.inProgress} {t('audits.stats.inProgressLabel', { defaultValue: 'en cours' })} • {stats.planned} {t('audits.stats.plannedLabel', { defaultValue: 'planifiés' })}</span>
 </div>
 <div className="flex items-center gap-4">
  <div className="flex items-center gap-1.5 text-[11px]">
  <div className="w-2 h-2 rounded-full bg-success-500" />
  <span className="text-muted-foreground">{t('audits.stats.completedLegend', { defaultValue: 'Terminés' })}</span>
  </div>
  <div className="flex items-center gap-1.5 text-[11px]">
  <div className="w-2 h-2 rounded-full bg-primary" />
  <span className="text-muted-foreground">{t('audits.stats.inProgressLegend', { defaultValue: 'En cours' })}</span>
  </div>
  <div className="flex items-center gap-1.5 text-[11px]">
  <div className="w-2 h-2 rounded-full bg-muted" />
  <span className="text-muted-foreground">{t('audits.stats.plannedLegend', { defaultValue: 'Planifiés' })}</span>
  </div>
 </div>
 </div>
 </motion.div>
 );
};
