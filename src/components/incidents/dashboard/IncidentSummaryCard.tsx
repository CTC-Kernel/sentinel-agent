import React, { useId } from 'react';
import { ShieldAlert, Siren, CheckCircle2 } from '../../ui/Icons';
import { useStore } from '../../../store';

interface IncidentSummaryCardProps {
 resolutionRate: number;
 totalIncidents: number;
 openIncidents: number;
 criticalIncidents: number;
}

export const IncidentSummaryCard: React.FC<IncidentSummaryCardProps> = ({
 resolutionRate,
 totalIncidents,
 openIncidents,
 criticalIncidents
}) => {
 const { t } = useStore();
 const uid = useId();
 const progressGradientId = `progressGradient-${uid}`;

 return (
 <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 md:p-8 rounded-xl border border-border/40 shadow-premium flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group">
 {/* Tech Corners Generic */}
 <svg className="absolute top-6 left-6 w-4 h-4 text-muted-foreground/30 rotate-0" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
 <svg className="absolute top-6 right-6 w-4 h-4 text-muted-foreground/30 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
 <svg className="absolute bottom-6 left-6 w-4 h-4 text-muted-foreground/30 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
 <svg className="absolute bottom-6 right-6 w-4 h-4 text-muted-foreground/30 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

 <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
 <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity duration-normal ease-apple group-hover:opacity-100 opacity-70"></div>
 </div>

 {/* Global Score */}
 <div className="flex items-center gap-6 relative z-10">
 <div className="relative">
  <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="-4 -4 104 104">
  <defs>
  <linearGradient id={progressGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" stopColor="var(--success)" />
  <stop offset="100%" stopColor="var(--success)" stopOpacity="0.7" />
  </linearGradient>
  </defs>
  <circle
  cx="48"
  cy="48"
  r="40"
  stroke="currentColor"
  strokeWidth="8"
  fill="transparent"
  className="text-muted/50"
  />
  <circle
  cx="48"
  cy="48"
  r="40"
  stroke={`url(#${progressGradientId})`}
  strokeWidth="8"
  fill="transparent"
  strokeDasharray={251.2}
  strokeDashoffset={251.2 - (251.2 * resolutionRate) / 100}
  strokeLinecap="round"
  className="transition-all duration-1000 ease-apple drop-shadow-sm"
  />
  </svg>
  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
  <span className="text-xl font-black text-foreground">{resolutionRate}%</span>
  </div>
 </div>
 <div>
  <h3 className="text-lg font-bold text-foreground mb-1">{t('incidents.resolutionRate', { defaultValue: 'Taux de Résolution' })}</h3>
  <p className="text-sm text-muted-foreground max-w-[200px] leading-snug">
  {t('incidents.resolutionRateDesc', { defaultValue: "Pourcentage d'incidents résolus ou fermés." })}
  </p>
 </div>
 </div>

 {/* Key Metrics Breakdown */}
 <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-border/40 px-6 mx-2 relative z-10">
 <div>
  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total</div>
  <div className="text-2xl font-black text-foreground">{totalIncidents}</div>
 </div>
 <div>
  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t('incidents.open', { defaultValue: 'En Cours' })}</div>
  <div className={`text-2xl font-black ${openIncidents > 0 ? 'text-warning' : 'text-foreground'}`}>
  {openIncidents}
  </div>
 </div>
 <div>
  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t('incidents.critical', { defaultValue: 'Critiques' })}</div>
  <div className={`text-2xl font-black ${criticalIncidents > 0 ? 'text-destructive' : 'text-foreground'}`}>
  {criticalIncidents}
  </div>
 </div>
 </div>

 {/* Alerts/Status */}
 <div className="flex flex-col gap-3 min-w-0 sm:min-w-[200px] relative z-10">
 {criticalIncidents > 0 && (
  <div className="flex items-center gap-3 text-xs font-bold text-destructive bg-destructive/10 px-4 py-2.5 rounded-xl border border-destructive/20 backdrop-blur-sm transition-all duration-normal ease-apple hover:scale-[1.02] animate-pulse">
  <ShieldAlert className="h-4 w-4 shrink-0" />
  <span>{criticalIncidents} {t('incidents.criticalOpen')}</span>
  </div>
 )}
 {openIncidents > 0 && criticalIncidents === 0 && (
  <div className="flex items-center gap-3 text-xs font-bold text-warning bg-warning/10 px-4 py-2.5 rounded-xl border border-warning/20 backdrop-blur-sm transition-all duration-normal ease-apple hover:scale-[1.02]">
  <Siren className="h-4 w-4 shrink-0" />
  <span>{openIncidents} {t('incidents.activeCount')}</span>
  </div>
 )}
 {openIncidents === 0 && (
  <div className="flex items-center gap-3 text-xs font-bold text-success bg-success/10 px-4 py-2.5 rounded-xl border border-success/20 backdrop-blur-sm transition-all duration-normal ease-apple hover:scale-[1.02]">
  <CheckCircle2 className="h-4 w-4 shrink-0" />
  <span>{t('incidents.noActive')}</span>
  </div>
 )}
 </div>
 </div>
 );
};
