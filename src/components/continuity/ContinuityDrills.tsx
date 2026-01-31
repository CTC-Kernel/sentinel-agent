import React from 'react';
import { motion } from 'framer-motion';
import { Zap, CalendarDays, ClipboardCheck, AlertTriangle } from '../ui/Icons';
import { slideUpVariants } from '../ui/animationVariants';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { BusinessProcess, BcpDrill } from '../../types';

interface ContinuityDrillsProps {
    drills: BcpDrill[];
    processes: BusinessProcess[];
    loading: boolean;
    onNewDrill: () => void;
    onDelete?: (id: string) => void;
}

export const ContinuityDrills: React.FC<ContinuityDrillsProps> = ({ drills, processes, loading, onNewDrill }) => {

    if (loading) return <TableSkeleton rows={5} columns={5} />;

    return (
        <motion.div variants={slideUpVariants} initial="initial" animate="visible" className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-4xl border border-border/40 dark:border-border/40 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-50 dark:bg-brand-800 rounded-3xl text-brand-600 dark:text-brand-400">
                        <Zap className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 dark:text-white">Exercices de Crise</h3>
                </div>
                <button
                    onClick={onNewDrill}
                    className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-3xl font-bold transition-all shadow-lg shadow-brand-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-600"
                >
                    <Zap className="h-4 w-4 mr-2" />
                    <span className="font-bold">Nouvel Exercice</span>
                </button>
            </div>

            {drills.length === 0 ? (
                <div className="glass-premium rounded-3xl overflow-hidden shadow-sm border border-border/40">
                    <EmptyState
                        icon={Zap}
                        title="Aucun exercice enregistré"
                        description="Enregistrez vos exercices de crise (Tabletop, Simulation...) pour valider votre PCA."
                    />
                </div>
            ) : (

                <div className="glass-premium rounded-3xl overflow-hidden shadow-sm border border-border/40">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-border/40 dark:border-white/5 text-slate-500 dark:text-slate-300 font-bold uppercase text-[11px] tracking-widest backdrop-blur-sm">
                                <tr>
                                    <th className="px-8 py-5">Date</th>
                                    <th className="px-6 py-5">Processus testé</th>
                                    <th className="px-6 py-5">Type d'exercice</th>
                                    <th className="px-6 py-5">Résultat</th>
                                    <th className="px-6 py-5">Notes / Preuves</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {drills.map(drill => {
                                    const proc = processes.find(p => p.id === drill.processId);
                                    return (
                                        <tr key={drill.id || 'unknown'} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors group">
                                            <td className="px-4 sm:px-8 py-5 text-slate-900 dark:text-white font-bold flex items-center">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-3xl mr-3 shadow-sm border border-border/40 dark:border-white/5 group-hover:scale-110 transition-transform">
                                                    <CalendarDays className="h-4 w-4 text-slate-600" />
                                                </div>
                                                {new Date(drill.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-5 font-medium text-slate-600 dark:text-muted-foreground">
                                                {proc ? proc.name : 'Inconnu'}
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-border/40 dark:border-white/5 shadow-sm">
                                                    {drill.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`flex items-center w-fit px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${drill.result === 'Succès' ? 'bg-green-50 text-green-700 dark:text-green-400 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' : drill.result === 'Échec' ? 'bg-red-50 text-red-700 dark:text-red-400 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30' : 'bg-amber-50 text-amber-700 dark:text-amber-400 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'}`}>
                                                    {drill.result === 'Succès' ? <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
                                                    {drill.result}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-slate-600 dark:text-slate-300 truncate max-w-xs font-medium">{drill.notes}</td>
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
