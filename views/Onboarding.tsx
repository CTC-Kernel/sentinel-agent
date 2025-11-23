
import React, { useState } from 'react';
import { useStore } from '../store';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ArrowRight, ShieldAlert, User, Building, Briefcase, Lock, AlertTriangle } from '../components/ui/Icons';

export const Onboarding: React.FC = () => {
    const { user, setUser, addToast } = useStore();
    const [role, setRole] = useState<'admin' | 'user' | 'auditor'>('admin'); // Default to admin for first user
    const [department, setDepartment] = useState('');
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [organizationName, setOrganizationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleComplete = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setError('');

        try {
            // Generate a simple ID for the organization or use a UUID. 
            // For simplicity and uniqueness, we can use the user's UID if they are the first creator, 
            // or a random string.
            const newOrgId = user.organizationId || Math.random().toString(36).substring(2, 15);

            const updates = {
                uid: user.uid,
                email: user.email,
                role,
                department,
                displayName,
                organizationName: user.organizationName || organizationName,
                organizationId: newOrgId,
                onboardingCompleted: true,
                photoURL: user.photoURL || null,
                lastLogin: new Date().toISOString()
            };

            // Use setDoc with merge instead of updateDoc to handle permissions better
            await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
            setUser({ ...user, ...updates });
            addToast("Configuration terminée avec succès !", "success");
        } catch (error: any) {
            console.error("Error completing onboarding", error);
            setError(error.message || "Une erreur est survenue. Veuillez réessayer.");
            addToast("Erreur lors de la configuration. Vérifiez vos permissions Firebase.", "error");
        } finally {
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
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">Configuration Initiale</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Créez votre espace organisationnel.</p>
                    </div>

                    <form onSubmit={handleComplete} className="space-y-6">
                        {/* Only show Organization Name if not already invited to one */}
                        {!user?.organizationId && (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom de l'Organisation</label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400"
                                        placeholder="Ex: Acme Corp"
                                        value={organizationName}
                                        onChange={e => setOrganizationName(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom complet</label>
                            <div className="relative">
                                <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400"
                                    placeholder="Votre nom"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Département</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium placeholder:text-slate-400"
                                        placeholder="Ex: IT / Sécurité"
                                        value={department}
                                        onChange={e => setDepartment(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Rôle</label>
                                <div className="relative">
                                    <ShieldAlert className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                                    <select
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none appearance-none font-medium cursor-pointer"
                                        value={role}
                                        onChange={e => setRole(e.target.value as any)}
                                    >
                                        <option value="admin">Admin (Responsable)</option>
                                        <option value="auditor">Auditeur</option>
                                        <option value="user">Utilisateur</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-red-900 dark:text-red-200">Erreur de configuration</p>
                                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
                                </div>
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading || (!user?.organizationId && !organizationName)}
                                className="w-full py-4 bg-[#000000] dark:bg-white text-white dark:text-black font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        Créer mon espace
                                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
