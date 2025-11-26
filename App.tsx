
import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, doc, where, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useStore } from './store';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/ui/Toast';
import { Login } from './views/Login';
import { Onboarding } from './views/Onboarding';
import { WifiOff, Lock, AlertTriangle } from './components/ui/Icons';
import { UserProfile, Invitation } from './types';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { CommandPalette } from './components/layout/CommandPalette';
import { TopBar } from './components/layout/TopBar';
import { autoRefreshTokenIfNeeded } from './utils/tokenRefresh';
import { NotificationService } from './services/notificationService';
import { BackupService } from './services/backupService';
import { NotificationPermissionBanner } from './components/ui/NotificationPermissionBanner';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { OnboardingTrigger } from './components/onboarding/OnboardingTrigger';
import { GeminiAssistant } from './components/ai/GeminiAssistant';
import { hasPermission } from './utils/permissions';
import { SkipLink } from './components/ui/SkipLink';
import { useHotkeys } from './hooks/useHotkeys';

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
const Pricing = React.lazy(() => import('./views/Pricing'));

const LoadingScreen = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] dark:bg-slate-900 transition-colors relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-brand-200/40 dark:bg-blue-900/20 rounded-full mix-blend-multiply filter blur-[100px] animate-float"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl glass-panel flex items-center justify-center shadow-2xl animate-pulse mb-8 border border-white/40 dark:border-white/10">
                <Lock className="h-10 w-10 text-slate-900 dark:text-white" strokeWidth={2.5} />
            </div>
            <div className="flex space-x-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
        </div>
    </div>
);

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
    useGlobalShortcuts();

    // Raccourcis clavier globaux
    useHotkeys('ctrl+k', () => {
        navigate('/search');
    });

    useHotkeys('ctrl+/', () => {
        navigate('/help');
    });
    return null;
};

