import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
 RadialBarChart,
 RadialBar,
 ResponsiveContainer
} from 'recharts';
import { SENTINEL_PALETTE } from '../../theme/chartTheme';
import { SMSIProgram, PDCAPhase } from '../../types/ebios';
import {
 TrendingUp,
 Target,
 PlayCircle,
 BarChart3,
 Settings2,
 Calendar,
 AlertTriangle,
 CheckCircle2,
 Activity
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { useLocale } from '@/hooks/useLocale';

interface SMSIPremiumStatsProps {
 program: SMSIProgram;
 overdueCount: number;
}

const PHASE_ICONS = {
 plan: Target,
 do: PlayCircle,
 check: BarChart3,
 act: Settings2
};

const PHASE_COLORS = {
 plan: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-500', border: 'border-blue-500/30' },
 do: { bg: 'bg-emerald-500/10 dark:bg-emerald-900/30', text: 'text-emerald-500', border: 'border-emerald-500/30' },
 check: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-500', border: 'border-amber-500/30' },
 act: { bg: 'bg-purple-500/10 dark:bg-purple-900/30', text: 'text-purple-500', border: 'border-purple-500/30' }
};

const PHASE_LABELS = {
 plan: 'Plan',
 do: 'Do',
 check: 'Check',
 act: 'Act'
};

// Tech corner decoration
const TechCorners: React.FC<{ className?: string }> = ({ className }) => (
 <div className={cn("pointer-events-none", className)}>
 <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
 <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
 <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
 <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
 </div>
);

export const SMSIPremiumStats: React.FC<SMSIPremiumStatsProps> = ({ program, overdueCount }) => {
 const { config } = useLocale();
 const currentPhase = program.currentPhase as PDCAPhase;
 const PhaseIcon = PHASE_ICONS[currentPhase] || Target;
 const phaseColors = PHASE_COLORS[currentPhase] || PHASE_COLORS.plan;
 const phaseLabel = PHASE_LABELS[currentPhase] || 'Inconnu';

 // Calculate certification countdown
 const { daysUntilCertification, targetDate, isOverdue: certOverdue } = useMemo(() => {
 if (!program.targetCertificationDate) {
 return { daysUntilCertification: null, targetDate: null, isOverdue: false };
 }
 const target = new Date(program.targetCertificationDate);
 const days = Math.ceil((target.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
 return {
 daysUntilCertification: days,
 targetDate: target,
 isOverdue: days < 0
 };
 }, [program.targetCertificationDate]);

 // Gauge data
 const gaugeData = useMemo(() => [{
 name: 'Conformité',
 value: program.overallProgress,
 fill: program.overallProgress >= 80 ? SENTINEL_PALETTE.success :
 program.overallProgress >= 50 ? SENTINEL_PALETTE.warning : SENTINEL_PALETTE.danger
 }], [program.overallProgress]);

 // Phase progress indicator
 const phases: PDCAPhase[] = ['plan', 'do', 'check', 'act'];
 const currentPhaseIndex = phases.indexOf(currentPhase);

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
  <filter id="smsiGlow" x="-50%" y="-50%" width="200%" height="200%">
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
  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
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
   style={{ filter: 'url(#smsiGlow)' }}
  />
  </RadialBarChart>
  </ResponsiveContainer>
  <div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="text-2xl font-black text-foreground">
  {program.overallProgress}%
  </span>
  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
  Conformité
  </span>
  </div>
  </div>
  <div className="hidden sm:block">
  <div className="flex items-center gap-2 mb-1">
  <TrendingUp className="w-4 h-4 text-primary" />
  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
  Programme SMSI
  </span>
  </div>
  <p className="text-xs text-muted-foreground max-w-[180px]">
  {program.overallProgress >= 80 ? 'Excellente progression' :
  program.overallProgress >= 50 ? 'En bonne voie' : 'Effort nécessaire'}
  </p>
  </div>
 </div>

 {/* Divider */}
 <div className="hidden lg:block w-px h-20 bg-gradient-to-b from-transparent via-border to-transparent" />

 {/* Stats Grid */}
 <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
  {/* Current Phase */}
  <div className={cn(
  "p-4 rounded-2xl border group hover:scale-[1.02] transition-transform",
  "bg-white/50 dark:bg-white/5 border-border/40"
  )}>
  <div className="flex items-center justify-between mb-2">
  <div className={cn("p-2 rounded-3xl", phaseColors.bg)}>
  <PhaseIcon className={cn("w-4 h-4", phaseColors.text)} />
  </div>
  <Badge className={cn(
  "text-[11px] font-bold",
  phaseColors.bg, phaseColors.text, phaseColors.border
  )}>
  Actif
  </Badge>
  </div>
  <div className={cn("text-2xl font-black", phaseColors.text)}>
  {phaseLabel}
  </div>
  <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
  Phase Active
  </div>
  {/* Phase Progress Dots */}
  <div className="mt-3 flex items-center gap-1.5">
  {phases.map((phase, idx) => (
  <div
   key={phase || 'unknown'}
   className={cn(
   "h-1.5 flex-1 rounded-full transition-colors",
   idx <= currentPhaseIndex
   ? PHASE_COLORS[phase].bg.replace('/10', '')
   : "bg-muted dark:bg-white/10"
   )}
   style={{
   backgroundColor: idx <= currentPhaseIndex
   ? phase === 'plan' ? 'hsl(var(--primary))' :
   phase === 'do' ? 'hsl(var(--success))' :
   phase === 'check' ? 'hsl(var(--warning))' : SENTINEL_PALETTE.secondary
   : undefined
   }}
  />
  ))}
  </div>
  </div>

  {/* Overdue Milestones */}
  <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 group hover:scale-[1.02] transition-transform">
  <div className="flex items-center justify-between mb-2">
  <div className={cn(
  "p-2 rounded-3xl",
  overdueCount > 0 ? "bg-red-50 dark:bg-red-900/30" : "bg-success-bg"
  )}>
  {overdueCount > 0 ? (
   <AlertTriangle className="w-4 h-4 text-red-500" />
  ) : (
   <CheckCircle2 className="w-4 h-4 text-success-500" />
  )}
  </div>
  {overdueCount > 0 && (
  <span className="flex h-2 w-2">
   <span className="animate-ping absolute h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
   <span className="relative rounded-full h-2 w-2 bg-red-500"></span>
  </span>
  )}
  </div>
  <div className={cn(
  "text-2xl font-black",
  overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-success-600 dark:text-success-400"
  )}>
  {overdueCount}
  </div>
  <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
  Jalons en retard
  </div>
  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
  <motion.div
  initial={{ width: 0 }}
  animate={{ width: overdueCount > 0 ? '100%' : '0%' }}
  transition={{ duration: 0.8, ease: "easeOut" }}
  className={cn(
   "h-full rounded-full",
   overdueCount > 0 ? "bg-red-500" : "bg-success-500"
  )}
  />
  </div>
  </div>

  {/* Certification Countdown */}
  <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 group hover:scale-[1.02] transition-transform sm:col-span-2">
  <div className="flex items-center justify-between mb-2">
  <div className={cn(
  "p-2 rounded-3xl",
  certOverdue ? "bg-red-50 dark:bg-red-900/30" : "bg-indigo-500/10 dark:bg-indigo-900/30"
  )}>
  <Calendar className={cn(
   "w-4 h-4",
   certOverdue ? "text-red-500" : "text-indigo-500"
  )} />
  </div>
  {targetDate && (
  <span className="text-[11px] text-muted-foreground font-medium">
   {targetDate.toLocaleDateString(config.intlLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
  </span>
  )}
  </div>
  <div className="flex items-baseline gap-2">
  <div className={cn(
  "text-2xl font-black",
  certOverdue ? "text-red-600 dark:text-red-400" :
  daysUntilCertification !== null && daysUntilCertification <= 30 ? "text-warning-600 dark:text-warning-400" :
  "text-foreground"
  )}>
  {daysUntilCertification !== null ? (
   certOverdue ? `+${Math.abs(daysUntilCertification)}` : `J-${daysUntilCertification}`
  ) : '—'}
  </div>
  {certOverdue && (
  <Badge className="bg-red-50 text-red-600 dark:text-red-400 border-red-500/20 text-[11px]">
   En retard
  </Badge>
  )}
  </div>
  <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
  {targetDate ? 'Objectif Certification' : 'Certification non définie'}
  </div>
  {daysUntilCertification !== null && !certOverdue && (
  <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
  <motion.div
   initial={{ width: 0 }}
   animate={{ width: `${Math.max(0, 100 - (daysUntilCertification / 365) * 100)}%` }}
   transition={{ duration: 0.8, ease: "easeOut" }}
   className="h-full bg-indigo-500 rounded-full"
  />
  </div>
  )}
  </div>
 </div>
 </div>

 {/* Bottom PDCA Progress */}
 <div className="mt-4 pt-4 border-t border-border/40 dark:border-white/5 flex items-center justify-between">
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Activity className="w-3.5 h-3.5" />
  <span>Cycle PDCA • Phase {currentPhaseIndex + 1}/4</span>
 </div>
 <div className="flex items-center gap-3">
  {phases.map((phase) => {
  const PhaseIconComp = PHASE_ICONS[phase];
  const colors = PHASE_COLORS[phase];
  const isActive = phase === currentPhase;
  const isPast = phases.indexOf(phase) < currentPhaseIndex;

  return (
  <div
  key={phase || 'unknown'}
  className={cn(
   "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all",
   isActive && cn(colors.bg, "ring-1", colors.border),
   !isActive && !isPast && "opacity-40"
  )}
  >
  <PhaseIconComp className={cn(
   "w-3 h-3",
   isActive || isPast ? colors.text : "text-muted-foreground"
  )} />
  <span className={cn(
   "text-[11px] font-bold uppercase",
   isActive || isPast ? colors.text : "text-muted-foreground"
  )}>
   {PHASE_LABELS[phase]}
  </span>
  {isPast && (
   <CheckCircle2 className="w-3 h-3 text-success-500" />
  )}
  </div>
  );
  })}
 </div>
 </div>
 </motion.div>
 );
};
