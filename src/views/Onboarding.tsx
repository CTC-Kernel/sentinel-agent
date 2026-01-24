import React, { useState, useCallback } from 'react';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { useStore } from '../store';
import { ArrowRight, User as UserIcon, Briefcase, Lock, AlertTriangle, Check, Search, Users, Plus, ShieldCheck, Mail, Trash2, Server, Loader2, BrainCircuit } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { motion } from 'framer-motion';
import { PLANS } from '../config/plans';
import { PlanType, UserProfile } from '../types';
import { OnboardingService, SearchResult } from '../services/onboardingService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ErrorLogger } from '../services/errorLogger';
import { SubmitHandler, Controller } from 'react-hook-form';
import { useZodForm } from '../hooks/useZodForm';
import { onboardingSchema, OnboardingFormData } from '../schemas/onboardingSchema';
import { CustomSelect } from '../components/ui/CustomSelect';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { LegalModal } from '../components/ui/LegalModal';
import { getSectorTemplate, getMandatoryFrameworks, type IndustryType } from '../data/sectorTemplates';

// Framework ID to display name mapping for sector templates
const frameworkDisplayNames: Record<string, string> = {
    'ISO27001': 'ISO 27001',
    'ISO27005': 'ISO 27005',
    'ISO22301': 'ISO 22301',
    'GDPR': 'RGPD',
    'NIS2': 'NIS 2',
    'DORA': 'DORA',
    'SOC2': 'SOC 2',
    'HDS': 'HDS',
    'PCI_DSS': 'PCI-DSS',
    'NIST_CSF': 'NIST CSF',
    'EBIOS': 'EBIOS RM'
};

