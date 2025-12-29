import React, { useState, useEffect } from 'react';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { LandingMap } from '../components/landing/LandingMap';
import { SEO } from '../components/SEO';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { Lock, Mail, ArrowRight, AlertTriangle, X, CheckCircle2 } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { useStore } from '../store';
import { LegalModal } from '../components/ui/LegalModal';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, registerSchema, resetPasswordSchema, LoginFormData, RegisterFormData, ResetPasswordFormData } from '../schemas/authSchema';
import { useAuthActions } from '../hooks/useAuthActions';

// Google SVG optimized
const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const Login: React.FC<{ skipBoot?: boolean }> = ({ skipBoot = false }) => {
    const [isLogin, setIsLogin] = useState(true);
    const { t } = useStore();

    // Auth Actions Hook
    const {
        loading,
        errorMsg,
        setErrorMsg,
        handleEmailAuth,
        handleGoogleLogin,
        handleAppleLogin,
        handlePasswordReset,
        handleMfaVerification,
        showMfaModal,
        setShowMfaModal,
        mfaLoading,
        mfaError
    } = useAuthActions();

    // Main Auth Form
    const { register, handleSubmit, formState: { errors }, clearErrors } = useForm<LoginFormData | RegisterFormData>({
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
    const [legalTab, setLegalTab] = useState<'mentions' | 'privacy' | 'terms' | 'cgv'>('mentions');

    // MFA State from Hook
    const [mfaCode, setMfaCode] = useState('');

    const onMfaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleMfaVerification(mfaCode);
    };

    // Clear errors when switching modes
    useEffect(() => {
        clearErrors();
        setErrorMsg(null);
    }, [isLogin, clearErrors, setErrorMsg]);

    const onEmailAuthSubmit: SubmitHandler<LoginFormData | RegisterFormData> = async (data) => {
        await handleEmailAuth(data, isLogin);
    };

    const onPasswordResetSubmit: SubmitHandler<ResetPasswordFormData> = async (data) => {
        const success = await handlePasswordReset(data);
        if (success) {
            setResetSent(true);
        }
    };

    // Boot Sequence State
    const [bootSequence, setBootSequence] = useState<string[]>([]);
    const [isBooting, setIsBooting] = useState(!skipBoot);

    useEffect(() => {
        if (skipBoot) return;

        const sequence = [
            "INITIALISATION DU NOYAU SENTINEL v2.0...",
            "CHARGEMENT DES MODULES DE SÉCURITÉ...",
            "ÉTABLISSEMENT DE LA LIAISON SÉCURISÉE...",
            "ACCÈS AUTORISÉ."
        ];

        let currentIndex = 0;
        const interval = setInterval(() => {
            if (currentIndex >= sequence.length) {
                clearInterval(interval);
                setTimeout(() => setIsBooting(false), 800);
                return;
            }
            setBootSequence(prev => [...prev, sequence[currentIndex]]);
            currentIndex++;
        }, 600);

        return () => clearInterval(interval);
    }, [skipBoot]);

    if (isBooting) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-emerald-600 dark:text-emerald-500 font-mono flex items-center justify-center p-8 transition-colors duration-500">
                <div className="w-full max-w-lg">
                    {bootSequence.map((line, i) => (
                        <div key={`msg-${i}`} className="mb-2 animate-fade-in font-bold">
                            <span className="opacity-50 mr-2">{`>`}</span>
                            {line}
                        </div>
                    ))}
                    <div className="animate-pulse">_</div>
                </div>
            </div>
        );
    }

    return (
        <AuroraBackground className="min-h-screen py-4 sm:py-0 px-4 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 bg-opacity-100 dark:bg-opacity-100 relative font-sans selection:bg-brand-500 selection:text-white overflow-hidden">
            <SEO
                title="Connexion"
                description="Connectez-vous à votre espace sécurisé Sentinel GRC."
                keywords="Connexion, Secure Login, MFA, GRC, Sentinel"
            />

            {/* Aceternity Spotlight Effect */}
            <Spotlight
                className="-top-40 left-0 md:left-60 md:-top-20"
                fill="white"
            />

            {/* Background Map - Visual Continuity */}
            <LandingMap />

            {/* Ambient Background & Sparkles */}
            <div className="absolute inset-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-blue-300/30 dark:bg-slate-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-indigo-300/30 dark:bg-slate-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float" style={{ animationDelay: '3s' }}></div>
            </div>

            <div className="w-full max-w-[440px] p-6 relative z-10 animate-scale-in flex-1 flex flex-col justify-center mx-auto px-4 sm:px-6 min-w-0">
                <div className="glass-panel rounded-[2rem] p-8 flex flex-col items-center shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-black/60 backdrop-blur-xl">

                    {/* Logo */}
                    <div className="mb-6 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl mb-5 ring-1 ring-black/5 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                            <Lock className="h-8 w-8" strokeWidth={2.5} />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tighter text-slate-900 dark:text-white">Sentinel GRC</h1>
                        <p className="text-base font-medium text-slate-600 dark:text-slate-400 mt-2">{t('auth.subtitle')}</p>
                    </div>

                    {errorMsg && (
                        <div className="w-full mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2 text-xs font-bold text-red-600 shadow-sm animate-slide-up">
                            <p className="flex items-center justify-center"><AlertTriangle className="h-4 w-4 mr-2" /> {errorMsg}</p>
                            {errorMsg.includes('restreint') && (
                                <p className="text-[10px] font-normal text-red-500 text-center mt-1">{t('auth.errors.contactAdmin')}</p>
                            )}
                        </div>
                    )}

                    <div className="w-full space-y-4">
                        <Button
                            onClick={handleGoogleLogin}
                            isLoading={loading}
                            variant="outline"
                            className="w-full py-6 rounded-2xl border-slate-200 dark:border-white/10 card-hover shadow-sm"
                        >
                            {!loading && <GoogleIcon />}
                            <span className="ml-3 text-[15px] font-bold text-slate-700 dark:text-white">{t('auth.google')}</span>
                        </Button>

                        <Button
                            onClick={handleAppleLogin}
                            isLoading={loading}
                            className="w-full py-6 bg-black text-white rounded-2xl card-hover shadow-sm"
                        >
                            {!loading && (
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-.98-.4-2.05-.4-3.08.4-1.05.45-2.05.45-3.08-.4-1.05-.85-2.05-2.4-2.05-4.6 0-3.15 2.05-4.8 4.1-4.8 1.05 0 2.05.45 3.08.45 1.05 0 2.05-.45 3.08-.45 1.05 0 2.05.45 3.08.45.98 0 1.95-.45 2.55-1.15-2.05-1.15-2.05-3.6-2.05-3.75 1.55-.65 2.55-1.9 2.55-3.15-.05-.25-.05-.5-.05-.75-1.55.65-2.55 1.9-2.55 3.15.05.25.05.5.05.75 1.55-.65 2.55-1.9 2.55-3.15zM12.03 7.25c-.05-.25-.05-.5-.05-.75 1.55-.65 2.55-1.9 2.55-3.15.05.25.05.5.05.75-1.55.65-2.55 1.9-2.55 3.15z" />
                                    <path d="M12.03 7.25c.05.25.05.5.05.75-1.55.65-2.55 1.9-2.55 3.15-.05-.25-.05-.5-.05-.75 1.55-.65-2.55 1.9-2.55 3.15z" fill="none" />
                                    <path d="M13.03 2.1c-1.55.65-2.55 1.9-2.55 3.15.05.25.05.5.05.75 1.55-.65 2.55-1.9 2.55-3.15-.05-.25-.05-.5-.05-.75z" />
                                    <path d="M17.03 11.28c-.6-.7-1.55-1.15-2.55-1.15-1.03 0-2.03.45-3.08.45-1.03 0-2.03-.45-3.08-.45-2.05 0-4.1 1.65-4.1 4.8 0 2.2 1 3.75 2.05 4.6 1.03.85 2.03.85 3.08.4 1.03-.8 2.1-.8 3.08.4 1.03.48 2.1.55 3.08-.4 1.03-.85 2.03-2.4 2.05-4.6-.05-.15-2.05-1.15-2.05-3.75.05-.15 2.05-1.15 2.05-3.75z" />
                                </svg>
                            )}
                            <span className="ml-3 text-[15px] font-bold">{t('auth.apple')}</span>
                        </Button>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-white/10"></div></div>
                            <div className="relative flex justify-center"><span className="px-4 bg-white/80 dark:bg-black/40 backdrop-blur-sm text-[11px] uppercase tracking-widest font-bold text-slate-500">{t('auth.orEmail')}</span></div>
                        </div>

                        <form onSubmit={handleSubmit(onEmailAuthSubmit)} className="space-y-5">
                            <div className="space-y-1.5">
                                <FloatingLabelInput
                                    id="email"
                                    label={t('auth.email')}
                                    type="email"
                                    autoComplete="email"
                                    icon={Mail}
                                    {...register('email')}
                                    error={errors.email?.message}
                                    placeholder="nom@entreprise.com"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center ml-1 mb-1">
                                    {isLogin && (
                                        <button type="button" aria-label={t('auth.forgotPassword')} onClick={() => setShowResetModal(true)} className="text-[13px] font-bold text-brand-600 hover:text-brand-700 transition-colors">
                                            {t('auth.forgotPassword')}
                                        </button>
                                    )}
                                </div>
                                <FloatingLabelInput
                                    id="password"
                                    label={t('auth.password')}
                                    type="password"
                                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                                    icon={Lock}
                                    {...register('password')}
                                    error={errors.password?.message}
                                    placeholder="••••••••"
                                />
                            </div>

                            <Button
                                type="submit"
                                isLoading={loading}
                                disabled={loading}
                                className="w-full py-6 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl card-hover shadow-lg shadow-brand-500/20"
                            >
                                {isLogin ? t('auth.login') : t('auth.signup')}
                                {!loading && <ArrowRight className="ml-2 h-5 w-5" strokeWidth={2.5} />}
                            </Button>
                        </form>
                    </div>

                    <div className="mt-8 text-center">
                        <button
                            aria-label={isLogin ? t('auth.switchSignup') : t('auth.switchLogin')}
                            onClick={() => { setIsLogin(!isLogin); setErrorMsg(null); }}
                            className="text-[13px] font-bold text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            {isLogin ? t('auth.switchSignup') : t('auth.switchLogin')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="py-6 text-center relative z-10 space-y-2 px-4 sm:px-6 max-w-full">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('auth.footer.developedBy')}</p>
                <p className="text-sm text-slate-500 break-words">
                    {t('auth.footer.recaptcha')}
                    <button aria-label={t('auth.footer.privacy')} onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }} className="underline hover:text-slate-600 ml-1">
                        {t('auth.footer.privacy')}
                    </button>
                    {' '}{t('common.and')}{' '}
                    <button aria-label={t('auth.footer.terms')} onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }} className="underline hover:text-slate-600">
                        {t('auth.footer.terms')}
                    </button>
                    ,{' '}
                    <button aria-label={t('auth.footer.cgv')} onClick={() => { setLegalTab('cgv'); setShowLegalModal(true); }} className="underline hover:text-slate-600">
                        {t('auth.footer.cgv')}
                    </button>
                    {' '}{t('common.and')}{' '}
                    <button aria-label={t('auth.footer.legal')} onClick={() => { setLegalTab('mentions'); setShowLegalModal(true); }} className="underline hover:text-slate-600">
                        {t('auth.footer.legal')}
                    </button>
                    {' '}{t('auth.footer.apply')}
                </p>
            </div>

            {/* Reset Password Modal */}
            {
                showResetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md border border-white/20 shadow-2xl relative">
                            <button aria-label="Fermer" onClick={() => setShowResetModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <X className="h-5 w-5" />
                            </button>

                            <div className="text-center mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mx-auto mb-4 text-brand-600">
                                    <Mail className="h-7 w-7" />
                                </div>
                                {/* Heading hierarchy: h2 for modal title (follows h1 page title) */}
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('auth.reset.title')}</h2>
                                <p className="text-sm text-slate-600 mt-2">{t('auth.reset.desc')}</p>
                            </div>

                            {!resetSent ? (
                                <form onSubmit={resetForm.handleSubmit(onPasswordResetSubmit)} className="space-y-6">
                                    <div>
                                        <FloatingLabelInput
                                            id="resetEmail"
                                            label={t('auth.email')}
                                            type="email"
                                            {...resetForm.register('email')}
                                            error={resetForm.formState.errors.email?.message}
                                            placeholder="nom@entreprise.com"
                                        />
                                    </div>
                                    <Button type="submit" isLoading={loading} disabled={loading} className="w-full py-6 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-2xl hover:scale-[1.02] shadow-lg">
                                        {loading ? t('auth.reset.sending') : t('auth.reset.submit')}
                                    </Button>
                                </form>
                            ) : (
                                <div className="text-center py-4">
                                    <div className="inline-flex items-center px-4 py-2 rounded-xl bg-green-50 text-green-700 text-sm font-bold mb-4 border border-green-100">
                                        <CheckCircle2 className="h-4 w-4 mr-2" /> {t('auth.reset.sent')}
                                    </div>
                                    <p className="text-sm text-slate-600 mb-6">{t('auth.reset.checkEmail')}</p>
                                    <button aria-label={t('auth.reset.back')} onClick={() => setShowResetModal(false)} className="text-sm font-bold text-brand-600 hover:underline">{t('auth.reset.back')}</button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {/* MFA Modal */}
            {
                showMfaModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md border border-white/20 shadow-2xl relative">
                            <button aria-label="Fermer" onClick={() => setShowMfaModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <X className="h-5 w-5" />
                            </button>

                            <div className="text-center mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4 text-emerald-600">
                                    <Lock className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('auth.mfa.title')}</h3>
                                <p className="text-sm text-slate-600 mt-2">{t('auth.mfa.desc')}</p>
                            </div>

                            {mfaError && (
                                <div className="w-full mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 text-center">
                                    {mfaError}
                                </div>
                            )}

                            <form onSubmit={onMfaSubmit} className="space-y-6">
                                <div>
                                    <FloatingLabelInput
                                        id="mfaCode"
                                        label={t('auth.mfa.codeLabel')}
                                        name="mfaCode"
                                        type="text"
                                        value={mfaCode}
                                        onChange={(e) => {
                                            if (typeof e === 'string') setMfaCode(e);
                                            else if (e && e.target) setMfaCode(e.target.value);
                                        }}
                                        placeholder="000000"
                                        maxLength={6}
                                        autoComplete="one-time-code"
                                        inputMode="numeric"
                                        className="text-center tracking-widest"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    isLoading={mfaLoading}
                                    disabled={mfaLoading}
                                    className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl hover:scale-[1.02] shadow-lg"
                                >
                                    {mfaLoading ? t('auth.mfa.verifying') : t('auth.mfa.verify')}
                                </Button>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Legal Modal */}
            <LegalModal
                isOpen={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                initialTab={legalTab}
            />
        </AuroraBackground>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
