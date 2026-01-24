import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { Building, Users, FileSpreadsheet, Search } from '../ui/Icons';
import { useNavigate } from 'react-router-dom';

import { SubmitHandler } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { organizationSchema, OrganizationFormData } from '../../schemas/settingsSchema';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { functions } from '../../firebase';
import { httpsCallable } from 'firebase/functions';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { hasPermission } from '../../utils/permissions';
import { logAction } from '../../services/logger'; // Added import
import { SubscriptionService } from '../../services/subscriptionService';
import { UserProfile } from '../../types';
import { ConfirmModal } from '../ui/ConfirmModal'; // Keyboard: Escape key supported
import { UserRow } from './UserRow';
import { useSettingsData } from '../../hooks/settings/useSettingsData';
import { Switch } from '../ui/Switch';
import { GlassCard } from '../ui/GlassCard';

const SECONDS_TO_MS = 1000;

export const OrganizationSettings: React.FC = () => {
    const { user, setUser, addToast, t } = useStore();
    const navigate = useNavigate();
    const { organization, users: hookUsers, updateOrganization, batchUpdateOrgUsers, updateUser } = useSettingsData();
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

    const orgForm = useZodForm<typeof organizationSchema>({
        schema: organizationSchema,
        mode: 'onChange',
        defaultValues: {
            orgName: '',
            address: '',
            vatNumber: '',
            contactEmail: '',
            lei: '',
            country: undefined,
            aiSettings: {
                enabled: true,
                consentGiven: false,
                dataSanitization: true
            }
        }
    });

    // Sync form with organization data
    useEffect(() => {
        if (organization) {
            orgForm.reset({
                orgName: organization.name || '',
                address: organization.address || '',
                vatNumber: organization.vatNumber || '',
                contactEmail: organization.contactEmail || '',
                lei: organization.lei || '',
                country: organization.country as typeof orgForm.getValues extends () => infer T ? T extends { country?: infer C } ? C : undefined : undefined,
                aiSettings: organization.settings?.aiSettings || {
                    enabled: true,
                    consentGiven: false,
                    dataSanitization: true
                }
            });
        }
    }, [organization, orgForm]);

    const handleUpdateOrg: SubmitHandler<OrganizationFormData> = useCallback(async (data) => {
        if (!hasPermission(user, 'Settings', 'manage') || !user?.organizationId) return;

        setSavingOrg(true);
        try {
            await updateOrganization(sanitizeData({
                name: data.orgName,
                address: data.address,
                vatNumber: data.vatNumber,
                contactEmail: data.contactEmail,
                // DORA Compliance fields
                lei: data.lei || undefined,
                country: data.country || undefined,
                settings: {
                    ...currentOrg?.settings,
                    aiSettings: data.aiSettings
                }
            }));

            if (currentOrg?.name !== data.orgName) {
                await batchUpdateOrgUsers(user.organizationId, data.orgName);
                setUser({ ...user, organizationName: data.orgName });
            }

            await logAction(user, 'UPDATE', 'Organization', `Mise à jour organisation: ${data.orgName}`);
            addToast(t('settings.orgUpdated'), "success");
        } catch (_e) {
            ErrorLogger.handleErrorWithToast(_e, 'OrganizationSettings.handleUpdateOrg', 'UPDATE_FAILED');
        } finally {
            setSavingOrg(false);
        }
    }, [user, currentOrg, updateOrganization, batchUpdateOrgUsers, setUser, addToast, t]);

    const handleManageSubscription = useCallback(async () => {
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
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error, 'OrganizationSettings.handleManageSubscription', 'UNKNOWN_ERROR');
        } finally {
            setSubLoading(false);
        }
    }, [user, currentOrg, navigate, addToast, t]);

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
            await updateUser(targetUserId, sanitizeData({ role: newRole }));
            await logAction(user, 'UPDATE', 'User', `Rôle mis à jour pour ${targetUserId}: ${newRole}`);
            addToast(t('settings.success.roleUpdated'), 'success');
        } catch (_e) {
            ErrorLogger.handleErrorWithToast(_e, 'OrganizationSettings.handleUpdateUserRole', 'UPDATE_FAILED');
        } finally {
            setUpdatingUserIds(prev => {
                const next = new Set(prev);
                next.delete(targetUserId);
                return next;
            });
        }
    }, [canManageRestrictedRoles, addToast, t, user, updateUser]);

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
        } catch (error: unknown) {
            ErrorLogger.error(error, 'OrganizationSettings.handleTransferOwnership');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addToast(t('settings.transferError') + errorMessage, 'error');
        }
    }, [currentOrg, user, t, addToast]);

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
            await updateUser(targetUserId, sanitizeData({ organizationId: '', organizationName: '', role: '' }));
            await logAction(user, 'DELETE', 'User', `Utilisateur retiré de l'organisation: ${targetUserId}`);
            addToast(t('settings.userRemoved'), 'success');
            setConfirmRemoveData(prev => ({ ...prev, isOpen: false }));
        } catch (_e) {
            ErrorLogger.handleErrorWithToast(_e, 'OrganizationSettings.handleRemoveUser', 'DELETE_FAILED');
        } finally {
            setConfirmRemoveData(prev => ({ ...prev, loading: false }));
        }
    }, [user, addToast, t, updateUser]);

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
                <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 rounded-4xl p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden group border border-white/10">
                    <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/15 transition-colors duration-500"></div>

                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner">
                                <FileSpreadsheet className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    {/* Heading hierarchy: h2 for subscription details (follows h1) */}
                                    <h2 className="text-xl font-bold">
                                        {currentOrg?.subscription?.planId === 'professional' ? t('settings.plans.professional') :
                                            currentOrg?.subscription?.planId === 'enterprise' ? t('settings.plans.enterprise') :
                                                t('settings.plans.discovery')}
                                    </h2>
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
                <GlassCard className="p-0 rounded-5xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-brand-500/10 dark:bg-brand-500/20 rounded-xl text-brand-600 dark:text-brand-400">
                                <Building className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.admin')}</h3>
                        </div>
                    </div>

                    <div className="relative z-10 p-6">
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
                                    label={t('settings.address')}
                                    {...orgForm.register('address')}
                                />
                                <FloatingLabelInput
                                    label={t('settings.vatNumber')}
                                    {...orgForm.register('vatNumber')}
                                />
                            </div>

                            {/* DORA Compliance Section */}
                            <div className="pt-6 border-t border-white/10">
                                <h4 className="text-md font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <span className="text-blue-500">🏛️</span> {t('settings.doraCompliance', { defaultValue: 'Conformité DORA' })}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    {t('settings.doraComplianceDesc', { defaultValue: 'Informations requises pour la conformité au règlement DORA (Digital Operational Resilience Act) - Article 3.' })}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FloatingLabelInput
                                        label={t('settings.lei', { defaultValue: 'LEI (Legal Entity Identifier)' })}
                                        {...orgForm.register('lei')}
                                        error={orgForm.formState.errors.lei?.message}
                                        placeholder="Ex: 549300EXAMPLE00LEI90"
                                    />
                                    <div className="space-y-1">
                                        <label htmlFor="country-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {t('settings.country', { defaultValue: 'Pays (UE)' })}
                                        </label>
                                        <select
                                            id="country-select"
                                            {...orgForm.register('country')}
                                            className="w-full px-4 py-3 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus-visible:ring-brand-500/20 transition-all"
                                        >
                                            <option value="">{t('settings.selectCountry', { defaultValue: 'Sélectionner un pays' })}</option>
                                            <option value="AT">Autriche</option>
                                            <option value="BE">Belgique</option>
                                            <option value="BG">Bulgarie</option>
                                            <option value="HR">Croatie</option>
                                            <option value="CY">Chypre</option>
                                            <option value="CZ">République tchèque</option>
                                            <option value="DK">Danemark</option>
                                            <option value="EE">Estonie</option>
                                            <option value="FI">Finlande</option>
                                            <option value="FR">France</option>
                                            <option value="DE">Allemagne</option>
                                            <option value="GR">Grèce</option>
                                            <option value="HU">Hongrie</option>
                                            <option value="IE">Irlande</option>
                                            <option value="IT">Italie</option>
                                            <option value="LV">Lettonie</option>
                                            <option value="LT">Lituanie</option>
                                            <option value="LU">Luxembourg</option>
                                            <option value="MT">Malte</option>
                                            <option value="NL">Pays-Bas</option>
                                            <option value="PL">Pologne</option>
                                            <option value="PT">Portugal</option>
                                            <option value="RO">Roumanie</option>
                                            <option value="SK">Slovaquie</option>
                                            <option value="SI">Slovénie</option>
                                            <option value="ES">Espagne</option>
                                            <option value="SE">Suède</option>
                                        </select>
                                        {orgForm.formState.errors.country?.message && (
                                            <p className="text-xs text-red-500 mt-1">{orgForm.formState.errors.country.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* AI & Privacy Section */}
                            <div className="pt-6 border-t border-white/10">
                                <h4 className="text-md font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <span className="text-brand-500">✨</span> {t('settings.aiPrivacyTitle', { defaultValue: 'Sentinel AI & Confidentialité' })}
                                </h4>
                                <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {t('settings.enableAI', { defaultValue: 'Activer Sentinel AI' })}
                                            </label>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                                                {t('settings.enableAIDesc', { defaultValue: 'Permet l\'utilisation des fonctionnalités d\'intelligence artificielle pour l\'analyse de risques et la génération de contenu.' })}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={!!orgForm.watch('aiSettings.enabled')}
                                            onChange={(checked: boolean) => orgForm.setValue('aiSettings.enabled', checked, { shouldDirty: true })}
                                        />
                                    </div>

                                    {orgForm.watch('aiSettings.enabled') && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {t('settings.dataSanitization', { defaultValue: 'Anonymisation des Données' })}
                                                    </label>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                                                        {t('settings.dataSanitizationDesc', { defaultValue: 'Supprime automatiquement les noms, emails et numéros de téléphone avant l\'envoi aux modèles IA.' })}
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={!!orgForm.watch('aiSettings.dataSanitization')}
                                                    onChange={(checked: boolean) => orgForm.setValue('aiSettings.dataSanitization', checked, { shouldDirty: true })}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between opacity-80">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {t('settings.aiConsent', { defaultValue: 'Consentement d\'analyse' })}
                                                    </label>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                                                        {t('settings.aiConsentDesc', { defaultValue: 'J\'autorise Sentinel à traiter les données (anonymisées si activé) pour fournir des analyses.' })}
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={!!orgForm.watch('aiSettings.consentGiven')}
                                                    onChange={(checked: boolean) => orgForm.setValue('aiSettings.consentGiven', checked, { shouldDirty: true })}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button type="submit" isLoading={savingOrg} disabled={savingOrg} className="min-w-[140px] shadow-lg shadow-brand-500/20">
                                    {t('settings.saveChanges')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </GlassCard>
            )}

            {/* User Management */}
            {user && hasPermission(user, 'User', 'manage') && (
                <GlassCard className="p-0 rounded-5xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
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
                                className="pl-9 pr-4 py-2 bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus-visible:ring-brand-500/20 w-48 transition-all focus:w-64"
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
                </GlassCard>
            )}
        </div>
    );
};
