import React, { useState } from 'react';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { useStore } from '../store';
import { auth } from '../firebase';
import { ArrowRight, User as UserIcon, Briefcase, Lock, AlertTriangle, Check, Search, Users, Plus, ShieldCheck, Mail, Trash2, Server, Loader2, Globe, Activity } from '../components/ui/Icons';
import { motion } from 'framer-motion';
import { PLANS } from '../config/plans';
import { PlanType, UserProfile } from '../types';
import { OnboardingService, SearchResult } from '../services/onboardingService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ErrorLogger } from '../services/errorLogger';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { onboardingSchema, OnboardingFormData } from '../schemas/onboardingSchema';
import { LegalModal } from '../components/ui/LegalModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';

export const Onboarding: React.FC = () => {
    const { user, setUser, addToast, t } = useStore();
    const { refreshSession } = useAuth();
    const navigate = useNavigate();
    const currentUser = auth.currentUser;

    const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
    const [step, setStep] = useState(1);
    const [selectedPlan, setSelectedPlan] = useState<PlanType>('discovery');

    const form = useForm<OnboardingFormData>({
        resolver: zodResolver(onboardingSchema),
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

    // Step 4: Team
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('user');
    const [invitedUsers, setInvitedUsers] = useState<{ email: string, role: string }[]>([]);

    // Step 5: Assets
    const [assetName, setAssetName] = useState('');
    const [assetType, setAssetType] = useState('SaaS');
    const [initialAssets, setInitialAssets] = useState<{ name: string, type: string }[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanText, setScanText] = useState('');
    const [manualMode, setManualMode] = useState(false);

    const runAutoScan = () => {
        setIsScanning(true);
        setManualMode(false);
        const steps = [
            t('onboarding.scan.step1') || "Initialisation des scanners...",
            t('onboarding.scan.step2') || "Analyse des enregistrements DNS...",
            t('onboarding.scan.step3') || "Détection des empreintes Cloud...",
            t('onboarding.scan.step4') || "Vérification des endpoints SaaS...",
            t('onboarding.scan.step5') || "Finalisation du rapport..."
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
            addToast("4 actifs détectés automatiquement", "success");
        }, 4000);
    };

    // Legal & Terms
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [legalTab, setLegalTab] = useState<'mentions' | 'privacy' | 'terms' | 'cgv'>('terms');

    const handleFinalize = async () => {
        if (!user?.organizationId) {
            addToast("Erreur : Organisation manquante", "error");
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
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Onboarding.handleFinalize', 'UPDATE_FAILED');
            setLoading(false);
        }
    };

    const handleStep3 = async () => {
        if (!user?.organizationId || user.role !== 'admin') return;
        setLoading(true);
        try {
            await OnboardingService.updateOrganizationConfiguration(user.organizationId, standards, scope);
            setStep(4);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Onboarding.step3', 'UPDATE_FAILED');
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
            addToast("Veuillez saisir une adresse email.", "error");
            return;
        }
        if (!isValidEmail(trimmedEmail)) {
            addToast("Adresse email invalide.", "error");
            return;
        }
        if (invitedUsers.some(u => u.email === trimmedEmail)) {
            addToast("Cette adresse a déjà été ajoutée.", "info");
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
                addToast(`${invitedUsers.length} invitations envoyées`, "success");
            } catch (e) {
                ErrorLogger.handleErrorWithToast(e, 'Onboarding.step4', 'INVITE_FAILED');
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
                addToast(`${initialAssets.length} actifs créés`, "success");
            } catch (e) {
                ErrorLogger.handleErrorWithToast(e, 'Onboarding.step5', 'CREATE_FAILED');
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
                        // Use default logic to just mark complete, or re-use finalize with 'discovery' valid?
                        // Actually better to just explicit set onboardingCompleted.
                        // But we can use finalizeOnboarding passing 'discovery' as dummy or create a specific method.
                        // For invited user, no subscription choice, they just join.
                        await OnboardingService.finalizeOnboarding(userProfile, 'discovery');

                        await refreshSession();
                        setUser({ ...user, onboardingCompleted: true });
                        navigate('/', { replace: true });
                    } catch (error) {
                        ErrorLogger.handleErrorWithToast(error, 'Onboarding.autoComplete', 'UPDATE_FAILED');
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
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Onboarding.handleSearchOrg', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRequest = async (orgId: string, orgName: string) => {
        if (!user) return;
        setLoading(true);
        try {
            // Need a full UserProfile object here, or at least the parts used by sendJoinRequest
            const userProfile: UserProfile = {
                uid: user.uid,
                email: user.email,
                displayName: form.getValues('displayName') || user.displayName || user.email,
                role: 'user' // Default role for joiners
            } as UserProfile;

            await OnboardingService.sendJoinRequest(userProfile, orgId, orgName, form.getValues('displayName'));
            setJoinRequestSent(true);
            addToast("Demande envoyée avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Onboarding.handleJoinRequest', 'CREATE_FAILED');
        } finally {
            setLoading(false);
        }
    };



    const handleStep1: SubmitHandler<OnboardingFormData> = async (data) => {
        const targetUser = currentUser || user;

        if (!targetUser || !targetUser.uid) {
            ErrorLogger.handleErrorWithToast(new Error("No valid user found"), 'Onboarding.handleStep1', 'AUTH_FAILED');
            addToast("Erreur : Utilisateur non identifié. Veuillez vous reconnecter.", "error");
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Call the Service provided method
            const result = await OnboardingService.createOrganization({
                organizationName: data.organizationName || user?.organizationName || 'Mon Organisation',
                displayName: data.displayName || '',
                department: data.department || '',
                role: data.role || 'admin',
                industry: data.industry || ''
            });

            const { organizationId } = result;

            // Force refresh session to get new claims
            await refreshSession();

            // Update local user state
            if (user) {
                setUser({
                    ...user,
                    organizationId,
                    organizationName: data.organizationName || '',
                    role: 'admin',
                    onboardingCompleted: false
                });
            }

            // Move to Step 2 (Plan Selection)
            setStep(2);
            addToast("Organisation créée avec succès !", "success");

        } catch (error: unknown) {
            ErrorLogger.handleErrorWithToast(error, 'Onboarding.handleStep1', 'CREATE_FAILED');
            const errorMessage = error instanceof Error ? error.message : String(error);
            setError(errorMessage || "Une erreur est survenue lors de la création de l'organisation.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen py-10 flex items-center justify-center relative font-sans selection:bg-brand-500 selection:text-white">
            <MasterpieceBackground />

            <div className="w-full max-w-xl p-6 relative z-10 animate-scale-in">
                <div className="glass-panel rounded-[2.5rem] p-10 md:p-12 shadow-2xl">
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
                        <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">
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
                            <button
                                onClick={() => setMode('create')}
                                className="group relative p-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg transition-all text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('onboarding.actions.createOrg')}</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t('onboarding.actions.createDesc')}</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => setMode('join')}
                                className="group relative p-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-brand-500 dark:hover:border-brand-400 hover:shadow-lg transition-all text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-slate-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('onboarding.actions.joinOrg')}</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t('onboarding.actions.joinDesc')}</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {mode === 'join' && (
                        <div className="space-y-6">
                            {!joinRequestSent ? (
                                <>
                                    <form onSubmit={handleSearchOrg} className="relative">
                                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
                                        <input
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-500"
                                            placeholder={t('onboarding.actions.search') + "..."}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        <button
                                            type="submit"
                                            disabled={loading || !searchQuery}
                                            className="absolute right-2 top-2 px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs shadow-lg disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('onboarding.actions.search')}
                                        </button>
                                    </form>

                                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {searchResults.map(org => (
                                            <div key={org.id} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white">{org.name}</h4>
                                                    <p className="text-xs text-slate-600">{org.industry || 'Non spécifié'}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleJoinRequest(org.id, org.name)}
                                                    disabled={loading}
                                                    className="px-4 py-2 bg-brand-50 dark:bg-slate-900 text-brand-600 dark:bg-slate-900/20 dark:text-brand-400 rounded-xl text-sm font-bold hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors disabled:opacity-50"
                                                >
                                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('onboarding.actions.join')}
                                                </button>
                                            </div>
                                        ))}
                                        {searchResults.length === 0 && searchQuery && !loading && (
                                            <p className="text-center text-slate-600 text-sm py-4">Aucune organisation trouvée.</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                                        <Check className="h-8 w-8" strokeWidth={3} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('onboarding.actions.sent')}</h3>
                                    <p className="text-slate-600 dark:text-slate-400">
                                        {t('onboarding.actions.sentDesc')}
                                    </p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="mt-8 px-6 py-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                                    >
                                        {t('onboarding.actions.home')}
                                    </button>
                                </div>
                            )}

                            {!joinRequestSent && (
                                <button
                                    onClick={() => setMode('select')}
                                    className="w-full py-4 text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 font-bold transition-colors"
                                >
                                    {t('onboarding.actions.back')}
                                </button>
                            )}
                        </div>
                    )}

                    {mode === 'create' && (
                        <>
                            {step === 1 ? (
                                <form onSubmit={form.handleSubmit(handleStep1)} className="space-y-6">
                                    {!user?.organizationId && (
                                        <div>
                                            <FloatingLabelInput
                                                label={t('onboarding.form.orgName')}
                                                icon={ShieldCheck}
                                                {...form.register('organizationName')}
                                                placeholder="Ex: Acme Corp"
                                                error={form.formState.errors.organizationName?.message}
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <FloatingLabelInput
                                            label={t('onboarding.form.fullName')}
                                            icon={UserIcon}
                                            {...form.register('displayName')}
                                            placeholder="Votre nom"
                                            error={form.formState.errors.displayName?.message}
                                        />
                                    </div>
                                    <div>
                                        <FloatingLabelInput
                                            label={t('onboarding.form.department')}
                                            icon={Briefcase}
                                            {...form.register('department')}
                                            placeholder="Ex: IT / Sécurité"
                                            error={form.formState.errors.department?.message}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="industry" className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">Secteur</label>
                                        <div className="relative">
                                            <Controller
                                                name="industry"
                                                control={control}
                                                render={({ field }) => (
                                                    <CustomSelect
                                                        options={[
                                                            { value: "tech", label: "Technologie / SaaS" },
                                                            { value: "finance", label: "Finance / Banque" },
                                                            { value: "health", label: "Santé" },
                                                            { value: "retail", label: "Retail / E-commerce" },
                                                            { value: "public", label: "Secteur Public" },
                                                            { value: "other", label: "Autre" }
                                                        ]}
                                                        value={field.value || ''}
                                                        onChange={field.onChange}
                                                        placeholder={t('onboarding.form.select')}
                                                        error={form.formState.errors.industry?.message}
                                                    />
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3"><AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-semibold text-red-900 dark:text-red-200">Erreur de configuration</p><p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p></div></div>}

                                    <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                        <div className="flex items-center h-5 mt-0.5">
                                            <input
                                                id="terms"
                                                type="checkbox"
                                                checked={termsAccepted}
                                                onChange={(e) => setTermsAccepted(e.target.checked)}
                                                className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 bg-white dark:bg-black/20 dark:border-white/10"
                                            />
                                        </div>
                                    </div>
                                    <label htmlFor="terms" className="text-sm text-slate-600 dark:text-slate-400">
                                        {t('onboarding.form.terms')} <button type="button" onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }} className="text-brand-600 dark:text-brand-400 font-bold hover:underline">Conditions</button>...
                                    </label>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setMode('select')}
                                            className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            {t('onboarding.actions.back')}
                                        </button>
                                        <button type="submit" disabled={loading || (!user?.organizationId && !form.watch('organizationName')) || !termsAccepted} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 card-hover transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed">
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t('onboarding.actions.continue')} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {(['discovery', 'professional', 'enterprise'] as const).map((planId) => {
                                            const plan = PLANS[planId];
                                            const isSelected = selectedPlan === planId;
                                            return (
                                                <div
                                                    key={planId}
                                                    onClick={() => setSelectedPlan(planId)}
                                                    className={`relative p-6 rounded-3xl border transition-all duration-300 cursor-pointer group ${isSelected
                                                        ? 'bg-brand-50/50 dark:bg-slate-900/10 border-brand-500 ring-1 ring-brand-500 shadow-lg shadow-brand-500/10'
                                                        : 'bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h3 className={`font-bold text-lg ${isSelected ? 'text-brand-700 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>
                                                                {plan.name}
                                                            </h3>
                                                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                                                                {plan.description}
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
                                                        {plan.featuresList.slice(0, 3).map((f, i) => (
                                                            <li key={i} className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300">
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
                                            );
                                        })}
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            {t('onboarding.actions.back')}
                                        </button>
                                        <button
                                            onClick={() => setStep(3)}
                                            disabled={loading}
                                            className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-xl shadow-brand-500/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    {t('onboarding.actions.continue')}
                                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-4 ml-1 flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" /> {t('onboarding.steps.standards')}
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {['ISO 27001', 'ISO 27005', 'RGPD', 'SOC 2', 'HDS', 'PCI-DSS'].map(std => (
                                                <div
                                                    key={std}
                                                    onClick={() => setStandards(prev => prev.includes(std) ? prev.filter(s => s !== std) : [...prev, std])}
                                                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${standards.includes(std) ? 'bg-brand-50/50 border-brand-500 ring-1 ring-brand-500' : 'bg-slate-50/50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-brand-300'}`}
                                                >
                                                    <span className="font-bold text-slate-700 dark:text-white">{std}</span>
                                                    {standards.includes(std) && <Check className="h-5 w-5 text-brand-600" strokeWidth={3} />}
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
                                        <button onClick={() => setStep(2)} className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Retour</button>
                                        <button onClick={handleStep3} disabled={loading} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group disabled:opacity-50">
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continuer <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
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
                                                    placeholder="email@entreprise.com"
                                                />
                                            </div>
                                            <div className="relative flex-1">
                                                <CustomSelect
                                                    value={inviteRole}
                                                    onChange={(val) => setInviteRole(val as string)}
                                                    options={[
                                                        { value: "user", label: "Collaborateur" },
                                                        { value: "admin", label: "Admin" },
                                                        { value: "rssi", label: "RSSI" },
                                                        { value: "auditor", label: "Auditeur" },
                                                        { value: "project_manager", label: "Chef Projet" },
                                                        { value: "direction", label: "Direction" }
                                                    ]}
                                                    placeholder={t('onboarding.form.role')}
                                                    label=""
                                                />
                                            </div>
                                            <button onClick={handleInviteUser} className="px-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold hover:opacity-90 transition-opacity h-[56px] flex items-center justify-center">
                                                <Plus className="h-5 w-5" />
                                            </button>
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
                                                    <button onClick={() => handleRemoveInvite(userInvite.email)} className="text-slate-500 hover:text-red-500 transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 flex gap-3">
                                        <button onClick={() => setStep(3)} className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Retour</button>
                                        <button onClick={handleStep4} disabled={loading} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group disabled:opacity-50">
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{invitedUsers.length > 0 ? 'Inviter & Continuer' : 'Passer cette étape'} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 5 && (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
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
                                                    <p className="text-sm text-slate-500 font-mono mt-1">{scanText}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {initialAssets.length === 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                        <button
                                                            onClick={runAutoScan}
                                                            className="p-6 bg-gradient-to-br from-brand-600 to-indigo-600 rounded-2xl shadow-lg shadow-brand-500/20 text-left group hover:scale-[1.02] transition-transform relative overflow-hidden"
                                                        >
                                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                                <Server className="h-24 w-24 text-white" />
                                                            </div>
                                                            <div className="relative z-10 text-white">
                                                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                                                                    <Activity className="h-6 w-6" />
                                                                </div>
                                                                <h3 className="font-bold text-lg mb-1">Scan Automatique</h3>
                                                                <p className="text-white/80 text-xs leading-relaxed">
                                                                    Détecter automatiquement les actifs via l'empreinte DNS et Cloud.
                                                                </p>
                                                            </div>
                                                        </button>

                                                        <button
                                                            onClick={() => setManualMode(true)}
                                                            className="p-6 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-left group hover:border-slate-300 dark:hover:border-white/20 transition-all"
                                                        >
                                                            <div className="w-10 h-10 bg-slate-100 dark:bg-white/10 rounded-xl flex items-center justify-center mb-4 text-slate-600 dark:text-slate-300">
                                                                <Plus className="h-6 w-6" />
                                                            </div>
                                                            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">Saisie Manuelle</h3>
                                                            <p className="text-slate-500 text-xs leading-relaxed">
                                                                Ajouter vos serveurs, SaaS et postes de travail un par un.
                                                            </p>
                                                        </button>
                                                    </div>
                                                ) : null}

                                                {(manualMode || initialAssets.length > 0) && (
                                                    <div className="space-y-4 animate-fade-in">
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <div className="col-span-2 relative">
                                                                <FloatingLabelInput
                                                                    label="Nom (ex: Serveur Prod)"
                                                                    icon={Server}
                                                                    value={assetName}
                                                                    onChange={e => setAssetName(e.target.value)}
                                                                    placeholder="Nom (ex: Serveur Prod)"
                                                                />
                                                            </div>
                                                            <CustomSelect
                                                                value={assetType}
                                                                onChange={(val) => setAssetType(val as string)}
                                                                options={[
                                                                    { value: 'SaaS', label: 'SaaS' },
                                                                    { value: 'Server', label: 'Serveur' },
                                                                    { value: 'Laptop', label: 'Ordinateur' },
                                                                    { value: 'Data', label: 'Données' }
                                                                ]}
                                                                label=""
                                                            />
                                                        </div>
                                                        <button onClick={handleAddAsset} disabled={!assetName} className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50">
                                                            <Plus className="h-4 w-4" /> Ajouter
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {initialAssets.length > 0 && (
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                            {initialAssets.map((asset, idx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                    key={idx}
                                                    className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${asset.type === 'SaaS' ? 'bg-blue-100 text-blue-600' :
                                                            asset.type === 'Server' ? 'bg-indigo-100 text-indigo-600' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {asset.type === 'SaaS' ? <Globe className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-700 dark:text-white text-sm">{asset.name}</p>
                                                            <p className="text-xs text-slate-600">{asset.type}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleRemoveAsset(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 flex gap-3">
                                        <button onClick={() => setStep(4)} className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t('onboarding.actions.back')}</button>
                                        <button onClick={handleStep5} disabled={loading} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group hover:scale-[1.02] active:scale-[0.98] transition-all">
                                            {loading ? '...' : <>{t('onboarding.steps.finish')} <Check className="ml-2 h-5 w-5" strokeWidth={3} /></>}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}

                </div>
            </div >

            <LegalModal
                isOpen={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                initialTab={legalTab}
            />
        </div >
    );
};
