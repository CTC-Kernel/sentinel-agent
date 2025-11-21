
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, ShieldAlert, FileText, Users, Settings, Lock, Activity, Briefcase, FolderKanban, Siren } from '../ui/Icons';

const navItems = [
  { name: 'Tableau de bord', to: '/', icon: LayoutDashboard },
  { name: 'Incidents', to: '/incidents', icon: Siren },
  { name: 'Projets SSI', to: '/projects', icon: FolderKanban },
  { name: 'Actifs', to: '/assets', icon: Server },
  { name: 'Gestion des Risques', to: '/risks', icon: ShieldAlert },
  { name: 'Documents', to: '/documents', icon: Briefcase },
  { name: 'Conformité DdA', to: '/compliance', icon: FileText },
  { name: 'Audits', to: '/audits', icon: Activity },
  { name: 'Équipe', to: '/team', icon: Users },
];

export const Sidebar: React.FC<{ mobileOpen: boolean; setMobileOpen: (o: boolean) => void }> = ({ mobileOpen, setMobileOpen }) => {
  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-20 lg:hidden backdrop-blur-sm transition-opacity duration-500"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-[280px] 
        bg-white/70 dark:bg-slate-900/60 backdrop-blur-2xl
        border-r border-white/20 dark:border-white/5
        transform transition-transform duration-500 cubic-bezier(0.32, 0.72, 0, 1)
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        flex flex-col p-4
      `}>
        {/* Brand Logo */}
        <div className="h-16 flex items-center px-4 mb-6">
          <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-brand-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-gray-300 p-2.5 rounded-2xl shadow-lg shadow-brand-500/10 ring-1 ring-white/10">
                    <Lock className="h-5 w-5 text-white dark:text-slate-900" />
                </div>
              </div>
              <div>
                  <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none font-display">Sentinel</h1>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-[0.2em] uppercase mt-1">GRC Platform</p>
              </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar px-2">
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-2 opacity-80">Menu Principal</p>
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `
                group flex items-center px-3 py-2.5 text-sm font-medium rounded-2xl transition-all duration-300 ease-out relative
                ${isActive 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-white dark:text-slate-900 dark:shadow-white/10 scale-[1.02]' 
                  : 'text-slate-500 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
              `}
            >
              <item.icon className={`
                h-5 w-5 mr-3 transition-transform duration-300 group-hover:scale-110
                ${({ isActive }: any) => isActive ? 'text-white dark:text-slate-900' : 'opacity-70'}
              `} />
              <span className="tracking-tight">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Profile / Bottom Actions */}
        <div className="mt-auto pt-4 px-2">
           <NavLink
              to="/settings"
              className={({ isActive }) => `
                flex items-center px-3 py-2.5 text-sm font-medium rounded-2xl transition-all duration-300
                ${isActive ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5'}
              `}
            >
              <Settings className="h-5 w-5 mr-3 transition-transform duration-500 hover:rotate-90" />
              Paramètres
            </NavLink>
        </div>
      </aside>
    </>
  );
};