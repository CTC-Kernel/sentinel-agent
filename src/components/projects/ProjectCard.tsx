
import React from 'react';
import { Project, UserProfile } from '../../types';
import { Badge } from '../ui/Badge';
import { Edit, Trash2, CheckSquare } from '../ui/Icons';
import { canDeleteResource } from '../../utils/permissions';

interface ProjectCardProps {
    project: Project;
    canEdit: boolean;
    user: UserProfile | null;
    onEdit: (project: Project) => void;
    onDelete: (id: string, name: string) => void;
    onClick: (project: Project) => void;
    onDuplicate: (project: Project) => void;
    compact?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
    project, canEdit, user, onEdit, onDelete, onClick, onDuplicate, compact
}) => {
    return (
        <div onClick={() => onClick(project)} className={`glass-panel rounded-[2.5rem] ${compact ? 'p-4 rounded-2xl' : 'p-6'} card-hover flex flex-col cursor-pointer group border border-white/50 dark:border-white/5`}>
            <div className="flex justify-between items-start mb-4">
                <Badge
                    status={project.status === 'En cours' ? 'info' : project.status === 'Terminé' ? 'success' : project.status === 'Suspendu' ? 'error' : 'neutral'}
                    variant="soft"
                >
                    {project.status}
                </Badge>
                {!compact && (
                    <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onDuplicate(project); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-500 hover:text-brand-500 shadow-sm backdrop-blur-sm transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onEdit(project); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-500 hover:text-indigo-500 shadow-sm backdrop-blur-sm transition-colors">
                                    <Edit className="h-4 w-4" />
                                </button>
                                {canDeleteResource(user, 'Project') && (
                                    <button onClick={(e) => { e.stopPropagation(); onDelete(project.id, project.name); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-500 hover:text-red-500 shadow-sm backdrop-blur-sm transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            <h3 className={`font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 ${compact ? 'text-base' : 'text-lg'}`}>{project.name}</h3>
            {!compact && <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-2 h-10 leading-relaxed">{project.description}</p>}

            <div className={compact ? "mb-4" : "mb-6"}>
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-600 dark:text-slate-300">Avancement</span>
                    <span className="text-brand-600">{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5">
                    <div className="bg-brand-500 h-1.5 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${project.progress}%` }}></div>
                </div>
            </div>

            <div className="flex items-center text-xs text-slate-600 mb-auto space-x-4 pt-2 mt-auto">
                <div className="flex items-center font-medium ml-auto">
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    {project.tasks?.length || 0}
                </div>
            </div>
        </div>
    );
};
