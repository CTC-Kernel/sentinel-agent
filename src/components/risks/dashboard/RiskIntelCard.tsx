import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
 Activity, ShieldAlert, TrendingDown, Target,
 ArrowRight, AlertTriangle, CheckCircle
} from '../../ui/Icons';
import { Risk } from '../../../types';
import { PremiumCard } from '../../ui/PremiumCard';
import { RISK_ACCEPTANCE_THRESHOLD, RISK_LEVELS } from '../../../constants/RiskConstants';
import { cn } from '../../../utils/cn';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';

interface RiskIntelCardProps {
 risks: Risk[];
}

export const RiskIntelCard: React.FC<RiskIntelCardProps> = ({ risks }) => {
 const { dateFnsLocale } = useLocale();

 // --- 1. Compute Metrics ---
 const metrics = useMemo(() => {
 const total = risks.length;
 if (total === 0) return null;

 const critical = risks.filter(r => r.score >= RISK_LEVELS.HIGH.min).length;
 const aboveAppetite = risks.filter(r => (r.residualScore ?? r.score) > RISK_ACCEPTANCE_THRESHOLD).length;

 // Averages for "The Gap" Visualization
 const totalInherent = risks.reduce((sum, r) => sum + r.score, 0);
 const totalResidual = risks.reduce((sum, r) => sum + (r.residualScore ?? r.score), 0);

 const avgInherent = totalInherent / total;
 const avgResidual = totalResidual / total;
 const reduction = avgInherent > 0 ? ((avgInherent - avgResidual) / avgInherent) * 100 : 0;

 return {
 total,
 critical,
 aboveAppetite,
 avgInherent,
 avgResidual,
 reduction
 };
 }, [risks]);

 // --- 2. Empty State ---
 if (!metrics) {
 return (
 <PremiumCard glass className="p-8 flex items-center justify-center min-h-[200px]">
 <div className="text-center opacity-60">
  <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
  <p className="text-lg font-medium">En attente de données...</p>
  <p className="text-sm">Ajoutez des risques pour activer l'intelligence.</p>
 </div>
 </PremiumCard>
 );
 }

 // --- 3. Render "The Command Center" ---
 return (
 <PremiumCard glass className="mb-8 overflow-hidden relative border-t border-white/20 p-0" hover={false}>
 {/* Ambient Background Gradient for "Hero" feel */}
 <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-8 relative z-decorator">

 {/* LEFT: Vital Signs (Vertical Stack) */}
 <div className="lg:col-span-4 flex flex-col justify-between gap-6 border-r border-border/40 dark:border-white/5 pr-0 lg:pr-8">
  <div>
  <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
  <Activity className="text-primary w-6 h-6" />
  Global Risk Intel
  </h2>
  <p className="text-sm text-muted-foreground mt-1">
  État de santé du registre au {format(new Date(), 'd MMMM yyyy', { locale: dateFnsLocale })}
  </p>
  </div>

  <div className="grid grid-cols-2 gap-4">
  <motion.div
  initial={{ scale: 0.9, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ delay: 0.1 }}
  className="bg-card p-4 rounded-2xl border border-white/40 dark:border-white/5 shadow-sm"
  >
  <p className="text-sm text-foreground font-medium mb-1">Total Risques</p>
  <div className="text-3xl font-black text-foreground tracking-tight">
  {metrics.total}
  </div>
  </motion.div>

  <motion.div
  initial={{ scale: 0.9, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ delay: 0.2 }}
  className={cn(
  "p-4 rounded-2xl border shadow-sm",
  metrics.critical > 0
   ? "bg-error-bg/50 dark:bg-error-bg/10 border-error-border dark:border-error-border/30"
   : "bg-success-bg/50 dark:bg-success-bg/10 border-success-border dark:border-success-border/30"
  )}
  >
  <div className="flex items-center justify-between mb-1">
  <p className={cn("text-sm font-medium", metrics.critical > 0 ? "text-error-text dark:text-error-text" : "text-success-text dark:text-success-text")}>
   Élevés+
  </p>
  {metrics.critical > 0 ? <ShieldAlert className="w-4 h-4 text-error-text" /> : <CheckCircle className="w-4 h-4 text-success-text" />}
  </div>
  <div className={cn("text-3xl font-black tracking-tight", metrics.critical > 0 ? "text-error-text dark:text-error-text/90" : "text-success-text dark:text-success-text/90")}>
  {metrics.critical}
  </div>
  </motion.div>
  </div>

  <div className="flex items-center gap-3 text-sm p-3 bg-muted/50 dark:bg-white/5 rounded-3xl border border-border/40 dark:border-white/5">
  <AlertTriangle className={cn("w-5 h-5", metrics.aboveAppetite > 0 ? "text-warning-text" : "text-muted-foreground")} />
  <span className="text-muted-foreground">
  <strong>{metrics.aboveAppetite}</strong> risques hors appétence (&gt; {RISK_ACCEPTANCE_THRESHOLD})
  </span>
  </div>
 </div>

 {/* RIGHT: The "Value Creation" Engine (Visualization) */}
 <div className="lg:col-span-8 flex flex-col justify-center pl-0 lg:pl-4">
  <div className="flex items-center justify-between mb-6">
  <h3 className="text-lg font-bold text-foreground /40 flex items-center gap-2">
  <Target className="w-5 h-5 text-violet-500" />
  Performance de Traitement
  </h3>
  <div className="flex items-center gap-2 px-3 py-1 bg-success-bg dark:bg-success-bg/20 text-success-text dark:text-success-text rounded-full text-sm font-bold border border-success-border dark:border-success-border/50">
  <TrendingDown className="w-4 h-4" />
  -{metrics.reduction.toFixed(0)}% de Risque
  </div>
  </div>

  {/* Visual Bar Comparison */}
  <div className="relative pt-6 pb-2 overflow-hidden">
  {/* 1. Inherent Bar (Background) */}
  <div className="relative h-12 md:h-16 bg-muted rounded-full overflow-hidden shadow-inner">
  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-200 to-red-100 dark:from-red-900/40 dark:to-red-800/20 w-full" />
  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-right">
  <span className="block text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Risque Brut Moyen</span>
  <span className="block text-lg md:text-2xl font-black text-red-800 dark:text-red-200">{metrics.avgInherent.toFixed(1)}</span>
  </div>
  </div>

  {/* 2. Residual Bar (Foreground) */}
  <motion.div
  initial={{ width: "100%" }}
  animate={{ width: `${Math.max((metrics.avgResidual / metrics.avgInherent) * 100, 25)}%` }}
  transition={{ duration: 1.2, ease: "circOut", delay: 0.3 }}
  className="absolute top-6 left-0 h-12 md:h-16 bg-gradient-to-r from-success-text to-primary rounded-full shadow-lg shadow-primary/20 z-decorator flex items-center justify-end overflow-hidden"
  >
  <div className="pr-4 text-right shrink-0">
  <span className="block text-xs font-bold text-white/90 uppercase tracking-wider text-shadow-sm">Risque Résiduel</span>
  <span className="block text-lg md:text-2xl font-black text-white text-shadow-md">{metrics.avgResidual.toFixed(1)}</span>
  </div>
  </motion.div>
  </div>

  {/* Value indicator below the bars */}
  <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
  <ArrowRight className="w-4 h-4" />
  <span className="font-medium">Valeur Créée: Sécurisation du patrimoine</span>
  </div>

  <p className="mt-6 text-xs text-center text-muted-foreground max-w-lg mx-auto">
  Le graphique ci-dessus illustre la réduction de l'exposition au risque grâce aux contrôles en place.
  La zone rouge représente le risque évité (Impact de la Gouvernance).
  </p>
 </div>
 </div>
 </PremiumCard>
 );
};
