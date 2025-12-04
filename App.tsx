import React, { useEffect, useState, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { PublicOnlyRoute } from './components/auth/PublicOnlyRoute';
import { useStore } from './store';
import { Sidebar } from './components/layout/Sidebar';
import { Toaster } from 'sonner';
import { Login } from './views/Login';
import { Onboarding } from './views/Onboarding';
import { VerifyEmail } from './views/VerifyEmail';
import { WifiOff, AlertTriangle } from './components/ui/Icons'; // Lock supprimé car dans LoadingScreen
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
import { CookieConsent } from './components/ui/CookieConsent';
import { ShortcutsHelp } from './components/ui/ShortcutsHelp';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { CustomRole } from './types';
import { VersionCheck } from './components/VersionCheck';

// Lazy Loading des Vues
const Dashboard = React.lazy(() => import('./views/Dashboard').then(module => ({ default: module.Dashboard })));
const Assets = React.lazy(() => import('./views/Assets').then(module => ({ default: module.Assets })));
const Risks = React.lazy(() => import('./views/Risks').then(module => ({ default: module.Risks })));
const Compliance = React.lazy(() => import('./views/Compliance').then(module => ({ default: module.Compliance })));
const Audits = React.lazy(() => import('./views/Audits').then(module => ({ default: module.Audits })));
const Team = React.lazy(() => import('./views/Team').then(module => ({ default: module.Team })));
const Settings = React.lazy(() => import('./views/Settings').then(module => ({ default: module.Settings })));
const Documents = React.lazy(() => import('./views/Documents').then(module => ({ default: module.Documents })));
const Projects = React.lazy(() => import('./views/Projects').then(module => ({ default: module.Projects })));
const Incidents = React.lazy(() => import('./views/Incidents').then(module => ({ default: module.Incidents })));
const Suppliers = React.lazy(() => import('./views/Suppliers').then(module => ({ default: module.Suppliers })));
const Privacy = React.lazy(() => import('./views/Privacy').then(module => ({ default: module.Privacy })));
const Help = React.lazy(() => import('./views/Help').then(module => ({ default: module.Help })));
const Continuity = React.lazy(() => import('./views/Continuity').then(module => ({ default: module.Continuity })));
const VoxelView = React.lazy(() => import('./views/VoxelView').then(module => ({ default: module.VoxelView })));
const Notifications = React.lazy(() => import('./views/Notifications').then(module => ({ default: module.Notifications })));
const Search = React.lazy(() => import('./views/Search').then(module => ({ default: module.Search })));
const KioskPage = React.lazy(() => import('./components/AssetIntake/KioskPage').then(module => ({ default: module.KioskPage })));
const BackupRestore = React.lazy(() => import('./views/BackupRestore').then(module => ({ default: module.BackupRestore })));
const AnalyticsDashboard = React.lazy(() => import('./components/dashboard/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const InteractiveTimeline = React.lazy(() => import('./components/timeline/InteractiveTimeline').then(module => ({ default: module.InteractiveTimeline })));
const AuditTrailViewer = React.lazy(() => import('./components/audit/AuditTrailViewer').then(module => ({ default: module.AuditTrailViewer })));
const CalendarView = React.lazy(() => import('./views/CalendarView').then(module => ({ default: module.CalendarView })));
const Pricing = React.lazy(() => import('./views/Pricing'));
const AdminDashboard = React.lazy(() => import('./views/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const Integrations = React.lazy(() => import('./views/Integrations').then(module => ({ default: module.Integrations })));

// ... (skipping unchanged parts)

const NotFound = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="glass-panel p-12 rounded-[2.5rem] max-w-md shadow-2xl border border-white/40 dark:border-white/5">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-6 text-slate-400">
                <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3 font-display tracking-tight">404</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg font-medium">La page que vous cherchez n'existe pas.</p>
            <a href="#/" className="px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-sm hover:scale-105 transition-transform inline-block shadow-lg">Retour à l'accueil</a>
        </div>
    </div>
);

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
        <div className="flex h-screen overflow-hidden bg-[#fafafa] dark:bg-slate-950 text-[#1d1d1f] dark:text-[#f5f5f7] font-sans relative selection:bg-brand-500 selection:text-white transition-colors duration-300">
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-blue-200/30 dark:bg-blue-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float"></div>
                <div className="absolute top-[20%] right-[-10%] w-[50rem] h-[50rem] bg-purple-200/30 dark:bg-purple-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float" style={{ animationDelay: '2s' }}></div>
                <div className="absolute bottom-[-20%] left-[20%] w-[55rem] h-[55rem] bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float" style={{ animationDelay: '4s' }}></div>
            </div>

            <div>
                <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
            </div>

            <Toaster richColors position="bottom-right" theme={theme === 'dark' ? 'dark' : 'light'} />
            <Helmet>
                <title>Sentinel GRC - Gouvernance, Risques et Conformité</title>
                <meta name="description" content="Plateforme de gouvernance, risques et conformité (GRC) pour piloter votre cybersécurité." />
                <meta name="theme-color" content={theme === 'dark' ? '#0f172a' : '#fafafa'} />
            </Helmet>
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

                <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth no-scrollbar bg-[#fafafa] dark:bg-slate-950">
                    <div className="max-w-[1600px] mx-auto animate-fade-in h-full pb-10">
                        <Suspense fallback={<LoadingScreen />}>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/analytics" element={<AnalyticsDashboard />} />
                                <Route path="/timeline" element={<InteractiveTimeline />} />
                                <Route path="/audit-trail" element={<AuditTrailViewer />} />
                                <Route path="/incidents" element={<Incidents />} />
                                <Route path="/projects" element={<Projects />} />
                                <Route path="/assets" element={<Assets />} />
                                <Route path="/risks" element={<Risks />} />
                                <Route path="/compliance" element={<Compliance />} />
                                <Route path="/documents" element={<Documents />} />
                                <Route path="/audits" element={<Audits />} />
                                <Route path="/team" element={<Team />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/suppliers" element={<Suppliers />} />
                                <Route path="/backup" element={<BackupRestore />} />
                                <Route path="/privacy" element={<Privacy />} />
                                <Route path="/continuity" element={<Continuity />} />
                                <Route path="/ctc-engine" element={<VoxelView />} />
                                <Route path="/notifications" element={<Notifications />} />
                                <Route path="/search" element={<Search />} />
                                <Route path="/help" element={<Help />} />
                                <Route path="/intake" element={<KioskPage />} />
                                <Route path="/calendar" element={<CalendarView />} />
                                <Route path="/pricing" element={<Pricing />} />
                                <Route path="/admin_management" element={<AdminDashboard />} />
                                <Route path="/integrations" element={<Integrations />} />
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </Suspense>
                    </div>
                </main>
            </div>

            <NotificationPermissionBanner />
            <CookieConsent />
            <OnboardingTrigger />
        </div>
    );
};

import { ContentBlockerError } from './components/ui/ContentBlockerError';
import { useAuth } from './hooks/useAuth';

const AppContent: React.FC = () => {
    return (
        <Router>
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

    return (
        <>
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
