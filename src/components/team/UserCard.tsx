import React from 'react';
import { useLocale } from '../../hooks/useLocale';
import { UserProfile } from '../../types';
import { Edit, Trash2, Mail, Timer, Building, Clock } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { RoleBadge } from '../ui/RoleBadge';
import { getDefaultAvatarUrl } from '../../utils/avatarUtils';

interface UserCardProps {
 user: UserProfile;
 canAdmin: boolean;
 onEdit: (u: UserProfile) => void;
 onDelete: (u: UserProfile) => void;
}

export const UserCard = React.memo(({ user, canAdmin, onEdit, onDelete }: UserCardProps) => {
 const { t } = useLocale();
 const handleEdit = React.useCallback(() => onEdit(user), [onEdit, user]);
 const deleteGuardRef = React.useRef(false);
 const handleDelete = React.useCallback(() => {
  if (deleteGuardRef.current) return;
  deleteGuardRef.current = true;
  onDelete(user);
  setTimeout(() => { deleteGuardRef.current = false; }, 2000);
 }, [onDelete, user]);

 return (
 <div className={`glass-premium rounded-3xl p-6 flex flex-col items-center text-center card-hover group relative border border-border/40 ${user.isPending ? 'border-dashed border-border/40 bg-muted/50' : ''}`}>
 {canAdmin && (
 <div className="absolute top-4 right-4 flex gap-2 opacity-70 md:opacity-0 md:group-hover:opacity-70 transition-opacity">
  {!user.isPending && (
  <CustomTooltip content={t('team.actions.edit')}>
  <button
  type="button"
  onClick={handleEdit}
  className="p-2.5 bg-card rounded-2xl text-muted-foreground hover:text-primary dark:hover:text-primary/70 shadow-apple-sm hover:scale-110 transition-all border border-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
  aria-label={t('team.actions.edit')}
  >
  <Edit className="h-4 w-4" />
  </button>
  </CustomTooltip>
  )}
  <CustomTooltip content={user.isPending ? t('team.delete.titleInvite').replace('?', '') : t('team.actions.delete')}>
  <button
  type="button"
  onClick={() => confirm("Confirmer la suppression ?") && handleDelete()}
  className="p-2.5 bg-card rounded-2xl text-muted-foreground hover:text-error-text shadow-apple-sm hover:scale-110 transition-all border border-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
  aria-label={t('team.actions.delete')}
  >
  <Trash2 className="h-4 w-4" />
  </button>
  </CustomTooltip>
 </div>
 )}

 <div className="relative mb-4 mt-2">
 {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
 <img alt={user.displayName}
  src={getDefaultAvatarUrl(user.role)}
  loading="lazy"
  className={`w-24 h-24 rounded-full object-cover shadow-xl ring-4 ring-white dark:ring-slate-800 ${user.isPending ? 'opacity-60 grayscale' : ''}`}
  onError={(e) => {
  const target = e.target as HTMLImageElement;
  const fallback = getDefaultAvatarUrl(user.role);
  if (target.src !== fallback) {
  target.src = fallback;
  }
  }}
 />
 <div className="absolute bottom-0 right-0 transform translate-x-2 translate-y-1">
  <RoleBadge role={user.role} />
 </div>
 </div>

 <h3 className="text-lg font-bold text-foreground mb-1">{user.displayName}</h3>
 <div className="flex items-center text-xs font-medium text-muted-foreground mb-4 bg-muted px-3 py-1 rounded-full">
 <Mail className="h-3 w-3 mr-1.5 opacity-70" /> {user.email}
 </div>

 {user.isPending ? (
 <div className="w-full pt-4 border-t border-dashed border-border flex justify-center items-center text-xs mt-auto">
  <div className="flex items-center text-warning-text font-black uppercase tracking-widest bg-warning-bg px-4 py-2 rounded-2xl shadow-sm border border-warning-border/30">
  <Timer className="h-3.5 w-3.5 mr-2" />
  {t('team.invite.success').split(' ')[0]} {t('team.stats.pending')}
  </div>
 </div>
 ) : (
 <div className="w-full pt-4 border-t border-dashed border-border/40 flex justify-between items-center text-xs mt-auto">
  <div className="flex items-center text-muted-foreground font-medium">
  <Building className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
  {user.department || t('team.defaultDepartment', { defaultValue: 'Général' })}
  </div>
  {user.lastLogin && (
  <div className="flex items-center text-muted-foreground font-medium" title={t('team.columns.lastLogin')}>
  <Clock className="h-3.5 w-3.5 mr-1.5" />
  {new Date(user.lastLogin).toLocaleDateString('fr-FR')}
  </div>
  )}
 </div>
 )}
 </div>
 );
});
