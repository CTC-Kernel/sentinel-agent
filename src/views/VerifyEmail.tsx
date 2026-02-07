import React, { useState, useEffect } from 'react';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { useStore } from '../store';
import { Mail, RefreshCw, LogOut, CheckCircle2, AlertCircle } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { useAuthActions } from '../hooks/useAuthActions';
import { toast } from '../lib/toast';

import { useNavigate } from 'react-router-dom';

export const VerifyEmail: React.FC = () => {
 const { user, t } = useStore();
 const navigate = useNavigate();
 const [loading, setLoading] = useState(false);
 const [emailSent, setEmailSent] = useState(false);
 const [notVerifiedMsg, setNotVerifiedMsg] = useState(false);
 const { sendVerificationEmail, checkEmailVerification, logout } = useAuthActions();

 useEffect(() => {
 // Check if already verified on mount
 if (user?.emailVerified) {
 navigate('/dashboard');
 }
 }, [user?.emailVerified, navigate]);

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
 setNotVerifiedMsg(false);
 try {
 const verified = await checkEmailVerification();
 if (verified) {
 toast.success(t('auth.emailVerified') || 'Email vérifié avec succès !');
 navigate('/');
 } else {
 setNotVerifiedMsg(true);
 }
 } catch {
 setNotVerifiedMsg(true);
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

 <div className="w-full max-w-md p-6 relative z-decorator animate-scale-in">
 <div className="glass-premium rounded-3xl p-10 flex flex-col items-center shadow-2xl border border-white/50 dark:border-white/10 bg-white/90 dark:bg-black/60 backdrop-blur-xl text-center">

  <div className="w-20 h-20 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center mb-6 text-yellow-600 dark:text-yellow-500 shadow-lg">
  <Mail className="h-10 w-10" />
  </div>

  <h1 className="text-2xl font-bold text-foreground mb-2">Vérifiez votre email</h1>
  <p className="text-muted-foreground mb-8">
  Un lien de vérification a été envoyé à <strong>{user?.email}</strong>.<br />
  Veuillez cliquer sur le lien pour activer votre compte.
  </p>

  {emailSent && (
  <div className="w-full mb-6 p-4 bg-success-bg border border-success-border rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-success-text">
  <CheckCircle2 className="h-4 w-4" /> Email envoyé ! Vérifiez vos spams.
  </div>
  )}

  {notVerifiedMsg && (
  <div className="w-full mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700/30 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-yellow-700 dark:text-yellow-400">
  <AlertCircle className="h-4 w-4" /> {t('auth.emailNotYetVerified') || 'Email non encore vérifié. Vérifiez votre boîte de réception.'}
  </div>
  )}

  <div className="space-y-4 w-full">
  <Button
  aria-label={t('auth.iVerifiedMyEmail', { defaultValue: 'J\'ai vérifié mon email' })}
  onClick={handleCheckVerification}
  disabled={loading}
  isLoading={loading}
  className="w-full py-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-lg"
  >
  {!loading && <RefreshCw className="mr-2 h-5 w-5" />}
  {t('auth.iVerifiedMyEmail', { defaultValue: 'J\'ai vérifié mon email' })}
  </Button>

  <Button
  variant="outline"
  aria-label={t('auth.resendEmail', { defaultValue: 'Renvoyer l\'email' })}
  onClick={handleResendEmail}
  disabled={loading || emailSent}
  isLoading={loading}
  className="w-full py-6 bg-card border border-border text-foreground font-bold rounded-2xl hover:bg-muted/50 transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-lg"
  >
  {t('auth.resendEmail', { defaultValue: 'Renvoyer l\'email' })}
  </Button>
  </div>

  <Button
  variant="link"
  aria-label={t('auth.logout', { defaultValue: 'Se déconnecter' })}
  onClick={handleLogout}
  className="mt-8 text-sm font-bold text-muted-foreground hover:text-muted-foreground/60 flex items-center transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  <LogOut className="mr-2 h-4 w-4" />
  {t('auth.logout', { defaultValue: 'Se déconnecter' })}
  </Button>
 </div>
 </div>
 </div>
 );
};
