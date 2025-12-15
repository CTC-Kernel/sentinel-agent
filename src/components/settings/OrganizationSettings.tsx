import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { Server, Users, Star, RefreshCw, Trash2, Loader2, FileSpreadsheet } from '../ui/Icons';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { organizationSchema, OrganizationFormData } from '../../schemas/settingsSchema';
import { Button } from '../ui/button';
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

    return (
        <div className="space-y-8 animate-fade-in-up">
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
                <div className="glass-panel rounded-[2rem] p-6 bg-card/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <FileSpreadsheet className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-foreground">{t('settings.subscription')} {currentOrg?.subscription?.planId === 'professional' ? 'Professional' : currentOrg?.subscription?.planId === 'enterprise' ? 'Enterprise' : 'Discovery'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${currentOrg?.subscription?.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-accent text-muted-foreground border-border'}`}>
                                    {currentOrg?.subscription?.status === 'active' ? t('settings.active') : t('settings.free')}
                                </span>
                                {currentOrg?.subscription?.currentPeriodEnd && (
                                    <span className="text-xs text-muted-foreground">{t('settings.renewalDate').replace('{date}', new Date((currentOrg.subscription.currentPeriodEnd as unknown as { seconds: number }).seconds ? (currentOrg.subscription.currentPeriodEnd as unknown as { seconds: number }).seconds * 1000 : (currentOrg.subscription.currentPeriodEnd as string | number)).toLocaleDateString())}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        onClick={handleManageSubscription}
                        isLoading={subLoading}
                        variant="outline"
                        className="bg-background text-foreground hover:bg-accent"
                    >
                        {currentOrg?.subscription?.planId === 'discovery' ? t('settings.upgradeSub') : t('settings.manage')}
                    </Button>
                </div>
            )}

            {/* Admin Details */}
            {hasPermission(user, 'Settings', 'manage') && (
                <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm">
                    <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center gap-4 bg-slate-50/50 dark:bg-white/5">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
                            <Server className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.admin')}</h3>
                            <p className="text-xs text-slate-600 font-medium">{t('settings.orgAdmin')} {orgForm.watch('orgName')}</p>
                        </div>
                    </div>

                    <div className="p-8 border-b border-gray-100 dark:border-white/5">
                        <form onSubmit={orgForm.handleSubmit(handleUpdateOrg)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.orgName')}</label>
                                    <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                        {...orgForm.register('orgName')} />
                                    {orgForm.formState.errors.orgName && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.orgName.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.contactEmail')}</label>
                                    <input type="email" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                        {...orgForm.register('contactEmail')} />
                                    {orgForm.formState.errors.contactEmail && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.contactEmail.message}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('common.address')}</label>
                                    <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                        {...orgForm.register('address')} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.vatNumber')}</label>
                                    <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                        {...orgForm.register('vatNumber')} />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" isLoading={savingOrg} className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
                                    {t('settings.saveChanges')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Management */}
            {user && hasPermission(user, 'User', 'manage') && (
                <div className="glass-panel rounded-[2.5rem] p-8 border border-white/50 dark:border-white/5 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.users')}</h3>
                            <p className="text-xs text-slate-600 font-medium">{t('settings.accessManagement')} ({usersList.length} membres)</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {usersList.map(u => (
                            <div key={u.uid} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 card-hover transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 font-bold">
                                        {u.photoURL ? <img src={u.photoURL} className="w-full h-full rounded-full object-cover" /> : u.displayName?.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {u.displayName}
                                            </p>
                                            {currentOrg?.ownerId === u.uid && (
                                                <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center gap-1">
                                                    <Star size={10} />
                                                    {t('settings.owner')}
                                                </span>
                                            )}
                                            {u.uid === user?.uid && (
                                                <span className="text-xs text-slate-600 dark:text-slate-400">{t('settings.you')}</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600">{u.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={u.role}
                                        onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserProfile['role'])}
                                        disabled={u.uid === user.uid || currentOrg?.ownerId === u.uid || updatingUserIds.has(u.uid)}
                                        className={`text-xs font-bold bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 ${updatingUserIds.has(u.uid) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="rssi">RSSI</option>
                                        <option value="auditor">Auditeur</option>
                                        <option value="project_manager">Chef de Projet</option>
                                        <option value="direction">Direction</option>
                                        <option value="user">Utilisateur</option>
                                    </select>
                                    <div className="flex items-center gap-2">
                                        {/* Transfer Ownership Button (Only for Owner) */}
                                        {currentOrg?.ownerId === user?.uid && u.uid !== user?.uid && (
                                            <button
                                                onClick={() => initiateTransfer(u.uid)}
                                                className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                title={t('settings.transferOwnership')}
                                            >
                                                <RefreshCw size={18} />
                                            </button>
                                        )}

                                        {/* Remove Member Button */}
                                        {(user?.role === 'admin' || currentOrg?.ownerId === user?.uid) && u.uid !== user?.uid && currentOrg?.ownerId !== u.uid && (
                                            <button
                                                onClick={() => initiateRemoveUser(u.uid)}
                                                disabled={updatingUserIds.has(u.uid)}
                                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                title={t('settings.removeMember')}
                                            >
                                                {updatingUserIds.has(u.uid) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={18} />}
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
