import React, { useState, useEffect } from 'react';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { useStore } from '../store';
import { Mail, RefreshCw, LogOut, CheckCircle2, Loader2 } from '../components/ui/Icons';
import { useAuthActions } from '../hooks/useAuthActions';

export const VerifyEmail: React.FC = () => {
    const { user } = useStore();
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const { sendVerificationEmail, checkEmailVerification, logout } = useAuthActions();

    useEffect(() => {
        // Check if already verified on mount
        if (user?.emailVerified) {
            window.location.href = '/dashboard';
        }
    }, [user?.emailVerified]);

    const handleResendEmail = async () => {
        setLoading(true);
        try {
            await sendVerificationEmail();
            setEmailSent(true);
        } catch {
            // Error handled in hook
        } finally {
            setLoading(false);
        }
    };

    const handleCheckVerification = async () => {
        setLoading(true);
        try {
            await checkEmailVerification();
        } catch {
            // Error handled in hook
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    return (
        <div className="min-h-screen py-10 flex flex-col items-center justify-center relative font-sans">
            <MasterpieceBackground />

            <div className="w-full max-w-md p-6 relative z-10 animate-scale-in">
                <div className="glass-panel rounded-[2.5rem] p-10 flex flex-col items-center shadow-2xl border border-white/50 dark:border-white/10 bg-white/90 dark:bg-black/60 backdrop-blur-xl text-center">

                    <div className="w-20 h-20 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center mb-6 text-yellow-600 dark:text-yellow-500 shadow-lg">
                        <Mail className="h-10 w-10" />
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Vérifiez votre email</h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-8">
                        Un lien de vérification a été envoyé à <strong>{user?.email}</strong>.<br />
                        Veuillez cliquer sur le lien pour activer votre compte.
                    </p>

                    {emailSent && (
                        <div className="w-full mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-green-600">
                            <CheckCircle2 className="h-4 w-4" /> Email envoyé ! Vérifiez vos spams.
                        </div>
                    )}

                    <div className="space-y-4 w-full">
                        <button
                            onClick={handleCheckVerification}
                            disabled={loading}
                            className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                    <RefreshCw className="mr-2 h-5 w-5" />
                                    J'ai vérifié mon email
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleResendEmail}
                            disabled={loading || emailSent}
                            className="w-full py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-600" /> : "Renvoyer l'email"}
                        </button>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="mt-8 text-sm font-bold text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 flex items-center transition-colors hover:underline"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
};
