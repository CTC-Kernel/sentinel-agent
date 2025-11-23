
import React, { useEffect, useState, useRef, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, doc, where, getDocs, setDoc, updateDoc, limit, orderBy } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useStore } from './store';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/ui/Toast';
import { Login } from './views/Login';
import { Onboarding } from './views/Onboarding';
import { LayoutDashboard, ShieldAlert, Server, FileText, Users, Settings as SettingsIcon, Bell, LogOut, Menu, Search as SearchIcon, Moon, Sun, WifiOff, Lock, AlertTriangle, CheckCircle2, X, User } from './components/ui/Icons';
import { UserProfile, AlertNotification, Risk, Supplier, Incident, Audit, Document } from './types';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { CommandPalette } from './components/layout/CommandPalette';
import { NotificationCenter } from './components/ui/NotificationCenter';
import { autoRefreshTokenIfNeeded } from './utils/tokenRefresh';


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

const AppContent: React.FC = () => {
    const { theme, toggleTheme, setUser, user } = useStore();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const [showNotifications, setShowNotifications] = useState(false);
    const [alerts, setAlerts] = useState<AlertNotification[]>([]);
    const notifRef = useRef<HTMLDivElement>(null);

    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Apply theme to body immediately
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

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
                } catch (e) { /* Ignore */ }

                const userDocRef = doc(db, 'users', u.uid);
                const unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data() as UserProfile;
                        setUser(userData);
                        if (userData.theme && userData.theme !== theme) {
                            if (userData.theme === 'dark') document.documentElement.classList.add('dark');
                            else document.documentElement.classList.remove('dark');
                            localStorage.setItem('theme', userData.theme);
                        }
                    } else {
                        const q = query(collection(db, 'users'), where('email', '==', u.email));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            setUser(querySnapshot.docs[0].data() as UserProfile);
                        } else {
                            const newProfile: UserProfile = {
                                uid: u.uid, email: u.email || '', role: 'user',
                                displayName: u.displayName || u.email?.split('@')[0] || 'User',
                                ...(u.photoURL && { photoURL: u.photoURL }),
                                onboardingCompleted: false
                            };
                            try { await setDoc(userDocRef, newProfile); setUser(newProfile); }
                            catch (e) { setUser(newProfile); }
                        }
                    }
                    setInitializing(false);
                }, (error) => {
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
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [user?.uid]);

    // Real-time Notification Polling (OPTIMIZED)
    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchNotifications = async () => {
            const newAlerts: AlertNotification[] = [];
            const today = new Date();
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(today.getFullYear() - 1);
            const orgId = user.organizationId;

            try {
                const [incSnap, auditSnap, docSnap, riskSnap, suppSnap] = await Promise.all([
                    getDocs(query(collection(db, 'incidents'), where('organizationId', '==', orgId), limit(20))),
                    getDocs(query(collection(db, 'audits'), where('organizationId', '==', orgId), limit(20))),
                    getDocs(query(collection(db, 'documents'), where('organizationId', '==', orgId), limit(50))),
                    getDocs(query(collection(db, 'risks'), where('organizationId', '==', orgId), limit(100))),
                    getDocs(query(collection(db, 'suppliers'), where('organizationId', '==', orgId), limit(50)))
                ]);

                incSnap.docs.forEach(doc => {
                    const i = doc.data() as Incident;
                    if (i.status !== 'Fermé' && i.severity === 'Critique') {
                        newAlerts.push({
                            id: `inc-${doc.id}`, type: 'danger', title: 'Incident Critique',
                            message: i.title, date: i.dateReported, link: '/incidents'
                        });
                    }
                });

                auditSnap.docs.forEach(doc => {
                    const a = doc.data() as Audit;
                    if ((a.status === 'Planifié' || a.status === 'En cours') && new Date(a.dateScheduled) < today) {
                        newAlerts.push({
                            id: `audit-${doc.id}`, type: 'warning', title: 'Audit en retard',
                            message: a.name, date: a.dateScheduled, link: '/audits'
                        });
                    }
                });

                docSnap.docs.forEach(doc => {
                    const d = doc.data() as Document;
                    if (d.status === 'Publié' && d.nextReviewDate && new Date(d.nextReviewDate) < today) {
                        newAlerts.push({
                            id: `doc-${doc.id}`, type: 'info', title: 'Révision requise',
                            message: d.title, date: d.nextReviewDate, link: '/documents'
                        });
                    }
                });

                riskSnap.docs.forEach(doc => {
                    const r = doc.data() as Risk;
                    if (r.status !== 'Fermé') {
                        const reviewDate = r.lastReviewDate ? new Date(r.lastReviewDate) : (r.createdAt ? new Date(r.createdAt) : null);
                        if (reviewDate && reviewDate < oneYearAgo) {
                            newAlerts.push({
                                id: `risk-review-${doc.id}`, type: 'warning', title: 'Revue de risque requise',
                                message: `Le risque "${r.threat}" n'a pas été revu depuis 1 an.`,
                                date: new Date().toISOString(),
                                link: '/risks'
                            });
                        }
                    }
                });

                suppSnap.docs.forEach(doc => {
                    const s = doc.data() as Supplier;
                    if (s.status === 'Actif' && s.assessment?.lastAssessmentDate) {
                        const assessDate = new Date(s.assessment.lastAssessmentDate);
                        if (assessDate < oneYearAgo) {
                            newAlerts.push({
                                id: `supp-assess-${doc.id}`, type: 'info', title: 'Évaluation Fournisseur',
                                message: `Réévaluer ${s.name} (Dernière: ${assessDate.toLocaleDateString()})`,
                                date: new Date().toISOString(),
                                link: '/suppliers'
                            });
                        }
                    }
                });

                setAlerts(newAlerts);
            } catch (e) { console.error("Notification fetch error", e); }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 300000);
        return () => clearInterval(interval);
    }, [user?.organizationId]);

    const handleThemeToggle = () => {
        toggleTheme();
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, { theme: theme === 'light' ? 'dark' : 'light' }).catch(() => { });
        }
    };

    const handleLogout = async () => {
        try { await signOut(auth); } catch (error) { console.error("Error logging out:", error); }
    };

    if (initializing) return <LoadingScreen />;
    if (!user) return <Login />;
    if (!user.onboardingCompleted || !user.organizationId) return <Onboarding />;

    return (
        <Router>
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

                    {!isOnline && (
                        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] glass-panel px-4 py-2 rounded-full flex items-center text-xs font-medium text-slate-600 shadow-lg animate-slide-up border border-slate-200">
                            <WifiOff className="h-3 w-3 mr-2 text-red-500" />
                            Mode hors ligne
                        </div>
                    )}

                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        <header className="h-16 flex items-center justify-between px-6 z-20 sticky top-0 bg-white/80 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 transition-colors shadow-sm">
                            <div className="flex items-center space-x-2 sm:space-x-4">
                                <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 transition-colors lg:hidden">
                                    <Menu className="h-5 w-5" />
                                </button>
                                <Link to="/search" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors relative group">
                                    <SearchIcon className="h-5 w-5" />
                                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Recherche (Cmd+K)</span>
                                </Link>
                            </div>

                            <div className="hidden md:flex items-center text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-white/5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/5 shadow-sm backdrop-blur-sm">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                                {user.organizationName || 'Espace Personnel'} • {user.department ? user.department : 'Général'}
                            </div>

                            <div className="flex ml-auto items-center gap-4">
                                {/* New Notification Center */}
                                <NotificationCenter />

                                <button onClick={handleThemeToggle} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-all">
                                    {theme === 'light' ? <Moon className="h-5 w-5" strokeWidth={2} /> : <Sun className="h-5 w-5" strokeWidth={2} />}
                                </button>

                                <div className="relative" ref={userMenuRef}>
                                    <div
                                        className="flex items-center pl-4 border-l border-slate-200 dark:border-white/10 ml-2 gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => setShowUserMenu(!showUserMenu)}
                                    >
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold text-slate-800 dark:text-white leading-none">{user.displayName}</span>
                                            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{user.role}</span>
                                        </div>
                                        {user?.photoURL ? (
                                            <img src={user.photoURL} alt="Profile" className="h-9 w-9 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-md" />
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-800 to-black dark:from-white dark:to-slate-200 flex items-center justify-center text-white dark:text-black font-bold text-sm shadow-md ring-2 ring-white dark:ring-slate-800">
                                                {user?.displayName?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    {showUserMenu && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                                            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.displayName}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                                            </div>
                                            <Link to="/settings" onClick={() => setShowUserMenu(false)} className="flex items-center px-4 py-3 text-left text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <User className="h-4 w-4 mr-3 text-slate-400" />
                                                Mon Profil
                                            </Link>
                                            <Link to="/settings" onClick={() => setShowUserMenu(false)} className="flex items-center px-4 py-3 text-left text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <SettingsIcon className="h-4 w-4 mr-3 text-slate-400" />
                                                Paramètres
                                            </Link>
                                            <div className="h-px bg-slate-100 dark:bg-white/10 my-1"></div>
                                            <button
                                                onClick={() => { handleLogout(); setShowUserMenu(false); }}
                                                className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center transition-colors"
                                            >
                                                <LogOut className="h-4 w-4 mr-3" />
                                                Déconnexion
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </header>

                        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth no-scrollbar bg-[#fafafa] dark:bg-slate-900">
                            <div className="max-w-[1600px] mx-auto animate-fade-in h-full pb-10">
                                <Suspense fallback={<LoadingScreen />}>
                                    <Routes>
                                        <Route path="/" element={<Dashboard />} />
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
                                        <Route path="/privacy" element={<Privacy />} />
                                        <Route path="/continuity" element={<Continuity />} />
                                        <Route path="/voxel" element={<VoxelView />} />
                                        <Route path="/notifications" element={<Notifications />} />
                                        <Route path="/search" element={<Search />} />
                                        <Route path="/help" element={<Help />} />
                                        <Route path="/intake" element={<KioskPage />} />
                                        <Route path="*" element={<NotFound />} />
                                    </Routes>
                                </Suspense>
                            </div>
                        </main>
                    </div>
                </div>
            </ErrorBoundary>
        </Router>
    );
};

export default AppContent;
