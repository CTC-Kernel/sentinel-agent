import React from 'react';
import { Project } from '../../../types';
import { Server, ShieldAlert, ClipboardCheck } from '../../ui/Icons';

interface ProjectOverviewProps {
    project: Project;
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({ project }) => {
    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Objectif</h3>
                <div className="glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <p className="relative z-10 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {project.description || "Aucune description disponible."}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-900/20 pointer-events-none" />
                    <div className="relative z-10">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600/80 mb-4 flex items-center gap-2">
                            <Server className="h-4 w-4" /> Actifs Concernés
                        </h4>
                        <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">{project.relatedAssetIds?.length || 0}</div>
                    </div>
                </div>
                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/20 pointer-events-none" />
                    <div className="relative z-10">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-red-600/80 mb-4 flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4" /> Risques Traités
                        </h4>
                        <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">{project.relatedRiskIds?.length || 0}</div>
                    </div>
                </div>
                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/20 pointer-events-none" />
                    <div className="relative z-10">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600/80 mb-4 flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4" /> Contrôles Implémentés
                        </h4>
                        <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">{project.relatedControlIds?.length || 0}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
