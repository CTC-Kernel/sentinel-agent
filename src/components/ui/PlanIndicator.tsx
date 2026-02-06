/**
 * PlanIndicator.tsx
 * Premium plan indicator for the topbar displaying the current subscription tier
 * Follows Apple design language with glassmorphism and refined typography
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Star, Building2, Sparkles, ChevronRight, Calendar, Zap } from './Icons';
import { useStore } from '../../store';
import { PlanType } from '../../types';

interface PlanIndicatorProps {
 className?: string;
 compact?: boolean;
}

const PLAN_CONFIG: Record<PlanType | 'unknown', {
 name: string;
 shortName: string;
 icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
 gradient: string;
 bgGradient: string;
 borderColor: string;
 textColor: string;
 glowColor: string;
 iconBg: string;
 ringColor: string;
}> = {
 discovery: {
 name: 'Discovery',
 shortName: 'Free',
 icon: Star,
 gradient: 'from-slate-400 to-muted/500',
 bgGradient: 'from-white/80 to-muted/50/80 dark:from-muted/60 dark:to-card/60',
 borderColor: 'border-border/40',
 textColor: 'text-foreground',
 glowColor: 'shadow-slate-200/40 dark:shadow-slate-900/40',
 iconBg: 'bg-gradient-to-br from-slate-400 to-muted/500',
 ringColor: 'ring-slate-300/50 dark:ring-slate-600/50',
 },
 professional: {
 name: 'Professional',
 shortName: 'Pro',
 icon: Crown,
 gradient: 'from-primary to-violet-600',
 bgGradient: 'from-primary/10/90 to-violet-50/90 dark:from-primary/40 dark:to-violet-900/40',
 borderColor: 'border-primary/30 dark:border-primary/80',
 textColor: 'text-primary dark:text-primary/40',
 glowColor: 'shadow-primary/40 dark:shadow-primary/40',
 iconBg: 'bg-gradient-to-br from-primary to-violet-600',
 ringColor: 'ring-primary/60 dark:ring-primary',
 },
 enterprise: {
 name: 'Enterprise',
 shortName: 'Ent',
 icon: Building2,
 gradient: 'from-purple-500 via-violet-500 to-fuchsia-500',
 bgGradient: 'from-purple-50/90 to-fuchsia-50/90 dark:from-purple-900/40 dark:to-fuchsia-900/40',
 borderColor: 'border-purple-200 dark:border-purple-700',
 textColor: 'text-purple-700 dark:text-purple-200',
 glowColor: 'shadow-purple-300/40 dark:shadow-purple-900/40',
 iconBg: 'bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-500',
 ringColor: 'ring-purple-300/50 dark:ring-purple-600/50',
 },
 unknown: {
 name: 'Discovery',
 shortName: 'Free',
 icon: Star,
 gradient: 'from-slate-400 to-muted/500',
 bgGradient: 'from-white/80 to-muted/50/80 dark:from-muted/60 dark:to-card/60',
 borderColor: 'border-border/40',
 textColor: 'text-foreground',
 glowColor: 'shadow-slate-200/40 dark:shadow-slate-900/40',
 iconBg: 'bg-gradient-to-br from-slate-400 to-muted/500',
 ringColor: 'ring-slate-300/50 dark:ring-slate-600/50',
 },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; pulse?: boolean }> = {
 active: { label: 'Actif', color: 'text-success-text', bgColor: 'bg-success', pulse: false },
 trialing: { label: 'Essai', color: 'text-warning-text', bgColor: 'bg-warning', pulse: true },
 past_due: { label: 'Impayé', color: 'text-error-text', bgColor: 'bg-error', pulse: true },
 canceled: { label: 'Annulé', color: 'text-muted-foreground', bgColor: 'bg-muted-foreground', pulse: false },
 incomplete: { label: 'Incomplet', color: 'text-warning-text', bgColor: 'bg-warning', pulse: false },
};

export const PlanIndicator: React.FC<PlanIndicatorProps> = ({ className = '', compact = false }) => {
 const { organization } = useStore();
 const [isHovered, setIsHovered] = useState(false);

 // Calculate days until renewal - move hooks before early return
 const [currentTime, setCurrentTime] = React.useState(() => Date.now());

 React.useEffect(() => {
 const timer = setInterval(() => {
 setCurrentTime(Date.now());
 }, 60000);
 return () => clearInterval(timer);
 }, []);

 // Fallback if organization is missing - show discovery plan
 const subscription = organization?.subscription || {
 planId: 'discovery' as PlanType,
 status: 'active',
 currentPeriodEnd: null,
 cancelAtPeriodEnd: false
 };

 const plan = subscription.planId || 'discovery';
 const status = subscription.status || 'active';
 const config = PLAN_CONFIG[plan] || PLAN_CONFIG.discovery;
 const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
 const Icon = config.icon;

 // Calculate days until renewal
 const periodEnd = subscription.currentPeriodEnd;
 const daysUntilRenewal = periodEnd
 ? Math.ceil((new Date(periodEnd).getTime() - currentTime) / (1000 * 60 * 60 * 24))
 : null;

 const isTrialing = status === 'trialing';
 const isPastDue = status === 'past_due';
 const showUpgradeHint = plan === 'discovery';

 return (
 <Link
 to="/pricing"
 className={`group relative ${className}`}
 onMouseEnter={() => setIsHovered(true)}
 onMouseLeave={() => setIsHovered(false)}
 >
 {/* Main Badge */}
 <motion.div
 className={`
  relative flex items-center gap-2.5 px-3 py-1.5 rounded-3xl
  bg-gradient-to-br ${config.bgGradient}
  backdrop-blur-sm
  border ${config.borderColor}
  shadow-sm ${config.glowColor}
  ring-1 ${config.ringColor}
  transition-all duration-300
  group-hover:shadow-md group-hover:scale-[1.02]
  cursor-pointer
 `}
 whileTap={{ scale: 0.98 }}
 >
 {/* Animated shimmer for premium plans */}
 {(plan === 'professional' || plan === 'enterprise') && (
  <motion.div
  className={`absolute inset-0 rounded-3xl bg-gradient-to-r ${config.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`}
  />
 )}

 {/* Icon with gradient background */}
 <div className={`
  relative flex items-center justify-center w-7 h-7 rounded-lg
  ${config.iconBg}
  shadow-sm
 `}>
  <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />

  {/* Sparkle effect for enterprise */}
  {plan === 'enterprise' && (
  <motion.div
  className="absolute -top-1 -right-1"
  animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
  >
  <Sparkles className="w-3 h-3 text-amber-400 drop-shadow-sm" />
  </motion.div>
  )}
 </div>

 {/* Plan name and status - Always visible */}
 <div className={`flex flex-col items-start leading-none ${compact ? 'hidden sm:flex' : ''}`}>
  <span className={`text-xs font-bold tracking-tight ${config.textColor}`}>
  {config.name}
  </span>

  {/* Status indicator with dot */}
  <div className="flex items-center gap-1 mt-0.5">
  {statusConfig.pulse ? (
  <span className="relative flex h-1.5 w-1.5">
  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPastDue ? 'bg-error' : 'bg-warning'} opacity-75`}></span>
  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPastDue ? 'bg-error' : 'bg-warning'}`}></span>
  </span>
  ) : (
  <span className={`inline-flex rounded-full h-1.5 w-1.5 ${statusConfig.bgColor}`}></span>
  )}
  <span className={`text-[11px] font-semibold uppercase tracking-wider ${statusConfig.color}`}>
  {statusConfig.label}
  </span>
  </div>
 </div>

 {/* Chevron indicator */}
 <ChevronRight className={`
  w-3.5 h-3.5 ${config.textColor} opacity-40
  group-hover:opacity-70 group-hover:translate-x-0.5
  transition-all duration-200
 `} />
 </motion.div>

 {/* Hover tooltip with more details */}
 <AnimatePresence>
 {isHovered && (
  <motion.div
  initial={{ opacity: 0, y: 4, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: 4, scale: 0.95 }}
  transition={{ duration: 0.15 }}
  className="absolute top-full right-0 mt-2 z-popover"
  >
  <div className="
  w-64 p-4 rounded-2xl
  bg-card/95
  backdrop-blur-xl
  border border-border/40
  shadow-xl shadow-slate-200/30 dark:shadow-black/30
  ">
  {/* Header */}
  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/40">
  <div className={`flex items-center justify-center w-10 h-10 rounded-3xl ${config.iconBg} shadow-md`}>
   <Icon className="w-5 h-5 text-white" strokeWidth={2} />
  </div>
  <div>
   <p className="text-sm font-bold text-foreground">
   Plan {config.name}
   </p>
   <div className="flex items-center gap-1.5 mt-0.5">
   <span className={`inline-flex rounded-full h-2 w-2 ${statusConfig.bgColor}`}></span>
   <p className={`text-xs font-semibold ${statusConfig.color}`}>
   {statusConfig.label}
   </p>
   </div>
  </div>
  </div>

  {/* Renewal info */}
  {daysUntilRenewal !== null && status === 'active' && (
  <div className="flex items-center gap-2.5 p-2.5 rounded-3xl bg-muted/50 mb-2.5">
   <div className="p-1.5 rounded-lg bg-muted/50">
   <Calendar className="w-4 h-4 text-muted-foreground" />
   </div>
   <span className="text-xs text-muted-foreground">
   Renouvellement dans <strong className="text-foreground">{daysUntilRenewal} jours</strong>
   </span>
  </div>
  )}

  {/* Trial info */}
  {isTrialing && daysUntilRenewal !== null && (
  <div className="flex items-center gap-2.5 p-2.5 rounded-3xl bg-amber-50 dark:bg-amber-900/20 mb-2.5">
   <div className="p-1.5 rounded-lg bg-amber-200/50 dark:bg-amber-500">
   <Zap className="w-4 h-4 text-amber-500" />
   </div>
   <span className="text-xs text-amber-700 dark:text-amber-300">
   Essai termine dans <strong>{daysUntilRenewal} jours</strong>
   </span>
  </div>
  )}

  {/* Upgrade CTA */}
  {showUpgradeHint && (
  <div className="flex items-center justify-between p-3 rounded-3xl bg-gradient-to-r from-muted/50 to-muted dark:from-muted/50 dark:to-muted/50 border border-border/40/30">
   <div>
   <span className="text-xs font-bold text-foreground /40">
   Passez à Pro
   </span>
   <p className="text-[11px] text-muted-foreground mt-0.5">
   Fonctionnalités avancées
   </p>
   </div>
   <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-primary to-violet-600 text-white text-xs font-bold shadow-sm">
   <Sparkles className="w-3 h-3" />
   Upgrade
   </div>
  </div>
  )}

  {/* Footer */}
  <p className="text-[11px] text-center text-muted-foreground mt-3">
  Cliquer pour gérer l'abonnement
  </p>
  </div>
  </motion.div>
 )}
 </AnimatePresence>
 </Link>
 );
};
