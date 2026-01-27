
import React from 'react';
import { Project, UserProfile } from '../../types';
import { Badge } from '../ui/Badge';
import { Edit, Trash2, CheckSquare, ClipboardList, ShieldCheck, Rocket, Building2, Siren, Target } from '../ui/Icons';
import { canDeleteResource } from '../../utils/permissions';
import { getUserAvatarUrl } from '../../utils/avatarUtils';

const getProjectCategoryStyles = (category: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('audit')) return { icon: ClipboardList, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-2000', progress: 'bg-amber-500' };
    if (cat.includes('conformité') || cat.includes('compliance')) return { icon: ShieldCheck, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-2000', progress: 'bg-blue-500' };
    if (cat.includes('déploiement') || cat.includes('technique')) return { icon: Rocket, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/50', progress: 'bg-emerald-500' };
    if (cat.includes('gouvernance')) return { icon: Building2, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/50', progress: 'bg-indigo-500' };
    if (cat.includes('crise')) return { icon: Siren, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-2000', progress: 'bg-red-500' };
    return { icon: Target, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-white/5', border: 'border-slate-100 dark:border-white/10', progress: 'bg-brand-500' };
};

interface ProjectCardProps {
    project: Project;
    canEdit: boolean;
    user: UserProfile | null;
    usersList?: UserProfile[]; // Made optional to avoid immediate break
    onEdit: (project: Project) => void;
    onDelete: (id: string, name: string) => void;
    onClick: (project: Project) => void;
    onDuplicate: (project: Project) => void;
    compact?: boolean;
}

const ProjectCardTooltip = ({ content, children }: { content: string, children: React.ReactNode }) => (
    <div className="group/tooltip relative">
        {children}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-slate-900 rounded opacity-0 group-hover/tooltip:opacity-70 pointer-events-none transition-opacity whitespace-nowrap z-50">
            {content}
        </div>
    </div>
);

export const ProjectCard: React.FC<ProjectCardProps> = ({
    project, canEdit, user, usersList = [], onEdit, onDelete, onClick, onDuplicate, compact
}) => {
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleDelete = async () => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await onDelete(project.id, project.name);
        } finally {
            setIsDeleting(false);
        }
    };

    // Calculate members
    const memberIds = project.members || [];
    const members = usersList.filter(u => memberIds.includes(u.uid));
    const displayMembers = members.slice(0, 3);
    const remaining = members.length - 3;

    return (
        <div
            onClick={() => onClick(project)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick(project);
                }
            }}
            role="button"
            tabIndex={0}
            className={`glass-panel rounded-3xl ${compact ? 'p-4 rounded-2xl' : 'p-6'} card-hover flex flex-col cursor-pointer group border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border shadow-sm ${getProjectCategoryStyles(project.category || '').bg} ${getProjectCategoryStyles(project.category || '').color} ${getProjectCategoryStyles(project.category || '').border} transition-transform group-hover:scale-110`}>
                        {React.createElement(getProjectCategoryStyles(project.category || '').icon, { className: "h-5 w-5" })}
                    </div>
                    <Badge
                        status={project.status === 'En cours' ? 'info' : project.status === 'Terminé' ? 'success' : project.status === 'Suspendu' ? 'error' : 'neutral'}
                        variant="soft"
                    >
                        {project.status}
                    </Badge>
                </div>
                {!compact && (
                    <div className="flex space-x-1">
                        {canEdit && (
                            <>
                                <ProjectCardTooltip content="Dupliquer">
                                    <button onClick={(e) => { e.stopPropagation(); onDuplicate(project); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-500 dark:text-slate-400 hover:text-brand-500 shadow-sm backdrop-blur-sm transition-colors border border-slate-200 dark:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`Dupliquer le projet ${project.name}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                    </button>
                                </ProjectCardTooltip>
                                <ProjectCardTooltip content="Modifier">
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(project); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-500 shadow-sm backdrop-blur-sm transition-colors border border-slate-200 dark:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                        <Edit className="h-3.5 w-3.5" />
                                    </button>
                                </ProjectCardTooltip>
                                {canDeleteResource(user, 'Project') && (
                                    <ProjectCardTooltip content={isDeleting ? "Suppression..." : "Supprimer"}>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={isDeleting} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-500 shadow-sm backdrop-blur-sm transition-colors border border-slate-200 dark:border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600" aria-label={`Supprimer le projet ${project.name}`}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </ProjectCardTooltip>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            <h3 className={`font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 ${compact ? 'text-base' : 'text-lg'}`}>{project.name}</h3>
            {!compact && <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 line-clamp-2 h-10 leading-relaxed">{project.description}</p>}

            <div className={compact ? "mb-4" : "mb-6"}>
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-600 dark:text-muted-foreground">Avancement</span>
                    <span className={getProjectCategoryStyles(project.category || '').color}>{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                    <div className={`${getProjectCategoryStyles(project.category || '').progress} h-1.5 rounded-full transition-all duration-500 shadow-sm shadow-black/5`} style={{ width: `${project.progress}%` }}></div>
                </div>
            </div>

            <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 mb-auto space-x-4 pt-2 mt-auto justify-between">
                {/* Team Members Stack */}
                <div className="flex -space-x-2">
                    {displayMembers.length > 0 ? (
                        <>
                            {displayMembers.map(m => (
                                <ProjectCardTooltip key={m.uid} content={m.displayName || m.email}>
                                    <img
                                        src={getUserAvatarUrl(m.photoURL, m.role)}
                                        alt={m.displayName || 'Membre'}
                                        className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 object-cover bg-slate-100 dark:bg-slate-800"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = getUserAvatarUrl(null, m.role);
                                        }}
                                    />
                                </ProjectCardTooltip>
                            ))}
                            {remaining > 0 && (
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[11px] font-bold text-slate-500">
                                    +{remaining}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-slate-400 text-[11px] italic">Aucune équipe</div>
                    )}
                </div>

                <div className="flex items-center font-medium">
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    {project.tasks?.length || 0}
                </div>
            </div>
        </div>
    );
};
