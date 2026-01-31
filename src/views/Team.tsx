import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { UserProfile, JoinRequest } from '../types';
import { Users, Plus, User, FileSpreadsheet, Check, UserPlus, Timer } from '../components/ui/Icons';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Drawer } from '../components/ui/Drawer';
import { SubmitHandler, Controller } from 'react-hook-form';
import { useZodForm } from '../hooks/useZodForm';
import { CustomSelect } from '../components/ui/CustomSelect';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { Button } from '../components/ui/button';
import { userSchema, UserFormData } from '../schemas/userSchema';

import { RoleManager } from '../components/team/RoleManager';
import { GroupManager } from '../components/team/GroupManager';
import { JoinRequestCard } from '../components/team/JoinRequestCard';
import { UserCard } from '../components/team/UserCard';
import { hasPermission } from '../utils/permissions';
import { usePersistedState } from '../hooks/usePersistedState';
import { useTeamManagement } from '../hooks/useTeamManagement';

import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { ImportService } from '../services/ImportService';
import { Upload } from '../components/ui/Icons';

const Team: React.FC = () => {
    const { t } = useTranslation();
    const { user, addToast } = useStore();
    const { claimsSynced, loading: authLoading } = useAuth();
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
        rejectRequest,
        importUsers
    } = useTeamManagement(claimsSynced);

    const [csvImportOpen, setCsvImportOpen] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

    // CSV Import Handlers
    const userGuidelines = React.useMemo(() => ({
        required: [t('common.columns.email')],
        optional: [t('common.columns.name'), t('common.columns.role'), t('common.columns.department')],
        format: 'CSV'
    }), [t]);

    const handleDownloadTemplate = React.useCallback(() => {
        ImportService.downloadUserTemplate(t);
    }, [t]);

    const handleImportCsvFile = React.useCallback(async (file: File) => {
        if (!file) return;
        const text = await file.text();
        await importUsers(text);
        setCsvImportOpen(false);
    }, [importUsers]);

    const canAdmin = hasPermission(user, 'User', 'manage');

    const inviteForm = useZodForm({
        schema: userSchema,
        defaultValues: { role: 'user' },
        mode: 'onChange'
    });

    const editForm = useZodForm({
        schema: userSchema,
        mode: 'onChange'
    });

    const handleOpenInviteModal = React.useCallback(() => {
        inviteForm.reset();
        setInviteSuccess(null);
        setShowInviteModal(true);
    }, [inviteForm]);

    const handleAddUser: SubmitHandler<UserFormData> = React.useCallback(async (data) => {
        const success = await inviteUser(data);
        if (success) {
            setInviteSuccess(data.email);
            addToast(t('team.invite.success', { defaultValue: 'Invitation envoyée à {{email}}', email: data.email }), 'success');
            inviteForm.reset({ role: 'user', displayName: '', email: '', department: '' });
        }
    }, [inviteUser, addToast, t, inviteForm]);

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
        if (success) {
            addToast(t('team.userUpdated', { defaultValue: '{{name}} mis à jour avec succès', name: selectedUser.displayName || selectedUser.email }), 'success');
            setShowEditModal(false);
        }
    }, [selectedUser, updateUser, addToast, t]);

    const initiateDelete = React.useCallback(async (u: UserProfile) => {
        try {
            if (!u.isPending) {
                const dependencies = await checkDependencies(u.uid);
                if (dependencies.length > 0) {
                    setConfirmData({
                        isOpen: true,
                        title: t('team.delete.cannotDelete', { defaultValue: 'Impossible de supprimer' }),
                        message: t('team.delete.hasDependenciesDetailed', { defaultValue: 'Cet utilisateur possède des éléments liés : {{dependencies}}. Veuillez réassigner ces éléments à un autre membre depuis les modules concernés (Actifs, Risques, Documents) avant de pouvoir supprimer ce compte.', dependencies: dependencies.join(', ') }),
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
        } catch {
            addToast(t('team.delete.error', { defaultValue: "Erreur lors de la préparation de la suppression." }), 'error');
        }
    }, [checkDependencies, t, deleteUser, addToast]);

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
        ImportService.exportUsers(
            users
        );
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

    const handleCloseConfirm = React.useCallback(() => {
        setConfirmData(prev => ({ ...prev, isOpen: false }));
    }, []);

    const handleCloseInvite = React.useCallback(() => {
        setShowInviteModal(false);
        setInviteSuccess(null);
    }, []);

    const handleCloseEdit = React.useCallback(() => {
        setShowEditModal(false);
    }, []);

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
        >
            <MasterpieceBackground />
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={handleCloseConfirm}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <PageHeader
                title={t('team.title')}
                subtitle={t('team.subtitle')}
                icon={
                    <img
                        src="/images/administration.png"
                        alt="ADMINISTRATION"
                        className="w-full h-full object-contain"
                    />
                }
                actions={undefined}
            />

            {/* Summary Card */}
            <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative group mb-10 overflow-hidden shadow-apple transition-all duration-500">
                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70 opacity-70"></div>
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
                                className={`${activityRate >= 80 ? 'text-success-text' : activityRate >= 50 ? 'text-brand-500' : 'text-warning-text'} transition-all duration-1000 ease-out`}
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
                            <span className={`text-2xl font-black ${activityRate >= 80 ? 'text-success-text' : activityRate >= 50 ? 'text-brand-600 dark:text-brand-400' : 'text-warning-text'}`}>
                                {Math.round(activityRate)}%
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Actifs</span>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Vue d'ensemble</h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-300 max-w-xs leading-relaxed">
                            {users.length} comptes gérés sur votre organisation.
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 md:gap-8 w-full md:w-auto relative z-10">
                    <div className="flex items-center justify-between p-2.5 bg-success-bg rounded-2xl border border-success-border/30 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-success-text" />
                            <span className="text-xs font-black text-success-text uppercase tracking-widest">{t('team.stats.active')}</span>
                        </div>
                        <span className="text-sm font-black text-success-text">{activeUsersCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-info-bg rounded-2xl border border-info-border/30 shadow-sm">
                        <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-info-text" />
                            <span className="text-xs font-black text-info-text uppercase tracking-widest">{t('team.stats.requests')}</span>
                        </div>
                        <span className="text-sm font-black text-info-text">{joinRequestsCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-warning-bg rounded-2xl border border-warning-border/30 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-warning-text" />
                            <span className="text-xs font-black text-warning-text uppercase tracking-widest">{t('team.stats.pending')}</span>
                        </div>
                        <span className="text-sm font-black text-warning-text">{pendingInvites}</span>
                    </div>
                </div>
            </motion.div>

            <motion.div variants={slideUpVariants} className="flex space-x-1 bg-slate-100/50 dark:bg-slate-800/20 p-1.5 rounded-2xl w-fit backdrop-blur-sm border border-border/50">
                <button
                    type="button"
                    aria-label={t('team.tabs.members')}
                    onClick={handleMembersTab}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'members'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-apple-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                >
                    {t('team.tabs.members')}
                </button>
                <button
                    type="button"
                    aria-label={t('team.tabs.roles')}
                    onClick={handleRolesTab}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'roles'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-apple-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                >
                    {t('team.tabs.roles')}
                </button>
                <button
                    type="button"
                    aria-label={t('team.tabs.groups')}
                    onClick={handleGroupsTab}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'groups'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-apple-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
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
                        actions={canAdmin && (
                            <>
                                <CustomTooltip content={t('team.actions.exportCsv')}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={exportCSV}
                                        className="gap-2"
                                        aria-label={t('team.actions.exportCsv')}
                                    >
                                        <FileSpreadsheet className="h-4 w-4" /> {t('team.actions.exportCsv')}
                                    </Button>
                                </CustomTooltip>
                                <CustomTooltip content={t('team.actions.importCsv')}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setCsvImportOpen(true)}
                                        className="gap-2"
                                        aria-label={t('team.actions.importCsv')}
                                    >
                                        <Upload className="h-4 w-4" /> {t('team.actions.importCsv')}
                                    </Button>
                                </CustomTooltip>
                                <CustomTooltip content={t('team.actions.invite')}>
                                    <Button
                                        type="button"
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

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Pending Join Requests Section */}
                        {joinRequests.length > 0 ? (
                            <div className="col-span-full mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                                    <UserPlus className="h-5 w-5 mr-2 text-brand-500" />
                                    {t('team.joinRequests.title', { defaultValue: "Demandes d'accès" })} ({joinRequests.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {joinRequests.map(req => (
                                        <JoinRequestCard key={req.id || 'unknown'} req={req} onApprove={handleApproveRequest} onReject={handleRejectRequest} />
                                    ))}
                                </div>
                                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-10 opacity-60" />
                            </div>
                        ) : (
                            <div className="col-span-full mb-4">
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    {t('team.joinRequests.empty', { defaultValue: "Aucune demande d'accès en attente." })}
                                </p>
                            </div>
                        )}

                        {loading || authLoading || !claimsSynced ? (
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
                                <UserCard key={u.uid || 'unknown'} user={u} canAdmin={canAdmin} onEdit={openEditModal} onDelete={initiateDelete} />
                            ))
                        )}
                    </div>
                </motion.div>
            )}

            {/* INVITE DRAWER */}
            <Drawer
                isOpen={showInviteModal}
                onClose={handleCloseInvite}
                title={t('team.invite.title')}
                subtitle={t('team.invite.subtitle', { org: user?.organizationName || t('common.settings.organization') })}
                width="max-w-6xl"
            // Headless UI handles FocusTrap and keyboard navigation for accessibility
            >
                <form onSubmit={(e) => { e.preventDefault(); inviteForm.handleSubmit(handleAddUser)(e); }} className="p-4 sm:p-8 space-y-6">
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
                    {inviteSuccess && (
                        <div className="p-4 bg-success-bg border border-success-border/30 rounded-2xl text-success-text text-sm font-medium">
                            {t('team.invite.successMessage', { defaultValue: 'Invitation envoyée à {{email}} !', email: inviteSuccess })}
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-slate-100 dark:border-white/5">
                        {inviteSuccess ? (
                            <>
                                <Button type="button" variant="ghost" onClick={handleCloseInvite}>{t('team.invite.done', { defaultValue: 'Terminé' })}</Button>
                                <Button type="button" onClick={() => setInviteSuccess(null)} className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20">
                                    <Plus className="h-4 w-4 mr-2" />{t('team.invite.inviteAnother', { defaultValue: 'Inviter un autre' })}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button type="button" variant="ghost" onClick={handleCloseInvite}>{t('team.actions.cancel')}</Button>
                                <Button type="submit" disabled={loading || inviteForm.formState.isSubmitting} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 transition-transform" isLoading={loading || inviteForm.formState.isSubmitting}>{t('team.invite.send')}</Button>
                            </>
                        )}
                    </div>
                </form>
            </Drawer>

            {/* EDIT DRAWER */}
            <Drawer
                isOpen={showEditModal && !!selectedUser && !selectedUser.isPending}
                onClose={handleCloseEdit}
                title={t('team.edit.title')}
                subtitle={t('team.edit.subtitle')}
                width="max-w-6xl"
            >
                {selectedUser && (
                    <form onSubmit={(e) => { e.preventDefault(); editForm.handleSubmit(handleUpdateUser)(e); }} className="p-4 sm:p-8 space-y-6">
                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl mb-4">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-1">{t('team.edit.account')}</p>
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

                        <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-slate-100 dark:border-white/5">
                            <Button type="button" variant="ghost" onClick={handleCloseEdit}>{t('team.actions.cancel')}</Button>
                            <Button type="submit" disabled={loading || editForm.formState.isSubmitting} className="bg-brand-600 text-white hover:scale-105 transition-transform" isLoading={loading || editForm.formState.isSubmitting}>{t('team.edit.save')}</Button>
                        </div>
                    </form>
                )}
            </Drawer>

            <ImportGuidelinesModal
                isOpen={csvImportOpen}
                onClose={() => setCsvImportOpen(false)}
                entityName={t('team.title')}
                guidelines={userGuidelines}
                onImport={handleImportCsvFile}
                onDownloadTemplate={handleDownloadTemplate}
            />
        </motion.div>
    );
};

export default Team;
