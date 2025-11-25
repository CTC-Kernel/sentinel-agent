import React from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { LayoutDashboard, Server, ShieldAlert, FileText, Users, Settings, Lock, Activity, Briefcase, FolderKanban, Siren, Building, Fingerprint, HelpCircle, HeartPulse, LogOut, Settings as Settings3D, ChevronRight, Database } from '../ui/Icons';

const navItems = [
  { name: 'Tableau de bord', to: '/', icon: LayoutDashboard },
  { name: 'Voxel Studio', to: '/voxel', icon: Settings3D },
  { name: 'Incidents', to: '/incidents', icon: Siren },
  { name: 'Projets SSI', to: '/projects', icon: FolderKanban },
  { name: 'Actifs', to: '/assets', icon: Server },
  { name: 'Gestion des Risques', to: '/risks', icon: ShieldAlert },
  { name: 'Continuité (PCA)', to: '/continuity', icon: HeartPulse },
  { name: 'Fournisseurs', to: '/suppliers', icon: Building },
  { name: 'Documents', to: '/documents', icon: Briefcase },
  { name: 'Conformité DdA', to: '/compliance', icon: FileText },
  { name: 'Confidentialité (RGPD)', to: '/privacy', icon: Fingerprint },
  { name: 'Audits', to: '/audits', icon: Activity },
  { name: 'Sauvegarde', to: '/backup', icon: Database },
  { name: 'Équipe', to: '/team', icon: Users },
];

import { useStore } from '../../store';
import { hasPermission } from '../../utils/permissions';

export const Sidebar: React.FC<{ mobileOpen: boolean; setMobileOpen: (o: boolean) => void }> = ({ mobileOpen, setMobileOpen }) => {
  const { user } = useStore();

  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    if (item.name === 'Tableau de bord') return true;
    if (item.name === 'Équipe') return hasPermission(user, 'User', 'read');
    if (item.name === 'Paramètres') return true; // Always show settings, internal logic handles access

    // Map nav items to resources for permission checks
    switch (item.name) {
      case 'Incidents': return hasPermission(user, 'Risk', 'read'); // Using Risk as proxy or add Incident resource
      case 'Projets SSI': return hasPermission(user, 'Project', 'read');
      case 'Actifs': return hasPermission(user, 'Asset', 'read');
      case 'Gestion des Risques': return hasPermission(user, 'Risk', 'read');
      case 'Audits': return hasPermission(user, 'Audit', 'read');
      case 'Documents': return hasPermission(user, 'Document', 'read');
      // For others, default to true or specific checks if needed. 
      // Assuming 'read' permission is enough to see the menu item.
      default: return true;
    }
  });
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-20 lg:hidden backdrop-blur-sm transition-opacity duration-500"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 lg:inset-y-auto lg:sticky lg:top-0 z-30 w-[82vw] max-w-[320px] lg:w-[260px]
        bg-gradient-to-b from-white/95 via-white/92 to-white/90 dark:from-slate-900/95 dark:via-slate-900/93 dark:to-slate-900/92
        backdrop-blur-2xl border-r border-slate-200/60 dark:border-slate-800/70
        shadow-[0_20px_60px_rgba(15,23,42,0.15)] lg:shadow-none
        transform transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1)
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col pb-8 pt-4 lg:pb-6 min-h-0 lg:h-screen
      `}>
        {/* Brand Logo */}
        <div className="h-16 flex items-center px-6 mb-4 border-b border-slate-200/60 dark:border-white/5">
          <div className="flex items-center gap-3 group cursor-pointer select-none">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl shadow-slate-900/30 ring-1 ring-black/5 dark:ring-white/10">
              <Lock className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">Sentinel</h1>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-[0.4em] mt-1 uppercase">GRC</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 space-y-2 overflow-y-auto custom-scrollbar px-4">
          <div className="px-1 mb-2">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Espace de travail</p>
          </div>

          {filteredNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] sm:text-[13.5px] font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60
                ${isActive
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/15 dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}
              `}
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-all duration-200 ${isActive ? 'bg-white/10 text-white dark:bg-slate-900/10 dark:text-slate-900' : 'bg-slate-100/70 text-slate-500 dark:bg-white/5 dark:text-slate-400 group-hover:bg-white/80 group-hover:text-slate-900 dark:group-hover:bg-white/15 dark:group-hover:text-white'}`}>
                    <item.icon className="h-4.5 w-4.5" strokeWidth={2.1} />
                  </span>
                  <span className="flex-1 truncate">{item.name}</span>
                  <ChevronRight className={`h-3.5 w-3.5 transition-opacity duration-200 ${isActive ? 'opacity-80 text-white dark:text-slate-900' : 'opacity-0 text-slate-400 dark:text-slate-500 group-hover:opacity-70'}`} />
                </>
              )}
            </NavLink>
          ))}

          <div className="px-1 mb-2 mt-6">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Support</p>
          </div>
          <NavLink
            to="/help"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `
                group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] sm:text-[13.5px] font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60
                ${isActive
                ? 'bg-slate-100 text-slate-900 shadow-inner shadow-white/60 dark:bg-white/10 dark:text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
              `}
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-slate-200 text-slate-900 dark:bg-white/20 dark:text-white' : 'bg-slate-100/70 text-slate-500 dark:bg-white/5 dark:text-slate-400 group-hover:bg-white/80 group-hover:text-slate-900 dark:group-hover:bg-white/15 dark:group-hover:text-white'}`}>
                  <HelpCircle className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <span className="flex-1 truncate">Centre d'aide</span>
                <ChevronRight className={`h-3.5 w-3.5 transition-opacity duration-200 ${isActive ? 'opacity-80 text-slate-900 dark:text-white' : 'opacity-0 text-slate-400 dark:text-slate-500 group-hover:opacity-70'}`} />
              </>
            )}
          </NavLink>
        </nav>

        {/* User Settings & Logout */}
        <div className="mt-auto pt-5 px-4 border-t border-slate-200/60 dark:border-white/8 mx-2 space-y-2">
          <NavLink
            to="/settings"
            className={({ isActive }) => `
                group flex items-center gap-3 px-4 py-3 text-[14px] font-semibold rounded-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60
                ${isActive ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white shadow-inner shadow-white/50' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
              `}
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-slate-900/90 text-white dark:bg-white/20 dark:text-white' : 'bg-slate-100/80 text-slate-500 dark:bg-white/5 dark:text-slate-400 group-hover:bg-white/80 group-hover:text-slate-900 dark:group-hover:bg-white/15 dark:group-hover:text-white'}`}>
                  <Settings className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <span className="flex-1">Paramètres</span>
                <ChevronRight className={`h-3.5 w-3.5 transition-opacity duration-200 ${isActive ? 'opacity-80 text-slate-900 dark:text-white' : 'opacity-0 text-slate-400 dark:text-slate-500 group-hover:opacity-70'}`} />
              </>
            )}
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-[14px] font-semibold rounded-2xl transition-all duration-200 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-300 group-hover:bg-red-100 group-hover:text-red-600">
              <LogOut className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
            <span className="flex-1">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
};