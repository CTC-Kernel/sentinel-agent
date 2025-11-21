
import React, { useEffect, useState, useRef, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useStore } from './store';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/ui/Toast';
import { Login } from './views/Login';
import { Menu, Moon, Sun, Bell, LogOut } from './components/ui/Icons';
import { UserProfile } from './types';

// Lazy Loading des Vues pour optimiser le bundle initial
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

const LoadingSpinner = () => (
  <div className="flex h-full w-full items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin"></div>
  </div>
);

const AppContent: React.FC = () => {
  const { theme, toggleTheme, setUser, user } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  
  // Notification State
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
            // Optimisation: Check if we already have the user in state to avoid redundant fetches
            // Note: We fetch mainly for the Role
            let userProfile: UserProfile = { 
                uid: u.uid, 
                email: u.email || '', 
                role: 'user', 
                displayName: u.email?.split('@')[0] || 'User' 
            };

            const userDocRef = doc(db, 'users', u.uid);
            // Use cache first if available (managed by Firestore SDK persistence)
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                userProfile = userDocSnap.data() as UserProfile;
            } else {
                // Fallback lookup
                const q = query(collection(db, 'users'), where('email', '==', u.email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    userProfile = querySnapshot.docs[0].data() as UserProfile;
                }
            }
            setUser(userProfile);
        } catch (error) {
            console.error("Error fetching user profile:", error);
            setUser({ uid: u.uid, email: u.email || '', role: 'user', displayName: 'User' });
        }
      } else {
        setUser(null);
      }
      setInitializing(false);
    });

    // Real-time Logs: Only subscribe if logged in to save bandwidth
    let unsubLogs = () => {};
    if (user) {
        const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(5));
        unsubLogs = onSnapshot(q, (snap) => {
            setRecentLogs(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
    }

    const handleClickOutside = (event: MouseEvent) => {
        if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
            setShowNotifications(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
        unsubscribe();
        unsubLogs();
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user?.uid]); // Re-run logs subscription only when user changes

  const handleLogout = () => {
      signOut(auth);
      setUser(null);
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
           <div className="relative">
                <div className="w-12 h-12 border-4 border-brand-200/30 border-t-brand-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-brand-600 rounded-full"></div>
                </div>
           </div>
           <p className="text-xs font-medium text-slate-400 animate-pulse">Chargement sécurisé...</p>
        </div>
      </div>
    );
  }

  if (!user) {
      return <Login />;
  }

  return (
    <Router>
      <div className="flex h-screen overflow-hidden bg-gray-50/50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans relative">
        
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-400/20 dark:bg-brand-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-400/20 dark:bg-purple-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-400/20 dark:bg-pink-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="z-40">
            <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        </div>
        
        <ToastContainer />

        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          <header className="h-16 flex items-center justify-between px-6 border-b border-white/20 dark:border-gray-800 z-20 glass sticky top-0">
            <div className="flex items-center lg:hidden">
              <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors">
                <Menu className="h-6 w-6" />
              </button>
            </div>
            
            <div className="hidden md:block text-sm font-medium text-gray-500 dark:text-gray-400">
                Espace de travail sécurisé • {user.department ? `${user.department}` : 'Général'}
            </div>

            <div className="flex ml-auto items-center space-x-3">
              <div className="relative" ref={notifRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-500 dark:hover:text-gray-300 relative transition-all"
                  >
                    <Bell className="h-5 w-5" />
                    {recentLogs.length > 0 && <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800"></span>}
                  </button>
                  
                  {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-850 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in z-50">
                          <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
                              <h3 className="text-xs font-bold uppercase text-gray-500">Activités récentes</h3>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                              {recentLogs.map((log, i) => (
                                  <div key={i} className="p-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                      <div className="flex items-start gap-3">
                                          <div className="mt-1 w-2 h-2 rounded-full bg-brand-500 flex-shrink-0"></div>
                                          <div>
                                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{log.action} <span className="font-normal text-gray-500">sur {log.resource}</span></p>
                                              <p className="text-[10px] text-gray-400 mt-0.5">{log.details}</p>
                                              <p className="text-[9px] text-gray-300 mt-1">{new Date(log.timestamp).toLocaleTimeString()}</p>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>

              <button onClick={toggleTheme} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-brand-500 transition-all">
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>

              <div className="flex items-center pl-2 border-l border-gray-200 dark:border-gray-700 ml-2 gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md cursor-default" title={user?.role}>
                     {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Se déconnecter">
                      <LogOut className="h-5 w-5" />
                  </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth no-scrollbar">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<LoadingSpinner />}>
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
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </div>
             <div className="py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-600 font-medium">Sentinel GRC v1.7.0 • {user?.role.toUpperCase()}</p>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default AppContent;
