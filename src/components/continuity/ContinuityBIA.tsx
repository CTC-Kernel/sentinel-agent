import React from 'react';
import { motion } from 'framer-motion';
import { HeartPulse, LayoutDashboard, Server, ClipboardCheck } from '../ui/Icons';
import { slideUpVariants } from '../ui/animationVariants';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { BusinessProcess } from '../../types';

interface ContinuityBIAProps {
    processes: BusinessProcess[];
    loading: boolean;
    onOpenInspector: (proc: BusinessProcess) => void;
    onNewProcess: () => void;
}

export const ContinuityBIA: React.FC<ContinuityBIAProps> = ({ processes, loading, onOpenInspector, onNewProcess }) => {

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'Critique': return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30';
            case 'Elevée': return 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/30';
            case 'Moyenne': return 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30';
            default: return 'bg-blue-50 dark:bg-slate-900 text-blue-700 border-blue-100 dark:bg-slate-900/20 dark:text-blue-400 dark:border-blue-900/30';
        }
    };

    return (
        <motion.div variants={slideUpVariants} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
                <CardSkeleton count={6} />
            ) : processes.length === 0 ? (
                <div className="col-span-full">
                    <EmptyState
                        icon={HeartPulse}
                        title="Aucun processus défini"
                        description="Commencez par définir vos processus critiques pour l'analyse d'impact (BIA)."
                        actionLabel="Nouveau Processus"
                        onAction={onNewProcess}
                    />
                </div>
            ) : (
                processes.map(proc => {
                    const lastTest = proc.lastTestDate ? new Date(proc.lastTestDate) : null;
                    const isOverdue = lastTest ? (new Date().getTime() - lastTest.getTime() > 31536000000) : true; // 1 year

                    return (
                        <div key={proc.id} onClick={() => onOpenInspector(proc)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm hover:shadow-apple transition-all duration-300 hover:-translate-y-1 relative group flex flex-col cursor-pointer border border-white/50 dark:border-white/5">
                            <div className="flex justify-between items-start mb-5">
                                <div className="p-3 bg-rose-50 dark:bg-slate-800 rounded-2xl text-rose-600 shadow-inner">
                                    <HeartPulse className="h-6 w-6" />
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getPriorityColor(proc.priority)}`}>
                                    {proc.priority}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{proc.name}</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">{proc.description}</p>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-white/5 text-center">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">RTO (Temps)</span>
                                    <span className="text-3xl font-black text-slate-800 dark:text-white">{proc.rto}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-white/5 text-center">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">RPO (Données)</span>
                                    <span className="text-3xl font-black text-slate-800 dark:text-white">{proc.rpo}</span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-dashed border-gray-200 dark:border-white/10">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center font-bold text-slate-500 uppercase tracking-wide"><LayoutDashboard className="h-3 w-3 mr-1.5" /> Responsable</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{proc.owner}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center font-bold text-slate-500 uppercase tracking-wide"><Server className="h-3 w-3 mr-1.5" /> Dépendances</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{proc.supportingAssetIds?.length || 0} actifs</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center font-bold text-slate-500 uppercase tracking-wide"><ClipboardCheck className="h-3 w-3 mr-1.5" /> Dernier Test</span>
                                    <span className={`font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                        {proc.lastTestDate ? new Date(proc.lastTestDate).toLocaleDateString() : 'Jamais'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })
            )}
        </motion.div>
    );
};
