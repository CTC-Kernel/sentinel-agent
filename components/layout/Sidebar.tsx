import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { LayoutDashboard, Server, ShieldAlert, FileText, Users, Settings, Lock, Activity, Briefcase, FolderKanban, Siren, Building, Fingerprint, HelpCircle, HeartPulse, LogOut, Settings as Settings3D, ChevronRight, Database } from '../ui/Icons';

const navGroups = [
  {
    title: 'Pilotage',
    items: [
      { name: 'Tableau de bord', to: '/', icon: LayoutDashboard },
      { name: 'CTC Engine', to: '/voxel', icon: Settings3D },
      { name: 'Incidents', to: '/incidents', icon: Siren },
      { name: 'Projets SSI', to: '/projects', icon: FolderKanban },
    ]
  },
  {
    title: 'Gouvernance',
    items: [
      { name: 'Gestion des Risques', to: '/risks', icon: ShieldAlert },
      { name: 'Continuité (PCA)', to: '/continuity', icon: HeartPulse },
      { name: 'Conformité DdA', to: '/compliance', icon: FileText },
      { name: 'Audits', to: '/audits', icon: Activity },
    ]
  },
  {
    title: 'Référentiel',
    items: [
      { name: 'Actifs', to: '/assets', icon: Server },
      { name: 'Fournisseurs', to: '/suppliers', icon: Building },
      { name: 'Documents', to: '/documents', icon: Briefcase },
      { name: 'Confidentialité (RGPD)', to: '/privacy', icon: Fingerprint },
    ]
  },
  {
    title: 'Administration',
    items: [
      { name: 'Équipe', to: '/team', icon: Users },
      { name: 'Sauvegarde', to: '/backup', icon: Database },
    ]
  }
];

import { useStore } from '../../store';
import { hasPermission } from '../../utils/permissions';

export const Sidebar: React.FC<{ mobileOpen: boolean; setMobileOpen: (o: boolean) => void }> = ({ mobileOpen, setMobileOpen }) => {
  const { user } = useStore();

  const filterItem = (item: { name: string }) => {
    if (!user) return false;
    
    // ALWAYS SHOW Dashboard to avoid empty menu confusion
    if (item.name === 'Tableau de bord') return true;
    
    // If user is admin or owner -> Show All
    if (user.role === 'admin' || user.role === 'rssi') return true;

    // STRICT RBAC FILTERING
    switch (item.name) {
      case 'Incidents': return hasPermission(user, 'Risk', 'read');
      case 'Projets SSI': return hasPermission(user, 'Project', 'read');
      case 'Gestion des Risques': return hasPermission(user, 'Risk', 'read');
      case 'Audits': return hasPermission(user, 'Audit', 'read');
      case 'Documents': return hasPermission(user, 'Document', 'read');
      case 'Actifs': return hasPermission(user, 'Asset', 'read');
      case 'Équipe': return hasPermission(user, 'User', 'read');
      case 'Sauvegarde': return hasPermission(user, 'Settings', 'manage');
      case 'Continuité (PCA)': return hasPermission(user, 'Risk', 'read'); // PCA lié au risque
      case 'Conformité DdA': return hasPermission(user, 'Audit', 'read'); // DdA lié audit/compliance
      case 'Fournisseurs': return hasPermission(user, 'Asset', 'read'); // Fournisseurs = actifs externes
      case 'Confidentialité (RGPD)': return hasPermission(user, 'Document', 'read');
      case 'CTC Engine': return false; // Caché pour les non-admins par défaut sauf si permission explicite (future)
      default: return true; // Pages neutres (Help, etc.)
    }
  };

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
        <nav className="flex-1 min-h-0 space-y-6 overflow-y-auto custom-scrollbar px-4">
          {navGroups.map((group, groupIndex) => {
            const visibleItems = group.items.filter(filterItem);
            if (visibleItems.length === 0) return null;

            return (
              <div key={groupIndex}>
                <div className="px-1 mb-2">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">{group.title}</p>
                </div>
                <div className="space-y-1">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => `
                         group relative flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[14px] font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60
                         ${isActive
                          ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/15 dark:bg-white dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}
                       `}
                    >
                      {({ isActive }) => (
                        <>
                          <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all duration-200 ${isActive ? 'bg-white/10 text-white dark:bg-slate-900/10 dark:text-slate-900' : 'bg-slate-100/70 text-slate-500 dark:bg-white/5 dark:text-slate-400 group-hover:bg-white/80 group-hover:text-slate-900 dark:group-hover:bg-white/15 dark:group-hover:text-white'}`}>
                            <item.icon className="h-4 w-4" strokeWidth={2.1} />
                          </span>
                          <span className="flex-1 truncate">{item.name}</span>
                          {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-80 text-white dark:text-slate-900" />}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="px-1 mb-2 mt-6">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Support</p>
          </div>
          <NavLink
            to="/help"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `
                group relative flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[14px] font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60
                ${isActive
                ? 'bg-slate-100 text-slate-900 shadow-inner shadow-white/60 dark:bg-white/10 dark:text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
              `}
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${isActive ? 'bg-slate-200 text-slate-900 dark:bg-white/20 dark:text-white' : 'bg-slate-100/70 text-slate-500 dark:bg-white/5 dark:text-slate-400 group-hover:bg-white/80 group-hover:text-slate-900 dark:group-hover:bg-white/15 dark:group-hover:text-white'}`}>
                  <HelpCircle className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="flex-1 truncate">Centre d'aide</span>
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
            <span className="flex-1 text-left">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
};