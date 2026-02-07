import React from 'react';
import { Project, UserProfile } from '../../../types';
import { Users } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { getUserAvatarUrl } from '../../../utils/avatarUtils';

interface ProjectTeamProps {
 project: Project;
 usersList: UserProfile[];
}

export const ProjectTeam: React.FC<ProjectTeamProps> = ({ project, usersList }) => {
 const hasMembers = project.members && project.members.length > 0;

 // Safe array access
 const safeUsersList = usersList ?? [];

 return (
 <div className="space-y-4">
 {hasMembers ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {safeUsersList.filter(u => project.members?.includes(u.uid)).map(member => (
  <div key={member.uid || 'unknown'} className="glass-premium p-4 rounded-3xl border border-border/40 flex items-center gap-4 group hover:bg-muted/500 dark:hover:bg-muted/50 transition-colors">
  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-primary/15 to-primary/10 dark:from-primary/40 dark:to-primary/40 text-primary flex items-center justify-center font-bold text-lg border-2 border-white dark:border-white/5 shadow-sm group-hover:scale-110 transition-transform overflow-hidden">
  <img alt={member.displayName}
   src={getUserAvatarUrl(member.photoURL, member.role)}
   className="h-full w-full rounded-full object-cover"
  />
  </div>
  <div className="min-w-0">
  <h4 className="font-bold text-foreground truncate">{member.displayName || 'Utilisateur'}</h4>
  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
  <div className="mt-1.5 inline-flex">
   <Badge variant="soft" status="neutral" className="text-xs px-2 py-0.5 h-auto">{member.role}</Badge>
  </div>
  </div>
  </div>
  ))}
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
  <Users className="h-12 w-12 mb-2 opacity-60" />
  <p>Aucun membre affecté à ce projet.</p>
 </div>
 )}
 </div>
 );
};
