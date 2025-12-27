import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserProfile, JoinRequest } from '../types';
import { Users, Mail, Plus, Building, User, Trash2, Edit, Clock, Timer, FileSpreadsheet, Check, XCircle, UserPlus } from '../components/ui/Icons';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Drawer } from '../components/ui/Drawer';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { CustomSelect } from '../components/ui/CustomSelect';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { Button } from '../components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema, UserFormData } from '../schemas/userSchema';
import { RoleBadge } from '../components/ui/RoleBadge';

import { RoleManager } from '../components/team/RoleManager';
import { GroupManager } from '../components/team/GroupManager';
import { hasPermission } from '../utils/permissions';
import { usePersistedState } from '../hooks/usePersistedState';
import { useTeamManagement } from '../hooks/useTeamManagement';

import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

const Team: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useStore();
    const [activeTab, setActiveTab] = usePersistedState<'members' | 'roles' | 'groups'>('team_active_tab', 'members');
    const [filter, setFilter] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [confirmData, setConfirmData] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const {
        users,
        joinRequests,
        loading,
        customRoles,
        fetchRoles,
        inviteUser,
        updateUser,
        deleteUser,
        checkDependencies,
        approveRequest,
        rejectRequest
    } = useTeamManagement();

    const canAdmin = hasPermission(user, 'User', 'manage');

    const inviteForm = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: { role: 'user' }
    });

    const editForm = useForm<UserFormData>({
        resolver: zodResolver(userSchema)
    });

    const handleOpenInviteModal = React.useCallback(() => {
        inviteForm.reset();
        setShowInviteModal(true);
    }, [inviteForm]);

    const handleAddUser: SubmitHandler<UserFormData> = React.useCallback(async (data) => {
        const success = await inviteUser(data);
        if (success) setShowInviteModal(false);
    }, [inviteUser]);

    const openEditModal = React.useCallback((u: UserProfile) => {
        setSelectedUser(u);
        editForm.reset({
            displayName: u.displayName,
            email: u.email,
            role: u.role,
            department: u.department
        });
        setShowEditModal(true);
    }, [editForm]);

    const handleUpdateUser: SubmitHandler<UserFormData> = React.useCallback(async (data) => {
        if (!selectedUser) return;
        const success = await updateUser(selectedUser.uid, data, !!selectedUser.isPending);
        if (success) setShowEditModal(false);
    }, [selectedUser, updateUser]);

    const initiateDelete = React.useCallback(async (u: UserProfile) => {
        if (!u.isPending) {
            const dependencies = await checkDependencies(u.uid);
            if (dependencies.length > 0) {
                setConfirmData({
                    isOpen: true,
                    title: "Impossible de supprimer",
                    message: `Cet utilisateur possède des éléments liés : ${dependencies.join(', ')}. Réassignez-les avant de supprimer.`,
                    onConfirm: () => setConfirmData(prev => ({ ...prev, isOpen: false }))
                });
                return;
            }
        }

        setConfirmData({
            isOpen: true,
            title: t('team.delete.title'),
            message: t('team.delete.message', { name: u.displayName }),
            onConfirm: async () => {
                await deleteUser(u);
                setConfirmData(prev => ({ ...prev, isOpen: false }));
            }
        });
    }, [checkDependencies, t, deleteUser]);

    const handleApproveRequest = React.useCallback(async (req: JoinRequest) => {
        await approveRequest(req);
    }, [approveRequest]);

    const handleRejectRequest = React.useCallback(async (req: JoinRequest) => {
        await rejectRequest(req);
    }, [rejectRequest]);

    const filteredUsers = React.useMemo(() => users.filter(u =>
        u.displayName?.toLowerCase().includes(filter.toLowerCase()) ||
        u.email?.toLowerCase().includes(filter.toLowerCase()) ||
        u.department?.toLowerCase().includes(filter.toLowerCase())
    ), [users, filter]);

    const pendingInvites = React.useMemo(() => users.filter(u => u.isPending).length, [users]);
    const activeUsersCount = React.useMemo(() => users.filter(u => !u.isPending).length, [users]);
    const joinRequestsCount = joinRequests.length;

    const exportCSV = React.useCallback(() => {
        const headers = ["Nom", "Email", "Rôle", "Département", "Statut", "Dernière Connexion"];
        const rows = users.map(u => [
            u.displayName || '',
            u.email,
            u.role,
            u.department || '',
            u.isPending ? 'Invité' : 'Actif',
            u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : ''
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `team_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }, [users]);


    // Calculate activity rate for the visual ring (mock logic for now or based on login)
    const activeUsersLast30Days = React.useMemo(() => users.filter(u => {
        if (!u.lastLogin) return false;
        const diff = new Date().getTime() - new Date(u.lastLogin).getTime();
        return diff < 30 * 24 * 60 * 60 * 1000;
    }).length, [users]);
    const activityRate = users.length > 0 ? (activeUsersLast30Days / users.length) * 100 : 0;

    const handleMembersTab = React.useCallback(() => setActiveTab('members'), [setActiveTab]);
    const handleRolesTab = React.useCallback(() => setActiveTab('roles'), [setActiveTab]);
    const handleGroupsTab = React.useCallback(() => setActiveTab('groups'), [setActiveTab]);



    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <PageHeader
                title={t('team.title')}
                subtitle={t('team.subtitle', { org: user?.organizationName || t('common.settings.organization') })}
                breadcrumbs={[
                    { label: t('team.title') }
                ]}
                icon={<Users className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canAdmin && activeTab === 'members' && (
                    <>
                        <CustomTooltip content={t('team.actions.exportCsv')}>
                            <Button
                                variant="outline"
                                onClick={exportCSV}
                                className="gap-2"
                                aria-label={t('team.actions.exportCsv')}
                            >
                                <FileSpreadsheet className="h-4 w-4" /> {t('team.actions.exportCsv')}
                            </Button>
                        </CustomTooltip>
                        <CustomTooltip content={t('team.actions.invite')}>
                            <Button
                                onClick={handleOpenInviteModal}
                                className="gap-2 bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                                aria-label={t('team.actions.invite')}
                            >
                                <Plus className="h-4 w-4" />
                                {t('team.actions.invite')}
                            </Button>
                        </CustomTooltip>
                    </>
                )}
            />

            {/* Summary Card */}
            <motion.div variants={slideUpVariants} className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative group mb-10 overflow-hidden shadow-sm hover:shadow-apple transition-all duration-500 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-100 opacity-70"></div>
                </div>

                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-decorator">
                    <div className="relative group/ring">
                        <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                            <circle
                                className="text-slate-100 dark:text-slate-800"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="48"
                                cy="48"
                            />
                            <circle
                                className={`${activityRate >= 80 ? 'text-emerald-500' : activityRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * activityRate) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="48"
                                cy="48"
                            />
                        </svg>
                        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                            <span className={`text-2xl font-black ${activityRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : activityRate >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {Math.round(activityRate)}%
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actifs</span>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Vue d'ensemble</h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                            {users.length} comptes gérés sur votre organisation.
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 md:gap-8 w-full md:w-auto relative z-10">
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{t('team.stats.active')}</span>
                        </div>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">{activeUsersCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{t('team.stats.requests')}</span>
                        </div>
                        <span className="text-sm font-black text-blue-700 dark:text-blue-400">{joinRequestsCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{t('team.stats.pending')}</span>
                        </div>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400">{pendingInvites}</span>
                    </div>
                </div>
            </motion.div>

            <motion.div variants={slideUpVariants} className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit">
                <button
                    aria-label={t('team.tabs.members')}
                    onClick={handleMembersTab}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'members'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    {t('team.tabs.members')}
                </button>
                <button
                    aria-label={t('team.tabs.roles')}
                    onClick={handleRolesTab}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'roles'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    {t('team.tabs.roles')}
                </button>
                <button
                    aria-label={t('team.tabs.groups')}
                    onClick={handleGroupsTab}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'groups'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    {t('team.tabs.groups')}
                </button>
            </motion.div>

            {activeTab === 'roles' ? (
                <motion.div variants={slideUpVariants}>
                    <RoleManager roles={customRoles} onRefresh={fetchRoles} />
                </motion.div>
            ) : activeTab === 'groups' ? (
                <motion.div variants={slideUpVariants}>
                    <GroupManager users={users} />
                </motion.div>
            ) : (
                <motion.div variants={slideUpVariants} className="flex flex-col gap-6">
                    <PremiumPageControl
                        searchQuery={filter}
                        onSearchChange={setFilter}
                        searchPlaceholder={t('common.settings.searchMembers')}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Pending Join Requests Section */}
                        {joinRequests.length > 0 && (
                            <div className="col-span-full mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                                    <UserPlus className="h-5 w-5 mr-2 text-blue-500" />
                                    Demandes d'accès ({joinRequests.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {joinRequests.map(req => (
                                        <JoinRequestCard key={req.id} req={req} onApprove={handleApproveRequest} onReject={handleRejectRequest} />
                                    ))}
                                </div>
                                <div className="h-px bg-slate-200 dark:bg-white/10 my-6" />
                            </div>
                        )}

                        {loading ? (
                            <div className="col-span-full"><CardSkeleton count={3} /></div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="col-span-full">
                                <EmptyState
                                    icon={Users}
                                    title={t('team.empty.title')}
                                    description={filter ? t('team.empty.descSearch') : t('team.empty.desc')}
                                    actionLabel={canAdmin && !filter ? t('team.actions.invite') : undefined}
                                    onAction={canAdmin && !filter ? handleOpenInviteModal : undefined}
                                />
                            </div>
                        ) : (
                            filteredUsers.map((u) => (
                                <UserCard key={u.uid} user={u} canAdmin={canAdmin} onEdit={openEditModal} onDelete={initiateDelete} />
                            ))
                        )}
                    </div>
                </motion.div>
            )}

            {/* INVITE DRAWER */}
            <Drawer
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                title={t('team.invite.title')}
                subtitle={t('team.invite.subtitle', { org: user?.organizationName || t('common.settings.organization') })}
                width="max-w-4xl"
            // Headless UI handles FocusTrap and keyboard navigation for accessibility
            >
                <form onSubmit={inviteForm.handleSubmit(handleAddUser)} className="p-4 sm:p-8 space-y-6">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white shadow-inner">
                            <User className="h-10 w-10" />
                        </div>
                    </div>

                    <FloatingLabelInput
                        label={t('team.invite.name')}
                        {...inviteForm.register('displayName')}
                    />

                    <div>
                        <FloatingLabelInput
                            label={t('team.invite.email')}
                            type="email"
                            {...inviteForm.register('email')}
                        />
                        {inviteForm.formState.errors.email && <p className="text-red-500 text-xs mt-1">{inviteForm.formState.errors.email?.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <Controller
                                control={inviteForm.control}
                                name="role"
                                render={({ field }) => (
                                    <CustomSelect
                                        label={t('team.invite.role')}
                                        value={field.value}
                                        onChange={field.onChange}
                                        options={[
                                            { value: 'user', label: t('common.settings.roles.user') },
                                            { value: 'rssi', label: t('common.settings.roles.rssi') },
                                            { value: 'auditor', label: t('common.settings.roles.auditor') },
                                            { value: 'project_manager', label: t('common.settings.roles.project_manager') },
                                            { value: 'direction', label: t('common.settings.roles.direction') },
                                            { value: 'admin', label: t('common.settings.roles.admin') },
                                            ...customRoles.map(r => ({ value: r.id, label: r.name }))
                                        ]}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <FloatingLabelInput
                                label={t('team.invite.department')}
                                {...inviteForm.register('department')}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <Button type="button" variant="ghost" onClick={() => setShowInviteModal(false)}>{t('team.actions.cancel')}</Button>
                        <Button type="submit" className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 transition-transform" isLoading={loading}>{t('team.invite.send')}</Button>
                    </div>
                </form>
            </Drawer>

            {/* EDIT DRAWER */}
            <Drawer
                isOpen={showEditModal && !!selectedUser && !selectedUser.isPending}
                onClose={() => setShowEditModal(false)}
                title={t('team.edit.title')}
                subtitle={t('team.edit.subtitle')}
                width="max-w-4xl"
            >
                {selectedUser && (
                    <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="p-4 sm:p-8 space-y-6">
                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl mb-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t('team.edit.account')}</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedUser.email}</p>
                        </div>

                        <FloatingLabelInput
                            label={t('team.invite.name')}
                            {...editForm.register('displayName')}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <Controller
                                    control={editForm.control}
                                    name="role"
                                    render={({ field }) => (
                                        <CustomSelect
                                            label={t('team.invite.role')}
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={[
                                                { value: 'user', label: t('common.settings.roles.user') },
                                                { value: 'rssi', label: t('common.settings.roles.rssi') },
                                                { value: 'auditor', label: t('common.settings.roles.auditor') },
                                                { value: 'project_manager', label: t('common.settings.roles.project_manager') },
                                                { value: 'direction', label: t('common.settings.roles.direction') },
                                                { value: 'admin', label: t('common.settings.roles.admin') },
                                                ...customRoles.map(r => ({ value: r.id, label: r.name }))
                                            ]}
                                        />
                                    )}
                                />
                            </div>
                            <div>
                                <FloatingLabelInput
                                    label={t('team.invite.department')}
                                    {...editForm.register('department')}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                            <Button type="button" variant="ghost" onClick={() => setShowEditModal(false)}>{t('team.actions.cancel')}</Button>
                            <Button type="submit" className="bg-brand-600 text-white hover:scale-105 transition-transform">{t('team.edit.save')}</Button>
                        </div>
                    </form>
                )}
            </Drawer>
        </motion.div>
    );
};

export default Team;

const JoinRequestCard = React.memo(({ req, onApprove, onReject }: { req: JoinRequest, onApprove: (req: JoinRequest) => void, onReject: (req: JoinRequest) => void }) => {
    const { t } = useTranslation();
    const handleReject = React.useCallback(() => onReject(req), [onReject, req]);
    const handleApprove = React.useCallback(() => onApprove(req), [onApprove, req]);

    return (
        <div className="glass-panel p-5 rounded-2xl border border-blue-200/50 dark:border-blue-900/30 shadow-sm flex flex-col relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-50/30 dark:bg-blue-900/10 pointer-events-none" />
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-sm">
                        {req.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 dark:text-white">{req.displayName}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{req.userEmail}</p>
                    </div>
                </div>
                <div className="mt-auto flex gap-2 pt-3">
                    <CustomTooltip content={t('team.actions.reject')}>
                        <button
                            aria-label={t('team.actions.reject')}
                            onClick={handleReject}
                            className="flex-1 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all flex items-center justify-center gap-1"
                        >
                            <XCircle className="h-3.5 w-3.5" /> {t('team.actions.reject')}
                        </button>
                    </CustomTooltip>
                    <CustomTooltip content={t('team.actions.approve')}>
                        <button
                            aria-label={t('team.actions.approve')}
                            onClick={handleApprove}
                            className="flex-1 py-2 bg-blue-600 text-white border border-blue-500 rounded-xl text-xs font-bold hover:bg-blue-700 hover:shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1"
                        >
                            <Check className="h-3.5 w-3.5" /> {t('team.actions.approve')}
                        </button>
                    </CustomTooltip>
                </div>
            </div>
        </div>
    );
});

const UserCard = React.memo(({ user, canAdmin, onEdit, onDelete }: { user: UserProfile, canAdmin: boolean, onEdit: (u: UserProfile) => void, onDelete: (u: UserProfile) => void }) => {
    const { t } = useTranslation();
    const handleEdit = React.useCallback(() => onEdit(user), [onEdit, user]);
    const handleDelete = React.useCallback(() => onDelete(user), [onDelete, user]);

    return (
        <div className={`glass-panel rounded-[2.5rem] p-6 flex flex-col items-center text-center card-hover group relative border border-white/50 dark:border-white/5 ${user.isPending ? 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20' : ''}`}>
            {canAdmin && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!user.isPending && (
                        <CustomTooltip content={t('team.actions.edit')}>
                            <button
                                onClick={handleEdit}
                                className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-sm hover:scale-105 transition-all"
                                aria-label={t('team.actions.edit')}
                            >
                                <Edit className="h-4 w-4" />
                            </button>
                        </CustomTooltip>
                    )}
                    <CustomTooltip content={user.isPending ? t('team.delete.titleInvite').replace('?', '') : t('team.actions.delete')}>
                        <button
                            onClick={handleDelete}
                            className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-500 hover:text-red-500 shadow-sm hover:scale-105 transition-all"
                            aria-label={t('team.actions.delete')}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </CustomTooltip>
                </div>
            )}

            <div className="relative mb-4 mt-2">
                {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className={`w-24 h-24 rounded-full object-cover shadow-xl ring-4 ring-white dark:ring-slate-800 ${user.isPending ? 'opacity-50 grayscale' : ''}`} />
                ) : (
                    <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-3xl font-bold text-slate-600 dark:text-slate-300 shadow-xl ring-4 ring-white dark:ring-slate-800 ${user.isPending ? 'opacity-50' : ''}`}>
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                )}
                <div className="absolute bottom-0 right-0 transform translate-x-2 translate-y-1">
                    <RoleBadge role={user.role} />
                </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{user.displayName}</h3>
            <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-400 mb-4 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full">
                <Mail className="h-3 w-3 mr-1.5 opacity-70" /> {user.email}
            </div>

            {user.isPending ? (
                <div className="w-full pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-center items-center text-xs mt-auto">
                    <div className="flex items-center text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg">
                        <Timer className="h-3.5 w-3.5 mr-1.5" />
                        {t('team.invite.success').split(' ')[0]} {t('team.stats.pending')}
                    </div>
                </div>
            ) : (
                <div className="w-full pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center text-xs mt-auto">
                    <div className="flex items-center text-slate-600 dark:text-slate-300 font-medium">
                        <Building className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                        {user.department || 'Général'}
                    </div>
                    {user.lastLogin && (
                        <div className="flex items-center text-slate-500 font-medium" title={t('team.columns.lastLogin')}>
                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                            {new Date(user.lastLogin).toLocaleDateString()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
