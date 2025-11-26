import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { UserProfile } from '../types';
import {
    hasPermission,
    getRoleName,
    getRoleDescription,
    Role
} from '../utils/permissions';
import {
    ShieldCheck,
    X,
    Edit,
    Save,
    AlertTriangle,
    Info
} from './ui/Icons';
import { ErrorLogger } from '../services/errorLogger';

export const RoleManagement: React.FC = () => {
    const { user } = useStore();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<Role>('user');

    useEffect(() => {
        fetchUsers();
    }, [user?.organizationId]);

    const fetchUsers = async () => {
        if (!user?.organizationId) return;

        try {
            const q = query(
                collection(db, 'users'),
                where('organizationId', '==', user.organizationId)
            );
            const snapshot = await getDocs(q);
            const usersData = snapshot.docs.map((doc) => ({
                ...doc.data(),
                uid: doc.id,
            })) as UserProfile[];

            setUsers(usersData);
        } catch (error) {
            ErrorLogger.error(error, 'RoleManagement.fetchUsers');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async (userId: string, newRole: Role) => {
        try {
            await updateDoc(doc(db, 'users', userId), {
                role: newRole,
            });

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
                    <div
                        key={role}
                        className="glass-panel p-4 rounded-2xl border border-white/40 dark:border-white/10"
                    >
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {getRoleName(role)}
                            </h3>
                            <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-[10px] font-bold">
                                {users.filter((u) => u.role === role).length}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {getRoleDescription(role)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div className="glass-panel rounded-2xl overflow-hidden border border-white/40 dark:border-white/10">
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
                                <tr
                                    key={u.uid}
                                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            {u.photoURL ? (
                                                <img
                                                    src={u.photoURL}
                                                    alt={u.displayName}
                                                    className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-800"
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                                    {u.displayName?.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {u.displayName}
                                                </div>
                                                {u.department && (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        {u.department}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                        {u.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {editingUser === u.uid ? (
                                            <select
                                                value={selectedRole}
                                                onChange={(e) => setSelectedRole(e.target.value as Role)}
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
                                                {getRoleName(u.role)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                        {u.lastLogin
                                            ? new Date(u.lastLogin).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })
                                            : 'Jamais'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {editingUser === u.uid ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleUpdateRole(u.uid, selectedRole)}
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                    title="Enregistrer"
                                                >
                                                    <Save className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingUser(null)}
                                                    className="p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Annuler"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingUser(u.uid);
                                                    setSelectedRole(u.role);
                                                }}
                                                disabled={u.uid === user?.uid}
                                                className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Modifier le rôle"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Box */}
            <div className="glass-panel p-4 rounded-2xl border border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10">
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
