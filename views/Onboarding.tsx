import React, { useState } from 'react';
import { useStore } from '../store';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ArrowRight, ShieldAlert, User, Building, Briefcase, Lock, AlertTriangle, Check } from '../components/ui/Icons';
import { sendEmail } from '../services/emailService';
import { getWelcomeEmailTemplate } from '../services/emailTemplates';
import { PLANS } from '../config/plans';
import { PlanType } from '../types';
import { useNavigate } from 'react-router-dom';
import { SubscriptionService } from '../services/subscriptionService';

export const Onboarding: React.FC = () => {
    const { user, setUser, addToast } = useStore();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [selectedPlan, setSelectedPlan] = useState<PlanType>('discovery');
    const [role, setRole] = useState<'admin' | 'user' | 'auditor'>('admin');
    const [department, setDepartment] = useState('');
    const [industry, setIndustry] = useState('');
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [organizationName, setOrganizationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleStep1 = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setError('');

        try {
            // Generate a robust ID for the organization if not exists
            const newOrgId = user.organizationId || crypto.randomUUID();
            const orgName = user.organizationName || organizationName;

            // 1. Create/Update User Profile
            const userUpdates = {
                uid: user.uid,
                email: user.email,
                role,
                department,
                industry,
                displayName,
                organizationName: orgName,
                organizationId: newOrgId,
                // onboardingCompleted will be set to true ONLY after plan selection
                photoURL: user.photoURL || null,
                lastLogin: new Date().toISOString()
            };

            await setDoc(doc(db, 'users', user.uid), userUpdates, { merge: true });
            setUser({ ...user, ...userUpdates });

            // 2. Create Organization Document (CRITICAL for SubscriptionService)
            const orgRef = doc(db, 'organizations', newOrgId);
            await setDoc(orgRef, {
                id: newOrgId,
                name: orgName,
                ownerId: user.uid,
                createdAt: new Date().toISOString(),
                industry,
                subscription: {
                    planId: 'discovery', // Default to discovery, will be updated in step 2
                    status: 'active',
                    startDate: new Date().toISOString()
                }
            }, { merge: true });

            // 3. Send welcome email (async, don't block)
            try {
                const htmlContent = getWelcomeEmailTemplate(
                    displayName || user.email,
                    orgName,
                    role,
                    `${window.location.origin}/dashboard`
                );
                sendEmail(user, {
                    to: user.email,
                    subject: '🎉 Bienvenue sur Sentinel GRC',
                    html: htmlContent,
                    type: 'WELCOME_EMAIL'
                }, false).catch(console.error);
            } catch (emailError) {
                console.error('Error preparing welcome email:', emailError);
            }

            // Move to Step 2 (Plan Selection)
            setStep(2);
            addToast("Profil créé ! Choisissez votre offre.", "success");

        } catch (error: any) {
            console.error("Error completing step 1", error);
            setError(error.message || "Une erreur est survenue.");
            addToast("Erreur lors de la configuration.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            // Update user onboarding status
            await setDoc(doc(db, 'users', user.uid), { onboardingCompleted: true }, { merge: true });
            
            // Update local user state to unlock app access immediately for free plan
            // For paid plans, Stripe redirection happens, so state update is less critical here but good practice
            setUser({ ...user, onboardingCompleted: true });

            if (selectedPlan === 'discovery') {
                // Free plan: Direct access
                navigate('/dashboard');
                window.location.reload(); // Force reload to clear onboarding state from App.tsx check
            } else {
                // Paid plan: Redirect to Stripe
                await SubscriptionService.startSubscription(user.organizationId, selectedPlan, 'month'); // Default to monthly for onboarding
            }
        } catch (e) {
            console.error("Finalize error", e);
            addToast("Erreur lors de la finalisation.", "error");
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
                            <Lock className="h-8 w-8" strokeWidth={2.5} />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
                            {step === 1 ? 'Configuration Initiale' : 'Choisissez votre Plan'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                            {step === 1 ? 'Créez votre espace organisationnel.' : 'Adaptez Sentinel GRC à vos besoins.'}
                        </p>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={handleStep1} className="space-y-6">
                            {/* Step 1 Content (Keep existing form) */}
                            {!user?.organizationId && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom de l'Organisation</label>
                                    <div className="relative">
                                        <Building className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                        <input type="text" required className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400" placeholder="Ex: Acme Corp" value={organizationName} onChange={e => setOrganizationName(e.target.value)} />
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom complet</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                    <input type="text" required className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400" placeholder="Votre nom" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Département</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                        <input type="text" required className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400" placeholder="Ex: IT / Sécurité" value={department} onChange={e => setDepartment(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Secteur</label>
                                    <div className="relative">
                                        <Building className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                        <select className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none appearance-none font-medium cursor-pointer" value={industry} onChange={e => setIndustry(e.target.value)}>
                                            <option value="">Sélectionner...</option>
                                            <option value="tech">Technologie / SaaS</option>
                                            <option value="finance">Finance / Banque</option>
                                            <option value="health">Santé</option>
                                            <option value="retail">Retail / E-commerce</option>
                                            <option value="public">Secteur Public</option>
                                            <option value="other">Autre</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Rôle</label>
                                <div className="relative">
                                    <ShieldAlert className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                    <select className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none appearance-none font-medium cursor-pointer" value={role} onChange={e => setRole(e.target.value as any)}>
                                        <option value="admin">Admin (Responsable)</option>
                                        <option value="auditor">Auditeur</option>
                                        <option value="user">Utilisateur</option>
                                    </select>
                                </div>
                            </div>
                            {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3"><AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-semibold text-red-900 dark:text-red-200">Erreur de configuration</p><p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p></div></div>}
                            <div className="pt-4">
                                <button type="submit" disabled={loading || (!user?.organizationId && !organizationName)} className="w-full py-4 bg-[#000000] dark:bg-white text-white dark:text-black font-bold rounded-2xl shadow-lg card-hover transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed">
                                    {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <>Continuer <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                {['discovery', 'professional', 'enterprise'].map((planId) => {
                                    const plan = PLANS[planId as PlanType];
                                    const isSelected = selectedPlan === planId;
                                    return (
                                        <div 
                                            key={planId}
                                            onClick={() => setSelectedPlan(planId as PlanType)}
                                            className={`relative p-6 rounded-3xl border-2 cursor-pointer transition-all ${isSelected ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-brand-200'}`}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{plan.name}</h3>
                                                <span className="text-sm font-semibold text-slate-500">{plan.priceMonthly}€ / mois</span>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{plan.description}</p>
                                            <ul className="space-y-2">
                                                {plan.featuresList.slice(0, 3).map((f, i) => (
                                                    <li key={i} className="flex items-center text-xs text-slate-600 dark:text-slate-300">
                                                        <Check className="h-3 w-3 mr-2 text-green-500" /> {f}
                                                    </li>
                                                ))}
                                            </ul>
                                            {isSelected && <div className="absolute top-4 right-4 bg-brand-500 text-white rounded-full p-1"><Check className="h-4 w-4" /></div>}
                                        </div>
                                    )
                                })}
                            </div>
                            
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setStep(1)} className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors">
                                    Retour
                                </button>
                                <button onClick={handleFinalize} disabled={loading} className="w-2/3 py-4 bg-[#000000] dark:bg-white text-white dark:text-black font-bold rounded-2xl shadow-lg card-hover transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed">
                                    {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <>{selectedPlan === 'discovery' ? 'Commencer Gratuitement' : 'Passer au Paiement'} <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} /></>}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
