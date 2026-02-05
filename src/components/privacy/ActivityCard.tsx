import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Scale, GlobeLock, Clock, CheckCircle2, Trash2 } from '../ui/Icons';
import { slideUpVariants } from '../ui/animationVariants';
import { ProcessingActivity } from '../../types';
import { ConfirmModal } from '../ui/ConfirmModal'; // Keyboard: Escape key supported
import { useStore } from '../../store';

interface ActivityCardProps {
 activity: ProcessingActivity;
 onClick: (activity: ProcessingActivity) => void;
 onDelete: (id: string, name: string) => void;
 canEdit: boolean;
}

export const ActivityCard = React.memo(({ activity, onClick, onDelete, canEdit }: ActivityCardProps) => {
 const { t } = useStore();
 const [showConfirmDelete, setShowConfirmDelete] = useState(false); // confirmDialog via ConfirmModal
 return (
 <motion.div
 variants={slideUpVariants}
 onClick={() => onClick(activity)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
  e.preventDefault();
  onClick(activity);
 }
 }}
 role="button"
 tabIndex={0}
 className="glass-premium rounded-3xl p-7 shadow-sm card-hover flex flex-col relative overflow-hidden cursor-pointer group border border-border/40 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
 <div className="flex justify-between items-start mb-5">
 <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 shadow-inner">
  <Fingerprint className="h-6 w-6" />
 </div>
 <span className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${activity.status === 'Actif' ? 'bg-green-50 text-green-700 dark:text-green-400 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground border-border/40 dark:bg-white/5 '}`}>
  {activity.status}
 </span>
 </div>

 <h3 className="text-lg font-bold text-foreground mb-2 leading-tight">{activity.name}</h3>
 <p className="text-sm text-muted-foreground mb-6 line-clamp-2 flex-1 leading-relaxed">{activity.purpose}</p>

 <div className="space-y-3 pt-5 border-t border-dashed border-border/40">
 <div className="flex items-center justify-between">
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center"><Scale className="h-3 w-3 mr-1.5" />{t('privacy.card.legalBasis', { defaultValue: 'Base Légale' })}</span>
  <span className="text-xs font-bold text-foreground bg-muted px-2 py-1 rounded-lg">{activity.legalBasis}</span>
 </div>
 <div className="flex items-center justify-between">
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center"><GlobeLock className="h-3 w-3 mr-1.5" />{t('privacy.card.categories', { defaultValue: 'Catégories' })}</span>
  <span className="text-xs font-medium text-muted-foreground truncate max-w-[150px]">
  {activity.dataCategories.length > 0 ? activity.dataCategories.join(', ') : '-'}
  </span>
 </div>
 <div className="flex items-center justify-between">
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center"><Clock className="h-3 w-3 mr-1.5" />{t('privacy.card.retention', { defaultValue: 'Conservation' })}</span>
  <span className="text-xs font-medium text-muted-foreground">{activity.retentionPeriod}</span>
 </div>
 </div>

 {activity.hasDPIA && (
 <div className="mt-5 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 py-2 rounded-3xl text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30">
  <CheckCircle2 className="h-3 w-3 mr-1.5" /> {t('privacy.card.dpiaCompleted', { defaultValue: 'DPIA Effectué' })}
 </div>
 )}

 {canEdit && (
 <div className="absolute top-6 right-6 flex gap-2 opacity-70 md:opacity-0 md:group-hover:opacity-70 transition-opacity">
  <button
  aria-label="Delete"
  onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(true); }}
  className="p-2 bg-card/80 rounded-3xl text-muted-foreground hover:text-red-500 shadow-sm backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  <Trash2 className="h-4 w-4" />
  </button>
 </div>
 )}

 <ConfirmModal
 isOpen={showConfirmDelete}
 onClose={() => setShowConfirmDelete(false)}
 onConfirm={() => onDelete(activity.id, activity.name)}
 title={t('privacy.card.deleteTitle', { defaultValue: "Supprimer l'activité de traitement" })}
 message={t('privacy.card.deleteMessage', { defaultValue: `Êtes-vous sûr de vouloir supprimer "${activity.name}" ?`, name: activity.name })}
 type="danger"
 confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 />
 </motion.div>
 );
});
