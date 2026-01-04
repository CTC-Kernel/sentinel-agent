import React from 'react';
import { FolderKanban } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { Asset } from '../../../types';

interface AssetInspectorProjectsProps {
    selectedAsset: Asset;
    linkedProjects: any[]; // Ideally Project[]
}

export const AssetInspectorProjects: React.FC<AssetInspectorProjectsProps> = ({
    linkedProjects
}) => {
    return (
        <div className="space-y-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center">
                <FolderKanban className="h-4 w-4 mr-2" /> Projets Liés ({linkedProjects.length})
            </h3>
            {linkedProjects.length === 0 ? (
                <EmptyState compact icon={FolderKanban} title="Aucun projet" description="Aucun projet associé." />
            ) : (
                <div className="grid gap-4">
                    {linkedProjects.map(proj => (
                        <div key={proj.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{proj.name}</span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${proj.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {proj.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{proj.description}</p>
                            <div className="flex items-center justify-between">
                                <div className="w-full bg-slate-200 rounded-full h-1.5 mr-4 max-w-[100px]">
                                    <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${proj.progress}%` }}></div>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{proj.progress}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
