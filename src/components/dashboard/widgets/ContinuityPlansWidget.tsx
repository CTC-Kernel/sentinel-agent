import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { BusinessProcess, BcpDrill } from '../../../types';
import { where, orderBy, limit } from 'firebase/firestore';
import { useStore } from '../../../store';
import { HeartPulse, CheckCircle2, AlertTriangle, CalendarClock, LifeBuoy } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { PremiumCard } from '../../ui/PremiumCard';

interface ContinuityPlansWidgetProps {
 navigate?: (path: string) => void;
}

export const ContinuityPlansWidget: React.FC<ContinuityPlansWidgetProps> = ({ navigate }) => {
 const { user } = useStore();

 const { data: processes, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
 'business_processes',
 [where('organizationId', '==', user?.organizationId || '')],
 { realtime: true, enabled: !!user?.organizationId }
 );

 const { data: drills, loading: loadingDrills } = useFirestoreCollection<BcpDrill>(
 'bcp_drills',
 [where('organizationId', '==', user?.organizationId || ''), orderBy('date', 'desc'), limit(1)],
 { realtime: true, enabled: !!user?.organizationId }
 );

 const stats = useMemo(() => {
 const total = processes.length;
 if (total === 0) return { coverage: 0, lastDrillStr: 'Aucun' };

 const tested = processes.filter(p => {
 if (!p.lastTestDate) return false;
 const last = new Date(p.lastTestDate);
 const yearAgo = new Date();
 yearAgo.setFullYear(yearAgo.getFullYear() - 1);
 return last > yearAgo;
 }).length;

 const coverage = Math.round((tested / total) * 100);
 const lastDrill = drills.length > 0 ? drills[0] : null;

 // Format relative date or strict date
 let lastDrillStr = 'Aucun';
 if (lastDrill) {
 lastDrillStr = new Date(lastDrill.date).toLocaleDateString('fr-FR');
 }

 return { coverage, lastDrillStr, lastDrillResult: lastDrill?.result };
 }, [processes, drills]);

 const loading = loadingProcesses || loadingDrills;

 // Gradient calculation similar to Compliance widget
 const circumference = 2 * Math.PI * 36; // r=36 matching SVG circles
 const strokeDashoffset = circumference - (stats.coverage / 100) * circumference;

 if (loading) {
 return (
 <div className="h-full flex items-center justify-center glass-premium rounded-2xl border border-border/40 p-4">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 );
 }

 // Empty state when no business processes
 if (processes.length === 0) {
 return (
 <PremiumCard glass
 className="h-full flex flex-col p-5 overflow-hidden"
 hover={true}
 gradientOverlay={true}
 >
 <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-white/5 relative z-decorator">
  <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
  <div className="p-1.5 rounded-lg bg-error-bg dark:bg-error/10 text-error-text dark:text-error">
  <HeartPulse className="w-4 h-4" />
  </div>
  Continuité
  </h3>
 </div>

 <div className="flex-1 flex items-center justify-center relative z-decorator">
  <EmptyState
  icon={LifeBuoy}
  title="Aucun processus métier"
  description="Définissez vos processus critiques pour planifier la continuité d'activité."
  actionLabel="Gérer la continuité"
  onAction={() => navigate && navigate('/continuity')}
  semantic="warning"
  compact
  />
 </div>
 </PremiumCard>
 );
 }

 return (
 <div className="h-full flex flex-col p-5 glass-premium rounded-2xl border border-border/40 shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-300">
 <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />

 <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-white/5 relative z-decorator">
 <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
  <div className="p-1.5 rounded-lg bg-error-bg dark:bg-error/10 text-error-text dark:text-error">
  <HeartPulse className="w-4 h-4" />
  </div>
  Continuité
 </h3>
 <button
  onClick={() => navigate && navigate('/continuity')}
  className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
  Voir tout
 </button>
 </div>

 <div className="flex-1 flex items-center justify-between relative z-decorator pt-2 px-1">
 {/* Circular Chart */}
 <div className="relative w-20 h-20 flex-shrink-0">
  <svg className="w-full h-full transform -rotate-90">
  <circle
  cx="40"
  cy="40"
  r="36"
  fill="transparent"
  stroke="currentColor"
  strokeWidth="8"
  className="text-muted-foreground/40"
  />
  <circle
  cx="40"
  cy="40"
  r="36"
  fill="transparent"
  stroke="currentColor"
  strokeWidth="8"
  strokeDasharray={circumference}
  strokeDashoffset={strokeDashoffset}
  strokeLinecap="round"
  className={`transition-all duration-1000 ease-out ${stats.coverage >= 80 ? 'text-success' : stats.coverage >= 50 ? 'text-warning' : 'text-destructive'}`}
  />
  </svg>
  <div className="absolute inset-0 flex items-center justify-center flex-col">
  <span className="text-lg font-black text-foreground">{stats.coverage}%</span>
  </div>
 </div>

 <div className="flex flex-col items-end gap-1 text-right">
  <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Dernier Test</span>
  <span className="text-sm font-bold text-foreground">{stats.lastDrillStr}</span>

  {stats.lastDrillResult && (
  <div className={`mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${stats.lastDrillResult === 'Succès' ? 'bg-success-bg text-success-text border-success-border dark:bg-success/10 dark:border-success/20' : 'bg-error-bg text-error-text border-error-border dark:bg-error/10 dark:border-error/20'}`}>
  {stats.lastDrillResult === 'Succès' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
  {stats.lastDrillResult}
  </div>
  )}
  {!stats.lastDrillResult && (
  <div className="mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
  <CalendarClock className="w-3 h-3" />
  À Planifier
  </div>
  )}
 </div>
 </div>
 </div>
 );
};