const AppContent: React.FC = () => {
    const { theme, setUser, setTheme, user } = useStore();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        // Apply theme to body immediately
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                // Auto-refresh token to get custom claims (organizationId)
                try {
                    await autoRefreshTokenIfNeeded();
                } catch (e) {
                    console.warn('Token refresh failed:', e);
                }

                // Update Last Login
                try {
                    const userRef = doc(db, 'users', u.uid);
                    updateDoc(userRef, { lastLogin: new Date().toISOString() }).catch(() => { });
                } catch { /* Ignore */ }

                const userDocRef = doc(db, 'users', u.uid);
                const unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        let userData = docSnap.data() as UserProfile;

                        // SELF-HEALING: If user has no organizationId, check if they own one
                        if (!userData.organizationId) {
                            try {
                                // Try client-side first (fastest)
                                const orgsQuery = query(collection(db, 'organizations'), where('ownerId', '==', u.uid));
                                const orgsSnap = await getDocs(orgsQuery);
                                if (!orgsSnap.empty) {
                                    const org = orgsSnap.docs[0].data();
                                    await updateDoc(userDocRef, {
                                        organizationId: org.id,
                                        organizationName: org.name,
                                        onboardingCompleted: true
                                    });
                                    userData = { ...userData, organizationId: org.id, organizationName: org.name, onboardingCompleted: true };
                                } else {
                                    // Fallback: Try Cloud Function (bypasses rules)
                                    // This is needed if client-side rules block the query
                                    const { httpsCallable, getFunctions } = await import('firebase/functions');
                                    const functions = getFunctions();
                                    const healMe = httpsCallable(functions, 'healMe');
                                    const result = await healMe();
                                    const data = result.data as any;
                                    if (data.success && data.restored) {
                                        // Reload user data
                                        const freshSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', u.uid))); // Force refresh
                                        if (!freshSnap.empty) userData = freshSnap.docs[0].data() as UserProfile;
                                    }
                                }
                            } catch (e) {
                                console.error("Self-healing failed, trying Cloud Function fallback...", e);
                                try {
                                    const { httpsCallable, getFunctions } = await import('firebase/functions');
                                    const functions = getFunctions();
                                    const healMe = httpsCallable(functions, 'healMe');
                                    const result = await healMe();
                                    const data = result.data as any;
                                    if (data.success) {
                                        // Reload user data manually since snapshot might not trigger immediately
                                        userData = { ...userData, organizationId: data.organizationId, onboardingCompleted: true };
                                    }
                                } catch (err) {
                                    console.error("Cloud Function healing also failed", err);
                                }
                            }
                        }

                        // SELF-HEALING: If user has organizationId but onboardingCompleted is missing/false
                        if (userData.organizationId && !userData.onboardingCompleted) {
                            await updateDoc(userDocRef, { onboardingCompleted: true });
                            userData = { ...userData, onboardingCompleted: true };
                        }

                        setUser(userData);
                        if (userData.theme && userData.theme !== theme) {
                            setTheme(userData.theme);
                        }
                    } else {
                        const q = query(collection(db, 'users'), where('email', '==', u.email));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            setUser(querySnapshot.docs[0].data() as UserProfile);
                        } else {
                            // CHECK FOR INVITATIONS
                            const inviteQuery = query(collection(db, 'invitations'), where('email', '==', u.email));
                            const inviteSnap = await getDocs(inviteQuery);

                            if (!inviteSnap.empty) {
                                // Invitation found -> Create User Profile linked to Organization
                                const invite = inviteSnap.docs[0].data() as Invitation;
                                const newProfile: UserProfile = {
                                    uid: u.uid,
                                    email: u.email || '',
                                    role: invite.role || 'user',
                                    displayName: u.displayName || u.email?.split('@')[0] || 'User',
                                    department: invite.department || '',
                                    organizationId: invite.organizationId,
                                    organizationName: invite.organizationName,
                                    onboardingCompleted: false, // User might need to confirm details
                                    ...(u.photoURL && { photoURL: u.photoURL })
                                };

                                try {
                                    await setDoc(userDocRef, newProfile);
                                    // Delete used invitation
                                    await deleteDoc(inviteSnap.docs[0].ref);
                                    setUser(newProfile);
                                } catch (e) {
                                    console.error("Error creating profile from invitation", e);
                                    setUser(newProfile);
                                }
                            } else {
                                // No Invitation -> Redirect to Onboarding (DO NOT CREATE DOC)
                                // We set a temporary local user object so the app knows we are authenticated
                                // but 'onboardingCompleted: false' + no orgId will trigger the Onboarding view.
                                const tempUser: UserProfile = {
                                    uid: u.uid,
                                    email: u.email || '',
                                    role: 'user',
                                    displayName: u.displayName || u.email?.split('@')[0] || 'User',
                                    onboardingCompleted: false,
                                    ...(u.photoURL && { photoURL: u.photoURL })
                                };
                                setUser(tempUser);
                            }
                        }
                    }
                    setInitializing(false);
                }, () => {
                    // Fallback in case of error or missing user doc
                    setUser({ uid: u.uid, email: u.email || '', role: 'user', displayName: u.displayName || 'User', onboardingCompleted: false });
                    setInitializing(false);
                });
                return () => unsubProfile();
            } else {
                setUser(null);
                setInitializing(false);
            }
        });

        return () => {
            unsubscribe();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [user?.uid, setUser, theme]);

    // Notification automation: persist alerts in Firestore for real-time center
    useEffect(() => {
        if (!user?.organizationId) return;

        const runChecks = async () => {
            try {
                await NotificationService.runAutomatedChecks(user.organizationId!);
                if (hasPermission(user, 'Settings', 'manage')) {
                    await BackupService.checkScheduledBackups(user);
                }
            } catch (e) {
                console.error('Automation checks failed', e);
            }
        };

        runChecks();
        const interval = setInterval(runChecks, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, user?.organizationId]);

    if (initializing) return <LoadingScreen />;
    if (!user) return <Login />;
    if (!user.onboardingCompleted || !user.organizationId) {
        return (
            <Router>
                <Onboarding />
            </Router>
        );
    }

    return (
        <Router>
            <SkipLink />
            <GlobalShortcutsWrapper />
            <ErrorBoundary>
                <div className="flex h-screen overflow-hidden bg-[#fafafa] dark:bg-slate-900 text-[#1d1d1f] dark:text-[#f5f5f7] font-sans relative selection:bg-brand-500 selection:text-white transition-colors duration-300">

                    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                        <div className="absolute top-[-20%] left-[-10%] w-[60rem] h-[60rem] bg-blue-200/30 dark:bg-blue-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float"></div>
                        <div className="absolute top-[20%] right-[-10%] w-[50rem] h-[50rem] bg-purple-200/30 dark:bg-purple-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float" style={{ animationDelay: '2s' }}></div>
                        <div className="absolute bottom-[-20%] left-[20%] w-[55rem] h-[55rem] bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-float" style={{ animationDelay: '4s' }}></div>
                    </div>

                    <div>
                        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
                    </div>

                    <ToastContainer />
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

                        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth no-scrollbar bg-[#fafafa] dark:bg-slate-900">
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
                                        <Route path="/voxel" element={<VoxelView />} />
                                        <Route path="/notifications" element={<Notifications />} />
                                        <Route path="/search" element={<Search />} />
                                        <Route path="/help" element={<Help />} />
                                        <Route path="/intake" element={<KioskPage />} />
                                        <Route path="/pricing" element={<Pricing />} />
                                        <Route path="*" element={<NotFound />} />
                                    </Routes>
                                </Suspense>
                            </div>
                        </main>
                    </div>
                </div>

                {/* Notification Permission Banner */}
                <NotificationPermissionBanner />

                {/* Onboarding Tour */}
                <OnboardingTrigger />
            </ErrorBoundary>
        </Router>
    );
};

export default AppContent;
