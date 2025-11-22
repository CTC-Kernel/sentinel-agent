import React from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { LayoutDashboard, Server, ShieldAlert, FileText, Users, Settings, Lock, Activity, Briefcase, FolderKanban, Siren, Building, Fingerprint, HelpCircle, HeartPulse, LogOut } from '../ui/Icons';

const navItems = [
  { name: 'Tableau de bord', to: '/', icon: LayoutDashboard },
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
  { name: 'Équipe', to: '/team', icon: Users },
];

export const Sidebar: React.FC<{ mobileOpen: boolean; setMobileOpen: (o: boolean) => void }> = ({ mobileOpen, setMobileOpen }) => {
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
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-500"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-[260px] 
        bg-white/98 dark:bg-slate-800/98 backdrop-blur-2xl
        border-r border-slate-200/60 dark:border-slate-700/50
        transform transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1)
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        flex flex-col pb-6 pt-2
      `}>
        {/* Brand Logo */}
        <div className="h-16 flex items-center px-6 mb-2 mt-2 border-b border-transparent">
          <div className="flex items-center gap-3 group cursor-pointer select-none">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black shadow-lg shadow-slate-900/20 ring-1 ring-black/5 dark:ring-white/10">
              <Lock className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-[16px] font-bold tracking-tight text-slate-900 dark:text-white leading-none">Sentinel</h1>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider mt-0.5">GRC PLATFORM</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar px-3 py-4">
          <div className="px-3 mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Espace de travail</p>
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                group flex items-center px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-200
                ${isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-900/10 dark:shadow-white/10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white'}
              `}
            >
              <item.icon className={`
                h-4 w-4 mr-3 transition-colors duration-200
                ${({ isActive }: any) => isActive ? 'text-white dark:text-black' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}
              `} strokeWidth={2} />
              {item.name}
            </NavLink>
          ))}

          <div className="px-3 mb-2 mt-8">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Support</p>
          </div>
          <NavLink
            to="/help"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `
                group flex items-center px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-200
                ${isActive
                ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/5'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}
              `}
          >
            <HelpCircle className="h-4 w-4 mr-3 text-slate-400 group-hover:text-slate-600" strokeWidth={2} />
            Centre d'aide
          </NavLink>
        </nav>

        {/* User Settings & Logout */}
        <div className="mt-auto pt-4 px-3 border-t border-slate-200/60 dark:border-white/8 mx-3 space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) => `
                flex items-center px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-200
                ${isActive ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}
              `}
          >
            <Settings className="h-4 w-4 mr-3 text-slate-400 group-hover:rotate-90 transition-transform duration-500" strokeWidth={2} />
            Paramètres
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 group"
          >
            <LogOut className="h-4 w-4 mr-3 text-slate-400 group-hover:text-red-500 transition-colors" strokeWidth={2} />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};