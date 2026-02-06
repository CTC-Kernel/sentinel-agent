import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useStore } from '../store';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { LandingMap } from '../components/landing/LandingMap';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { SEO } from '../components/SEO';
import { EnrollmentTokenPanel } from '../components/agents/EnrollmentTokenPanel';
import { ErrorLogger } from '../services/errorLogger';
import {
 Lock,
 UserPlus,
 LogIn,
 ArrowRight,
 ShieldCheck,
 Briefcase,
} from '../components/ui/Icons';

import * as AgentService from '../services/AgentService';

const RETURN_KEY = 'agent_setup_return';

export const AgentSetup: React.FC = () => {
 const { loading, firebaseUser, claimsSynced } = useAuth();
 const { user: storeUser, t } = useStore();
 const navigate = useNavigate();

 const [tokenValue, setTokenValue] = useState<string | null>(null);
 const [tokenLoading, setTokenLoading] = useState(false);
 const [tokenError, setTokenError] = useState<string | null>(null);

 const isAuthenticated = !!firebaseUser;
 const hasOrganization = !!storeUser?.organizationId;
 const organizationId = storeUser?.organizationId;

 // Auto-generate token when authenticated with org
 useEffect(() => {
 if (!hasOrganization || !organizationId) return;
 sessionStorage.removeItem(RETURN_KEY);

 let cancelled = false;

 const generateToken = async () => {
 setTokenLoading(true);
 try {
 const result = await AgentService.generateEnrollmentToken(organizationId);
 if (!cancelled) setTokenValue(result.token || null);
 } catch (err) {
 if (!cancelled) {
  setTokenError(t('agentSetup.errors.tokenGeneration', { defaultValue: 'Impossible de generer le token. Reessayez.' }));
  ErrorLogger.error(err, 'AgentSetup.generateToken');
 }
 } finally {
 if (!cancelled) setTokenLoading(false);
 }
 };

 generateToken();

 return () => { cancelled = true; };
 }, [hasOrganization, organizationId, t]);

 // Loading state
 if (loading || (firebaseUser && !claimsSynced)) {
 return <LoadingScreen />;
 }

 const handleNavigateToAuth = (mode: 'login' | 'register') => {
 sessionStorage.setItem(RETURN_KEY, 'true');
 navigate(`/${mode}`, { state: { from: { pathname: '/agent-setup' } } });
 };

 const handleNavigateToOnboarding = () => {
 navigate('/onboarding');
 };

 const handleGoToDashboard = () => {
 navigate('/');
 };

 // STATE C: Authenticated with organization → Token display
 if (isAuthenticated && hasOrganization) {
 return (
 <AuroraBackground className="min-h-screen py-4 px-4 flex flex-col bg-background text-foreground relative font-sans selection:bg-primary/30 selection:text-primary overflow-hidden">
 <div className="absolute top-4 right-4 z-modal">
  <ThemeToggle />
 </div>

 <SEO
  title={t('agentSetup.seoTitle', { defaultValue: "Installation de l'Agent" })}
  description={t('agentSetup.seoDescription', { defaultValue: "Obtenez votre token d'enrolement pour installer l'agent Sentinel GRC." })}
 />

 <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />
 <LandingMap className="fixed inset-0" />

 <div className="absolute inset-0 w-full h-full pointer-events-none">
  <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-primary/10/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float"></div>
 </div>

 <div className="w-full max-w-2xl relative z-decorator flex-1 flex flex-col items-center justify-center mx-auto px-4 sm:px-6">
  <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, type: 'spring', stiffness: 100, damping: 20 }}
  className="glass-premium glass-noise rounded-[3rem] p-10 w-full shadow-2xl relative overflow-hidden"
  >
  <div className="absolute inset-0 rounded-[3rem] p-[1px] bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none"></div>

  {/* Header */}
  <div className="flex flex-col items-center mb-8">
  <motion.div
  whileHover={{ scale: 1.1, rotate: 5 }}
  className="w-16 h-16 rounded-3xl bg-success text-success-foreground flex items-center justify-center shadow-2xl mb-4 ring-1 ring-white/10 relative overflow-hidden"
  >
  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
  <ShieldCheck className="h-8 w-8 relative z-decorator" strokeWidth={2.5} />
  </motion.div>
  <h2 className="text-2xl font-display font-bold text-foreground tracking-tight text-center">
  {t('agentSetup.tokenReady.heading', { defaultValue: "Votre token d'enrolement" })}
  </h2>
  <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
  {t('agentSetup.tokenReady.description', { defaultValue: 'Utilisez ce token pour enroler votre agent Sentinel.' })}
  </p>
  </div>

  {/* Token Panel */}
  <EnrollmentTokenPanel
  enrollmentToken={tokenValue}
  loading={tokenLoading}
  error={tokenError}
  />

  {/* Dashboard Link */}
  <div className="mt-8 text-center">
  <Button
  variant="ghost"
  onClick={handleGoToDashboard}
  className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
  >
  {t('agentSetup.goToDashboard', { defaultValue: 'Aller au tableau de bord' })}
  <ArrowRight className="ml-2 h-4 w-4" />
  </Button>
  </div>
  </motion.div>
 </div>
 </AuroraBackground>
 );
 }

 // STATE B: Authenticated but no organization → Needs onboarding
 if (isAuthenticated && !hasOrganization) {
 return (
 <AuroraBackground className="min-h-screen py-4 px-4 flex flex-col bg-background text-foreground relative font-sans selection:bg-primary/30 selection:text-primary overflow-hidden">
 <div className="absolute top-4 right-4 z-modal">
  <ThemeToggle />
 </div>

 <SEO
  title={t('agentSetup.seoTitle', { defaultValue: "Installation de l'Agent" })}
  description={t('agentSetup.seoDescription', { defaultValue: "Obtenez votre token d'enrolement pour installer l'agent Sentinel GRC." })}
 />

 <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />
 <LandingMap className="fixed inset-0" />

 <div className="absolute inset-0 w-full h-full pointer-events-none">
  <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-primary/10/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float"></div>
 </div>

 <div className="w-full max-w-lg relative z-decorator flex-1 flex flex-col items-center justify-center mx-auto px-4 sm:px-6">
  <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, type: 'spring', stiffness: 100, damping: 20 }}
  className="glass-premium glass-noise rounded-[3rem] p-10 w-full shadow-2xl relative overflow-hidden text-center"
  >
  <div className="absolute inset-0 rounded-[3rem] p-[1px] bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none"></div>

  <motion.div
  whileHover={{ scale: 1.1, rotate: 5 }}
  className="w-16 h-16 rounded-3xl bg-amber-500 text-white flex items-center justify-center shadow-2xl mb-6 mx-auto ring-1 ring-white/10 relative overflow-hidden"
  >
  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
  <Briefcase className="h-8 w-8 relative z-decorator" strokeWidth={2.5} />
  </motion.div>

  <h2 className="text-2xl font-display font-bold text-foreground tracking-tight mb-3">
  {t('agentSetup.needsOnboarding.heading', { defaultValue: 'Configurez votre organisation' })}
  </h2>
  <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-sm mx-auto">
  {t('agentSetup.needsOnboarding.description', { defaultValue: "Votre compte est actif mais vous devez terminer la configuration de votre organisation pour generer un token d'enrolement." })}
  </p>

  <Button
  onClick={handleNavigateToOnboarding}
  className="w-full py-6 font-bold rounded-2xl shadow-primary/20 shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all relative overflow-hidden group/btn"
  >
  <span className="relative z-decorator flex items-center justify-center">
  {t('agentSetup.needsOnboarding.goToOnboarding', { defaultValue: 'Configurer mon organisation' })}
  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover/btn:translate-x-1" strokeWidth={2.5} />
  </span>
  </Button>
  </motion.div>
 </div>
 </AuroraBackground>
 );
 }

 // STATE A: Not authenticated → Two cards
 return (
 <AuroraBackground className="min-h-screen py-4 px-4 flex flex-col bg-background text-foreground relative font-sans selection:bg-primary/30 selection:text-primary overflow-hidden">
 <div className="absolute top-4 right-4 z-modal">
 <ThemeToggle />
 </div>

 <SEO
 title={t('agentSetup.seoTitle', { defaultValue: "Installation de l'Agent" })}
 description={t('agentSetup.seoDescription', { defaultValue: "Obtenez votre token d'enrolement pour installer l'agent Sentinel GRC." })}
 />

 <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />
 <LandingMap className="fixed inset-0" />

 <div className="absolute inset-0 w-full h-full pointer-events-none">
 <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-primary/10/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float"></div>
 <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-primary/10/10 rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-float" style={{ animationDelay: '3s' }}></div>
 </div>

 <div className="w-full max-w-3xl relative z-decorator flex-1 flex flex-col items-center justify-center mx-auto px-4 sm:px-6">
 <motion.div
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8, type: 'spring', stiffness: 100, damping: 20 }}
  className="w-full"
 >
  {/* Header */}
  <div className="text-center mb-10">
  <motion.div
  whileHover={{ scale: 1.1, rotate: 5 }}
  className="w-20 h-20 rounded-3xl bg-foreground text-background flex items-center justify-center shadow-2xl mb-6 mx-auto ring-1 ring-white/10 relative overflow-hidden"
  >
  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
  <Lock className="h-10 w-10 relative z-decorator" strokeWidth={2.5} />
  </motion.div>
  <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tighter text-foreground mb-3">
  {t('agentSetup.title', { defaultValue: "Installer l'Agent Sentinel" })}
  </h1>
  <p className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
  {t('agentSetup.subtitle', { defaultValue: "Pour obtenir votre token d'enrolement, connectez-vous ou creez un compte Sentinel GRC." })}
  </p>
  </div>

  {/* Two Cards */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
  {/* Create Account Card */}
  <motion.button
  whileHover={{ scale: 1.02, y: -4 }}
  whileTap={{ scale: 0.98 }}
  onClick={() => handleNavigateToAuth('register')}
  className="glass-premium glass-noise rounded-[2rem] p-8 text-left shadow-xl relative overflow-hidden group cursor-pointer border border-transparent hover:border-primary/20 transition-all"
  >
  <div className="absolute inset-0 rounded-[2rem] p-[1px] bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none"></div>

  <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg mb-5 ring-1 ring-white/10 relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
  <UserPlus className="h-7 w-7 relative z-decorator" strokeWidth={2} />
  </div>

  <h3 className="text-lg font-bold text-foreground mb-2">
  {t('agentSetup.unauthenticated.createAccount', { defaultValue: 'Creer un compte' })}
  </h3>
  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
  {t('agentSetup.unauthenticated.createAccountDesc', { defaultValue: 'Nouveau sur Sentinel ? Creez un compte gratuit pour commencer.' })}
  </p>

  <div className="flex items-center text-sm font-bold text-primary group-hover:text-primary/80 transition-colors">
  {t('auth.signup', { defaultValue: "S'inscrire" })}
  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
  </div>
  </motion.button>

  {/* Sign In Card */}
  <motion.button
  whileHover={{ scale: 1.02, y: -4 }}
  whileTap={{ scale: 0.98 }}
  onClick={() => handleNavigateToAuth('login')}
  className="glass-premium glass-noise rounded-[2rem] p-8 text-left shadow-xl relative overflow-hidden group cursor-pointer border border-transparent hover:border-primary/20 transition-all"
  >
  <div className="absolute inset-0 rounded-[2rem] p-[1px] bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none"></div>

  <div className="w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-lg mb-5 ring-1 ring-white/10 relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
  <LogIn className="h-7 w-7 relative z-decorator" strokeWidth={2} />
  </div>

  <h3 className="text-lg font-bold text-foreground mb-2">
  {t('agentSetup.unauthenticated.signIn', { defaultValue: 'Se connecter' })}
  </h3>
  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
  {t('agentSetup.unauthenticated.signInDesc', { defaultValue: 'Vous avez deja un compte ? Connectez-vous pour obtenir votre token.' })}
  </p>

  <div className="flex items-center text-sm font-bold text-foreground/70 group-hover:text-foreground transition-colors">
  {t('auth.login', { defaultValue: 'Se connecter' })}
  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
  </div>
  </motion.button>
  </div>
 </motion.div>
 </div>

 {/* Footer */}
 <div className="py-6 text-center relative z-decorator px-4 sm:px-6">
 <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
  {t('auth.footer.developedBy', { defaultValue: 'Developpe par' })}{' '}
  <a
  href="https://cyber-threat-consulting.com"
  target="_blank"
  rel="noopener noreferrer"
  className="text-primary hover:text-primary/80 underline transition-colors"
  >
  cyber-threat-consulting.com
  </a>
 </p>
 </div>
 </AuroraBackground>
 );
};

export default AgentSetup;
