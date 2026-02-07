import React from 'react';
import { motion } from 'framer-motion';
import { Zap, CalendarDays, ClipboardCheck, AlertTriangle } from '../ui/Icons';
import { slideUpVariants } from '../ui/animationVariants';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { BusinessProcess, BcpDrill } from '../../types';
import { useLocale } from '@/hooks/useLocale';

interface ContinuityDrillsProps {
 drills: BcpDrill[];
 processes: BusinessProcess[];
 loading: boolean;
 onNewDrill: () => void;
 onDelete?: (id: string) => void;
}

export const ContinuityDrills: React.FC<ContinuityDrillsProps> = ({ drills, processes, loading, onNewDrill }) => {
 const { t } = useLocale();

 if (loading) return <TableSkeleton rows={5} columns={5} />;

 return (
 <motion.div variants={slideUpVariants} initial="initial" animate="visible" className="space-y-6">
 <div className="flex justify-between items-center bg-card p-4 rounded-4xl border border-border/40 shadow-sm">
 <div className="flex items-center gap-3">
  <div className="p-2 bg-primary/10 dark:bg-primary rounded-3xl text-primary">
  <Zap className="h-5 w-5" />
  </div>
  <h3 className="text-lg font-bold text-foreground dark:text-foreground">{t('continuity.drills.title', { defaultValue: 'Exercices de Crise' })}</h3>
 </div>
 <button
  onClick={onNewDrill}
  className="flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl font-bold transition-all shadow-lg shadow-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
 >
  <Zap className="h-4 w-4 mr-2" />
  <span className="font-bold">{t('continuity.drills.newDrill', { defaultValue: 'Nouvel Exercice' })}</span>
 </button>
 </div>

 {drills.length === 0 ? (
 <div className="glass-premium rounded-3xl overflow-hidden shadow-sm border border-border/40">
  <EmptyState
  icon={Zap}
  title={t('continuity.drills.emptyTitle', { defaultValue: 'Aucun exercice enregistré' })}
  description={t('continuity.drills.emptyDescription', { defaultValue: 'Enregistrez vos exercices de crise (Tabletop, Simulation...) pour valider votre PCA.' })}
  />
 </div>
 ) : (

 <div className="glass-premium rounded-3xl overflow-hidden shadow-sm border border-border/40">
  <div className="overflow-x-auto">
  <table className="w-full text-sm text-left">
  <thead className="bg-muted/50 border-b border-border/40 dark:border-border text-muted-foreground font-bold uppercase text-xs tracking-widest backdrop-blur-sm">
  <tr>
   <th className="px-8 py-5">{t('continuity.drills.date', { defaultValue: 'Date' })}</th>
   <th className="px-6 py-5">{t('continuity.drills.testedProcess', { defaultValue: 'Processus testé' })}</th>
   <th className="px-6 py-5">{t('continuity.drills.exerciseType', { defaultValue: "Type d'exercice" })}</th>
   <th className="px-6 py-5">{t('continuity.drills.result', { defaultValue: 'Résultat' })}</th>
   <th className="px-6 py-5">{t('continuity.drills.notesEvidence', { defaultValue: 'Notes / Preuves' })}</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-border dark:divide-border">
  {drills.map(drill => {
   const proc = processes.find(p => p.id === drill.processId);
   return (
   <tr key={drill.id || 'unknown'} className="hover:bg-muted/40 dark:hover:bg-muted transition-colors group">
   <td className="px-4 sm:px-8 py-5 text-foreground font-bold flex items-center">
   <div className="p-2 bg-card rounded-3xl mr-3 shadow-sm border border-border/40 dark:border-border group-hover:scale-110 transition-transform">
    <CalendarDays className="h-4 w-4 text-muted-foreground" />
   </div>
   {new Date(drill.date).toLocaleDateString('fr-FR')}
   </td>
   <td className="px-6 py-5 font-medium text-muted-foreground">
   {proc ? proc.name : t('continuity.drills.unknown', { defaultValue: 'Inconnu' })}
   </td>
   <td className="px-6 py-5">
   <span className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-bold border border-border/40 dark:border-border shadow-sm">
    {drill.type}
   </span>
   </td>
   <td className="px-6 py-5">
   <span className={`flex items-center w-fit px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${drill.result === 'Succès' ? 'bg-success-bg text-success-text border-success-border' : drill.result === 'Échec' ? 'bg-error-bg text-error-text border-error-border' : 'bg-warning-bg text-warning-text border-warning-border'}`}>
    {drill.result === 'Succès' ? <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
    {drill.result}
   </span>
   </td>
   <td className="px-6 py-5 text-muted-foreground truncate max-w-xs font-medium">{drill.notes}</td>
   </tr>
   )
  })}
  </tbody>
  </table>
  </div>
 </div>
 )}
 </motion.div>
 );
};
