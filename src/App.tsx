import React, { useEffect, useState, Suspense } from 'react';
import { SEO } from './components/SEO';
import { AnimatedRoutes } from './components/layout/AnimatedRoutes';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { PublicOnlyRoute } from './components/auth/PublicOnlyRoute';
import { useStore } from './store';
import { Sidebar } from './components/layout/Sidebar';
import { Toaster } from 'sonner';
import { WifiOff } from './components/ui/Icons';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/layout/CommandPalette';
import { TopBar } from './components/layout/TopBar';
import { ErrorLogger } from './services/errorLogger';
import { NotificationPermissionBanner } from './components/ui/NotificationPermissionBanner';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { OnboardingTrigger } from './components/onboarding/OnboardingTrigger';
import { GeminiAssistant } from './components/ai/GeminiAssistant';
import { hasPermission } from './utils/permissions';
import { SkipLink } from './components/ui/SkipLink';
import { useHotkeys } from './hooks/useHotkeys';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { SmoothScroll } from './components/ui/SmoothScroll';
import { CookieConsent } from './components/ui/CookieConsent';
import { ShortcutsHelp } from './components/ui/ShortcutsHelp';
import { db } from './firebase';
import { CustomRole } from './types';
import { VersionCheck } from './components/VersionCheck';
import { ContentBlockerError } from './components/ui/ContentBlockerError';
import { useAuth } from './hooks/useAuth';
import { OnboardingOverlay } from './components/ui/onboarding/OnboardingOverlay';
import { MasterpieceBackground } from './components/ui/MasterpieceBackground';

const Login = React.lazy(() => import('./views/Login').then(module => ({ default: module.Login })));
const Onboarding = React.lazy(() => import('./views/Onboarding').then(module => ({ default: module.Onboarding })));
const VerifyEmail = React.lazy(() => import('./views/VerifyEmail').then(module => ({ default: module.VerifyEmail })));
const LandingPage = React.lazy(() => import('./views/LandingPage').then(module => ({ default: module.LandingPage })));


// Route wrapper that decides whether to show Landing Page or App logic
const LandingOrAppRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (user) return <>{children}</>;
    return <LandingPage />; // Authenticated users see dashboard (via AppLayout), visitors see Landing
};

// Wrapper to activate global shortcuts inside Router context
const GlobalShortcutsWrapper: React.FC = () => {
    const navigate = useNavigate();
    const { showHelp, setShowHelp } = useGlobalShortcuts() || { showHelp: false, setShowHelp: () => { } };

    // usage of ctrl+k is now handled by CommandPalette component purely for toggling the modal
    // useHotkeys('ctrl+k', () => {
    //     navigate('/search');
    // });

    useHotkeys('ctrl+/', () => {
        navigate('/help');
    });

    return (
        <ShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    );
};

const AppLayout: React.FC = () => {
    const { theme, user } = useStore();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [theme]);

    // Fetch Custom Roles
    useEffect(() => {
        if (!user?.organizationId) return;
        const fetchRoles = async () => {
            try {
                const { collection, query, where, getDocs } = await import('firebase/firestore');
                const q = query(collection(db, 'custom_roles'), where('organizationId', '==', user.organizationId));
                const snapshot = await getDocs(q);
                const roles = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomRole));
                useStore.getState().setCustomRoles(roles);
            } catch (error) {
                ErrorLogger.error(error, "App.fetchRoles");
            }
        };
        fetchRoles();
    }, [user?.organizationId]);

    // Notification automation
    useEffect(() => {
        if (!user?.organizationId) return;

        const runChecks = async () => {
            try {
                const { NotificationService } = await import('./services/notificationService');
                await NotificationService.runAutomatedChecks(user.organizationId!);
                if (hasPermission(user, 'Settings', 'manage')) {
                    const { BackupService } = await import('./services/backupService');
                    await BackupService.checkScheduledBackups(user);
                }
            } catch (e) {
                ErrorLogger.error(e, 'Automation checks failed');
            }
        };

        runChecks();
        const interval = setInterval(runChecks, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    return (
        <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground font-sans relative selection:bg-brand-500 selection:text-white transition-colors duration-300 pb-safe">
            <MasterpieceBackground />

            <div>
                <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
            </div>

            <Toaster richColors position="bottom-right" theme={theme === 'dark' ? 'dark' : 'light'} />
            <SEO
                title="Tableau de bord"
                description="Plateforme de gouvernance, risques et conformité (GRC) pour piloter votre cybersécurité."
            />
            <CommandPalette />
            <GeminiAssistant />

            {!isOnline && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-tooltip glass-panel px-4 py-2 rounded-full flex items-center text-xs font-medium text-slate-600 shadow-lg animate-slide-up border border-slate-200">
                    <WifiOff className="h-3 w-3 mr-2 text-red-500" />
                    Mode hors ligne
                </div>
            )}

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative z-decorator">
                <TopBar setMobileOpen={setMobileOpen} />

                <SmoothScroll
                    id="main-content"
                    enabled={location.pathname !== '/ctc-engine'}
                    className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden scroll-smooth [scrollbar-gutter:stable] p-0`}
                >
                    <div className={`${location.pathname === '/ctc-engine' ? 'w-full flex-1 animate-fade-in flex flex-col' : 'w-full animate-fade-in min-h-full pb-10'}`}>
                        <AnimatedRoutes />
                    </div>
                </SmoothScroll>
            </div>

            <OfflineBanner />
            <NotificationPermissionBanner />
            <CookieConsent />
            <OnboardingTrigger />
            <OnboardingOverlay />
        </div>
    );
};

const AppContent: React.FC = () => {
    return (
        <Router>
            <AuthProvider>
                <AppInner />
            </AuthProvider>
        </Router>
    );
};

import { RouteProgressBar } from './components/ui/RouteProgressBar';
import { NavigationLoader } from './components/ui/NavigationLoader';

const AppInner: React.FC = () => {
    const { isBlocked } = useAuth();

    if (isBlocked) {
        return <ContentBlockerError />;
    }

    return (
        <>
            <NavigationLoader />
            <RouteProgressBar />
            <SkipLink />
            <VersionCheck />
            <GlobalShortcutsWrapper />
            <ErrorBoundary>
                <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                        <Route path="/login" element={
                            <PublicOnlyRoute>
                                <Login />
                            </PublicOnlyRoute>
                        } />
                        <Route path="/onboarding" element={
                            <AuthGuard requireOnboarding={false}>
                                <Onboarding />
                            </AuthGuard>
                        } />
                        <Route path="/verify-email" element={
                            <AuthGuard requireOnboarding={false}>
                                <VerifyEmail />
                            </AuthGuard>
                        } />

                        {/* Landing Page Route: Shows LandingPage for visitors, AppLayout (Dashboard) for users */}
                        <Route path="/" element={
                            <LandingOrAppRoute>
                                <AppLayout />
                            </LandingOrAppRoute>
                        } />

                        {/* Catch-all for sub-routes (e.g. /risks, /assets) protected by AuthGuard */}
                        <Route path="/*" element={
                            <AuthGuard>
                                <AppLayout />
                            </AuthGuard>
                        } />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        </>
    );
};

export default AppContent;
