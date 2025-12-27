import React from 'react';
import { motion } from 'framer-motion';
import { HeartPulse, LayoutDashboard, Server, ClipboardCheck, Edit, Trash2 } from '../ui/Icons';
import { slideUpVariants } from '../ui/animationVariants';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { BusinessProcess } from '../../types';

interface ContinuityBIAProps {
    processes: BusinessProcess[];
    loading: boolean;
    viewMode: 'grid' | 'list';
    onOpenInspector: (proc: BusinessProcess) => void;
    onNewProcess: () => void;
    onDelete?: (id: string) => void;
}

export const ContinuityBIA: React.FC<ContinuityBIAProps> = ({ processes, loading, viewMode, onOpenInspector, onNewProcess, onDelete }) => {

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'Critique': return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30';
            case 'Elevée': return 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/30';
            case 'Moyenne': return 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30';
            default: return 'bg-blue-50 dark:bg-slate-900 text-blue-700 border-blue-100 dark:bg-slate-900/20 dark:text-blue-400 dark:border-blue-900/30';
        }
    };

    if (loading) return <CardSkeleton count={6} />;

    if (processes.length === 0) {
        return (
            <div className="col-span-full">
                <EmptyState
                    icon={HeartPulse}
                    title="Aucun processus défini"
                    description="Commencez par définir vos processus critiques pour l'analyse d'impact (BIA)."
                    actionLabel="Nouveau Processus"
                    onAction={onNewProcess}
                />
            </div>
        );
    }

    if (viewMode === 'list') {
        return (
            <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-white/50 dark:border-white/5 animate-in fade-in duration-500">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-gray-100 dark:border-white/5 text-slate-500 font-bold uppercase text-[10px] tracking-widest backdrop-blur-sm">
                            <tr>
                                <th className="px-8 py-5">Processus</th>
                                <th className="px-6 py-5">Priorité</th>
                                <th className="px-6 py-5">RTO</th>
                                <th className="px-6 py-5">RPO</th>
                                <th className="px-6 py-5">Responsable</th>
                                <th className="px-6 py-5">Dernier Test</th>
                                <th className="px-6 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {processes.map(proc => {
                                const lastTest = proc.lastTestDate ? new Date(proc.lastTestDate) : null;
                                const isOverdue = lastTest ? (new Date().getTime() - lastTest.getTime() > 31536000000) : true;
                                return (
                                    <tr
                                        key={proc.id}
                                        onClick={() => onOpenInspector(proc)}
                                        className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                                        tabIndex={0}
                                        role="button"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                onOpenInspector(proc);
                                            }
                                        }}
                                    >
                                        <td className="px-8 py-5 text-slate-900 dark:text-white font-bold">
                                            {proc.name}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getPriorityColor(proc.priority)}`}>
                                                {proc.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 font-mono text-slate-600 dark:text-slate-300 font-bold">{proc.rto}</td>
                                        <td className="px-6 py-5 font-mono text-slate-600 dark:text-slate-300 font-bold">{proc.rpo}</td>
                                        <td className="px-6 py-5 text-slate-600 dark:text-slate-400">{proc.owner}</td>
                                        <td className="px-6 py-5">
                                            <span className={`font-bold text-xs px-2 py-1 rounded ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {proc.lastTestDate ? new Date(proc.lastTestDate).toLocaleDateString() : 'Jamais'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onOpenInspector(proc); }}
                                                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                    title="Modifier"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                {onDelete && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDelete(proc.id); }}
                                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                                        title="Supprimer"
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
            })}
        </motion.div>
    );
};
