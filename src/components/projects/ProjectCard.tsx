
import React from 'react';
import { Project, UserProfile } from '../../types';
import { Badge } from '../ui/Badge';
import { Edit, Trash2, CheckSquare, ClipboardList, ShieldCheck, Rocket, Building2, Siren, Target } from '../ui/Icons';
import { canDeleteResource } from '../../utils/permissions';
import { getUserAvatarUrl } from '../../utils/avatarUtils';

const getProjectCategoryStyles = (category: string) => {
 const cat = category?.toLowerCase() || '';
 if (cat.includes('audit')) return { icon: ClipboardList, color: 'text-warning-text', bg: 'bg-warning-bg', border: 'border-warning-border', progress: 'bg-warning' };
 if (cat.includes('conformité') || cat.includes('compliance')) return { icon: ShieldCheck, color: 'text-info-text', bg: 'bg-info-bg', border: 'border-info-border', progress: 'bg-info-text' };
 if (cat.includes('déploiement') || cat.includes('technique')) return { icon: Rocket, color: 'text-success-text', bg: 'bg-success-bg', border: 'border-success-border', progress: 'bg-success' };
 if (cat.includes('gouvernance')) return { icon: Building2, color: 'text-primary', bg: 'bg-primary/10 dark:bg-primary/20', border: 'border-primary/20 dark:border-primary/50', progress: 'bg-primary' };
 if (cat.includes('crise')) return { icon: Siren, color: 'text-error-text', bg: 'bg-error-bg', border: 'border-error-border', progress: 'bg-destructive' };
 return { icon: Target, color: 'text-muted-foreground', bg: 'bg-muted/50 dark:bg-white/5', border: 'border-border/40', progress: 'bg-primary' };
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
 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-primary-foreground bg-foreground rounded opacity-0 group-hover/tooltip:opacity-70 pointer-events-none transition-opacity whitespace-nowrap z-tooltip">
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
 className={`glass-premium rounded-3xl ${compact ? 'p-4 rounded-2xl' : 'p-6'} card-hover flex flex-col cursor-pointer group border border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
 >
 <div className="flex justify-between items-start mb-4">
 <div className="flex items-center gap-3">
  <div className={`p-2 rounded-3xl border shadow-sm ${getProjectCategoryStyles(project.category || '').bg} ${getProjectCategoryStyles(project.category || '').color} ${getProjectCategoryStyles(project.category || '').border} transition-transform group-hover:scale-110`}>
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
   <button onClick={(e) => { e.stopPropagation(); onDuplicate(project); }} className="p-1.5 bg-card/80 rounded-lg text-muted-foreground hover:text-primary shadow-sm backdrop-blur-sm transition-colors border border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Dupliquer le projet ${project.name}`}>
   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
   </button>
  </ProjectCardTooltip>
  <ProjectCardTooltip content="Modifier">
   <button onClick={(e) => { e.stopPropagation(); onEdit(project); }} className="p-1.5 bg-card/80 rounded-lg text-muted-foreground hover:text-primary shadow-sm backdrop-blur-sm transition-colors border border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
   <Edit className="h-3.5 w-3.5" />
   </button>
  </ProjectCardTooltip>
  {canDeleteResource(user, 'Project') && (
   <ProjectCardTooltip content={isDeleting ? "Suppression..." : "Supprimer"}>
   <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={isDeleting} className="p-1.5 bg-card/80 rounded-lg text-muted-foreground hover:text-destructive shadow-sm backdrop-blur-sm transition-colors border border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed disabled:border-muted" aria-label={`Supprimer le projet ${project.name}`}>
   <Trash2 className="h-3.5 w-3.5" />
   </button>
   </ProjectCardTooltip>
  )}
  </>
  )}
  </div>
 )}
 </div>

 <h3 className={`font-bold text-foreground mb-2 line-clamp-1 ${compact ? 'text-base' : 'text-lg'}`}>{project.name}</h3>
 {!compact && <p className="text-sm text-muted-foreground mb-6 line-clamp-2 h-10 leading-relaxed">{project.description}</p>}

 <div className={compact ? "mb-4" : "mb-6"}>
 <div className="flex justify-between text-xs mb-1.5 font-medium">
  <span className="text-muted-foreground">Avancement</span>
  <span className={getProjectCategoryStyles(project.category || '').color}>{project.progress}%</span>
 </div>
 <div className="w-full bg-muted rounded-full h-1.5">
  <div className={`${getProjectCategoryStyles(project.category || '').progress} h-1.5 rounded-full transition-all duration-500 shadow-sm shadow-black/5`} style={{ width: `${project.progress}%` }}></div>
 </div>
 </div>

 <div className="flex items-center text-xs text-muted-foreground mb-auto space-x-4 pt-2 mt-auto justify-between">
 {/* Team Members Stack */}
 <div className="flex -space-x-2">
  {displayMembers.length > 0 ? (
  <>
  {displayMembers.map(m => (
  <ProjectCardTooltip key={m.uid || 'unknown'} content={m.displayName || m.email}>
   <div className="relative">
   <img alt={m.displayName || 'Membre'}
   src={getUserAvatarUrl(m.photoURL, m.role)}
   className="w-6 h-6 rounded-full border-2 border-white dark:border-card object-cover bg-muted"
   />
   </div>
  </ProjectCardTooltip>
  ))}
  {remaining > 0 && (
  <div className="w-6 h-6 rounded-full bg-muted border-2 border-white dark:border-card flex items-center justify-center text-xs font-bold text-muted-foreground">
   +{remaining}
  </div>
  )}
  </>
  ) : (
  <div className="text-muted-foreground text-xs italic">Aucune équipe</div>
  )}
 </div>

 <div className="flex items-center font-medium">
  <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
  {project.tasks?.length || 0}
 </div>
 </div>
 </div>
 );
};
