import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { user, addToast } = useStore();
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
            addToast(t('roleManagement.errors.updateFailed'), 'error');
        }
    };

    const canManageRoles = hasPermission(user, 'User', 'update');

    if (!canManageRoles) {
        return (
            <div className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-2">
                    {t('roleManagement.accessRestricted')}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {t('roleManagement.noPermission')}
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                {/* Skeleton: Loading state for user roles table */}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <ShieldCheck className="h-7 w-7 text-primary" />
                        {t('roleManagement.title')}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t('roleManagement.subtitle')}
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
            <div className="glass-premium rounded-2xl overflow-hidden border border-border/40">
                {users.length === 0 ? (
                    <div className="text-center py-12">
                        <Info className="h-12 w-12 mx-auto text-slate-400 dark:text-slate-300 mb-4" />
                        <p className="text-slate-600 dark:text-muted-foreground">{t('roleManagement.noUsersFound')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/30 dark:bg-slate-800/50 border-b border-slate-200 dark:border-white/10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        {t('roleManagement.columns.user')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        {t('roleManagement.columns.email')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        {t('roleManagement.columns.currentRole')}
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        {t('roleManagement.columns.lastLogin')}
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        {t('roleManagement.columns.actions')}
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
            <div className="glass-premium p-4 rounded-2xl border border-primary/20 bg-primary/5">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-foreground">
                        <p className="font-bold mb-1">{t('roleManagement.importantNote')}</p>
                        <p className="text-muted-foreground">
                            {t('roleManagement.noteDescription')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
