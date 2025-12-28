import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { Building, Users, FileSpreadsheet, Search } from '../ui/Icons';
import { useNavigate } from 'react-router-dom';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { organizationSchema, OrganizationFormData } from '../../schemas/settingsSchema';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { updateDoc, doc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { hasPermission } from '../../utils/permissions';
import { logAction } from '../../services/logger'; // Added import
import { SubscriptionService } from '../../services/subscriptionService';
import { Organization, UserProfile } from '../../types';
import { ConfirmModal } from '../ui/ConfirmModal';
import { UserRow } from './UserRow';
import { useSettingsData } from '../../hooks/settings/useSettingsData';

const SECONDS_TO_MS = 1000;

export const OrganizationSettings: React.FC = () => {
    const { user, setUser, addToast, t } = useStore();
    const navigate = useNavigate();
    const { organization, users: hookUsers } = useSettingsData();
    const [savingOrg, setSavingOrg] = useState(false);
    const [subLoading, setSubLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingUserIds, setUpdatingUserIds] = useState<Set<string>>(new Set());

    // Transfer Modal
    const [confirmTransferData, setConfirmTransferData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Confirm Remove User
    const [confirmRemoveData, setConfirmRemoveData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const usersList = hookUsers;
    const currentOrg = organization;

    const orgForm = useForm<OrganizationFormData>({
        resolver: zodResolver(organizationSchema),
        defaultValues: { orgName: '', address: '', vatNumber: '', contactEmail: '' }
    });

    // Sync form with organization data
    useEffect(() => {
        if (organization) {
            orgForm.reset({
                orgName: organization.name || '',
                address: organization.address || '',
                vatNumber: organization.vatNumber || '',
                contactEmail: organization.contactEmail || ''
            });
        }
    }, [organization, orgForm]);

    const updateOrgUsers = useCallback(async (orgId: string, newName: string) => {
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
        const snap = await getDocs(q);

        const chunks = [];
        const CHUNK_SIZE = 450; // Safety margin below 500

        for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
            chunks.push(snap.docs.slice(i, i + CHUNK_SIZE));
        }

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(d => {
                batch.update(d.ref, sanitizeData({ organizationName: newName }));
            });
            await batch.commit();
        }
    }, []);

    const handleUpdateOrg: SubmitHandler<OrganizationFormData> = async (data) => {
        if (!hasPermission(user, 'Settings', 'manage') || !user?.organizationId) return;

        setSavingOrg(true);
        try {
            const orgRef = doc(db, 'organizations', user.organizationId);
            await updateDoc(orgRef, sanitizeData({
                name: data.orgName,
                address: data.address,
                vatNumber: data.vatNumber,
                contactEmail: data.contactEmail
            }));

            if (currentOrg?.name !== data.orgName) {
                await updateOrgUsers(user.organizationId, data.orgName);
                setUser({ ...user, organizationName: data.orgName });
            }

            setCurrentOrg(prev => prev ? { ...prev, name: data.orgName, address: data.address, vatNumber: data.vatNumber, contactEmail: data.contactEmail } : null);
            await logAction(user, 'UPDATE', 'Organization', `Mise à jour organisation: ${data.orgName}`);
            addToast(t('settings.orgUpdated'), "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'OrganizationSettings.handleUpdateOrg', 'UPDATE_FAILED');
        } finally {
            setSavingOrg(false);
        }
    };

    const handleManageSubscription = async () => {
        if (!user?.organizationId || !hasPermission(user, 'Settings', 'manage')) {
            addToast(t('settings.noPermission'), "error");
            return;
        }
        setSubLoading(true);
        try {
            if (currentOrg?.subscription?.planId === 'discovery') {
                navigate('/pricing');
            } else {
                await SubscriptionService.manageSubscription(user.organizationId);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'OrganizationSettings.handleManageSubscription', 'UNKNOWN_ERROR');
        } finally {
            setSubLoading(false);
        }
    };

    const canManageRestrictedRoles = useCallback((targetRole: UserProfile['role']) => {
        if (!user) return false;
        // Only Admins and Owners can assign Admin/Manager roles
        if (['admin', 'owner', 'manager'].includes(targetRole)) {
            return hasPermission(user, 'User', 'manage');
        }
        return true;
    }, [user]);

    const handleUpdateUserRole = React.useCallback(async (targetUserId: string, newRole: UserProfile['role']) => {
        if (!process.env.VITE_USE_FIREBASE_EMULATOR) {
            if (!canManageRestrictedRoles(newRole)) {
                addToast(t('settings.errors.unauthorizedRole'), 'error');
                return;
            }
        }

        try {
            setUpdatingUserIds(prev => new Set(prev).add(targetUserId));
            await updateDoc(doc(db, 'users', targetUserId), sanitizeData({ role: newRole }));
            setUsersList(prev => prev.map(u => u.uid === targetUserId ? { ...u, role: newRole } : u));
            await logAction(user, 'UPDATE', 'User', `Rôle mis à jour pour ${targetUserId}: ${newRole}`);
            addToast(t('settings.success.roleUpdated'), 'success');
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'OrganizationSettings.handleUpdateUserRole', 'UPDATE_FAILED');
        } finally {
            setUpdatingUserIds(prev => {
                const next = new Set(prev);
                next.delete(targetUserId);
                return next;
            });
        }
    }, [canManageRestrictedRoles, addToast, t, user]);

    const handleTransferOwnership = React.useCallback(async (targetId: string) => {
        if (!targetId) return;
        if (!currentOrg || !user || currentOrg.ownerId !== user.uid) return;

        try {
            const transferOwnership = httpsCallable(functions, 'transferOwnership');
            await transferOwnership({
                organizationId: currentOrg.id,
                newOwnerId: targetId
            });

            await logAction(user, 'TRANSFER', 'Organization', `Propriété transférée à ${targetId}`);
            addToast(t('settings.transferSuccess'), 'success');
            // Refresh details instead of reloading
            await fetchOrgDetails();
        } catch (error: unknown) {
            ErrorLogger.error(error, 'OrganizationSettings.handleTransferOwnership');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addToast(t('settings.transferError') + errorMessage, 'error');
        }
    }, [currentOrg, user, t, addToast, fetchOrgDetails]);

    const initiateTransfer = React.useCallback((targetId: string) => {
        setConfirmTransferData({
            isOpen: true,
            title: t('settings.transferOwnership'),
            message: t('settings.transferOwnershipMessage'),
            onConfirm: () => handleTransferOwnership(targetId)
        });
    }, [t, handleTransferOwnership]);


    const handleRemoveUser = React.useCallback(async (targetUserId: string) => {
        if (!hasPermission(user, 'User', 'manage')) return;
        setConfirmRemoveData(prev => ({ ...prev, loading: true }));
        try {
            await updateDoc(doc(db, 'users', targetUserId), sanitizeData({ organizationId: '', organizationName: '', role: '' }));
            setUsersList(prev => prev.filter(u => u.uid !== targetUserId));
            await logAction(user, 'DELETE', 'User', `Utilisateur retiré de l'organisation: ${targetUserId}`);
            addToast(t('settings.userRemoved'), 'success');
            setConfirmRemoveData(prev => ({ ...prev, isOpen: false }));
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'OrganizationSettings.handleRemoveUser', 'DELETE_FAILED');
        } finally {
            setConfirmRemoveData(prev => ({ ...prev, loading: false }));
        }
    }, [user, addToast, t]);

    const initiateRemoveUser = React.useCallback((targetUserId: string) => {
        setConfirmRemoveData({
            isOpen: true,
            title: t('settings.confirmRemoveUser'),
            message: t('settings.removeUserMessage'),
            onConfirm: () => handleRemoveUser(targetUserId),
            loading: false
        });
    }, [t, handleRemoveUser]);

    const handleCloseTransferModal = useCallback(() => {
        setConfirmTransferData(prev => ({ ...prev, isOpen: false }));
    }, []);

    const handleCloseRemoveModal = useCallback(() => {
        setConfirmRemoveData(prev => ({ ...prev, isOpen: false }));
    }, []);

    const filteredUsers = React.useMemo(() => usersList.filter(u =>
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [usersList, searchTerm]);

    const formatDate = (timestamp: unknown) => {
        if (!timestamp) return '';
        const ts = timestamp as { seconds?: number } | string | number;
        const ms = (typeof ts === 'object' && 'seconds' in ts && ts.seconds)
            ? ts.seconds * SECONDS_TO_MS
            : Number(ts);
        return new Date(ms).toLocaleDateString();
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('settings.organization')}</h2>

            <ConfirmModal
                isOpen={confirmTransferData.isOpen}
                onClose={handleCloseTransferModal}
                onConfirm={confirmTransferData.onConfirm}
                title={confirmTransferData.title}
                message={confirmTransferData.message}
            />
            <ConfirmModal
                isOpen={confirmRemoveData.isOpen}
                onClose={handleCloseRemoveModal}
                onConfirm={confirmRemoveData.onConfirm}
                title={confirmRemoveData.title}
                message={confirmRemoveData.message}
                loading={confirmRemoveData.loading}
            />

            {/* Subscription */}
            {user?.organizationId && (
                <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 rounded-[2rem] p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden group border border-white/10">
                    <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/15 transition-colors duration-500"></div>

                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
                                <FileSpreadsheet className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h4 className="text-xl font-bold">
                                        {currentOrg?.subscription?.planId === 'professional' ? t('settings.plans.professional') :
                                            currentOrg?.subscription?.planId === 'enterprise' ? t('settings.plans.enterprise') :
                                                t('settings.plans.discovery')}
                                    </h4>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${currentOrg?.subscription?.status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-white/10 text-white/70 border-white/20'}`}>
                                        {currentOrg?.subscription?.status === 'active' ? t('settings.active') : t('settings.free')}
                                    </span>
                                </div>
                                {currentOrg?.subscription?.currentPeriodEnd && (
                                    <p className="text-sm text-indigo-200 mt-1">
                                        {t('settings.renewalDate').replace('{date}', formatDate(currentOrg.subscription.currentPeriodEnd))}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button
                            onClick={handleManageSubscription}
                            isLoading={subLoading}
                            className="bg-white text-indigo-900 hover:bg-indigo-50 font-semibold border-none shadow-none"
                        >
                            {currentOrg?.subscription?.planId === 'discovery' ? t('settings.upgradeSub') : t('settings.manage')}
                        </Button>
                    </div>
                </div>
            )}

            {/* Admin Details */}
            {hasPermission(user, 'Settings', 'manage') && (
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 -mx-6 -mt-6 mb-6 bg-white/40 dark:bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-brand-500/10 dark:bg-brand-500/20 rounded-xl text-brand-600 dark:text-brand-400">
                                <Building className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.admin')}</h3>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <form onSubmit={orgForm.handleSubmit(handleUpdateOrg)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FloatingLabelInput
                                    label={t('settings.orgName')}
                                    {...orgForm.register('orgName')}
                                    error={orgForm.formState.errors.orgName?.message}
                                />
                                <FloatingLabelInput
                                    label={t('settings.contactEmail')}
                                    type="email"
                                    {...orgForm.register('contactEmail')}
                                    error={orgForm.formState.errors.contactEmail?.message}
                                />
                                <FloatingLabelInput
                                    label={t('common.address')}
                                    {...orgForm.register('address')}
                                />
                                <FloatingLabelInput
                                    label={t('settings.vatNumber')}
                                    {...orgForm.register('vatNumber')}
                                />
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button type="submit" isLoading={savingOrg} disabled={savingOrg} className="min-w-[140px] shadow-lg shadow-brand-500/20">
                                    {t('settings.saveChanges')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Management */}
            {user && hasPermission(user, 'User', 'manage') && (
                <div className="glass-panel p-0 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-purple-500/10 dark:bg-purple-500/20 rounded-xl text-purple-600 dark:text-purple-400">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.users')}</h3>
                                <p className="text-xs text-slate-500 font-medium">{t('settings.membersCount').replace('{count}', usersList.length.toString())}</p>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <label htmlFor="member-search" className="sr-only">{t('settings.searchMembers')}</label>
                            <input
                                id="member-search"
                                type="text"
                                placeholder={t('settings.searchMembers')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/20 w-48 transition-all focus:w-64"
                            />
                        </div>
                    </div>

                    <div className="relative z-10 divide-y divide-white/20 dark:divide-white/5">
                        {filteredUsers.map(u => (
                            <UserRow
                                key={u.uid}
                                user={u}
                                currentUser={user}
                                currentOrg={currentOrg}
                                updating={updatingUserIds.has(u.uid)}
                                onUpdateRole={handleUpdateUserRole}
                                onTransfer={initiateTransfer}
                                onRemove={initiateRemoveUser}
                                t={t}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


