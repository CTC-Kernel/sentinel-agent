import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HeartPulse, LayoutDashboard, Server, ClipboardCheck, Edit, Trash2 } from '../ui/Icons';
import { slideUpVariants } from '../ui/animationVariants';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { BusinessProcess, UserProfile } from '../../types';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { useLocale } from '@/hooks/useLocale';

interface ContinuityBIAProps {
 processes: BusinessProcess[];
 loading: boolean;
 viewMode: 'grid' | 'list';
 onOpenInspector: (proc: BusinessProcess) => void;
 onNewProcess: () => void;
 onDelete?: (id: string) => void;
 users?: UserProfile[];
}

export const ContinuityBIA: React.FC<ContinuityBIAProps> = ({ processes, loading, viewMode, onOpenInspector, onNewProcess, onDelete, users }) => {
 const { t } = useLocale();
 const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

 const handleDelete = async (id: string) => {
 if (!onDelete || deletingIds.has(id)) return;
 setDeletingIds(prev => new Set(prev).add(id));
 try {
 await onDelete(id);
 } finally {
 setDeletingIds(prev => {
 const next = new Set(prev);
 next.delete(id);
 return next;
 });
 }
 };

 const getPriorityColor = (p: string) => {
 switch (p) {
 case 'Critique': return 'bg-error-bg text-error-text border-error-border';
 case 'Élevée': return 'bg-warning-bg text-warning-text border-warning-border';
 case 'Moyenne': return 'bg-warning-bg/70 text-warning-text border-warning-border/70';
 default: return 'bg-info-bg text-info-text border-info-border';
 }
 };

 if (loading) return <CardSkeleton count={6} />;

 if (processes.length === 0) {
 return (
 <div className="col-span-full">
 <EmptyState
  icon={HeartPulse}
  title={t('continuity.bia.emptyTitle', { defaultValue: 'Aucun processus défini' })}
  description={t('continuity.bia.emptyDescription', { defaultValue: "Commencez par définir vos processus critiques pour l'analyse d'impact (BIA)." })}
  actionLabel={t('continuity.newProcess', { defaultValue: 'Nouveau Processus' })}
  onAction={onNewProcess}
 />
 </div>
 );
 }

 if (viewMode === 'list') {
 return (
 <div className="glass-premium rounded-3xl overflow-hidden shadow-sm border border-border/40 animate-in fade-in duration-500">
 <div className="overflow-x-auto">
  <table className="w-full text-sm text-left">
  <thead className="bg-muted/50 border-b border-border/40 dark:border-white/5 text-muted-foreground font-bold uppercase text-xs tracking-widest backdrop-blur-sm">
  <tr>
  <th className="px-8 py-5">{t('continuity.table.process', { defaultValue: 'Processus' })}</th>
  <th className="px-6 py-5">{t('common.priority', { defaultValue: 'Priorité' })}</th>
  <th className="px-6 py-5">{t('continuity.rto', { defaultValue: 'RTO' })}</th>
  <th className="px-6 py-5">{t('continuity.rpo', { defaultValue: 'RPO' })}</th>
  <th className="px-6 py-5">{t('common.owner', { defaultValue: 'Responsable' })}</th>
  <th className="px-6 py-5">{t('continuity.table.lastTest', { defaultValue: 'Dernier Test' })}</th>
  <th className="px-6 py-5 text-right">{t('common.actions', { defaultValue: 'Actions' })}</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-border dark:divide-white/5">
  {processes.map(proc => {
  const lastTest = proc.lastTestDate ? new Date(proc.lastTestDate) : null;
  const isOverdue = lastTest ? (new Date().getTime() - lastTest.getTime() > 31536000000) : true;
  const ownerUser = users?.find(u => u.displayName === proc.owner || u.email === proc.owner);

  return (
   <tr
   key={proc.id || 'unknown'}
   onClick={() => onOpenInspector(proc)}
   className="hover:bg-white/40 dark:hover:bg-muted transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
   tabIndex={0}
   role="button"
   onKeyDown={(e) => {
   if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
   onOpenInspector(proc);
   }
   }}
   >
   <td className="px-8 py-5 text-foreground font-bold">
   {proc.name}
   </td>
   <td className="px-6 py-5">
   <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border shadow-sm ${getPriorityColor(proc.priority)}`}>
   {proc.priority}
   </span>
   </td>
   <td className="px-6 py-5 font-mono text-muted-foreground font-bold">{proc.rto}</td>
   <td className="px-6 py-5 font-mono text-muted-foreground font-bold">{proc.rpo}</td>
   <td className="px-6 py-5 text-muted-foreground">
   <div className="flex items-center gap-2">
   <img alt={`Avatar de ${proc.owner}`}
    src={getUserAvatarUrl(ownerUser?.photoURL, ownerUser?.role)}
    className="w-5 h-5 rounded-full object-cover bg-muted"
   />
   <span>{proc.owner}</span>
   </div>
   </td>
   <td className="px-6 py-5">
   <span className={`font-bold text-xs px-2 py-1 rounded ${isOverdue ? 'bg-error-bg text-error-text' : 'bg-success-bg text-success-text'}`}>
   {proc.lastTestDate ? new Date(proc.lastTestDate).toLocaleDateString('fr-FR') : t('continuity.never', { defaultValue: 'Jamais' })}
   </span>
   </td>
   <td className="px-6 py-5 text-right">
   <div className="flex items-center justify-end gap-2">
   <button
    onClick={(e) => { e.stopPropagation(); onOpenInspector(proc); }}
    className="p-2 text-muted-foreground hover:text-info-text hover:bg-info-bg rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    title={t('common.edit', { defaultValue: 'Modifier' })}
   >
    <Edit className="h-4 w-4" />
   </button>
   {onDelete && (
    <button
    onClick={(e) => { e.stopPropagation(); handleDelete(proc.id); }}
    disabled={deletingIds.has(proc.id)}
    className="p-2 text-muted-foreground hover:text-destructive hover:bg-error-bg rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed"
    title={deletingIds.has(proc.id) ? t('common.deleting', { defaultValue: 'Suppression...' }) : t('common.delete', { defaultValue: 'Supprimer' })}
    >
    <Trash2 className="h-4 w-4" />
    </button>
   )}
   </div>
   </td>
   </tr>
  );
  })}
  </tbody>
  </table>
 </div>
 </div>
 );
 }

 return (
 <motion.div
 variants={slideUpVariants}
 initial="initial"
 animate="visible"
 className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
 >
 {processes.map(proc => {
 const lastTest = proc.lastTestDate ? new Date(proc.lastTestDate) : null;
 const isOverdue = lastTest ? (new Date().getTime() - lastTest.getTime() > 31536000000) : true; // 1 year
 const ownerUser = users?.find(u => u.displayName === proc.owner || u.email === proc.owner);

 return (
  <div
  key={proc.id || 'unknown'}
  onClick={() => onOpenInspector(proc)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenInspector(proc); } }}
  role="button"
  tabIndex={0}
  aria-label={t('continuity.openProcess', { defaultValue: `Ouvrir le processus ${proc.name}`, name: proc.name })}
  className="glass-premium rounded-3xl p-7 shadow-sm hover:shadow-apple transition-all duration-300 hover:-translate-y-1 relative group flex flex-col cursor-pointer border border-border/40"
  >
  <div className="flex justify-between items-start mb-5">
  <div className="p-3 bg-error-bg rounded-2xl text-error-text shadow-inner">
  <HeartPulse className="h-6 w-6" />
  </div>
  <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border shadow-sm ${getPriorityColor(proc.priority)}`}>
  {proc.priority}
  </span>
  </div>

  <h3 className="text-lg font-bold text-foreground mb-2 leading-tight">{proc.name}</h3>
  <p className="text-sm text-muted-foreground mb-6 line-clamp-2 flex-1 leading-relaxed">{proc.description}</p>

  <div className="grid grid-cols-2 gap-4 mb-6">
  <div className="bg-muted/50 p-3 rounded-2xl border border-border/40 dark:border-white/5 text-center">
  <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">{t('continuity.rtoTime', { defaultValue: 'RTO (Temps)' })}</span>
  <span className="text-3xl font-black text-foreground dark:text-white">{proc.rto}</span>
  </div>
  <div className="bg-muted/50 p-3 rounded-2xl border border-border/40 dark:border-white/5 text-center">
  <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">{t('continuity.rpoData', { defaultValue: 'RPO (Données)' })}</span>
  <span className="text-3xl font-black text-foreground dark:text-white">{proc.rpo}</span>
  </div>
  </div>

  <div className="space-y-3 pt-4 border-t border-dashed border-border/40">
  <div className="flex items-center justify-between text-xs">
  <span className="flex items-center font-bold text-muted-foreground uppercase tracking-wide"><LayoutDashboard className="h-3 w-3 mr-1.5" /> {t('common.owner', { defaultValue: 'Responsable' })}</span>
  <span className="font-bold text-foreground truncate max-w-[150px] flex items-center gap-2">
   <img alt={`Avatar de ${proc.owner}`}
   src={getUserAvatarUrl(ownerUser?.photoURL, ownerUser?.role)}
   className="w-4 h-4 rounded-full object-cover bg-muted"
   />
   {proc.owner}
  </span>
  </div>
  <div className="flex items-center justify-between text-xs">
  <span className="flex items-center font-bold text-muted-foreground uppercase tracking-wide"><Server className="h-3 w-3 mr-1.5" /> {t('common.dependencies', { defaultValue: 'Dépendances' })}</span>
  <span className="font-bold text-foreground">{proc.supportingAssetIds?.length || 0} {t('continuity.assets', { defaultValue: 'actifs' })}</span>
  </div>
  <div className="flex items-center justify-between text-xs">
  <span className="flex items-center font-bold text-muted-foreground uppercase tracking-wide"><ClipboardCheck className="h-3 w-3 mr-1.5" /> {t('continuity.table.lastTest', { defaultValue: 'Dernier Test' })}</span>
  <span className={`font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-error-bg text-error-text' : 'bg-success-bg text-success-text'}`}>
   {proc.lastTestDate ? new Date(proc.lastTestDate).toLocaleDateString('fr-FR') : t('continuity.never', { defaultValue: 'Jamais' })}
  </span>
  </div>
  </div>
  </div>
 )
 })}
 </motion.div>
 );
};
