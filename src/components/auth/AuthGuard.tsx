import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLocale } from '../../hooks/useLocale';
import { PremiumCard } from '../ui/PremiumCard';
import { MasterpieceBackground } from '../ui/MasterpieceBackground';
import { AlertCircle, RefreshCw, LogOut, Mail, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../ui/LoadingScreen';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../firebase';
import { toast } from '../../lib/toast';

interface AuthGuardProps {
 children: React.ReactNode;
 requireOnboarding?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireOnboarding = true }) => {
 const { t } = useLocale();
 const { user, loading, firebaseUser, error, profileError, claimsSynced, logout } = useAuth();

 const location = useLocation();

 // Resend verification email state
 const [resendCooldown, setResendCooldown] = useState(0);
 const [resendLoading, setResendLoading] = useState(false);

 useEffect(() => {
 if (resendCooldown <= 0) return;
 const timer = setInterval(() => {
 setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
 }, 1000);
 return () => clearInterval(timer);
 }, [resendCooldown]);

 const handleResendEmail = useCallback(async () => {
 if (!auth.currentUser || resendCooldown > 0) return;
 setResendLoading(true);
 try {
 await sendEmailVerification(auth.currentUser);
 toast.success(t('auth.emailResent', { defaultValue: 'Email de vérification envoyé ! Vérifiez votre boîte de réception et vos spams.' }) || 'Email de vérification envoyé !');
 setResendCooldown(60);
 } catch (err) {
 toast.error(t('auth.errors.generic', { defaultValue: 'Impossible d\'envoyer l\'email. Reessayez plus tard.' }));
 void err;
 } finally {
 setResendLoading(false);
 }
 }, [resendCooldown, t]);

 // Bypass auth in test mode (NEVER in production builds)
 if (import.meta.env.DEV === true && (import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_EMULATORS === 'true')) {
 return <>{children}</>;
 }

 if (error) {
 throw error;
 }

 if (loading || (firebaseUser && !claimsSynced)) {
 return <LoadingScreen />;
 }

 if (!firebaseUser) {
 return <Navigate to="/login" state={{ from: location }} replace />;
 }

 // NEW: Handle Email Verification Screen
 if (firebaseUser && !firebaseUser.emailVerified && location.pathname !== '/verify-email') {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-background relative overflow-hidden">
 <MasterpieceBackground />
 <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="w-full max-w-md p-6 relative z-decorator"
 >
  <PremiumCard glass className="p-8 text-center border-primary/20 dark:border-primary/10 shadow-xl shadow-primary/5">
  <div className="w-20 h-20 bg-primary/10 dark:bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 mx-auto ring-8 ring-primary/10 dark:ring-primary/5">
  <Mail className="w-10 h-10" />
  </div>
  <h1 className="text-2xl font-black mb-3 text-foreground tracking-tight">
  {t('auth.verifyEmailTitle')}
  </h1>
  <p className="text-text-description mb-8 leading-relaxed">
  {t('auth.verifyEmailDesc')} <b>{firebaseUser.email}</b>.
  </p>
  <div className="flex flex-col gap-3">
  <button
  onClick={() => window.location.reload()}
  className="w-full py-4 bg-primary text-primary-foreground font-black rounded-3xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  <RefreshCw className="w-4 h-4 mr-2" />
  {t('auth.iVerified')}
  </button>
  <button
  onClick={handleResendEmail}
  disabled={resendCooldown > 0 || resendLoading}
  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-3xl text-sm transition-all shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  <Send className="w-4 h-4 mr-2" />
  {resendCooldown > 0
   ? `${t('auth.resendEmail', { defaultValue: 'Renvoyer l\'email' })} (${resendCooldown}s)`
   : t('auth.resendEmail', { defaultValue: 'Renvoyer l\'email' })}
  </button>
  <button
  onClick={() => logout()}
  className="w-full py-3 text-muted-foreground hover:text-foreground text-muted-foreground dark:hover:text-foreground transition-colors text-sm font-bold flex items-center justify-center"
  >
  <LogOut className="w-4 h-4 mr-2" />
  {t('common.logout')}
  </button>
  </div>
  </PremiumCard>
 </motion.div>
 </div>
 );
 }

 if (user && requireOnboarding && (!user.onboardingCompleted || !user.organizationId)) {
 return <Navigate to="/onboarding" replace />;
 }

 // FIX: If we have a Firebase User but failed to load the Firestore Profile (e.g. timeout),
 // Show a "Retry" screen instead of redirecting to Onboarding (which causes a loop).
 if (firebaseUser && !user && !loading && (requireOnboarding || profileError)) {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-background relative overflow-hidden">
 <MasterpieceBackground />
 <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="w-full max-w-md p-6 relative z-decorator"
 >
  <PremiumCard glass className="p-8 text-center border-red-500/20 dark:border-red-500/10 shadow-xl shadow-red-500/5">
  <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6 mx-auto ring-8 ring-red-50 dark:ring-red-500/5">
  <AlertCircle className="w-10 h-10" />
  </div>
  <h1 className="text-2xl font-black mb-3 text-foreground tracking-tight">
  {t('auth.connectionError')}
  </h1>
  <p className="text-text-description mb-8 leading-relaxed">
  {t('auth.profileLoadError')}
  </p>
  <div className="flex flex-col gap-3">
  <button
  onClick={() => window.location.reload()}
  className="w-full py-4 bg-primary text-primary-foreground font-black rounded-3xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  <RefreshCw className="w-4 h-4 mr-2" />
  {t('common.retry')}
  </button>
  <button
  onClick={() => logout()}
  className="w-full py-3 text-muted-foreground hover:text-foreground text-muted-foreground dark:hover:text-foreground transition-colors text-sm font-bold flex items-center justify-center"
  >
  <LogOut className="w-4 h-4 mr-2" />
  {t('common.logout')}
  </button>
  </div>
  </PremiumCard>
 </motion.div>
 </div>
 );
 }

 return <>{children}</>;
};
