import React, { useState, useEffect } from 'react';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { LandingMap } from '../components/landing/LandingMap';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { Lock, Mail, ArrowRight, AlertTriangle, X, CheckCircle2, Shield } from '../components/ui/Icons';
import { SentinelAssistant } from '../components/auth/SentinelAssistant';
import { Button } from '../components/ui/button';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { useStore } from '../store';
import { LegalModal } from '../components/ui/LegalModal';
import { SubmitHandler } from 'react-hook-form';
import { useZodForm } from '../hooks/useZodForm';
import { loginSchema, registerSchema, resetPasswordSchema, LoginFormData, RegisterFormData, ResetPasswordFormData } from '../schemas/authSchema';
import { useAuthActions } from '../hooks/useAuthActions';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { toast } from '../lib/toast';

// Google SVG optimized
const GoogleIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const Login: React.FC<{ skipBoot?: boolean }> = () => {
    const location = useLocation();
    const [isLogin, setIsLogin] = useState(!location.pathname.includes('/register'));
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
    const { register, handleSubmit, formState: { errors }, clearErrors } = useZodForm({
        schema: isLogin ? loginSchema : registerSchema,
        mode: 'onChange'
    });

    // Reset Password Form
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const resetForm = useZodForm({
        schema: resetPasswordSchema,
        mode: 'onChange'
    });

    // Legal Modal State
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [legalTab, setLegalTab] = useState<'mentions' | 'privacy' | 'terms' | 'cgv'>('mentions');

    // Privacy consent for signup (RGPD compliance)
    const [privacyAccepted, setPrivacyAccepted] = useState(false);

    // MFA State from Hook
    const [mfaCode, setMfaCode] = useState('');

    const onMfaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await handleMfaVerification(mfaCode);
    };

    // Show session expired message if redirected after timeout
    useEffect(() => {
        const expired = sessionStorage.getItem('session_expired');
        if (expired) {
            sessionStorage.removeItem('session_expired');
            toast.info(t('auth.sessionExpired', { defaultValue: 'Votre session a expiré. Veuillez vous reconnecter.' }));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear errors when switching modes (this is safe - clearErrors is from react-hook-form)
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

    return (
        <AuroraBackground className="min-h-screen py-4 sm:py-0 px-4 flex flex-col bg-background text-foreground relative font-sans selection:bg-primary/30 selection:text-primary">
            <div className="absolute top-4 right-4 z-modal">
                <ThemeToggle />
            </div>

            <SEO
                title={t('login.seoTitle', { defaultValue: 'Login' })}
                description={t('login.seoDescription', { defaultValue: 'Log in to your secure Sentinel GRC workspace.' })}
                keywords="Connexion, Secure Login, MFA, GRC, Sentinel"
            />

            {/* Aceternity Spotlight Effect */}
            <Spotlight
                className="-top-40 left-0 md:left-60 md:-top-20"
                fill="white"
            />

            {/* Background Map - Visual Continuity */}
            <LandingMap className="fixed inset-0" />

            {/* Ambient Background & Sparkles */}
            <div className="absolute inset-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-primary/10 dark:bg-slate-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-primary/10 dark:bg-slate-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float" style={{ animationDelay: '3s' }}></div>
            </div>

            <div className="w-full max-h-full max-w-7xl relative z-10 animate-scale-in flex-1 flex flex-col lg:flex-row items-center justify-center mx-auto px-4 sm:px-6 min-w-0 transition-transform duration-500 ease-out origin-center [@media(max-height:900px)]:scale-90 [@media(max-height:750px)]:scale-75">

                {/* Left Column: Sentinel Assistant */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
                    <SentinelAssistant />
                </div>

                {/* Right Column: Login Form */}
                <div className="w-full lg:w-1/2 max-w-[480px] p-4 lg:p-8 perspective-1000">
                    <motion.div
                        initial={{ opacity: 0, rotateY: 15, x: 50 }}
                        animate={{ opacity: 1, rotateY: 0, x: 0 }}
                        transition={{
                            duration: 0.8,
                            type: "spring",
                            stiffness: 100,
                            damping: 20
                        }}
                        className="glass-premium glass-noise rounded-[3rem] p-10 flex flex-col items-center shadow-2xl relative overflow-hidden group"
                    >
                        {/* Dynamic Border Gradient */}
                        <div className="absolute inset-0 rounded-[3rem] p-[1px] bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none mask-image-blob"></div>

                        {/* Shimmer overlay on load */}
                        <div className="absolute inset-0 z-0 animate-shimmer pointer-events-none opacity-20"></div>

                        {/* Logo - Mobile Only or Simplified */}
                        <div className="mb-6 flex flex-col items-center lg:hidden">
                            <div className="w-16 h-16 rounded-3xl bg-foreground text-background flex items-center justify-center shadow-xl mb-5 ring-1 ring-background/5 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                                <Lock className="h-8 w-8" strokeWidth={2.5} />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tighter text-foreground">Sentinel GRC</h1>
                            <p className="text-base font-medium text-muted-foreground mt-2">{t('auth.subtitle')}</p>
                        </div>

                        {/* Logo - Desktop w/o Assistant Context (if simplified) -> Keep centered for form consistency */}
                        <div className="hidden lg:flex flex-col items-center mb-8 relative z-10">
                            <motion.div
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                className="w-16 h-16 rounded-3xl bg-foreground text-background flex items-center justify-center shadow-2xl mb-4 ring-1 ring-white/10 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
                                <Lock className="h-8 w-8 relative z-10" strokeWidth={2.5} />
                            </motion.div>
                            <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">
                                {isLogin ? (
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                                        {t('auth.login')}
                                    </span>
                                ) : (
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                                        {t('auth.signup')}
                                    </span>
                                )}
                            </h2>
                        </div>

                        {errorMsg && (
                            <div className="w-full mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex flex-col gap-2 text-xs font-bold text-destructive shadow-sm animate-slide-up">
                                <p className="flex items-center justify-center"><AlertTriangle className="h-4 w-4 mr-2" /> {errorMsg}</p>
                                {errorMsg.includes('restreint') && (
                                    <p className="text-[11px] font-normal text-destructive/80 text-center mt-1">{t('auth.errors.contactAdmin')}</p>
                                )}
                            </div>
                        )}

                        <div className="w-full space-y-4">
                            <Button
                                onClick={handleGoogleLogin}
                                isLoading={loading}
                                variant="outline"
                                className="w-full py-6 rounded-2xl border-muted card-hover shadow-sm"
                            >
                                {!loading && <GoogleIcon />}
                                <span className="ml-3 text-[15px] font-bold text-foreground">{t('auth.google')}</span>
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
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-muted"></div></div>
                                <div className="relative flex justify-center"><span className="px-4 bg-background/80 backdrop-blur-sm text-[11px] uppercase tracking-widest font-bold text-muted-foreground">{t('auth.orEmail')}</span></div>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.form
                                    key={isLogin ? 'login' : 'register'}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    onSubmit={handleSubmit(onEmailAuthSubmit)}
                                    className="space-y-5"
                                >
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
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    onClick={() => setShowResetModal(true)}
                                                    className="text-[13px] font-bold text-primary hover:text-primary/80 p-0 h-auto"
                                                >
                                                    {t('auth.forgotPassword')}
                                                </Button>
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

                                    {/* Privacy consent notice for signup (RGPD compliance) */}
                                    {!isLogin && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="p-4 rounded-2xl bg-success/10 border border-success/20 overflow-hidden"
                                        >
                                            <label className="flex items-start gap-3 cursor-pointer group">
                                                <div className="relative mt-0.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={privacyAccepted}
                                                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                                                        className="peer sr-only"
                                                        aria-label={t('auth.privacyConsent', { defaultValue: 'Accepter la politique de confidentialité' })}
                                                    />
                                                    <div className="w-5 h-5 rounded-md border-2 border-muted peer-checked:border-success peer-checked:bg-success transition-colors flex items-center justify-center">
                                                        {privacyAccepted && (
                                                            <svg className="w-3 h-3 text-success-foreground" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Shield className="w-4 h-4 text-success" />
                                                        <span className="text-sm font-bold text-success">
                                                            {t('auth.privacyTitle', { defaultValue: 'Protection de vos données' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                        {t('auth.privacyNotice', { defaultValue: 'En créant un compte, j\'accepte la ' })}
                                                        <button
                                                            type="button"
                                                            onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }}
                                                            className="text-success font-bold hover:underline"
                                                        >
                                                            {t('auth.footer.privacy', { defaultValue: 'Politique de confidentialité' })}
                                                        </button>
                                                        {' '}{t('login.andThe', { defaultValue: 'and the' })}{' '}
                                                        <button
                                                            type="button"
                                                            onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }}
                                                            className="text-success font-bold hover:underline"
                                                        >
                                                            {t('auth.footer.terms', { defaultValue: 'CGU' })}
                                                        </button>.
                                                    </p>
                                                </div>
                                            </label>
                                        </motion.div>
                                    )}

                                    <Button
                                        type="submit"
                                        isLoading={loading}
                                        disabled={loading || (!isLogin && !privacyAccepted)}
                                        className="w-full py-6 font-bold rounded-2xl shadow-primary/20 shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all disabled:opacity-70 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600 relative overflow-hidden group/btn"
                                    >
                                        <span className="relative z-10 flex items-center justify-center">
                                            {isLogin ? t('auth.login') : t('auth.signup')}
                                            {!loading && <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover/btn:translate-x-1" strokeWidth={2.5} />}
                                        </span>
                                    </Button>
                                </motion.form>
                            </AnimatePresence>
                        </div>

                        <div className="mt-8 text-center relative z-10">
                            <Button
                                variant="ghost"
                                onClick={() => { setIsLogin(!isLogin); setErrorMsg(null); setPrivacyAccepted(false); }}
                                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {isLogin ? t('auth.switchSignup') : t('auth.switchLogin')}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </div>


            <div className="py-6 text-center relative z-10 space-y-2 px-4 sm:px-6 max-w-full">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t('auth.footer.developedBy')}{' '}
                    <a
                        href="https://cyber-threat-consulting.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 underline transition-colors"
                    >
                        cyber-threat-consulting.com
                    </a>
                </p>
                <p className="text-sm text-muted-foreground break-words">
                    {t('auth.footer.recaptcha')}
                    <button aria-label={t('auth.footer.privacy')} onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }} className="underline hover:text-foreground ml-1">
                        {t('auth.footer.privacy')}
                    </button>
                    {' '}{t('common.and')}{' '}
                    <button aria-label={t('auth.footer.terms')} onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }} className="underline hover:text-foreground">
                        {t('auth.footer.terms')}
                    </button>
                    ,{' '}
                    <button aria-label={t('auth.footer.cgv')} onClick={() => { setLegalTab('cgv'); setShowLegalModal(true); }} className="underline hover:text-foreground">
                        {t('auth.footer.cgv')}
                    </button>
                    {' '}{t('common.and')}{' '}
                    <button aria-label={t('auth.footer.legal')} onClick={() => { setLegalTab('mentions'); setShowLegalModal(true); }} className="underline hover:text-foreground">
                        {t('auth.footer.legal')}
                    </button>
                    {' '}{t('auth.footer.apply')}
                </p>
            </div>

            {/* Reset Password Modal */}
            {
                showResetModal && (
                    <div className="fixed inset-0 z-modal flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-background rounded-3xl p-8 w-full max-w-md border border-muted shadow-2xl relative">
                            <Button variant="ghost" size="sm" onClick={() => setShowResetModal(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground p-2 h-auto rounded-full">
                                <X className="h-5 w-5" />
                            </Button>

                            <div className="text-center mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                                    <Mail className="h-7 w-7" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground">{t('auth.reset.title')}</h2>
                                <p className="text-sm text-muted-foreground mt-2">{t('auth.reset.desc')}</p>
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
                                    <Button type="submit" isLoading={loading} disabled={loading} className="w-full py-6 bg-foreground text-background font-bold rounded-2xl hover:scale-[1.02] shadow-lg">
                                        {loading ? t('auth.reset.sending') : t('auth.reset.submit')}
                                    </Button>
                                </form>
                            ) : (
                                <div className="text-center py-4">
                                    <div className="inline-flex items-center px-4 py-2 rounded-xl bg-success/10 text-success text-sm font-bold mb-4 border border-success/20">
                                        <CheckCircle2 className="h-4 w-4 mr-2" /> {t('auth.reset.sent')}
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-6">{t('auth.reset.checkEmail')}</p>
                                    <button aria-label={t('auth.reset.back')} onClick={() => setShowResetModal(false)} className="text-sm font-bold text-primary hover:underline">{t('auth.reset.back')}</button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            {/* MFA Modal */}
            {
                showMfaModal && (
                    <div className="fixed inset-0 z-modal flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-background rounded-3xl p-8 w-full max-w-md border border-muted shadow-2xl relative">
                            <Button variant="ghost" size="sm" onClick={() => setShowMfaModal(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground p-2 h-auto rounded-full">
                                <X className="h-5 w-5" />
                            </Button>

                            <div className="text-center mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4 text-success">
                                    <Lock className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">{t('auth.mfa.title')}</h3>
                                <p className="text-sm text-muted-foreground mt-2">{t('auth.mfa.desc')}</p>
                            </div>

                            {mfaError && (
                                <div className="w-full mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-2xl text-xs font-bold text-destructive text-center">
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
                                    className="w-full py-6 bg-success text-success-foreground font-bold rounded-2xl hover:scale-[1.02] shadow-lg"
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
        </AuroraBackground >
    );
};
