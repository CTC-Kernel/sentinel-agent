import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import {
    LayoutDashboard, Server, ShieldAlert, FileText, Users, Settings, Lock, Activity,
    Briefcase, FolderKanban, Siren, Building, Fingerprint, HelpCircle, HeartPulse,
    LogOut, Box, ChevronRight, Database, Calendar, Loader2, Bug, Globe,
    Scale, Shield, Printer, LucideIcon, RefreshCcw, X, Bot, GraduationCap,
    UserCheck, Info,
} from '../ui/Icons';
import { LegalModal } from '../ui/LegalModal';
import { Button } from '../ui/button';
import { hasPermission } from '../../utils/permissions';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';
import { ResourceType, ActionType } from '../../types';
import { useAdminActions } from '../../hooks/useAdminActions';

interface NavItem {
    key: string;
    name: string;
    to: string;
    icon: LucideIcon;
    resource?: ResourceType;
    action?: ActionType;
    superAdminOnly?: boolean;
}

interface NavGroup {
    title: string;
    items: NavItem[];
    iconColor?: string;
}

/**
 * Icon color coding by navigation section for visual differentiation
 * Uses design token colors for theme consistency (harmonized palette)
 * Includes both French and English keys to support i18n
 */
const NAV_GROUP_COLORS: Record<string, string> = {
    // French labels - using design token nav colors
    'PILOTAGE': 'text-nav-pilotage',
    'Pilotage': 'text-nav-pilotage',
    'OPÉRATIONS': 'text-nav-operations',
    'Opérations': 'text-nav-operations',
    'GOVERNANCE': 'text-nav-governance',
    'Gouvernance': 'text-nav-governance',
    'RÉFÉRENTIEL': 'text-nav-repository',
    'Référentiel': 'text-nav-repository',
    'ADMINISTRATION': 'text-nav-admin',
    'Administration': 'text-nav-admin',
    'SUPPORT': 'text-nav-support',
    'Support': 'text-nav-support',
    // English labels
    'STEERING': 'text-nav-pilotage',
    'OPERATIONS': 'text-nav-operations',
    'REPOSITORY': 'text-nav-repository',
};

import { useLocale } from '../../hooks/useLocale';

// ...

