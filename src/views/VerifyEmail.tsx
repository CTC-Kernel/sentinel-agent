import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { sendEmailVerification, signOut, reload } from 'firebase/auth';
import { useStore } from '../store';
import { Mail, RefreshCw, LogOut, CheckCircle2, AlertTriangle, Loader2 } from '../components/ui/Icons';
import { useNavigate } from 'react-router-dom';
import { ErrorLogger } from '../services/errorLogger';

export const VerifyEmail: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useStore();
    const navigate = useNavigate();

    useEffect(() => {
        // Check if already verified on mount
        if (auth.currentUser?.emailVerified) {
            navigate('/dashboard');
        }
    }, [navigate]);

    const handleResendEmail = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        setError(null);
        try {
            await sendEmailVerification(auth.currentUser);
            setEmailSent(true);
            addToast("Email de vérification envoyé", "success");
        } catch (err: unknown) {
            const error = err as { code?: string };
            if (error.code === 'auth/too-many-requests') {
                setError("Trop de tentatives. Veuillez patienter.");
            } else {
                setError("Erreur lors de l'envoi de l'email.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCheckVerification = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        try {
            await reload(auth.currentUser);
            if (auth.currentUser.emailVerified) {
                addToast("Email vérifié avec succès !", "success");
                // Force reload to update context
                window.location.reload();
            } else {
                addToast("Email non vérifié. Veuillez vérifier votre boîte mail.", "info");
            }
        } catch {
            addToast("Erreur lors de la vérification", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            ErrorLogger.error(error, 'VerifyEmail.handleLogout');
        }
    };

    return (
        <div className="min-h-screen py-10 flex flex-col items-center justify-center bg-background relative font-sans">
            {/* Ambient Background */}
            <div className="absolute inset-0 w-full h-full">
                <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-blue-300/30 dark:bg-slate-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-indigo-300/30 dark:bg-slate-900/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float" style={{ animationDelay: '3s' }}></div>
            </div>

            <div className="w-full max-w-md p-6 relative z-10 animate-scale-in">
                <div className="glass-panel rounded-[2.5rem] p-10 flex flex-col items-center shadow-2xl border border-white/50 dark:border-white/10 bg-white/90 dark:bg-black/60 backdrop-blur-xl text-center">

                    <div className="w-20 h-20 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center mb-6 text-yellow-600 dark:text-yellow-500 shadow-lg">
                        <Mail className="h-10 w-10" />
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Vérifiez votre email</h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-8">
                        Un lien de vérification a été envoyé à <strong>{auth.currentUser?.email}</strong>.<br />
                        Veuillez cliquer sur le lien pour activer votre compte.
                    </p>

                    {error && (
                        <div className="w-full mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-red-600">
                            <AlertTriangle className="h-4 w-4" /> {error}
                        </div>
                    )}

                    {emailSent && (
                        <div className="w-full mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-green-600">
                            <CheckCircle2 className="h-4 w-4" /> Email envoyé ! Vérifiez vos spams.
                        </div>
                    )}

                    <div className="space-y-4 w-full">
                        <button
                            onClick={handleCheckVerification}
                            disabled={loading}
                            className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center"
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
                            className="w-full py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-600" /> : "Renvoyer l'email"}
                        </button>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="mt-8 text-sm font-bold text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 flex items-center transition-colors"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
};
