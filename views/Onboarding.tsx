import React, { useState } from 'react';
import { useStore } from '../store';
import { doc, setDoc, collection, query, where, getDocs, addDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import { ArrowRight, User as UserIcon, Building, Briefcase, Lock, AlertTriangle, Check, Search, Users, Plus, ShieldCheck, Mail, Trash2, Server } from '../components/ui/Icons';
import { sendEmail } from '../services/emailService';
import { getInvitationTemplate } from '../services/emailTemplates';
import { PLANS } from '../config/plans';
import { PlanType, UserProfile } from '../types';
import { SubscriptionService } from '../services/subscriptionService';
import { analyticsService } from '../services/analyticsService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ErrorLogger } from '../services/errorLogger';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { onboardingSchema, OnboardingFormData } from '../schemas/onboardingSchema';



interface SearchResult {
    id: string;
    name: string;
    industry?: string;
}

export const Onboarding: React.FC = () => {
    const { user, setUser, addToast } = useStore();
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
    const [invitedUsers, setInvitedUsers] = useState<string[]>([]);

    // Step 5: Assets
    const [assetName, setAssetName] = useState('');
    const [assetType, setAssetType] = useState('SaaS');
    const [initialAssets, setInitialAssets] = useState<{ name: string, type: string }[]>([]);

    const handleStep3 = async () => {
        if (!user?.organizationId || user.role !== 'admin') return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'organizations', user.organizationId), {
                standards,
                scope,
                onboardingStep: 3
            });
            setStep(4);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Onboarding.step3', 'UPDATE_FAILED');
        } finally {
            setLoading(false);
        }
    };

    const handleInviteUser = () => {
        if (inviteEmail && !invitedUsers.includes(inviteEmail)) {
            setInvitedUsers([...invitedUsers, inviteEmail]);
            setInviteEmail('');
        }
    };

    const handleRemoveInvite = (email: string) => {
        setInvitedUsers(invitedUsers.filter(e => e !== email));
    };

    const handleStep4 = async () => {
        if (invitedUsers.length > 0 && user?.organizationId && user.role === 'admin') {
            setLoading(true);
            try {
                const batch = writeBatch(db);
                for (const email of invitedUsers) {
                    // Create invitation document instead of user document
                    const invitationRef = doc(collection(db, 'invitations'));
                    batch.set(invitationRef, {
                        email,
                        organizationId: user.organizationId,
                        organizationName: user.organizationName || '',
                        role: 'user',
                        invitedBy: user.uid,
                        createdAt: new Date().toISOString(),
                        status: 'pending'
                    });

                    // Trigger email via Cloud Function or API (using client-side service for now)
                    try {
                        // Link points to login/register, backend handles the rest via email matching
                        const inviteLink = `${window.location.origin}/login?email=${encodeURIComponent(email)}`;
                        const htmlContent = getInvitationTemplate(
                            user.displayName || user.email || 'Un administrateur',
                            'Collaborateur',
                            inviteLink
                        );

                        // Create a minimal user object for the email service
                        const invitedUserContext = {
                            uid: invitationRef.id, // Use invitation ID as temporary UID for logging/tracking
                            email,
                            displayName: 'Invité',
                            organizationId: user.organizationId
                        } as UserProfile;

                        await sendEmail(invitedUserContext, {
                            to: email,
                            subject: `Invitation à rejoindre ${user.organizationName || 'Sentinel GRC'}`,
                            html: htmlContent,
                            type: 'INVITATION'
                        }, false);
                    } catch (emailError) {
                        ErrorLogger.error(emailError as Error, 'Onboarding.step4.sendEmail');
                        // Don't block the flow if email fails, but log it
                    }
                }
                await batch.commit();
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
                const batch = writeBatch(db);
                initialAssets.forEach(asset => {
                    const ref = doc(collection(db, 'assets'));
                    batch.set(ref, {
                        name: asset.name,
                        type: asset.type,
                        organizationId: user.organizationId,
                        createdAt: new Date().toISOString(),
                        lifecycleStatus: 'En service',
                        confidentiality: 'Medium',
                        integrity: 'Medium',
                        availability: 'Medium',
                        owner: user.displayName || 'Admin'
                    });
                });
                await batch.commit();
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
                        await setDoc(doc(db, 'users', user.uid), { onboardingCompleted: true }, { merge: true });
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
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            // Simple case-insensitive search simulation (Firestore doesn't support native case-insensitive without plugins)
            // Ideally use Algolia or a normalized 'slug' field. Here we search by exact slug or name prefix.
            const q = query(
                collection(db, 'organizations'),
                where('name', '>=', searchQuery),
                where('name', '<=', searchQuery + '\uf8ff')
            );
            const snap = await getDocs(q);
            setSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as SearchResult)));
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
            await addDoc(collection(db, 'join_requests'), {
                userId: user.uid,
                userEmail: user.email,
                displayName: form.getValues('displayName') || user.displayName || user.email,
                organizationId: orgId,
                organizationName: orgName,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
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
            // Call the Secure Cloud Function
            const createOrganizationFn = httpsCallable(functions, 'createOrganization');
            const result = await createOrganizationFn({
                organizationName: data.organizationName || (user as unknown as { organizationName?: string })?.organizationName || 'Mon Organisation',
                displayName: data.displayName || '',
                department: data.department || '',
                role: data.role || 'admin',
                industry: data.industry || ''
            });

            const { organizationId } = result.data as { organizationId: string };

            // Force refresh session to get new claims
            await refreshSession();

            // Update local user state
            if (user) {
                setUser({
                    ...user,
                    organizationId,
                    organizationName: data.organizationName || '',
                    role: 'admin',
                    onboardingCompleted: true
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

    const handleFinalize = async () => {
        if (!user?.organizationId) {
            addToast("Erreur : Organisation manquante", "error");
            return;
        }
        setLoading(true);
        try {
            // Update user onboarding status

            await setDoc(doc(db, 'users', user.uid), { onboardingCompleted: true }, { merge: true });

            // Force refresh session to ensure claims and context are up to date
            await refreshSession();

            // Update local user state to unlock app access immediately for free plan
            setUser({ ...user, onboardingCompleted: true });

            analyticsService.logEvent('complete_onboarding', {
                plan: selectedPlan,
                organization_id: user.organizationId
            });

            if (selectedPlan === 'discovery') {
                // Free plan: Direct access
                navigate('/');
            } else {
                // Paid plan: Redirect to Stripe
                await SubscriptionService.startSubscription(user.organizationId, selectedPlan, 'month'); // Default to monthly for onboarding
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Onboarding.handleFinalize', 'UPDATE_FAILED');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] dark:bg-[#000000] relative overflow-hidden font-sans selection:bg-brand-500 selection:text-white">
            <div className="absolute inset-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-blue-400/20 dark:bg-slate-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-60 animate-float"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-indigo-400/20 dark:bg-slate-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-60 animate-float" style={{ animationDelay: '3s' }}></div>
            </div>

            <div className="w-full max-w-xl p-6 relative z-10 animate-scale-in">
                <div className="glass-panel rounded-[2.5rem] p-10 md:p-12 shadow-2xl">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl mb-6 ring-1 ring-black/5 mx-auto">
                            {mode === 'join' ? <Users className="h-8 w-8" /> : <Lock className="h-8 w-8" strokeWidth={2.5} />}
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                            {mode === 'select' ? 'Bienvenue' :
                                mode === 'join' ? 'Rejoindre une équipe' :
                                    step === 1 ? 'Configuration Initiale' :
                                        step === 2 ? 'Choisissez votre Plan' :
                                            step === 3 ? 'Pilotage & Conformité' :
                                                step === 4 ? 'Votre Équipe' : 'Cartographie Initiale'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                            {mode === 'select' ? 'Comment souhaitez-vous commencer ?' :
                                mode === 'join' ? 'Recherchez votre organisation.' :
                                    step === 1 ? 'Créez votre espace organisationnel.' :
                                        step === 2 ? 'Adaptez Sentinel GRC à vos besoins.' :
                                            step === 3 ? 'Définissez vos standards et votre périmètre.' :
                                                step === 4 ? 'Invitez vos collaborateurs.' : 'Identifiez vos actifs critiques.'}
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
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Créer une nouvelle organisation</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Je suis responsable et je veux configurer un nouvel espace.</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => setMode('join')}
                                className="group relative p-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-slate-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rejoindre une organisation existante</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Mon équipe utilise déjà Sentinel GRC.</p>
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
                                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                        <input
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400"
                                            placeholder="Rechercher par nom..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                        <button
                                            type="submit"
                                            disabled={loading || !searchQuery}
                                            className="absolute right-2 top-2 px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs shadow-lg disabled:opacity-50"
                                        >
                                            {loading ? '...' : 'Rechercher'}
                                        </button>
                                    </form>

                                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {searchResults.map(org => (
                                            <div key={org.id} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white">{org.name}</h4>
                                                    <p className="text-xs text-slate-500">{org.industry || 'Non spécifié'}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleJoinRequest(org.id, org.name)}
                                                    className="px-4 py-2 bg-blue-50 dark:bg-slate-900 text-blue-600 dark:bg-slate-900/20 dark:text-blue-400 rounded-xl text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                                >
                                                    Rejoindre
                                                </button>
                                            </div>
                                        ))}
                                        {searchResults.length === 0 && searchQuery && !loading && (
                                            <p className="text-center text-slate-500 text-sm py-4">Aucune organisation trouvée.</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                                        <Check className="h-8 w-8" strokeWidth={3} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Demande envoyée !</h3>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Un administrateur de l'organisation doit approuver votre demande. Vous recevrez un email dès que l'accès sera validé.
                                    </p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="mt-8 px-6 py-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                                    >
                                        Retour à l'accueil
                                    </button>
                                </div>
                            )}

                            {!joinRequestSent && (
                                <button
                                    onClick={() => setMode('select')}
                                    className="w-full py-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold transition-colors"
                                >
                                    Retour
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
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom de l'Organisation</label>
                                            <div className="relative">
                                                <Building className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                                <input type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400" placeholder="Ex: Acme Corp"
                                                    {...form.register('organizationName')} />
                                                {form.formState.errors.organizationName && <p className="text-red-500 text-xs mt-1 ml-1">{form.formState.errors.organizationName.message}</p>}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom complet</label>
                                        <div className="relative">
                                            <UserIcon className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                            <input type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400" placeholder="Votre nom"
                                                {...form.register('displayName')} />
                                            {form.formState.errors.displayName && <p className="text-red-500 text-xs mt-1 ml-1">{form.formState.errors.displayName.message}</p>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Département</label>
                                            <div className="relative">
                                                <Briefcase className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                                <input type="text" className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400" placeholder="Ex: IT / Sécurité"
                                                    {...form.register('department')} />
                                                {form.formState.errors.department && <p className="text-red-500 text-xs mt-1 ml-1">{form.formState.errors.department.message}</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Rôle Principal</label>
                                            <div className="relative">
                                                <UserIcon className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                                <select className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none appearance-none font-medium cursor-pointer"
                                                    {...form.register('role')}>
                                                    <option value="admin">Administrateur</option>
                                                    <option value="rssi">RSSI / CISO</option>
                                                    <option value="direction">Direction / DPO</option>
                                                    <option value="project_manager">Chef de Projet</option>
                                                    <option value="auditor">Auditeur</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Secteur</label>
                                        <div className="relative">
                                            <Building className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                            <select className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none appearance-none font-medium cursor-pointer"
                                                {...form.register('industry')}>
                                                <option value="">Sélectionner...</option>
                                                <option value="tech">Technologie / SaaS</option>
                                                <option value="finance">Finance / Banque</option>
                                                <option value="health">Santé</option>
                                                <option value="retail">Retail / E-commerce</option>
                                                <option value="public">Secteur Public</option>
                                                <option value="other">Autre</option>
                                            </select>
                                            {form.formState.errors.industry && <p className="text-red-500 text-xs mt-1 ml-1">{form.formState.errors.industry.message}</p>}
                                        </div>
                                    </div>

                                    {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3"><AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-semibold text-red-900 dark:text-red-200">Erreur de configuration</p><p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p></div></div>}

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setMode('select')}
                                            className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Retour
                                        </button>
                                        <button type="submit" disabled={loading || (!user?.organizationId && !form.watch('organizationName'))} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 card-hover transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed">
                                            {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <>Continuer <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
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
                                                        ? 'bg-blue-50/50 dark:bg-slate-900/10 border-blue-500 ring-1 ring-blue-500 shadow-lg shadow-blue-500/10'
                                                        : 'bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h3 className={`font-bold text-lg ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                                                                {plan.name}
                                                            </h3>
                                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                                                                {plan.description}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={`block text-xl font-bold font-display tracking-tight ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                                                                {plan.priceMonthly === 0 ? 'Gratuit' : `${plan.priceMonthly}€`}
                                                            </span>
                                                            {plan.priceMonthly > 0 && <span className="text-xs text-slate-400 font-medium">/ mois</span>}
                                                        </div>
                                                    </div>

                                                    <div className="h-px w-full bg-slate-100 dark:bg-white/5 my-4" />

                                                    <ul className="space-y-2">
                                                        {plan.featuresList.slice(0, 3).map((f, i) => (
                                                            <li key={i} className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300">
                                                                <div className={`mr-2 p-0.5 rounded-full ${isSelected ? 'bg-blue-100 dark:bg-slate-900/30 text-blue-600 dark:text-blue-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                                                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                                                </div>
                                                                {f}
                                                            </li>
                                                        ))}
                                                    </ul>

                                                    {isSelected && (
                                                        <div className="absolute top-4 right-4 animate-scale-in">
                                                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
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
                                            Retour
                                        </button>
                                        <button
                                            onClick={() => setStep(3)}
                                            disabled={loading}
                                            className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-xl shadow-brand-500/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        >
                                            {loading ? (
                                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    Continuer
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
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 ml-1 flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" /> Standards & Normes
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
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Périmètre (Scope)</label>
                                        <textarea
                                            value={scope}
                                            onChange={e => setScope(e.target.value)}
                                            className="w-full p-4 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400 min-h-[100px]"
                                            placeholder="Décrivez le périmètre de votre ISMS (ex: Toute l'entreprise, Service IT uniquement...)"
                                        />
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button onClick={() => setStep(2)} className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Retour</button>
                                        <button onClick={handleStep3} disabled={loading} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group">
                                            {loading ? '...' : <>Continuer <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Inviter des membres</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                                <input
                                                    type="email"
                                                    value={inviteEmail}
                                                    onChange={e => setInviteEmail(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleInviteUser()}
                                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white outline-none font-medium"
                                                    placeholder="email@entreprise.com"
                                                />
                                            </div>
                                            <button onClick={handleInviteUser} className="px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold hover:opacity-90 transition-opacity">
                                                <Plus className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {invitedUsers.length > 0 && (
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                            {invitedUsers.map(email => (
                                                <div key={email} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center font-bold text-xs">
                                                            {email.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-slate-700 dark:text-slate-200 text-sm">{email}</span>
                                                    </div>
                                                    <button onClick={() => handleRemoveInvite(email)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 flex gap-3">
                                        <button onClick={() => setStep(3)} className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Retour</button>
                                        <button onClick={handleStep4} disabled={loading} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group">
                                            {loading ? '...' : <>{invitedUsers.length > 0 ? 'Inviter & Continuer' : 'Passer cette étape'} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 5 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Ajouter un actif critique</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2 relative">
                                                <Server className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={assetName}
                                                    onChange={e => setAssetName(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white outline-none font-medium"
                                                    placeholder="Nom (ex: Serveur Prod)"
                                                />
                                            </div>
                                            <select
                                                value={assetType}
                                                onChange={e => setAssetType(e.target.value)}
                                                className="w-full px-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white outline-none font-medium appearance-none cursor-pointer"
                                            >
                                                <option value="SaaS">SaaS</option>
                                                <option value="Server">Serveur</option>
                                                <option value="Laptop">Ordinateur</option>
                                                <option value="Data">Données</option>
                                            </select>
                                        </div>
                                        <button onClick={handleAddAsset} disabled={!assetName} className="mt-2 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50">
                                            <Plus className="h-4 w-4" /> Ajouter à la liste
                                        </button>
                                    </div>

                                    {initialAssets.length > 0 && (
                                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                                            {initialAssets.map((asset, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-slate-900/30 text-indigo-600 flex items-center justify-center">
                                                            <Server className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-700 dark:text-white text-sm">{asset.name}</p>
                                                            <p className="text-xs text-slate-500">{asset.type}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleRemoveAsset(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 flex gap-3">
                                        <button onClick={() => setStep(4)} className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Retour</button>
                                        <button onClick={handleStep5} disabled={loading} className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center group">
                                            {loading ? '...' : <>Terminer l'installation <Check className="ml-2 h-5 w-5" strokeWidth={3} /></>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div >
        </div >
    );
};