export const Sidebar: React.FC<{ mobileOpen: boolean; setMobileOpen: (o: boolean) => void }> = ({ mobileOpen, setMobileOpen }) => {
    const { user } = useStore();
    const { t } = useLocale();
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const { verifySuperAdmin } = useAdminActions();

    React.useEffect(() => {
        const checkSuperAdmin = async () => {
            if (user) {
                // Use verifySuperAdmin which checks both claim AND bootstrap list
                const isAdmin = await verifySuperAdmin();
                setIsSuperAdmin(isAdmin);
            }
        };
        checkSuperAdmin();
    }, [user, verifySuperAdmin]);

    const navGroups: NavGroup[] = [
        {
            title: t('common.pilotage'),
            items: [
                { key: 'dashboard', name: t('sidebar.dashboard'), to: '/', icon: LayoutDashboard }, // No resource = visible to all
                { key: 'projects', name: t('sidebar.projects'), to: '/projects', icon: FolderKanban, resource: 'Project' },
                { key: 'reports', name: t('sidebar.reports'), to: '/reports', icon: Printer, resource: 'Risk' }, // Often linked to Risk/Audit
                { key: 'calendar', name: t('common.calendar'), to: '/calendar', icon: Calendar },
            ]
        },
        {
            title: t('common.operations'),
            items: [
                { key: 'incidents', name: t('sidebar.incidents'), to: '/incidents', icon: Siren, resource: 'Incident' },
                { key: 'vulnerabilities', name: t('sidebar.vulnerabilities'), to: '/vulnerabilities', icon: Bug, resource: 'Asset' },
                { key: 'agents', name: t('sidebar.agents'), to: '/agents', icon: Bot, resource: 'Agent' },
                { key: 'threat-intelligence', name: t('sidebar.threatIntel'), to: '/threat-intelligence', icon: Globe }, // Open feature
                { key: 'voxel', name: t('common.ctcEngine'), to: '/ctc-engine', icon: Box, resource: 'CTCEngine' },
            ]
        },
        {
            title: t('common.governance'),
            items: [
                { key: 'risks', name: t('common.riskManagement'), to: '/risks', icon: ShieldAlert, resource: 'Risk' },
                { key: 'smsi', name: t('sidebar.smsi'), to: '/smsi', icon: RefreshCcw, resource: 'Risk' }, // ISO 27003 PDCA
                { key: 'compliance', name: t('common.complianceDda'), to: '/compliance', icon: FileText, resource: 'Audit' }, // Compliance often mapped to Audit roles
                { key: 'audits', name: t('sidebar.audits'), to: '/audits', icon: Activity, resource: 'Audit' },
                { key: 'training', name: t('sidebar.training'), to: '/training', icon: GraduationCap, resource: 'User' }, // NIS2 Art. 21.2(g)
                { key: 'access-review', name: t('sidebar.accessReview'), to: '/access-review', icon: UserCheck, resource: 'User', action: 'manage' }, // NIS2 Art. 21.2(i)
                { key: 'continuity', name: t('sidebar.continuity'), to: '/continuity', icon: HeartPulse, resource: 'Risk' }, // BCP
                { key: 'privacy', name: t('common.privacyGdpr'), to: '/privacy', icon: Fingerprint, resource: 'Document' }, // Privacy
            ]
        },
        {
            title: t('common.repository'),
            items: [
                { key: 'assets', name: t('sidebar.assets'), to: '/assets', icon: Server, resource: 'Asset' },
                { key: 'cmdb', name: t('sidebar.cmdb', { defaultValue: 'CMDB' }), to: '/cmdb', icon: Database, resource: 'Asset' },
                { key: 'suppliers', name: t('sidebar.suppliers'), to: '/suppliers', icon: Building, resource: 'Supplier' },
                { key: 'documents', name: t('sidebar.documents'), to: '/documents', icon: Briefcase, resource: 'Document' },
            ]
        },
        {
            title: t('common.administration'),
            items: [
                { key: 'team', name: t('sidebar.team'), to: '/team', icon: Users, resource: 'User' },
                { key: 'system-health', name: t('sidebar.systemHealth'), to: '/system-health', icon: Activity, resource: 'Organization', action: 'manage' },
                { key: 'backup', name: t('common.backup'), to: '/backup', icon: Database, resource: 'Settings', action: 'manage' },
                { key: 'super_admin', name: t('sidebar.superAdmin'), to: '/admin_management', icon: Shield, superAdminOnly: true }
            ]
        }
    ];

    const filterItem = (item: NavItem) => {
        if (!user) return false;

        // 1. Super Admin Check
        if (item.superAdminOnly) return isSuperAdmin;

        // 2. Dynamic Resource Check
        if (item.resource) {
            return hasPermission(user, item.resource, item.action || 'read');
        }

        // 3. Default: Visible if no resource constraint
        return true;
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await signOut(auth);
            setIsLoggingOut(false);
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
                    className="fixed inset-0 bg-[var(--overlay-bg)] z-header lg:hidden backdrop-blur-sm transition-opacity duration-500 touch-none overscroll-contain"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                    data-testid="mobile-overlay"
                />
            )}

            <aside className={`
 fixed inset-y-0 left-0 lg:inset-y-auto lg:sticky lg:top-0 z-sidebar w-[82vw] max-w-[320px] lg:w-[260px]
 bg-[var(--glass-bg)]
 backdrop-blur-[var(--glass-blur-md)] border-r border-border/40
 shadow-[var(--glass-shadow)] lg:shadow-none
 transform transition-transform duration-500 ease-apple
 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
 flex flex-col pb-8 pt-4 pt-safe pb-safe lg:pb-6 min-h-0 lg:h-screen
 `}
                data-tour="sidebar"
            >
                {/* Brand Logo */}
                <div className="h-16 flex items-center justify-between px-6 mb-4 border-b border-border/60">
                    <a
                        href="https://cyber-threat-consulting.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 group cursor-pointer select-none shine-effect"
                    >
                        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-white/10">
                            <Lock className="h-5 w-5" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h1 className="text-lg font-extrabold font-display tracking-tight text-foreground leading-none">Sentinel</h1>
                            <span className="text-xs font-bold text-muted-foreground tracking-[0.4em] mt-1 uppercase">GRC</span>
                        </div>
                    </a>
                    {/* Mobile Close Button */}
                    <button
                        aria-label={t('common.closeMenu')}
                        onClick={() => setMobileOpen(false)}
                        className="lg:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-2 overflow-y-auto scrollbar-hide py-4" data-tour="sidebar-nav">
                    {navGroups.map((group, groupIndex) => {
                        const visibleItems = group.items.filter(filterItem);
                        if (visibleItems.length === 0) return null;

                        // Get icon color for this group
                        const groupIconColor = NAV_GROUP_COLORS[group.title] || 'text-muted-foreground';

                        return (
                            <div key={groupIndex || 'unknown'}>
                                <div className="px-1 mb-2">
                                    <p className="mono-label px-2">{group.title}</p>
                                </div>
                                <div className="space-y-1">
                                    {visibleItems.map((item) => (
                                        <NavLink
                                            key={item.to || 'unknown'}
                                            to={item.to}
                                            onClick={() => setMobileOpen(false)}
                                            data-tour={`${item.key}-nav`}
                                            className={({ isActive }) => `
  group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium tracking-tight
  transition-all duration-300 active:duration-75 active:scale-95 ease-apple
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden
  ${isActive
                                                    ? 'bg-gradient-primary text-primary-foreground shadow-lg shadow-primary/40 ring-1 ring-white/10'
                                                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-1'}
  `}
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all duration-300 ${isActive ? 'text-white bg-white/20 shadow-lg' : `${groupIconColor} group-hover:text-foreground`}`}>
                                                        <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
                                                    </span>
                                                    <span className="flex-1 truncate relative z-decorator">{item.name}</span>
                                                    {isActive && (
                                                        <motion.span
                                                            layoutId="sidebar-active-indicator"
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-white shadow-lg"
                                                            aria-hidden="true"
                                                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    <div className="px-1 mb-2 mt-6">
                        <p className="mono-label px-2">{t('common.support')}</p>
                    </div>
                    <NavLink
                        to="/help"
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => `
 group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium tracking-tight transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden
 ${isActive
                                ? 'bg-gradient-primary text-primary-foreground shadow-lg shadow-primary/25'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-1'}
 `}
                    >
                        {({ isActive }) => (
                            <>
                                <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all duration-300 ${isActive ? 'text-white bg-white/20 shadow-lg' : 'text-nav-support group-hover:text-foreground'}`}>
                                    <HelpCircle className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
                                </span>
                                <span className="flex-1 truncate relative z-decorator">{t('common.helpCenter')}</span>
                                {isActive && (
                                    <motion.span
                                        layoutId="sidebar-active-indicator"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-white shadow-lg"
                                        aria-hidden="true"
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                )}               </>
                        )}
                    </NavLink>
                </nav>

                {/* User Settings & Logout */}
                <div className="mt-auto pt-4 px-3 mx-3 mb-2 bg-white/5 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-border/40 space-y-1">
                    <NavLink
                        to="/settings"
                        data-tour="settings"
                        className={({ isActive }) => `
 group flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden
 ${isActive ? 'bg-gradient-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'}
 `}
                    >
                        {({ isActive }) => (
                            <>
                                <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all duration-300 ${isActive ? 'text-white bg-white/20 shadow-lg' : 'bg-muted text-muted-foreground group-hover:bg-background/80 group-hover:text-foreground'}`}>
                                    <Settings className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
                                </span>
                                <span className="flex-1 relative z-decorator">{t('sidebar.settings')}</span>
                                {isActive ? (
                                    <motion.span
                                        layoutId="sidebar-active-indicator"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-white shadow-lg"
                                        aria-hidden="true"
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                ) : (
                                    <ChevronRight className="h-3.5 w-3.5 transition-opacity duration-200 opacity-0 text-muted-foreground group-hover:opacity-70" />
                                )}
                            </>
                        )}
                    </NavLink>
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full justify-start px-3 py-2.5 h-auto text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 dark:hover:text-destructive-300 rounded-xl"
                    >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive mr-3 bg-destructive/10">
                            {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" strokeWidth={2} />}
                        </span>
                        <span className="flex-1 text-left">{t('common.logout')}</span>
                    </Button>

                    <div className="pt-2 border-t border-border/50 mt-2 space-y-1">
                        <a
                            href="https://cyber-threat-consulting.com/about"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 h-8 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors hover:bg-muted/50 rounded-xl no-underline"
                        >
                            <Info className="h-3 w-3" />
                            <span>{t('sidebar.about')}</span>
                        </a>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowLegalModal(true)}
                            className="w-full flex items-center justify-center gap-2 h-8 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Scale className="h-3 w-3" />
                            <span>{t('settings.mentionsLegales')}</span>
                        </Button>
                    </div>
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
// Headless UI handles FocusTrap and keyboard navigation
