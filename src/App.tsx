import React, { useEffect, useState, Suspense } from 'react';
// Conflict resolution verified
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'; // HashRouter aliased as Router


// Contexts & Hooks
import { AuthProvider } from './contexts/AuthContext';
import { CrisisProvider } from './context/CrisisContext';
import { useStore } from './store';
import { useAuth } from './hooks/useAuth';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useHotkeys } from './hooks/useHotkeys';

// Services & Utils
import { ErrorLogger } from './services/errorLogger';
import { hasPermission } from './utils/permissions';
import { db } from './firebase';
import { CustomRole } from './types';

// Layout & Navigation
import { AnimatedRoutes } from './components/layout/AnimatedRoutes';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { CommandPalette } from './components/layout/CommandPalette';

// UI Components
import { SEO } from './components/SEO';
import { AuthGuard } from './components/auth/AuthGuard';
import { TestAuthGuard } from './components/auth/TestGuards';
import { PublicOnlyRoute } from './components/auth/PublicOnlyRoute';
import { CertifierAuthGuard } from './components/auth/CertifierAuthGuard';
import { SuperAdminGuard } from './components/auth/SuperAdminGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WifiOff } from './components/ui/Icons';
import { NotificationPermissionBanner } from './components/ui/NotificationPermissionBanner';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { SkipLink } from './components/ui/SkipLink';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { SmoothScroll } from './components/ui/SmoothScroll';
import { CookieConsent } from './components/ui/CookieConsent';
import { ShortcutsHelp } from './components/ui/ShortcutsHelp';
import { ContentBlockerError } from './components/ui/ContentBlockerError';
import { OnboardingOverlay } from './components/ui/onboarding/OnboardingOverlay';
import { MasterpieceBackground } from './components/ui/MasterpieceBackground';
import { RouteProgressBar } from './components/ui/RouteProgressBar';
import { NavigationLoader } from './components/ui/NavigationLoader';

// Features
import { NotificationProvider } from './components/ui/NotificationSystem';
import { OnboardingTrigger } from './components/onboarding/OnboardingTrigger';
import { GeminiAssistant } from './components/ai/GeminiAssistant';
import { VersionCheck } from './components/VersionCheck';

const Login = React.lazy(() => import('./views/Login').then(module => ({ default: module.Login })));
const Onboarding = React.lazy(() => import('./views/Onboarding').then(module => ({ default: module.Onboarding })));
const VerifyEmail = React.lazy(() => import('./views/VerifyEmail').then(module => ({ default: module.VerifyEmail })));
const ExternalAuditPortal = React.lazy(() => import('./views/portal/ExternalAuditPortal').then(module => ({ default: module.ExternalAuditPortal })));
const ExternalAuditLayout = React.lazy(() => import('./views/layouts/ExternalAuditLayout').then(module => ({ default: module.ExternalAuditLayout })));
const CertifierLogin = React.lazy(() => import('@/views/portal/certifier/CertifierLogin').then(module => ({ default: module.CertifierLogin })));
const CertifierRegister = React.lazy(() => import('@/views/portal/certifier/CertifierRegister').then(module => ({ default: module.CertifierRegister })));
const CertifierDashboard = React.lazy(() => import('@/views/portal/certifier/CertifierDashboard').then(module => ({ default: module.CertifierDashboard })));
const AdminDashboard = React.lazy(() => import('./views/admin/AdminDashboard'));

// Route wrapper that decides whether to show Landing Page or App logic

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

    // Effect for Theme
    useEffect(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [theme]);

    // Effect for Online Status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

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
    }, [user, user?.organizationId]);

    return (
        <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground font-sans relative selection:bg-brand-500 selection:text-white transition-colors duration-300 pb-safe">
            <MasterpieceBackground />

            <div>
                <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
            </div>


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
                    <div className={`${location.pathname === '/ctc-engine' ? 'w-full flex-1 animate-fade-in flex flex-col' : 'w-full animate-fade-in min-h-full pb-24'}`}>
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
        <Router future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
        }}>
            <AuthProvider>
                <AppInner />
            </AuthProvider>
        </Router>
    );
};

const AppInner: React.FC = () => {
    const { isBlocked } = useAuth();

    if (isBlocked) {
        return <ContentBlockerError />;
    }

    const isTest = import.meta.env.MODE === 'test' ||
        import.meta.env.VITE_USE_EMULATORS === 'true' ||
        (typeof window !== 'undefined' && (
            (window as unknown as { __TEST_MODE__: boolean }).__TEST_MODE__ ||
            (() => { try { return localStorage.getItem('demoMode') === 'true' } catch { return false } })()
        ));

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

                        {/* Public Portal Routes - No AuthGuard, Token protected */}
                        <Route path="/portal" element={<ExternalAuditLayout />}>
                            <Route path="audit/:token" element={<ExternalAuditPortal />} />

                            {/* Certifier Ecosystem Routes */}
                            <Route path="login" element={<CertifierLogin />} />
                            <Route path="register" element={<CertifierRegister />} />
                            <Route path="dashboard" element={
                                <CertifierAuthGuard>
                                    <CertifierDashboard />
                                </CertifierAuthGuard>
                            } />
                        </Route>

                        {/* Super Admin Route */}
                        <Route path="/admin_management" element={
                            <SuperAdminGuard>
                                <NotificationProvider>
                                    <AppLayout />
                                </NotificationProvider>
                            </SuperAdminGuard>
                        } >
                            <Route index element={<AdminDashboard />} />
                        </Route>

                        {/* Main App Route - Handles all paths and sub-routes */}
                        <Route path="/*" element={
                            isTest ?
                                <TestAuthGuard>
                                    <NotificationProvider>
                                        <AppLayout />
                                    </NotificationProvider>
                                </TestAuthGuard> :
                                <AuthGuard>
                                    <NotificationProvider>
                                        <CrisisProvider>
                                            <AppLayout />
                                        </CrisisProvider>
                                    </NotificationProvider>
                                </AuthGuard>
                        } />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        </>
    );
};

export default AppContent;

// Headless UI handles FocusTrap and keyboard navigation
