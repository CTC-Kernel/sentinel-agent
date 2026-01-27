import React from 'react';
import { FolderKanban, Plus } from '../../ui/Icons';
import { Project } from '../../../types';

interface RiskLinkedProjectsProps {
    linkedProjects: Project[];
    canEdit: boolean;
    onNavigateToProject: () => void;
}

export const RiskLinkedProjects: React.FC<RiskLinkedProjectsProps> = ({
    linkedProjects,
    canEdit,
    onNavigateToProject
}) => {
    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets de Traitement ({linkedProjects.length})</h3>
                {canEdit && (
                    <button
                        aria-label="Créer un nouveau projet lié"
                        onClick={onNavigateToProject}
                        className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-800 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors flex items-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouveau Projet
                    </button>
                )}
            </div>
            <div className="grid gap-4">
                {linkedProjects.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400 italic">Aucun projet.</p> : linkedProjects.map(p => (
                    <div key={p.id} className="glass-panel-lite p-4">{p.name}</div>
                ))}
            </div>
        </div>
    );
};
