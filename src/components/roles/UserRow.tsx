import React from 'react';
import { UserProfile } from '../../types';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { Role, getRoleName } from '../../utils/permissions';
import { Save, X, Edit } from '../ui/Icons';

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
    return (
        <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                    <img
                        alt={user.displayName || 'User'}
                        src={getUserAvatarUrl(user.photoURL, user.role)}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-800"
                    />
                    <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {user.displayName}
                        </div>
                        {user.department && (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                                {user.department}
                            </div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                {user.email}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                {isEditing ? (
                    <select
                        value={selectedRole}
                        onChange={(e) => onRoleChange(e.target.value as Role)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                        <option value="admin">Administrateur</option>
                        <option value="rssi">RSSI</option>
                        <option value="auditor">Auditeur</option>
                        <option value="project_manager">Chef de Projet</option>
                        <option value="direction">Direction</option>
                        <option value="user">Utilisateur</option>
                    </select>
                ) : (
                    <span className="px-3 py-1.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-bold">
                        {getRoleName(user.role)}
                    </span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                {user.lastLogin
                    ? new Date(user.lastLogin).toLocaleDateString('fr-FR', {
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
                            className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            title="Annuler"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => onEditStart(user.uid, user.role)}
                        disabled={user.uid === currentUser?.uid}
                        className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Modifier le rôle"
                    >
                        <Edit className="h-4 w-4" />
                    </button>
                )}
            </td>
        </tr>
    );
};
