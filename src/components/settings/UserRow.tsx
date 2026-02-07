import { memo } from 'react';
import { UserProfile, Organization } from '../../types';
import { Star, RefreshCw, Trash2, Loader2 } from '../ui/Icons';
import { CustomSelect } from '../ui/CustomSelect';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { hasPermission } from '../../utils/permissions';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

interface UserRowProps {
 user: UserProfile;
 currentUser: UserProfile;
 currentOrg: Organization | null;
 updating: boolean;
 onUpdateRole: (uid: string, role: UserProfile['role']) => void;
 onTransfer: (uid: string) => void;
 onRemove: (uid: string) => void;
 t: (key: string) => string;
}

export const UserRow = memo(({ user, currentUser, currentOrg, updating, onUpdateRole, onTransfer, onRemove, t }: UserRowProps) => {
 return (
 <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/40 dark:hover:bg-muted dark:hover:bg-muted transition-colors backdrop-blur-[2px]">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-full bg-muted/50 flex-shrink-0 flex items-center justify-center text-muted-foreground font-bold border border-white/40 shadow-sm overflow-hidden">
  <img alt={user.displayName || 'Avatar'}
  src={getUserAvatarUrl(user.photoURL, user.role)}
  className="w-full h-full rounded-full object-cover"
  />
 </div>
 <div className="min-w-0">
  <div className="flex items-center gap-2 flex-wrap">
  <p className="font-semibold text-foreground truncate">
  {user.displayName}
  </p>
  {currentOrg?.ownerId === user.uid && (
  <span className="px-2 py-0.5 text-xs font-bold bg-warning-bg text-warning-text rounded-full flex items-center gap-1 border border-warning-border/20">
  <Star size={10} />
  {t('settings.owner')}
  </span>
  )}
  {user.uid === currentUser?.uid && (
  <span className="px-2 py-0.5 text-xs font-medium bg-muted/50 text-muted-foreground/50 rounded-full border border-border/40">
  {t('settings.you')}
  </span>
  )}
  </div>
  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
 </div>
 </div>

 <div className="flex items-center gap-3 self-end sm:self-auto">
 <div className="w-40">
  <CustomSelect
  value={user.role}
  onChange={(val) => onUpdateRole(user.uid, val as UserProfile['role'])}
  options={[
  { value: 'admin', label: t('settings.roles.admin') },
  { value: 'rssi', label: t('settings.roles.rssi') },
  { value: 'auditor', label: t('settings.roles.auditor') },
  { value: 'project_manager', label: t('settings.roles.project_manager') },
  { value: 'direction', label: t('settings.roles.direction') },
  { value: 'user', label: t('settings.roles.user') }
  ]}
  disabled={user.uid === currentUser.uid || currentOrg?.ownerId === user.uid || updating}
  label={t('settings.role')}
  />
 </div>

 <div className="flex items-center border-l border-white/20 pl-3 gap-1">
  {/* Transfer Ownership Button (Only for Owner) */}
  {currentOrg?.ownerId === currentUser?.uid && user.uid !== currentUser?.uid && (
  <button
  onClick={() => onTransfer(user.uid)}
  className="p-2 text-muted-foreground hover:text-warning hover:bg-warning-bg rounded-lg transition-colors"
  title={t('settings.transferOwnership')}
  aria-label={t('settings.transferOwnership')}
  type="button"
  >
  <RefreshCw size={16} />
  </button>
  )}

  {/* Remove Member Button */}
  {(hasPermission(currentUser, 'User', 'manage') || currentOrg?.ownerId === currentUser?.uid) && user.uid !== currentUser?.uid && currentOrg?.ownerId !== user.uid && (
  <button
  onClick={() => onRemove(user.uid)}
  disabled={updating}
  className="p-2 text-muted-foreground hover:text-destructive hover:bg-error-bg rounded-lg transition-colors disabled:bg-muted disabled:text-muted-foreground"
  title={t('settings.removeMember')}
  aria-label={t('settings.removeMember')}
  type="button"
  >
  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
  </button>
  )}
 </div>
 </div>
 </div>
 );
});
