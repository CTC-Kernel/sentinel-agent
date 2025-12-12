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
import { Login } from './views/Login';
import { Onboarding } from './views/Onboarding';
import { VerifyEmail } from './views/VerifyEmail';
import { WifiOff } from './components/ui/Icons';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/layout/CommandPalette';
import { TopBar } from './components/layout/TopBar';
import { NotificationService } from './services/notificationService';
import { BackupService } from './services/backupService';
import { ErrorLogger } from './services/errorLogger';
import { NotificationPermissionBanner } from './components/ui/NotificationPermissionBanner';
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
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { CustomRole } from './types';
import { VersionCheck } from './components/VersionCheck';
import { ContentBlockerError } from './components/ui/ContentBlockerError';
import { useAuth } from './hooks/useAuth';

// Wrapper to activate global shortcuts inside Router context
const GlobalShortcutsWrapper: React.FC = () => {
    const navigate = useNavigate();
    const { showHelp, setShowHelp } = useGlobalShortcuts() || { showHelp: false, setShowHelp: () => { } };

    useHotkeys('ctrl+k', () => {
        navigate('/search');
    });

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
                await NotificationService.runAutomatedChecks(user.organizationId!);
                if (hasPermission(user, 'Settings', 'manage')) {
                    await BackupService.checkScheduledBackups(user);
                }
            } catch (e) {
                ErrorLogger.error(e, 'Automation checks failed');
            }
        };

        runChecks();
        const interval = setInterval(runChecks, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, user?.organizationId]);

    return (
        <div className="flex h-screen overflow-hidden bg-[#fafafa] dark:bg-slate-950 text-[#1d1d1f] dark:text-[#f5f5f7] font-sans relative selection:bg-brand-500 selection:text-white transition-colors duration-300 pb-safe">
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-blue-200/30 dark:bg-blue-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float"></div>
                <div className="absolute top-[20%] right-[-10%] w-[50rem] h-[50rem] bg-purple-200/30 dark:bg-purple-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float" style={{ animationDelay: '2s' }}></div>
                <div className="absolute bottom-[-20%] left-[20%] w-[55rem] h-[55rem] bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float" style={{ animationDelay: '4s' }}></div>
            </div>

            <div className="relative z-30 flex-shrink-0">
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
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] glass-panel px-4 py-2 rounded-full flex items-center text-xs font-medium text-slate-600 shadow-lg animate-slide-up border border-slate-200">
                    <WifiOff className="h-3 w-3 mr-2 text-red-500" />
                    Mode hors ligne
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden relative">
                <TopBar setMobileOpen={setMobileOpen} />

                <SmoothScroll
                    id="main-content"
                    enabled={location.pathname !== '/ctc-engine'}
                    className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden scroll-smooth no-scrollbar bg-[#fafafa] dark:bg-slate-950 ${location.pathname === '/ctc-engine' ? 'p-0 overflow-hidden' : 'p-4 md:p-8'}`}
                >
                    <div className={`${location.pathname === '/ctc-engine' ? 'w-full flex-1 animate-fade-in flex flex-col' : 'max-w-[1600px] mx-auto animate-fade-in min-h-full pb-10'}`}>
                        <Suspense fallback={<LoadingScreen />}>
                            <AnimatedRoutes />
                        </Suspense>
                    </div>
                </SmoothScroll>
            </div>

            <NotificationPermissionBanner />
            <CookieConsent />
            <OnboardingTrigger />
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

const AppInner: React.FC = () => {
    const { isBlocked } = useAuth();

    if (isBlocked) {
        return <ContentBlockerError />;
    }

    return (
        <>
            <RouteProgressBar />
            <SkipLink />
            <VersionCheck />
            <GlobalShortcutsWrapper />
            <ErrorBoundary>
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
                    <Route path="/*" element={
                        <AuthGuard>
                            <AppLayout />
                        </AuthGuard>
                    } />
                </Routes>
            </ErrorBoundary>
        </>
    );
};

export default AppContent;