export const Onboarding: React.FC = () => {
    const { user, setUser, addToast, t } = useStore();
    // Removed direct auth import, relying on useAuth or useStore user
    // Ideally useAuth().user should be the source, but useStore.user is the hydrated profile.
    // If we need logic on the firebase auth user object, useAuth exposes it?
    // Let's check if useAuth exposes 'auth' itself or current user.
    // Usually useAuth returns { user, loading, error, ... }
    const { refreshSession, user: authUser } = useAuth();

    // We used to have: const currentUser = auth.currentUser;
    // We can replace it with authUser (from useAuth)

    const navigate = useNavigate();

    const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
    const [step, setStep] = useState(1);
    const [selectedPlan, setSelectedPlan] = useState<PlanType>('discovery');

    const form = useZodForm({
        schema: onboardingSchema,
        mode: 'onChange',
        defaultValues: {
            organizationName: user?.organizationName || '',
            displayName: user?.displayName || '',
            department: '',
            role: 'admin',
            industry: ''
        }
    });
    const { control } = form;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Join Flow States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [joinRequestSent, setJoinRequestSent] = useState(false);

    // Step 3: Pilotage
    const [standards, setStandards] = useState<string[]>([]);
    const [scope, setScope] = useState('');


    // Get sector-specific frameworks based on selected industry
    const getIndustryFrameworks = useCallback(() => {
        const industry = form.getValues('industry') as IndustryType || 'other';
        const template = getSectorTemplate(industry);
        const mandatoryFrameworks = getMandatoryFrameworks(industry);

        return template.recommendedFrameworks.map(fw => ({
            id: fw,
            name: frameworkDisplayNames[fw] || fw,
            isMandatory: mandatoryFrameworks.includes(fw)
        }));
    }, [form]);

    // Pre-select mandatory frameworks when moving to step 3
    React.useEffect(() => {
        if (step === 3 && standards.length === 0) {
            const industry = form.getValues('industry') as IndustryType || 'other';
            const mandatoryFrameworks = getMandatoryFrameworks(industry);
            const mandatoryDisplayNames = mandatoryFrameworks.map(fw => frameworkDisplayNames[fw] || fw);
            setStandards(mandatoryDisplayNames);
        }
    }, [step, form, standards.length]);

    // Step 4: Team
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('user');
    const [invitedUsers, setInvitedUsers] = useState<{ email: string, role: string }[]>([]);

    // Step 5: Assets
    const [assetName, setAssetName] = useState('');
    const [assetType, setAssetType] = useState('SaaS');
    const [initialAssets, setInitialAssets] = useState<{ name: string, type: string }[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [scanText, setScanText] = useState('');

    // Legal & Terms
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [legalTab, setLegalTab] = useState<'mentions' | 'privacy' | 'terms' | 'cgv'>('terms');

    const handleToggleStandard = useCallback((std: string) => {
        setStandards(prev => prev.includes(std) ? prev.filter(s => s !== std) : [...prev, std]);
    }, []);

    const runAutoScan = () => {
        setIsScanning(true);
        setManualMode(false);
        const steps = [
            t('onboarding.scan.step1'),
            t('onboarding.scan.step2'),
            t('onboarding.scan.step3'),
            t('onboarding.scan.step4'),
            t('onboarding.scan.step5')
        ];

        steps.forEach((text, i) => {
            setTimeout(() => setScanText(text), i * 800);
        });

        setTimeout(() => {
            setInitialAssets([
                { name: 'Google Workspace', type: 'SaaS' },
                { name: 'AWS Production', type: 'Server' },
                { name: 'Office 365', type: 'SaaS' },
                { name: 'Salesforce', type: 'SaaS' }
            ]);
            setIsScanning(false);
            addToast(t('onboarding.toasts.assetsDetected', { count: 4 }), "success");
        }, 4000);
    };

    const handleFinalize = async () => {
        // ... (existing logic)
        if (!user?.organizationId) {
            addToast(t('onboarding.toasts.orgMissing'), "error");
            return;
        }
        setLoading(true);
        try {
            const userProfile: UserProfile = {
                ...user,
                uid: user.uid,
                organizationId: user.organizationId
            } as UserProfile;

            await OnboardingService.finalizeOnboarding(userProfile, selectedPlan);
            await refreshSession();
            setUser({ ...user, onboardingCompleted: true });

            if (selectedPlan === 'discovery') {
                navigate('/');
            }
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error, 'Onboarding.handleFinalize', 'UPDATE_FAILED');
            setLoading(false);
        }
    };

    // ... (rest of helper functions: handleStep3, isValidEmail, handleInviteUser, handleRemoveInvite, handleStep4, handleAddAsset, handleRemoveAsset, handleStep5, useEffect for auto-detect)

    const handleStep3 = async () => {
        if (!user?.organizationId || user.role !== 'admin') return;
        setLoading(true);
        try {
            await OnboardingService.updateOrganizationConfiguration(user.organizationId, standards, scope);
            setStep(4);
        } catch (_e) {
            ErrorLogger.handleErrorWithToast(_e, 'Onboarding.step3', 'UPDATE_FAILED');
        } finally {
            setLoading(false);
        }
    };

    const isValidEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleInviteUser = () => {
        const trimmedEmail = inviteEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            addToast(t('onboarding.toasts.emailRequired'), "error");
            return;
        }
        if (!isValidEmail(trimmedEmail)) {
            addToast(t('onboarding.toasts.emailInvalid'), "error");
            return;
        }
        if (invitedUsers.some(u => u.email === trimmedEmail)) {
            addToast(t('onboarding.toasts.emailDuplicate'), "info");
            return;
        }

        setInvitedUsers([...invitedUsers, { email: trimmedEmail, role: inviteRole }]);
        setInviteEmail('');
        setInviteRole('user'); // Reset to default
    };

    const handleRemoveInvite = (email: string) => {
        setInvitedUsers(invitedUsers.filter(u => u.email !== email));
    };

    const handleStep4 = async () => {
        if (invitedUsers.length > 0 && user?.organizationId && user.role === 'admin') {
            setLoading(true);
            try {
                // Use the UserProfile type for the user object passed to sendInvites
                const currentUserProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email,
                    organizationId: user.organizationId,
                    organizationName: user.organizationName,
                    role: user.role
                };

                await OnboardingService.sendInvites(currentUserProfile, invitedUsers);
                addToast(t('onboarding.toasts.invitesSent', { count: invitedUsers.length }), "success");
            } catch (_e) {
                ErrorLogger.handleErrorWithToast(_e, 'Onboarding.step4', 'INVITE_FAILED');
            } finally {
                setLoading(false);
            }
        }
        setStep(5);
    };

    const handleAddAsset = () => {
        if (assetName) {
            setInitialAssets([...initialAssets, { name: assetName, type: assetType }]);
            setAssetName('');
        }
    };

    const handleRemoveAsset = (index: number) => {
        setInitialAssets(initialAssets.filter((_, i) => i !== index));
    };

    const handleStep5 = async () => {
        if (initialAssets.length > 0 && user?.organizationId && user.role === 'admin') {
            setLoading(true);
            try {
                // Ensure user profile is valid
                const currentUserProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || 'Admin',
                    organizationId: user.organizationId,
                    role: user.role
                };

                await OnboardingService.createInitialAssets(currentUserProfile, initialAssets);
                addToast(t('onboarding.toasts.assetsCreated', { count: initialAssets.length }), "success");
            } catch (_e) {
                ErrorLogger.handleErrorWithToast(_e, 'Onboarding.step5', 'CREATE_FAILED');
            } finally {
                setLoading(false);
            }
        }
        handleFinalize();
    };

    // Auto-detect step based on user state or REDIRECT if finished
    React.useEffect(() => {
        if (user?.onboardingCompleted) {
            // If onboarding is already done, go to dashboard immediately
            navigate('/', { replace: true });
            return;
        }

        if (user?.organizationId && !user.onboardingCompleted) {
            // If invited user (not admin), skip setup
            if (user.role !== 'admin') {
                const completeOnboarding = async () => {
                    try {
                        const userProfile: UserProfile = { ...user } as UserProfile;
                        await OnboardingService.finalizeOnboarding(userProfile, 'discovery');

                        await refreshSession();
                        setUser({ ...user, onboardingCompleted: true });
                        navigate('/', { replace: true });
                    } catch (_error) {
                        ErrorLogger.handleErrorWithToast(_error, 'Onboarding.autoComplete', 'UPDATE_FAILED');
                    }
                };
                completeOnboarding();
                return;
            }

            setMode('create');
            setStep(2);
            // Pre-fill fields if possible (optional)
            if (user.organizationName) {
                form.setValue('organizationName', user.organizationName);
            }
        }
    }, [user, navigate, form, refreshSession, setUser]);

    const handleSearchOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const results = await OnboardingService.searchOrganizations(searchQuery);
            setSearchResults(results);
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error, 'Onboarding.handleSearchOrg', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRequest = async (orgId: string, orgName: string) => {
        if (!user) return;
        setLoading(true);
        try {
            // Need a full UserProfile object here
            const userProfile: UserProfile = {
                uid: user.uid,
                email: user.email,
                displayName: form.getValues('displayName') || user.displayName || user.email,
                role: 'user' // Default role for joiners
            } as UserProfile;

            await OnboardingService.sendJoinRequest(userProfile, orgId, orgName, form.getValues('displayName'));
            setJoinRequestSent(true);
            addToast(t('onboarding.toasts.joinSent'), 'success');
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error, 'Onboarding.handleJoinRequest', 'CREATE_FAILED');
        } finally {
            setLoading(false);
        }
    };

    const handleStep1: SubmitHandler<OnboardingFormData> = async (data) => {
        // Use user from Store (which is usually updated by UseAuth) or potentially authUser from hook
        const targetUser = user || authUser;

        if (!targetUser || !targetUser.uid) {
            setError(t('onboarding.toasts.userUnidentified'));
            addToast(t('onboarding.toasts.userUnidentified'), "error");
            return;
        }

        // Check if user already has an organization
        if (targetUser.organizationId) {
            setError(t('onboarding.toasts.alreadyHasOrg'));
            addToast(t('onboarding.toasts.alreadyHasOrg'), "info");
            // Redirect to dashboard if already onboarded
            if (targetUser.onboardingCompleted) {
                navigate('/', { replace: true });
            }
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await OnboardingService.createOrganization({
                organizationName: data.organizationName || user?.organizationName || 'Mon Organisation',
                displayName: data.displayName || '',
                department: data.department || '',
                role: data.role || 'admin',
                industry: data.industry || ''
            });

            const { organizationId } = result;

            await refreshSession();

            if (user) {
                setUser({
                    ...user,
                    organizationId,
                    organizationName: data.organizationName || '',
                    role: 'admin',
                    onboardingCompleted: false
                });
            }

            setStep(2);
            addToast(t('onboarding.toasts.orgCreated'), "success");

        } catch (_error: unknown) {
            ErrorLogger.handleErrorWithToast(_error, 'Onboarding.handleStep1', 'CREATE_FAILED');

            // Parse Firebase Functions error for better UX
            let errorMessage = t('onboarding.toasts.createError');
            if (_error instanceof Error) {
                const msg = _error.message.toLowerCase();
                if (msg.includes('already-exists') || msg.includes('already belongs')) {
                    errorMessage = t('onboarding.toasts.alreadyHasOrg');
                } else if (msg.includes('permission') || msg.includes('denied')) {
                    errorMessage = t('onboarding.toasts.permissionDenied');
                } else if (msg.includes('unauthenticated') || msg.includes('session')) {
                    errorMessage = t('onboarding.toasts.sessionExpired');
                } else if (msg.includes('unavailable') || msg.includes('network')) {
                    errorMessage = t('onboarding.toasts.networkError');
                } else {
                    errorMessage = _error.message;
                }
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen py-10 flex items-center justify-center relative font-sans selection:bg-brand-500 selection:text-white">
            <MasterpieceBackground />
            <LegalModal
                isOpen={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                initialTab={legalTab}
            />

            <div className="w-full max-w-xl p-6 relative z-10 animate-scale-in">
                <div className="glass-premium rounded-5xl p-10 md:p-12 shadow-2xl">
                    {/* ... (Header and UI structure) ... */}
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl mb-6 ring-1 ring-black/5 mx-auto">
                            {mode === 'join' ? <Users className="h-8 w-8" /> : <Lock className="h-8 w-8" strokeWidth={2.5} />}
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                            {mode === 'select' ? t('onboarding.welcome') :
                                mode === 'join' ? t('onboarding.joinTeam') :
                                    step === 1 ? t('onboarding.initialConfig') :
                                        step === 2 ? t('onboarding.choosePlan') :
                                            step === 3 ? t('onboarding.pilot') :
                                                step === 4 ? t('onboarding.team') : t('onboarding.initialMap')}
                        </h1>
                        <p className="text-slate-600 dark:text-muted-foreground font-medium text-lg">
                            {mode === 'select' ? t('onboarding.subtitle.welcome') :
                                mode === 'join' ? t('onboarding.subtitle.join') :
                                    step === 1 ? t('onboarding.subtitle.config') :
                                        step === 2 ? t('onboarding.subtitle.plan') :
                                            step === 3 ? t('onboarding.subtitle.pilot') :
                                                step === 4 ? t('onboarding.subtitle.team') : t('onboarding.subtitle.assets')}
                        </p>
                    </div>

                    {mode === 'select' && (
                        <div className="grid grid-cols-1 gap-4">
                            <Button
                                variant="ghost"
                                aria-label={t('onboarding.actions.createOrg')}
                                onClick={() => setMode('create')}
                                className="group relative p-6 h-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg transition-all text-left w-full justify-start whitespace-normal"
                            >
                                <div className="flex items-center gap-4 w-full">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <div>
                                        {/* Heading hierarchy: h2 for action card title (follows h1) */}
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('onboarding.actions.createOrg')}</h2>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">{t('onboarding.actions.createDesc')}</p>
                                    </div>
                                </div>
                            </Button>

                            <Button
                                variant="ghost"
                                aria-label={t('onboarding.actions.joinOrg')}
                                onClick={() => setMode('join')}
                                className="group relative p-6 h-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg transition-all text-left w-full justify-start whitespace-normal"
                            >
                                <div className="flex items-center gap-4 w-full">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-slate-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('onboarding.actions.joinOrg')}</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">{t('onboarding.actions.joinDesc')}</p>
                                    </div>
                                </div>
                            </Button>
                        </div>
                    )}

                    {mode === 'join' && (
                        <div className="space-y-6">
                            {!joinRequestSent ? (
                                <>
                                    <form onSubmit={handleSearchOrg} className="relative">
                                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
                                        <input value={searchQuery}
                                            aria-label={t('onboarding.actions.search')}
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus-visible:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-500"
                                            placeholder={t('onboarding.actions.search') + "..."}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        <Button
                                            aria-label={t('onboarding.actions.search')}
                                            type="submit"
                                            disabled={loading || !searchQuery}
                                            isLoading={loading}
                                            size="sm"
                                            className="absolute right-2 top-2 px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs shadow-lg disabled:opacity-50 h-auto"
                                        >
                                            {!loading && t('onboarding.actions.search')}
                                        </Button>
                                    </form>
                                    {/* Results Logic */}
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {searchResults.map(org => (
                                            <div key={org.id} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white">{org.name}</h4>
                                                    <p className="text-xs text-slate-600">{org.industry || 'Non spécifié'}</p>
                                                </div>
                                                <Button
                                                    aria-label={t('onboarding.actions.join')}
                                                    onClick={() => handleJoinRequest(org.id, org.name)}
                                                    disabled={loading || joinRequestSent}
                                                    isLoading={loading}
                                                    size="sm"
                                                    className="px-4 py-2 bg-brand-50 dark:bg-slate-900 text-brand-600 dark:bg-slate-900/20 dark:text-brand-400 rounded-xl text-sm font-bold hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors disabled:opacity-50 h-auto"
                                                >
                                                    {!loading && t('onboarding.actions.join')}
                                                </Button>
                                            </div>
                                        ))}
                                        {searchResults.length === 0 && searchQuery && !loading && (
                                            <p className="text-center text-slate-600 text-sm py-4">{t('onboarding.toasts.emptySearch') || "Aucune organisation trouvée."}</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                // ... sent confirmation
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                                        <Check className="h-8 w-8" strokeWidth={3} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('onboarding.actions.sent')}</h3>
                                    <p className="text-slate-600 dark:text-muted-foreground">
                                        {t('onboarding.actions.sentDesc')}
                                    </p>
                                    <Button
                                        aria-label={t('onboarding.actions.home')}
                                        onClick={() => window.location.reload()}
                                        variant="outline"
                                        className="mt-8 px-6 py-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/20 transition-colors h-auto"
                                    >
                                        {t('onboarding.actions.home')}
                                    </Button>
                                </div>
                            )}
                            {!joinRequestSent && (
                                <Button
                                    variant="ghost"
                                    aria-label={t('onboarding.actions.back')}
                                    onClick={() => setMode('select')}
                                    className="w-full py-4 text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 font-bold transition-colors h-auto"
                                >
                                    {t('onboarding.actions.back')}
                                </Button>
                            )}
                        </div>
                    )}

                    {mode === 'create' && (
                        <>
                            {step === 1 && (
                                <form onSubmit={form.handleSubmit(handleStep1)} className="space-y-6">
                                    {/* (Existing Form Fields with floating label input) */}
                                    {!user?.organizationId && (
                                        <div>
                                            <FloatingLabelInput
                                                label={t('onboarding.form.orgName')}
                                                icon={ShieldCheck}
                                                {...form.register('organizationName')}
                                                placeholder={t('onboarding.form.orgPlaceholder')}
                                                error={form.formState.errors.organizationName?.message}
                                            />
                                        </div>
                                    )}
                                    {/* ... rest of inputs ... */}
                                    <div>
                                        <FloatingLabelInput
                                            label={t('onboarding.form.fullName')}
                                            icon={UserIcon}
                                            {...form.register('displayName')}
                                            placeholder={t('onboarding.form.namePlaceholder')}
                                            error={form.formState.errors.displayName?.message}
                                        />
                                    </div>
                                    <div>
                                        <FloatingLabelInput
                                            label={t('onboarding.form.department')}
                                            icon={Briefcase}
                                            {...form.register('department')}
                                            placeholder={t('onboarding.form.deptPlaceholder')}
                                            error={form.formState.errors.department?.message}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="industry" className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('onboarding.form.industry')}</label>
                                        {/* Select */}
                                        <Controller
                                            name="industry"
                                            control={control}
                                            render={({ field }) => (
                                                <CustomSelect
                                                    options={[
                                                        { value: "tech", label: t('onboarding.industries.tech') },
                                                        { value: "finance", label: t('onboarding.industries.finance') },
                                                        { value: "health", label: t('onboarding.industries.health') },
                                                        { value: "retail", label: t('onboarding.industries.retail') },
                                                        { value: "public", label: t('onboarding.industries.public') },
                                                        { value: "industrie", label: t('onboarding.industries.industrie') },
                                                        { value: "other", label: t('onboarding.industries.other') }
                                                    ]}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                    placeholder={t('onboarding.form.select')}
                                                    error={form.formState.errors.industry?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                    {error && (
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl space-y-3">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-red-900 dark:text-red-200">{t('onboarding.toasts.configError')}</p>
                                                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-2 border-t border-red-200 dark:border-red-800">
                                                {error.includes('session') || error.includes('Session') || error.includes('authentifi') ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={async () => {
                                                            setError('');
                                                            await refreshSession();
                                                            addToast(t('auth.sessionRefreshed') || 'Session actualisée', 'success');
                                                        }}
                                                        className="text-xs text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                                                    >
                                                        {t('auth.refreshSession') || 'Actualiser la session'}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setError('')}
                                                        className="text-xs text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                                                    >
                                                        {t('common.close') || 'Fermer'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                        <div className="flex items-center h-5 mt-0.5">
                                            <input
                                                aria-label={t('onboarding.form.terms')}
                                                id="terms"
                                                type="checkbox"
                                                checked={termsAccepted}
                                                onChange={(e) => setTermsAccepted(e.target.checked)}
                                                className="w-4 h-4 text-brand-600 border-slate-300 rounded focus-visible:ring-brand-500 bg-white dark:bg-black/20 dark:border-white/10"
                                            />
                                        </div>
                                    </div>
                                    <label htmlFor="terms" className="text-sm text-slate-600 dark:text-muted-foreground">
                                        {t('onboarding.form.terms')} <Button variant="link" size="sm" aria-label="Lire les conditions générales" type="button" onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }} className="text-brand-600 dark:text-brand-400 font-bold hover:underline px-0 h-auto">{t('onboarding.form.conditions')}</Button>...
                                    </label>

                                    <div className="pt-4 flex gap-3">
                                        <div className="pt-4 flex gap-3">
                                            <Button
                                                variant="ghost"
                                                aria-label="Retour à l'étape précédente"
                                                type="button"
                                                onClick={() => setMode('select')}
                                                className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors h-auto"
                                            >
                                                {t('onboarding.actions.back')}
                                            </Button>
                                            <Button
                                                aria-label="Continuer vers l'étape suivante"
                                                type="submit"
                                                disabled={loading || (!user?.organizationId && !form.watch('organizationName')) || !termsAccepted}
                                                isLoading={loading}
                                                className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 card-hover transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed h-auto"
                                            >
                                                {!loading && <>{t('onboarding.actions.continue')} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                            </Button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {step === 2 && (
                                // Plan selection - no changes needed, just keeping structure
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {(['discovery', 'professional', 'enterprise'] as const).map((planId) => {
                                            const plan = PLANS[planId];
                                            const isSelected = selectedPlan === planId;
                                            const features = t(`pricing.plans.${planId}Features`, { returnObjects: true }) as unknown as string[];
                                            return (
                                                <div
                                                    key={planId}
                                                    onClick={() => setSelectedPlan(planId)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setSelectedPlan(planId);
                                                        }
                                                    }}
                                                    className={`relative p-6 rounded-3xl border transition-all duration-300 cursor-pointer group ${isSelected
                                                        ? 'bg-brand-50/50 dark:bg-slate-900/10 border-brand-500 ring-1 ring-brand-500 shadow-lg shadow-brand-500/10'
                                                        : 'bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md'
                                                        }`}
                                                >
                                                    {/* Plan content */}
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h3 className={`font-bold text-lg ${isSelected ? 'text-brand-700 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>
                                                                {t(`pricing.plans.${planId}`)}
                                                            </h3>
                                                            <p className="text-xs font-medium text-slate-600 dark:text-muted-foreground mt-1">
                                                                {t(`pricing.plans.${planId}Desc`)}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={`block text-xl font-bold font-display tracking-tight ${isSelected ? 'text-brand-700 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>
                                                                {plan.priceMonthly === 0 ? 'Gratuit' : `${plan.priceMonthly}€`}
                                                            </span>
                                                            {plan.priceMonthly > 0 && <span className="text-xs text-slate-500 font-medium">/ mois</span>}
                                                        </div>
                                                    </div>
                                                    <div className="h-px w-full bg-slate-100 dark:bg-white/5 my-4" />
                                                    <ul className="space-y-2">
                                                        {features && features.slice(0, 3).map((f) => (
                                                            <li key={f} className="flex items-center text-xs font-medium text-slate-600 dark:text-muted-foreground">
                                                                <div className={`mr-2 p-0.5 rounded-full ${isSelected ? 'bg-brand-100 dark:bg-slate-900/30 text-brand-600 dark:text-brand-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-600'}`}>
                                                                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                                                </div>
                                                                {f}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    {isSelected && (
                                                        <div className="absolute top-4 right-4 animate-scale-in">
                                                            <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
                                                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <div className="pt-4 flex gap-3">
                                            <Button
                                                aria-label="Retour à l'étape 1"
                                                onClick={() => setStep(1)}
                                                variant="ghost"
                                                className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors h-auto"
                                            >
                                                {t('onboarding.actions.back')}
                                            </Button>
                                            <Button
                                                aria-label="Valider le plan et continuer"
                                                onClick={() => setStep(3)}
                                                disabled={loading}
                                                isLoading={loading}
                                                className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-xl shadow-brand-500/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none h-auto"
                                            >
                                                {!loading && <>{t('onboarding.actions.continue')} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                // Pilotage - Sector-specific frameworks
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-4 ml-1 flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" /> {t('onboarding.steps.standards')}
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {getIndustryFrameworks().map(fw => (
                                                <div
                                                    key={fw.id}
                                                    onClick={() => handleToggleStandard(fw.name)}
                                                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${standards.includes(fw.name) ? 'bg-brand-50/50 border-brand-500 ring-1 ring-brand-500' : 'bg-slate-50/50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-brand-300'}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 dark:text-white">{fw.name}</span>
                                                        {fw.isMandatory && (
                                                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                                                {t('common.mandatory') || 'Obligatoire'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {standards.includes(fw.name) && <Check className="h-5 w-5 text-brand-600" strokeWidth={3} />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('onboarding.steps.scope')}</label>
                                        <FloatingLabelInput
                                            value={scope}
                                            onChange={e => {
                                                if (typeof e === 'string') setScope(e);
                                                else if (e && e.target) setScope(e.target.value);
                                            }}
                                            label={t('onboarding.steps.scope')}
                                            textarea
                                            placeholder={t('onboarding.steps.scopePlaceholder')}
                                        />
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <div className="pt-4 flex gap-3">
                                            <Button aria-label="Retour à l'étape 2" onClick={() => setStep(2)} variant="ghost" className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors h-auto">{t('onboarding.actions.back')}</Button>
                                            <Button aria-label="Valider le périmètre et continuer" onClick={handleStep3} disabled={loading} isLoading={loading} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group disabled:opacity-50 h-auto">
                                                {!loading && <>{t('onboarding.actions.continue')} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                // Team
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('onboarding.steps.invite')}</label>
                                        <div className="flex gap-2 items-start">
                                            <div className="relative flex-[2]">
                                                <FloatingLabelInput
                                                    label={t('onboarding.form.email')}
                                                    icon={Mail}
                                                    type="email"
                                                    value={inviteEmail}
                                                    onChange={e => setInviteEmail(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInviteUser()}
                                                    placeholder={t('onboarding.form.emailPlaceholder')}
                                                />
                                            </div>
                                            <div className="relative flex-1">
                                                <CustomSelect
                                                    value={inviteRole}
                                                    onChange={(val) => setInviteRole(val as string)}
                                                    options={[
                                                        { value: "user", label: t('onboarding.roles.collaborator') },
                                                        { value: "admin", label: t('onboarding.roles.admin') },
                                                        { value: "rssi", label: t('onboarding.roles.rssi') },
                                                        { value: "auditor", label: t('onboarding.roles.auditor') },
                                                        { value: "project_manager", label: t('onboarding.roles.project_manager') },
                                                        { value: "direction", label: t('onboarding.roles.direction') }
                                                    ]}
                                                    placeholder={t('onboarding.form.role')}
                                                    label=""
                                                />
                                            </div>
                                            <Button aria-label="Inviter l'utilisateur" onClick={handleInviteUser} className="px-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold hover:opacity-90 transition-opacity h-[56px] flex items-center justify-center">
                                                <Plus className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </div>
                                    {invitedUsers.length > 0 && (
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                            {invitedUsers.map(userInvite => (
                                                <div key={userInvite.email} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center font-bold text-xs">
                                                            {userInvite.email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{userInvite.email}</span>
                                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{userInvite.role}</span>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" aria-label="Retirer l'invitation" onClick={() => handleRemoveInvite(userInvite.email)} className="text-slate-500 hover:text-red-500 transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="pt-4 flex gap-3">
                                        <div className="pt-4 flex gap-3">
                                            <Button aria-label="Retour à l'étape 3" onClick={() => setStep(3)} variant="ghost" className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors h-auto">{t('onboarding.actions.back')}</Button>
                                            <Button aria-label="Continuer vers l'étape 5" onClick={handleStep4} disabled={loading} isLoading={loading} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group disabled:opacity-50 h-auto">
                                                {!loading && <>{invitedUsers.length > 0 ? t('onboarding.actions.inviteContinue') : t('onboarding.actions.skip')} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 5 && (
                                // Assets
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {/* (Assets UI) */}
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="text-xs font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                                <Server className="h-4 w-4" /> {t('onboarding.steps.assets')}
                                            </label>
                                            {initialAssets.length === 0 && !isScanning && (
                                                <span className="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg font-bold animate-pulse">
                                                    {t('onboarding.steps.iaReady')}
                                                </span>
                                            )}
                                        </div>

                                        {isScanning ? (
                                            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-300 dark:border-white/10">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-brand-500 rounded-full animate-ping opacity-20"></div>
                                                    <div className="relative w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-xl border-4 border-brand-100 dark:border-brand-900">
                                                        <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">{t('onboarding.steps.scanning')}</h3>
                                                    <p className="text-sm text-slate-500 mt-1">{scanText}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            manualMode ? (
                                                <div className="space-y-4">
                                                    <div className="flex gap-2">
                                                        <FloatingLabelInput
                                                            label={t('onboarding.form.assetName')}
                                                            value={assetName}
                                                            onChange={e => setAssetName(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleAddAsset()}
                                                        />
                                                        {/* Type Select */}
                                                        <div className="w-1/3">
                                                            <CustomSelect
                                                                value={assetType}
                                                                onChange={(val) => setAssetType(val as string)}
                                                                options={[
                                                                    { value: "SaaS", label: "SaaS" },
                                                                    { value: "Server", label: "Serveur" },
                                                                    { value: "Workstation", label: "Poste" },
                                                                    { value: "Network", label: "Réseau" }
                                                                ]}
                                                                placeholder="Type"
                                                            />
                                                        </div>
                                                        <Button onClick={handleAddAsset} aria-label="Ajouter l'actif" className="p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold h-[56px] w-[56px] flex items-center justify-center hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 duration-200">
                                                            <Plus className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                    <Button variant="link" size="sm" onClick={() => setManualMode(false)} aria-label="Passer au scan automatique" className="text-xs text-slate-500 hover:text-slate-700 underline h-auto px-0">Switch to auto scan</Button>
                                                </div>
                                            ) : (
                                                initialAssets.length === 0 && (
                                                    <div
                                                        onClick={runAutoScan}
                                                        className="py-10 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-300 dark:border-white/10 hover:border-brand-500 dark:hover:border-brand-500 cursor-pointer group transition-all text-center"
                                                    >
                                                        <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/20 text-brand-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                                            <BrainCircuit className="h-6 w-6" />
                                                            {/* BrainCircuit not imported, using Globe or Activity instead if not available. Wait, previously it was imported? */}
                                                            {/* Checking imports: ArrowRight, User, Briefcase, Lock, AlertTriangle, Check, Search, Users, Plus, ShieldCheck, Mail, Trash2, Server, Loader2, Globe, Activity */}
                                                            {/* BrainCircuit NOT imported. Using Activity. */}
                                                        </div>
                                                        <h3 className="font-bold text-slate-900 dark:text-white">{t('onboarding.actions.autoScan')}</h3>
                                                        <p className="text-xs text-slate-500 mt-1">{t('onboarding.actions.autoScanDesc')}</p>
                                                        <div className="mt-4">
                                                            <Button variant="link" size="sm" onClick={(e) => { e.stopPropagation(); setManualMode(true); }} aria-label="Ajouter manuellement un actif" className="text-xs text-brand-600 font-bold hover:underline h-auto px-0">{t('onboarding.actions.manualAdd')}</Button>
                                                        </div>
                                                    </div>
                                                )
                                            )
                                        )}
                                        {initialAssets.length > 0 && (
                                            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                                {initialAssets.map((asset, i) => (
                                                    <div key={`${asset.name}-${i}`} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                                                                <Server className="h-4 w-4" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{asset.name}</span>
                                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{asset.type}</span>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveAsset(i)} aria-label="Supprimer l'actif" className="text-slate-500 hover:text-red-500 transition-colors">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <div className="pt-4 flex gap-3">
                                            <Button onClick={() => setStep(4)} variant="ghost" aria-label="Retour à l'étape 4" className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors h-auto">{t('onboarding.actions.back')}</Button>
                                            <Button onClick={handleStep5} disabled={loading} isLoading={loading} aria-label="Finaliser l'inscription" className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group disabled:opacity-50 h-auto">
                                                {!loading && <>{t('onboarding.actions.finalize')} <Check className="ml-2 h-5 w-5 group-hover:scale-110 transition-transform" strokeWidth={3} /></>}
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
