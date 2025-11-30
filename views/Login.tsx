import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Lock, Mail, ArrowRight, AlertTriangle, X, CheckCircle2, Server } from '../components/ui/Icons';
import { useStore } from '../store';
import { LegalModal } from '../components/ui/LegalModal';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, registerSchema, resetPasswordSchema, LoginFormData, RegisterFormData, ResetPasswordFormData } from '../schemas/authSchema';

// Google SVG optimized
const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { addToast } = useStore();

    // Main Auth Form
    const { register, handleSubmit, formState: { errors }, setValue, clearErrors } = useForm<LoginFormData | RegisterFormData>({
        resolver: zodResolver(isLogin ? loginSchema : registerSchema),
        mode: 'onSubmit'
    });

    // Reset Password Form
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const resetForm = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema)
    });

    // Legal Modal State
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [legalTab, setLegalTab] = useState<'mentions' | 'privacy' | 'terms'>('mentions');

    // Clear errors when switching modes
    useEffect(() => {
        clearErrors();
    }, [isLogin, clearErrors]);

    const handleEmailAuth: SubmitHandler<LoginFormData | RegisterFormData> = async (data) => {
        setLoading(true);
        setErrorMsg(null);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, data.email, data.password);
                addToast("Connexion réussie", "success");
            } else {
                await createUserWithEmailAndPassword(auth, data.email, data.password);
                addToast("Compte créé avec succès", "success");
            }
        } catch (error: unknown) {
            let msg = "Erreur d'authentification.";
            const code = (error as { code?: string })?.code;
            if (code === 'auth/invalid-credential') msg = "Identifiants incorrects.";
            if (code === 'auth/email-already-in-use') msg = "Cet email est déjà utilisé.";
            if (code === 'auth/weak-password') msg = "Le mot de passe est trop faible.";
            setErrorMsg(msg);
        } finally { setLoading(false); }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error: unknown) {
            const code = (error as { code?: string })?.code;
            if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed') {
                setErrorMsg("Environnement restreint : Google Auth non disponible ici. Utilisez l'email.");
            } else {
                setErrorMsg("Erreur Google Auth.");
            }
        } finally { setLoading(false); }
    };

    const handlePasswordReset: SubmitHandler<ResetPasswordFormData> = async (data) => {
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, data.email);
            setResetSent(true);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
            addToast("Erreur envoi email de réinitialisation", "error");
        } finally {
            setLoading(false);
        }
    };

    const fillDemo = () => {
        setValue('email', 'demo@sentinel.local');
        setValue('password', 'demo1234');
        setErrorMsg(null);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#E5E7EB] dark:bg-[#000000] relative overflow-hidden font-sans selection:bg-brand-500 selection:text-white">
            {/* Ambient Background */}
            <div className="absolute inset-0 w-full h-full">
                <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-blue-300/30 dark:bg-blue-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-indigo-300/30 dark:bg-indigo-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float" style={{ animationDelay: '3s' }}></div>
            </div>

            <div className="w-full max-w-[440px] p-6 relative z-10 animate-scale-in flex-1 flex flex-col justify-center">
                <div className="glass-panel rounded-[2.5rem] p-10 flex flex-col items-center shadow-2xl border border-white/50 dark:border-white/10 bg-white/90 dark:bg-black/60 backdrop-blur-xl">

                    {/* Logo */}
                    <div className="mb-10 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl mb-5 ring-1 ring-black/5 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                            <Lock className="h-8 w-8" strokeWidth={2.5} />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tighter text-slate-900 dark:text-white">Sentinel GRC</h1>
                        <p className="text-base font-medium text-slate-500 dark:text-slate-400 mt-2">Accédez à votre espace sécurisé</p>
                    </div>

                    {errorMsg && (
                        <div className="w-full mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2 text-xs font-bold text-red-600 shadow-sm animate-slide-up">
                            <p className="flex items-center justify-center"><AlertTriangle className="h-4 w-4 mr-2" /> {errorMsg}</p>
                            {errorMsg.includes('restreint') && (
                                <button onClick={fillDemo} className="mx-auto bg-white border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                                    <Server className="h-3 w-3" /> Mode Démo
                                </button>
                            )}
                        </div>
                    )}

                    <div className="w-full space-y-5">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center px-4 py-4 bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-white/10 rounded-2xl card-hover transition-all duration-200 shadow-sm active:scale-[0.98]"
                        >
                            <GoogleIcon />
                            <span className="ml-3 text-[15px] font-bold text-slate-700 dark:text-white">Continuer avec Google</span>
                        </button>

                        <button
                            onClick={async () => {
                                setLoading(true);
                                setErrorMsg(null);
                                try {
                                    const { OAuthProvider, signInWithPopup } = await import('firebase/auth');
                                    const provider = new OAuthProvider('apple.com');
                                    provider.addScope('email');
                                    provider.addScope('name');
                                    await signInWithPopup(auth, provider);
                                } catch (error: unknown) {
                                    const code = (error as { code?: string })?.code;
                                    if (code === 'auth/operation-not-allowed') {
                                        setErrorMsg("Apple Sign In non activé dans la console Firebase.");
                                    } else {
                                        setErrorMsg("Erreur Apple Sign In.");
                                    }
                                } finally { setLoading(false); }
                            }}
                            disabled={loading}
                            className="w-full flex items-center justify-center px-4 py-4 bg-black text-white border border-transparent rounded-2xl card-hover transition-all duration-200 shadow-sm active:scale-[0.98]"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-.98-.4-2.05-.4-3.08.4-1.05.45-2.05.45-3.08-.4-1.05-.85-2.05-2.4-2.05-4.6 0-3.15 2.05-4.8 4.1-4.8 1.05 0 2.05.45 3.08.45 1.05 0 2.05-.45 3.08-.45 1.05 0 2.05.45 3.08.45.98 0 1.95-.45 2.55-1.15-2.05-1.15-2.05-3.6-2.05-3.75 1.55-.65 2.55-1.9 2.55-3.15-.05-.25-.05-.5-.05-.75-1.55.65-2.55 1.9-2.55 3.15.05.25.05.5.05.75 1.55-.65 2.55-1.9 2.55-3.15zM12.03 7.25c-.05-.25-.05-.5-.05-.75 1.55-.65 2.55-1.9 2.55-3.15.05.25.05.5.05.75-1.55.65-2.55 1.9-2.55 3.15z" />
                                <path d="M12.03 7.25c.05.25.05.5.05.75-1.55.65-2.55 1.9-2.55 3.15-.05-.25-.05-.5-.05-.75 1.55-.65 2.55-1.9 2.55-3.15z" fill="none" />
                                <path d="M13.03 2.1c-1.55.65-2.55 1.9-2.55 3.15.05.25.05.5.05.75 1.55-.65 2.55-1.9 2.55-3.15-.05-.25-.05-.5-.05-.75z" />
                                <path d="M17.03 11.28c-.6-.7-1.55-1.15-2.55-1.15-1.03 0-2.03.45-3.08.45-1.03 0-2.03-.45-3.08-.45-2.05 0-4.1 1.65-4.1 4.8 0 2.2 1 3.75 2.05 4.6 1.03.85 2.03.85 3.08.4 1.03-.8 2.1-.8 3.08.4 1.03.48 2.1.55 3.08-.4 1.03-.85 2.03-2.4 2.05-4.6-.05-.15-2.05-1.15-2.05-3.75.05-.15 2.05-1.15 2.05-3.75z" />
                            </svg>
                            <span className="ml-3 text-[15px] font-bold">Continuer avec Apple</span>
                        </button>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-white/10"></div></div>
                            <div className="relative flex justify-center"><span className="px-4 bg-white/80 dark:bg-black/40 backdrop-blur-sm text-[11px] uppercase tracking-widest font-bold text-slate-400">Ou via email</span></div>
                        </div>

                        <form onSubmit={handleSubmit(handleEmailAuth)} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-widest">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                                    <input
                                        type="email"
                                        className={`w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border rounded-2xl focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:text-white transition-all outline-none placeholder:text-slate-400 text-[15px] font-medium shadow-inner ${errors.email ? 'border-red-500' : 'border-slate-200 dark:border-white/10'}`}
                                        placeholder="nom@entreprise.com"
                                        {...register('email')}
                                    />
                                </div>
                                {errors.email && <p className="text-red-500 text-xs ml-1 font-bold">{errors.email.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mot de passe</label>
                                    {isLogin && (
                                        <button type="button" onClick={() => setShowResetModal(true)} className="text-[11px] font-bold text-brand-600 hover:text-brand-500 transition-colors">
                                            Oublié ?
                                        </button>
                                    )}
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                                    <input
                                        type="password"
                                        className={`w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/20 border rounded-2xl focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:text-white transition-all outline-none placeholder:text-slate-400 text-[15px] font-medium shadow-inner ${errors.password ? 'border-red-500' : 'border-slate-200 dark:border-white/10'}`}
                                        placeholder="••••••••"
                                        {...register('password')}
                                    />
                                </div>
                                {errors.password && <p className="text-red-500 text-xs ml-1 font-bold">{errors.password.message}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl card-hover transition-all duration-300 flex items-center justify-center text-[15px] shadow-lg shadow-brand-500/20"
                            >
                                {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> :
                                    (isLogin ? 'Se connecter' : 'Créer un compte')}
                                {!loading && <ArrowRight className="ml-2 h-5 w-5" strokeWidth={2.5} />}
                            </button>
                        </form>
                    </div>

                    <div className="mt-8 text-center">
                        <button
                            onClick={() => { setIsLogin(!isLogin); setErrorMsg(null); }}
                            className="text-[13px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            {isLogin ? "Créer un nouveau compte" : "J'ai déjà un compte"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="py-6 text-center relative z-10 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Développé par Cyber Threat Consulting</p>
                <p className="text-sm text-slate-400">
                    Ce site est protégé par reCAPTCHA.
                    <button onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }} className="underline hover:text-slate-600 ml-1">
                        Politique de confidentialité
                    </button>
                    {' '}et{' '}
                    <button onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }} className="underline hover:text-slate-600">
                        Conditions d'utilisation
                    </button>
                    {' '}et{' '}
                    <button onClick={() => { setLegalTab('mentions'); setShowLegalModal(true); }} className="underline hover:text-slate-600">
                        Mentions Légales
                    </button>
                    {' '}s'appliquent.
                </p>
            </div>

            {/* Reset Password Modal */}
            {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] p-8 w-full max-w-md border border-white/20 shadow-2xl relative">
                        <button onClick={() => setShowResetModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <X className="h-5 w-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mx-auto mb-4 text-brand-600">
                                <Mail className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Réinitialisation</h3>
                            <p className="text-sm text-slate-500 mt-2">Entrez votre email pour recevoir un lien de réinitialisation.</p>
                        </div>

                        {!resetSent ? (
                            <form onSubmit={resetForm.handleSubmit(handlePasswordReset)} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Email</label>
                                    <input
                                        type="email"
                                        className={`w-full px-4 py-3.5 bg-slate-50 dark:bg-black/20 border rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white ${resetForm.formState.errors.email ? 'border-red-500' : 'border-slate-200 dark:border-white/10'}`}
                                        placeholder="nom@entreprise.com"
                                        {...resetForm.register('email')}
                                    />
                                    {resetForm.formState.errors.email && <p className="text-red-500 text-xs ml-1 font-bold mt-1">{resetForm.formState.errors.email.message}</p>}
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-2xl hover:scale-[1.02] transition-transform shadow-lg">
                                    {loading ? 'Envoi...' : 'Envoyer le lien'}
                                </button>
                            </form>
                        ) : (
                            <div className="text-center py-4">
                                <div className="inline-flex items-center px-4 py-2 rounded-xl bg-green-50 text-green-700 text-sm font-bold mb-4 border border-green-100">
                                    <CheckCircle2 className="h-4 w-4 mr-2" /> Email envoyé !
                                </div>
                                <p className="text-sm text-slate-500 mb-6">Vérifiez votre boîte de réception (et vos spams).</p>
                                <button onClick={() => setShowResetModal(false)} className="text-sm font-bold text-brand-600 hover:underline">Retour à la connexion</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Legal Modal */}
            <LegalModal
                isOpen={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                initialTab={legalTab}
            />
        </div>
    );
};
