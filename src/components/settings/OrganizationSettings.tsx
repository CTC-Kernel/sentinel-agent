import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { Building, Users, Star, RefreshCw, Trash2, Loader2, FileSpreadsheet, Search } from '../ui/Icons';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { organizationSchema, OrganizationFormData } from '../../schemas/settingsSchema';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { updateDoc, doc, collection, query, where, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { hasPermission } from '../../utils/permissions';
import { SubscriptionService } from '../../services/subscriptionService';
import { Organization, UserProfile } from '../../types';
import { ConfirmModal } from '../ui/ConfirmModal';

export const OrganizationSettings: React.FC = () => {
    const { user, setUser, addToast, t } = useStore();
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [savingOrg, setSavingOrg] = useState(false);
    const [subLoading, setSubLoading] = useState(false);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingUserIds, setUpdatingUserIds] = useState<Set<string>>(new Set());

    // Transfer Modal
    const [transferTargetId, setTransferTargetId] = useState<string>('');
    const [confirmTransferData, setConfirmTransferData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Confirm Remove User
    const [confirmRemoveData, setConfirmRemoveData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });


    const orgForm = useForm<OrganizationFormData>({
        resolver: zodResolver(organizationSchema),
        defaultValues: { orgName: '', address: '', vatNumber: '', contactEmail: '' }
    });

    const fetchOrgDetails = useCallback(async () => {
        if (!user?.organizationId) return;
        try {
            const orgRef = doc(db, 'organizations', user.organizationId);
            const orgSnap = await getDoc(orgRef);
            if (orgSnap.exists()) {
                const orgData = { id: orgSnap.id, ...orgSnap.data() } as Organization;
                setCurrentOrg(orgData);
                orgForm.reset({
                    orgName: orgData.name || '',
                    address: orgData.address || '',
                    vatNumber: orgData.vatNumber || '',
                    contactEmail: orgData.contactEmail || ''
                });
            }
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'OrganizationSettings.fetchOrgDetails', 'FETCH_FAILED'); }
    }, [user?.organizationId, orgForm]);

    const fetchUsers = useCallback(async () => {
        if (!user?.organizationId) return;
        try {
            const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
            const snap = await getDocs(q);
            const users = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
            setUsersList(users);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'OrganizationSettings.fetchUsers', 'FETCH_FAILED'); }
    }, [user?.organizationId]);

    useEffect(() => {
        fetchOrgDetails();
        fetchUsers();
    }, [fetchOrgDetails, fetchUsers]);

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
                const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
                const snap = await getDocs(q);
                const batch = writeBatch(db);
                snap.docs.forEach(d => {
                    batch.update(d.ref, sanitizeData({ organizationName: data.orgName }));
                });
                await batch.commit();
                setUser({ ...user, organizationName: data.orgName });
            }

            setCurrentOrg(prev => prev ? { ...prev, name: data.orgName, address: data.address, vatNumber: data.vatNumber, contactEmail: data.contactEmail } : null);
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
                window.location.href = '#/pricing';
            } else {
                await SubscriptionService.manageSubscription(user.organizationId);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'OrganizationSettings.handleManageSubscription', 'UNKNOWN_ERROR');
        } finally {
            setSubLoading(false);
        }
    };

    const handleUpdateUserRole = async (targetUserId: string, newRole: UserProfile['role']) => {
        if (!hasPermission(user, 'User', 'manage')) {
            addToast("Vous n'avez pas la permission de gérer les utilisateurs.", "error");
            return;
        }
        setUpdatingUserIds(prev => new Set(prev).add(targetUserId));
        try {
            await updateDoc(doc(db, 'users', targetUserId), sanitizeData({ role: newRole }));
            setUsersList(prev => prev.map(u => u.uid === targetUserId ? { ...u, role: newRole } : u));
            addToast(t('settings.roleUpdated'), "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'OrganizationSettings.handleUpdateUserRole', 'UPDATE_FAILED');
        } finally {
            setUpdatingUserIds(prev => {
                const next = new Set(prev);
                next.delete(targetUserId);
                return next;
            });
        }
    };

    const handleTransferOwnership = async () => {
        if (!transferTargetId) return;
        if (!currentOrg || !user || currentOrg.ownerId !== user.uid) return;

        try {
            const transferOwnership = httpsCallable(functions, 'transferOwnership');
            await transferOwnership({
                organizationId: currentOrg.id,
                newOwnerId: transferTargetId
            });

            addToast(t('settings.transferSuccess'), 'success');
            window.location.reload();
        } catch (error: unknown) {
            ErrorLogger.error(error, 'OrganizationSettings.handleTransferOwnership');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addToast(t('settings.transferError') + errorMessage, 'error');
        }
    };

    const initiateTransfer = (targetId: string) => {
        setTransferTargetId(targetId);
        setConfirmTransferData({
            isOpen: true,
            title: t('settings.transferOwnership'),
            message: "Êtes-vous sûr de vouloir transférer la propriété de l'organisation ? Cette action est irréversible.",
            onConfirm: handleTransferOwnership
        });
    }


    const handleRemoveUser = async (targetUserId: string) => {
        if (!hasPermission(user, 'User', 'manage')) return;
        setConfirmRemoveData(prev => ({ ...prev, loading: true }));
        try {
            await updateDoc(doc(db, 'users', targetUserId), sanitizeData({ organizationId: '', organizationName: '', role: '' }));
            setUsersList(prev => prev.filter(u => u.uid !== targetUserId));
            addToast(t('settings.userRemoved'), "success");
            setConfirmRemoveData(prev => ({ ...prev, isOpen: false }));
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'OrganizationSettings.handleRemoveUser', 'DELETE_FAILED');
        } finally {
            setConfirmRemoveData(prev => ({ ...prev, loading: false }));
        }
    };

    const initiateRemoveUser = (targetUserId: string) => {
        setConfirmRemoveData({
            isOpen: true,
            title: t('settings.confirmRemoveUser'),
            message: t('settings.removeUserMessage') || "Cet utilisateur n'aura plus accès à votre organisation.",
            onConfirm: () => handleRemoveUser(targetUserId),
            loading: false
        });
    };

    const filteredUsers = usersList.filter(u =>
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('settings.organization')}</h2>

            <ConfirmModal
                isOpen={confirmTransferData.isOpen}
                onClose={() => setConfirmTransferData({ ...confirmTransferData, isOpen: false })}
                onConfirm={confirmTransferData.onConfirm}
                title={confirmTransferData.title}
                message={confirmTransferData.message}
            />
            <ConfirmModal
                isOpen={confirmRemoveData.isOpen}
                onClose={() => setConfirmRemoveData({ ...confirmRemoveData, isOpen: false })}
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
                                        {t('settings.renewalDate').replace('{date}', new Date((currentOrg.subscription.currentPeriodEnd as unknown as { seconds: number }).seconds ? (currentOrg.subscription.currentPeriodEnd as unknown as { seconds: number }).seconds * 1000 : (currentOrg.subscription.currentPeriodEnd as string | number)).toLocaleDateString())}
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
                                <Button type="submit" isLoading={savingOrg} className="min-w-[140px] shadow-lg shadow-brand-500/20">
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
                            <input
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
                            <div key={u.uid} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/60 dark:hover:bg-white/10 transition-colors backdrop-blur-[2px]">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 flex items-center justify-center text-slate-500 font-bold border border-white/40 dark:border-white/10 shadow-sm">
                                        {u.photoURL ? <img src={u.photoURL} className="w-full h-full rounded-full object-cover" /> : (u.displayName?.charAt(0) || 'U')}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                                                {u.displayName}
                                            </p>
                                            {currentOrg?.ownerId === u.uid && (
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-full flex items-center gap-1 border border-amber-500/20">
                                                    <Star size={10} />
                                                    {t('settings.owner')}
                                                </span>
                                            )}
                                            {u.uid === user?.uid && (
                                                <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100/50 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300 rounded-full border border-slate-200/50 dark:border-slate-600/50">
                                                    {t('settings.you')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 self-end sm:self-auto">
                                    <div className="w-40">
                                        <CustomSelect
                                            value={u.role}
                                            onChange={(val) => handleUpdateUserRole(u.uid, val as UserProfile['role'])}
                                            options={[
                                                { value: 'admin', label: t('settings.roles.admin') },
                                                { value: 'rssi', label: t('settings.roles.rssi') },
                                                { value: 'auditor', label: t('settings.roles.auditor') },
                                                { value: 'project_manager', label: t('settings.roles.project_manager') },
                                                { value: 'direction', label: t('settings.roles.direction') },
                                                { value: 'user', label: t('settings.roles.user') }
                                            ]}
                                            disabled={u.uid === user.uid || currentOrg?.ownerId === u.uid || updatingUserIds.has(u.uid)}
                                            label=""
                                        />
                                    </div>

                                    <div className="flex items-center border-l border-white/20 dark:border-white/10 pl-3 gap-1">
                                        {/* Transfer Ownership Button (Only for Owner) */}
                                        {currentOrg?.ownerId === user?.uid && u.uid !== user?.uid && (
                                            <button
                                                onClick={() => initiateTransfer(u.uid)}
                                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                title={t('settings.transferOwnership')}
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                        )}

                                        {/* Remove Member Button */}
                                        {(user?.role === 'admin' || currentOrg?.ownerId === user?.uid) && u.uid !== user?.uid && currentOrg?.ownerId !== u.uid && (
                                            <button
                                                onClick={() => initiateRemoveUser(u.uid)}
                                                disabled={updatingUserIds.has(u.uid)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                title={t('settings.removeMember')}
                                            >
                                                {updatingUserIds.has(u.uid) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
