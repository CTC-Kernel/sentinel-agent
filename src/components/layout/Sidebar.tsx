import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { LayoutDashboard, Server, ShieldAlert, FileText, Users, Settings, Lock, Activity, Briefcase, FolderKanban, Siren, Building, Fingerprint, HelpCircle, HeartPulse, LogOut, Settings as Settings3D, ChevronRight, Database, Calendar, Loader2 } from '../ui/Icons';
import { LegalModal } from '../ui/LegalModal';
import { Button } from '../ui/button';
import { Scale, Shield } from 'lucide-react';
import { hasPermission } from '../../utils/permissions';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';

export const Sidebar: React.FC<{ mobileOpen: boolean; setMobileOpen: (o: boolean) => void }> = ({ mobileOpen, setMobileOpen }) => {
  const { user, t } = useStore();
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  React.useEffect(() => {
    const checkSuperAdmin = async () => {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdTokenResult();
        setIsSuperAdmin(!!token.claims.superAdmin);
      }
    };
    checkSuperAdmin();
  }, [user]);

  const navGroups = [
    {
      title: t('common.pilotage'),
      items: [
        { key: 'dashboard', name: t('sidebar.dashboard'), to: '/', icon: LayoutDashboard },
        { key: 'calendar', name: t('common.calendar'), to: '/calendar', icon: Calendar },
        { key: 'voxel', name: t('common.ctcEngine'), to: '/ctc-engine', icon: Settings3D },
        { key: 'incidents', name: t('sidebar.incidents'), to: '/incidents', icon: Siren },
        { key: 'projects', name: t('sidebar.projects'), to: '/projects', icon: FolderKanban },
      ]
    },
    {
      title: t('common.governance'),
      items: [
        { key: 'risks', name: t('common.riskManagement'), to: '/risks', icon: ShieldAlert },
        { key: 'continuity', name: t('sidebar.continuity'), to: '/continuity', icon: HeartPulse },
        { key: 'compliance', name: t('common.complianceDda'), to: '/compliance', icon: FileText },
        { key: 'audits', name: t('sidebar.audits'), to: '/audits', icon: Activity },
      ]
    },
    {
      title: t('common.repository'),
      items: [
        { key: 'assets', name: t('sidebar.assets'), to: '/assets', icon: Server },
        { key: 'suppliers', name: t('sidebar.suppliers'), to: '/suppliers', icon: Building },
        { key: 'documents', name: t('sidebar.documents'), to: '/documents', icon: Briefcase },
        { key: 'privacy', name: t('common.privacyGdpr'), to: '/privacy', icon: Fingerprint },
      ]
    },
    {
      title: t('common.administration'),
      items: [
        { key: 'team', name: t('sidebar.team'), to: '/team', icon: Users },
        { key: 'backup', name: t('common.backup'), to: '/backup', icon: Database },
        ...(isSuperAdmin ? [{ key: 'super_admin', name: 'Super Admin', to: '/admin_management', icon: Shield }] : [])
      ]
    }
  ];

  const filterItem = (item: { key: string; name: string }) => {
    if (!user) return false;

    // ALWAYS SHOW Dashboard to avoid empty menu confusion
    if (item.key === 'dashboard') return true;

    // If user is admin or owner -> Show All
    if (user.role === 'admin' || user.role === 'rssi') return true;

    // STRICT RBAC FILTERING
    switch (item.key) {
      case 'incidents': return hasPermission(user, 'Incident', 'read');
      case 'projects': return hasPermission(user, 'Project', 'read');
      case 'risks': return hasPermission(user, 'Risk', 'read');
      case 'audits': return hasPermission(user, 'Audit', 'read');
      case 'documents': return hasPermission(user, 'Document', 'read');
      case 'assets': return hasPermission(user, 'Asset', 'read');
      case 'team': return hasPermission(user, 'User', 'read');
      case 'backup': return hasPermission(user, 'Settings', 'manage');
      case 'continuity': return hasPermission(user, 'Risk', 'read');
      case 'compliance': return hasPermission(user, 'Audit', 'read');
      case 'suppliers': return hasPermission(user, 'Supplier', 'read');
      case 'privacy': return hasPermission(user, 'Document', 'read');
      case 'voxel': return false;
      default: return true;
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
    } catch (error) {
      ErrorLogger.error(error, 'Sidebar.handleLogout');
      setIsLoggingOut(false);
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
        flex flex-col pb-8 pt-4 pt-safe pb-safe lg:pb-6 min-h-0 lg:h-screen
      `}>
        {/* Brand Logo */}
        <div className="h-16 flex items-center px-6 mb-4 border-b border-slate-200/60 dark:border-white/5">
          <div className="flex items-center gap-3 group cursor-pointer select-none">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black shadow-xl shadow-slate-900/30 ring-1 ring-black/5 dark:ring-white/10">
              <Lock className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">Sentinel</h1>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 tracking-[0.4em] mt-1 uppercase">GRC</span>
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
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-[0.4em]">{group.title}</p>
                </div>
                <div className="space-y-1">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to} // Changed key to 'to' because 'name' is now dynamic
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => `
                         group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60
                         ${isActive
                          ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-white dark:text-slate-950 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
                       `}
                    >
                      {({ isActive }) => (
                        <>
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all duration-200 ${isActive ? 'text-white dark:text-slate-950' : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                            <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
                          </span>
                          <span className="flex-1 truncate">{item.name}</span>
                          {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-r-full opacity-0 lg:opacity-100" />}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="px-1 mb-2 mt-6">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-[0.4em]">{t('common.support')}</p>
          </div>
          <NavLink
            to="/help"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `
                group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60
                ${isActive
                ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
              `}
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                  <HelpCircle className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="flex-1 truncate">{t('common.helpCenter')}</span>
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
                ${isActive ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white shadow-inner shadow-white/50' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
              `}
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-slate-900/90 text-white dark:bg-white/20 dark:text-white' : 'bg-slate-100/80 text-slate-600 dark:bg-white/5 dark:text-slate-400 group-hover:bg-white/80 group-hover:text-slate-900 dark:group-hover:bg-white/15 dark:group-hover:text-white'}`}>
                  <Settings className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <span className="flex-1">{t('sidebar.settings')}</span>
                <ChevronRight className={`h-3.5 w-3.5 transition-opacity duration-200 ${isActive ? 'opacity-80 text-slate-900 dark:text-white' : 'opacity-0 text-slate-500 dark:text-slate-500 group-hover:opacity-70'}`} />
              </>
            )}
          </NavLink>
          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full justify-start px-3 py-2 h-auto text-[14px] font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 rounded-xl"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 dark:text-red-400/80 mr-3">
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" strokeWidth={2} />}
            </span>
            <span className="flex-1 text-left">{t('common.logout')}</span>
          </Button>

          <button
            onClick={() => setShowLegalModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-2 text-[10px] font-medium text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Scale className="h-3 w-3" />
            <span>{t('settings.mentionsLegales')}</span>
          </button>
        </div>
      </aside>

      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab="mentions"
      />
    </>
  );
};