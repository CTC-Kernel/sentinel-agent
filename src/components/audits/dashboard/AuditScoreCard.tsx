import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, CheckCircle2 } from '../../ui/Icons';
import { slideUpVariants } from '../../ui/animationVariants';

interface AuditScoreCardProps {
 complianceRate: number;
 totalAudits: number;
 openFindings: number;
 upcomingAudits: number;
 onFilterChange?: (filter: { type: string; value: string } | null) => void;
}

export const AuditScoreCard: React.FC<AuditScoreCardProps> = ({
 complianceRate,
 totalAudits,
 openFindings,
 upcomingAudits,
 onFilterChange
}) => {
 return (
 <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-4xl shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group mb-8 overflow-hidden hover:shadow-apple transition-all duration-300">
 <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />
 <div className="absolute inset-0 overflow-hidden rounded-4xl pointer-events-none">
 <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 dark:bg-primary/60/15 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
 </div>

 {/* Tech Corners */}
 <svg className="absolute top-5 left-5 w-4 h-4 text-muted-foreground/30" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v2H2z" /><path fill="currentColor" d="M2 2v20h2V2z" /></svg>
 <svg className="absolute bottom-5 right-5 w-4 h-4 text-muted-foreground/30 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v2H2z" /><path fill="currentColor" d="M2 2v20h2V2z" /></svg>

 {/* Global Score */}
 <div className="flex items-center gap-6 relative z-10">
 <div className="relative">
  <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
  <circle
  cx="48"
  cy="48"
  r="40"
  stroke="currentColor"
  strokeWidth="8"
  fill="transparent"
  className="text-muted-foreground/40"
  />
  <circle
  cx="48"
  cy="48"
  r="40"
  stroke="currentColor"
  strokeWidth="8"
  fill="transparent"
  strokeDasharray={251.2}
  strokeDashoffset={251.2 - (251.2 * complianceRate) / 100}
  className="text-emerald-500 transition-all duration-1000 ease-out drop-shadow-emerald-md"
  />
  </svg>
  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
  <span className="text-2xl font-black text-foreground tracking-tighter">{complianceRate}%</span>
  </div>
 </div>
 <div>
  <h3 className="text-lg font-bold text-foreground mb-1 uppercase tracking-wider">Taux de Complétion</h3>
  <p className="text-xs text-muted-foreground max-w-[200px] font-mono leading-relaxed">
  PCT. AUDITS TERMINÉS
  </p>
 </div>
 </div>

 {/* Key Metrics Breakdown */}
 <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-border/40 dark:border-white/5 px-6 mx-2 relative z-10">
 <div
  onClick={() => onFilterChange?.(null)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFilterChange?.(null); } }}
  role="button"
  tabIndex={0}
  aria-label="Afficher tous les audits"
  className="cursor-pointer group/item text-center hover:bg-muted/50 dark:hover:bg-muted/50 rounded-3xl transition-colors p-2"
 >
  <div className="text-[11px] uppercase font-bold text-muted-foreground mb-2 tracking-widest group-hover/item:text-primary transition-colors">Total Audits</div>
  <div className="text-3xl font-black text-foreground font-mono">{totalAudits}</div>
 </div>
 <div className="text-center">
  <div className="text-[11px] uppercase font-bold text-muted-foreground mb-2 tracking-widest">Actions Requises</div>
  <div className={`text-3xl font-black font-mono ${openFindings > 0 ? 'text-red-500 drop-shadow-red-md' : 'text-foreground'}`}>
  {openFindings}
  </div>
 </div>
 <div className="text-center">
  <div className="text-[11px] uppercase font-bold text-muted-foreground mb-2 tracking-widest">À Venir (30j)</div>
  <div className="text-3xl font-black text-foreground font-mono">{upcomingAudits}</div>
 </div>
 </div>

 {/* Alerts/Status */}
 <div className="flex flex-col gap-3 min-w-0 sm:min-w-[200px] relative z-10">
 {openFindings > 0 && (
  <div className="flex items-center gap-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-50 px-4 py-3 rounded-lg border border-red-200 dark:border-red-800 dark:border-red-500/20 backdrop-blur-md animate-pulse-slow">
  <AlertTriangle className="h-4 w-4 shrink-0" />
  <span className="uppercase tracking-wide">{openFindings} actions requises</span>
  </div>
 )}
 {upcomingAudits > 0 && (
  <div className="flex items-center gap-3 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100/50 dark:bg-purple-500/10 px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-500/20 backdrop-blur-md">
  <Calendar className="h-4 w-4 shrink-0" />
  <span className="uppercase tracking-wide">{upcomingAudits} audits planifiés</span>
  </div>
 )}
 {openFindings === 0 && upcomingAudits === 0 && (
  <div className="flex items-center gap-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/10 px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-500/20 backdrop-blur-md">
  <CheckCircle2 className="h-4 w-4 shrink-0" />
  <span className="uppercase tracking-wide">Système Sécurisé</span>
  </div>
 )}
 </div>
 </motion.div>
 );
};
