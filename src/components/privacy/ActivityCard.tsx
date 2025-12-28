import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Scale, GlobeLock, Clock, CheckCircle2, Trash2 } from '../ui/Icons';
import { slideUpVariants } from '../ui/animationVariants';
import { ProcessingActivity } from '../../types';
import { ConfirmModal } from '../ui/ConfirmModal'; // Keyboard: Escape key supported

interface ActivityCardProps {
    activity: ProcessingActivity;
    onClick: (activity: ProcessingActivity) => void;
    onDelete: (id: string, name: string) => void;
    canEdit: boolean;
}

export const ActivityCard = React.memo(({ activity, onClick, onDelete, canEdit }: ActivityCardProps) => {
    const [showConfirmDelete, setShowConfirmDelete] = useState(false); // confirmDialog via ConfirmModal
    return (
        <motion.div
            variants={slideUpVariants}
            onClick={() => onClick(activity)}
            className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover flex flex-col relative overflow-hidden cursor-pointer group border border-white/50 dark:border-white/5 hover:border-purple-500/30 transition-all"
        >
            <div className="flex justify-between items-start mb-5">
                <div className="p-3 bg-purple-50 dark:bg-slate-800 rounded-2xl text-purple-600 shadow-inner">
                    <Fingerprint className="h-6 w-6" />
                </div>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${activity.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400' : 'bg-gray-50 text-slate-600 border-gray-100 dark:bg-white/5 dark:border-white/10 dark:text-slate-400'}`}>
                    {activity.status}
                </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{activity.name}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">{activity.purpose}</p>

            <div className="space-y-3 pt-5 border-t border-dashed border-gray-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center"><Scale className="h-3 w-3 mr-1.5" />Base Légale</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">{activity.legalBasis}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center"><GlobeLock className="h-3 w-3 mr-1.5" />Catégories</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                        {activity.dataCategories.length > 0 ? activity.dataCategories.join(', ') : '-'}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center"><Clock className="h-3 w-3 mr-1.5" />Conservation</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{activity.retentionPeriod}</span>
                </div>
            </div>

            {activity.hasDPIA && (
                <div className="mt-5 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30">
                    <CheckCircle2 className="h-3 w-3 mr-1.5" /> DPIA Effectué
                </div>
            )}

            {canEdit && (
                <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        aria-label="Delete"
                        onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(true); }}
                        className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl text-slate-500 hover:text-red-500 shadow-sm backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )}

            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => setShowConfirmDelete(false)}
                onConfirm={() => onDelete(activity.id, activity.name)}
                title="Supprimer l'activité de traitement"
                message={`Êtes-vous sûr de vouloir supprimer "${activity.name}" ?`}
                type="danger"
                confirmText="Supprimer"
                cancelText="Annuler"
            />
        </motion.div>
    );
});
