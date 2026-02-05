import React from 'react';
import { UserProfile } from '../../types';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { Role, getRoleName } from '../../utils/permissions';
import { Save, X, Edit } from '../ui/Icons';
import { useLocale } from '@/hooks/useLocale';

interface UserRowProps {
 user: UserProfile;
 currentUser: UserProfile | null;
 isEditing: boolean;
 selectedRole: Role;
 onEditStart: (uid: string, role: Role) => void;
 onEditCancel: () => void;
 onRoleChange: (role: Role) => void;
 onSave: (uid: string, role: Role) => void;
}

export const UserRow: React.FC<UserRowProps> = ({
 user,
 currentUser,
 isEditing,
 selectedRole,
 onEditStart,
 onEditCancel,
 onRoleChange,
 onSave
}) => {
 const { config } = useLocale();
 return (
 <tr className="hover:bg-muted/50 dark:hover:bg-white/5 transition-colors">
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center gap-3">
  <img
  alt={user.displayName || 'User'}
  src={getUserAvatarUrl(user.photoURL, user.role)}
  className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-800"
  />
  <div>
  <div className="text-sm font-bold text-foreground">
  {user.displayName}
  </div>
  {user.department && (
  <div className="text-xs text-muted-foreground">
  {user.department}
  </div>
  )}
  </div>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
 {user.email}
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 {isEditing ? (
  <select
  value={selectedRole}
  onChange={(e) => onRoleChange(e.target.value as Role)}
  className="px-3 py-1.5 bg-card border border-border/40 rounded-lg text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus-visible:ring-primary"
  >
  <option value="admin">Administrateur</option>
  <option value="rssi">RSSI</option>
  <option value="auditor">Auditeur</option>
  <option value="project_manager">Chef de Projet</option>
  <option value="direction">Direction</option>
  <option value="user">Utilisateur</option>
  </select>
 ) : (
  <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold">
  {getRoleName(user.role as Role)}
  </span>
 )}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
 {user.lastLogin
  ? new Date(user.lastLogin).toLocaleDateString(config.intlLocale, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  })
  : 'Jamais'}
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
 {isEditing ? (
  <div className="flex items-center justify-end gap-2">
  <button
  onClick={() => onSave(user.uid, selectedRole)}
  className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
  title="Enregistrer"
  >
  <Save className="h-4 w-4" />
  </button>
  <button
  onClick={onEditCancel}
  className="p-2 text-muted-foreground hover:bg-muted dark:hover:bg-white/10 rounded-lg transition-colors"
  title="Annuler"
  >
  <X className="h-4 w-4" />
  </button>
  </div>
 ) : (
  <button
  onClick={() => onEditStart(user.uid, user.role as Role)}
  disabled={user.uid === currentUser?.uid}
  className="p-2 text-primary hover:bg-primary/10 dark:hover:bg-primary rounded-lg transition-colors disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-slate-600"
  title="Modifier le rôle"
  >
  <Edit className="h-4 w-4" />
  </button>
 )}
 </td>
 </tr>
 );
};
