import React, { useState } from 'react';
import { useStore } from '../store';
import { doc, setDoc, collection, query, where, getDocs, addDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ArrowRight, User as UserIcon, Building, Briefcase, Lock, AlertTriangle, Check, Search, Users, Plus } from '../components/ui/Icons';
import { sendEmail } from '../services/emailService';
import { getWelcomeEmailTemplate } from '../services/emailTemplates';
import { PLANS } from '../config/plans';
import { PlanType, UserProfile } from '../types';
import { SubscriptionService } from '../services/subscriptionService';
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

    // Auto-detect step based on user state or REDIRECT if finished
    React.useEffect(() => {
        if (user?.onboardingCompleted) {
            // If onboarding is already done, go to dashboard immediately
            navigate('/', { replace: true });
            return;
        }

        if (user?.organizationId && !user.onboardingCompleted) {
            setMode('create');
            setStep(2);
            // Pre-fill fields if possible (optional)
            if (user.organizationName) {
                form.setValue('organizationName', user.organizationName);
            }
        }
    }, [user, navigate, form]);

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

    // Helper for UUID generation with fallback
    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for older browsers or insecure contexts
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
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

        const uid = targetUser.uid;
        const email = targetUser.email || '';
        const photoURL = targetUser.photoURL || null;



        try {
            // Generate a NEW organization ID
            const newOrgId = generateUUID();
            const orgName = data.organizationName || (user as unknown as { organizationName?: string })?.organizationName || 'Mon Organisation';



            // USE BATCH FOR ATOMICITY
            const batch = writeBatch(db);

            // 1. Create/Update User Profile
            const userRef = doc(db, 'users', uid);
            const userUpdates = {
                uid: uid,
                email: email,
                role: data.role,
                department: data.department || '',
                industry: data.industry || '',
                displayName: data.displayName || '',
                organizationName: orgName,
                organizationId: newOrgId,
                photoURL: photoURL,
                lastLogin: new Date().toISOString()
            };


            // Important: merge is not directly available in batch.set, but we can use update if doc exists
            // However, since we want upsert behavior, we use set with merge option which IS supported in batch
            batch.set(userRef, userUpdates, { merge: true });

            // 2. Create Organization Document (CRITICAL for SubscriptionService)
            const orgRef = doc(db, 'organizations', newOrgId);

            // Generate slug from organization name safely
            const safeName = String(orgName || 'org');


            const slug = safeName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
                .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes



            batch.set(orgRef, {
                id: newOrgId,
                name: orgName,
                slug: slug || newOrgId, // Fallback to ID if slug fails
                ownerId: uid, // Utilisation de la variable locale uid
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                industry: data.industry || '',
                subscription: {
                    planId: 'discovery',
                    status: 'active',
                    startDate: new Date().toISOString(),
                    stripeCustomerId: null,
                    stripeSubscriptionId: null,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false
                }
            });

            // COMMIT BATCH
            await batch.commit();

            // Update local store IMMEDIATELY
            if (user) {
                setUser({ ...user, ...userUpdates });
            } else {
                setUser(userUpdates as UserProfile);
            }



            // 3. Send welcome email (async, don't block)
            try {
                const htmlContent = getWelcomeEmailTemplate(
                    data.displayName || email || 'Utilisateur',
                    orgName,
                    data.role,
                    `${window.location.origin}/`
                );

                if (email) {
                    // Cast user to any or create minimal user object if needed for sendEmail
                    // sendEmail expects a UserProfile-like object.
                    const emailUserMock = { ...user, email, displayName: data.displayName } as UserProfile;

                    sendEmail(emailUserMock, {
                        to: email,
                        subject: '🎉 Bienvenue sur Sentinel GRC',
                        html: htmlContent,
                        type: 'WELCOME_EMAIL'
                    }, false).catch(err => ErrorLogger.error(err, 'Onboarding.handleStep1.sendEmail'));
                }
            } catch (emailError) {
                ErrorLogger.error(emailError, 'Onboarding.handleStep1.prepareEmail');
            }

            // Move to Step 2 (Plan Selection)
            setStep(2);
            addToast("Profil créé ! Choisissez votre offre.", "success");

        } catch (error: unknown) {
            ErrorLogger.handleErrorWithToast(error, 'Onboarding.handleStep1', 'CREATE_FAILED');
            const errorMessage = error instanceof Error ? error.message : String(error);
            setError(errorMessage || "Une erreur est survenue.");
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
                <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-blue-400/20 dark:bg-blue-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-60 animate-float"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-indigo-400/20 dark:bg-indigo-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-60 animate-float" style={{ animationDelay: '3s' }}></div>
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
                                    step === 1 ? 'Configuration Initiale' : 'Choisissez votre Plan'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                            {mode === 'select' ? 'Comment souhaitez-vous commencer ?' :
                                mode === 'join' ? 'Recherchez votre organisation.' :
                                    step === 1 ? 'Créez votre espace organisationnel.' : 'Adaptez Sentinel GRC à vos besoins.'}
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
                                    <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
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
                                                    className="px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
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
                                                        ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-500 ring-1 ring-blue-500 shadow-lg shadow-blue-500/10'
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
                                                                <div className={`mr-2 p-0.5 rounded-full ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
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
                                            onClick={handleFinalize}
                                            disabled={loading}
                                            className="w-2/3 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-xl shadow-brand-500/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        >
                                            {loading ? (
                                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    {selectedPlan === 'discovery' ? 'Commencer Gratuitement' : 'Passer au Paiement'}
                                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                                                </>
                                            )}
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
