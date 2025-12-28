import React, { useState } from 'react';
import { useStore } from '../store';
import { UserProfile } from '../types';
import { useTeamData } from '../hooks/team/useTeamData';
import {
    hasPermission,
    Role
} from '../utils/permissions';
import {
    ShieldCheck,
    AlertTriangle,
    Info
} from './ui/Icons';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { RoleCard } from './roles/RoleCard';
import { UserRow } from './roles/UserRow';

export const RoleManagement: React.FC = () => {
    const { user } = useStore();
    const { users: teamUsers, loading, updateUser } = useTeamData();
    const [users, setUsers] = useState<UserProfile[]>(teamUsers);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<Role>('user');

    // Sync local state with hook data for optimistic updates
    React.useEffect(() => {
        setUsers(teamUsers);
    }, [teamUsers]);

    const handleUpdateRole = async (userId: string, newRole: Role) => {
        try {
            await updateUser(userId, sanitizeData({
                role: newRole,
            }));

            setUsers((prev) =>
                prev.map((u) => (u.uid === userId ? { ...u, role: newRole } : u))
            );
            setEditingUser(null);
        } catch (error) {
            ErrorLogger.error(error, 'RoleManagement.handleUpdateRole');
            alert('Erreur lors de la mise à jour du rôle');
        }
    };

    const canManageRoles = hasPermission(user, 'User', 'update');

    if (!canManageRoles) {
        return (
            <div className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    Accès Restreint
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Vous n'avez pas les permissions nécessaires pour gérer les rôles.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
                {/* Skeleton: Loading state for user roles table */}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <ShieldCheck className="h-7 w-7 text-brand-600 dark:text-brand-400" />
                        Gestion des Rôles et Permissions
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Gérez les rôles et permissions des utilisateurs de votre organisation
                    </p>
                </div>
            </div>

            {/* Role Descriptions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(['admin', 'rssi', 'auditor', 'project_manager', 'direction', 'user'] as Role[]).map((role) => (
                    <RoleCard
                        key={role}
                        role={role}
                        count={users.filter((u) => u.role === role).length}
                    />
                ))}
            </div>

            {/* Users Table */}
            <div className="glass-panel rounded-2xl overflow-hidden border border-white/40 dark:border-white/10">
                {users.length === 0 ? (
                    <div className="text-center py-12">
                        <Info className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                        <p className="text-slate-600 dark:text-slate-400">Aucun utilisateur trouvé dans votre organisation.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-white/10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Utilisateur
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Rôle Actuel
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Dernière Connexion
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                                {users.map((u) => (
                                    <UserRow
                                        key={u.uid}
                                        user={u}
                                        currentUser={user}
                                        isEditing={editingUser === u.uid}
                                        selectedRole={selectedRole}
                                        onEditStart={(uid, role) => {
                                            setEditingUser(uid);
                                            setSelectedRole(role);
                                        }}
                                        onEditCancel={() => setEditingUser(null)}
                                        onRoleChange={setSelectedRole}
                                        onSave={handleUpdateRole}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Info Box */}
            <div className="glass-panel p-4 rounded-2xl border border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-slate-900/10">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                        <p className="font-bold mb-1">Note importante</p>
                        <p className="text-blue-700 dark:text-blue-300">
                            Les modifications de rôles prennent effet immédiatement. Les utilisateurs devront peut-être se reconnecter pour voir les changements appliqués.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
