import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Menu, Search, Moon, Sun, User, Settings as SettingsIcon, LogOut, Command, Shield, MessageSquare, Globe } from '../ui/Icons';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { Breadcrumbs } from '../ui/Breadcrumbs';

import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useTeamData } from '../../hooks/team/useTeamData';
import { ErrorLogger } from '../../services/errorLogger';
import { FeedbackModal } from '../ui/FeedbackModal';
import { Tooltip } from '../ui/Tooltip';
import { SyncIndicator } from '../ui/SyncIndicator';
import { PlanIndicator } from '../ui/PlanIndicator';
import { getDefaultAvatarUrl } from '../../utils/avatarUtils';

interface TopBarProps {
    setMobileOpen: (open: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ setMobileOpen }) => {
    const { theme, toggleTheme, user, t, language, setLanguage } = useStore();
    const { updateUser } = useTeamData();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Handle click outside for user menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    useEffect(() => {
        const checkSuperAdmin = async () => {
            if (auth.currentUser) {
                const token = await auth.currentUser.getIdTokenResult();
                setIsSuperAdmin(!!token.claims.superAdmin);
            }
        };
        checkSuperAdmin();
    }, [user?.uid]);

    // Trigger Command Palette (Cmd+K) programmatically
    const openCommandPalette = () => {
        const event = new KeyboardEvent('keydown', {
            key: 'k',
            metaKey: true,
            bubbles: true
        });
        window.dispatchEvent(event);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            ErrorLogger.error(error, 'TopBar.handleLogout');
        }
    };

    const handleThemeToggle = useCallback(async () => {
        toggleTheme();
        if (user) {
            try {
                const newTheme = theme === 'light' ? 'dark' : 'light';
                await updateUser(user.uid, { theme: newTheme });
            } catch (e) {
                ErrorLogger.error(e, 'TopBar.toggleTheme');
            }
        }
    }, [toggleTheme, user, theme, updateUser]);

    return (
        <header className="h-16 pt-safe z-sticky sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-3xl border-b border-slate-200 dark:border-white/5 transition-all duration-300 px-4 md:px-8 shadow-sm dark:shadow-none">
            <div className="h-full max-w-[1600px] mx-auto flex items-center justify-between">
                {/* Left: Mobile Menu & Search Trigger */}
                <div className="flex items-center flex-1 gap-4">
                    <button
                        aria-label="Ouvrir le menu mobile"
                        onClick={() => setMobileOpen(true)}
                        className="p-2 -ml-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors lg:hidden rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    {/* Breadcrumbs (Desktop) */}
                    <Breadcrumbs />

                    {/* Modern Search Bar Trigger */}
                    <button
                        aria-label="Rechercher (Cmd+K)"
                        data-tour="command-palette"
                        onClick={openCommandPalette}
                        className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-100/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-600 dark:text-slate-400 transition-all duration-200 group w-full max-w-sm shadow-sm hover:shadow-md"
                    >
                        <Search className="h-4 w-4 text-slate-500 group-hover:text-brand-500 transition-colors" />
                        <span className="flex-1 text-left font-medium text-xs uppercase tracking-wide">{t('common.search')}</span>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-white/10 border border-slate-200 dark:border-white/5 text-[10px] font-bold text-slate-500 shadow-sm">
                            <Command className="h-3 w-3" />
                            <span>K</span>
                        </div>
                    </button>

                    {/* Mobile Search Icon */}
                    <button
                        aria-label="Rechercher"
                        onClick={openCommandPalette}
                        className="md:hidden p-2 text-slate-500 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                        <Search className="h-5 w-5" />
                    </button>
                </div>

                {/* Right: Actions & Profile */}
                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Plan Indicator */}
                    <div className="hidden sm:block">
                        <PlanIndicator />
                    </div>

                    {isSuperAdmin && (
                        <Link
                            to="/admin_management"
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                            <Shield className="h-4 w-4" />
                            {t('common.adminShort')}
                        </Link>
                    )}
                    <SyncIndicator />
                    <span data-tour="notifications">
                        <NotificationCenter />
                    </span>

                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block"></div>

                    <Tooltip content={theme === 'light' ? t('common.darkMode') : t('common.lightMode')} position="bottom">
                        <button
                            data-tour="theme-toggle"
                            onClick={handleThemeToggle}
                            className="p-2 rounded-full text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                            aria-label="Toggle Theme"
                        >
                            {theme === 'light' ? <Moon className="h-5 w-5" strokeWidth={2} /> : <Sun className="h-5 w-5" strokeWidth={2} />}
                        </button>
                    </Tooltip>

                    <div className="relative" ref={userMenuRef}>
                        <button
                            aria-label="Menu utilisateur"
                            data-tour="header-profile"
                            className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 dark:hover:bg-white/5 transition-all group focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                        >
                            <div className="hidden sm:flex flex-col items-end mr-1">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">{user?.displayName}</span>
                                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5">{user?.role || 'User'}</span>
                            </div>
                            <img
                                alt="Profile"
                                src={getDefaultAvatarUrl(user?.role)}
                                className="h-9 w-9 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shadow-md group-hover:scale-105 transition-transform"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = getDefaultAvatarUrl(user?.role);
                                }}
                            />
                        </button>

                        {/* Dropdown Menu */}
                        {showUserMenu && (
                            <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-950 border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden z-50 animate-scale-in origin-top-right shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)] ring-1 ring-white/20 dark:ring-white/5">
                                <div className="p-4 bg-gradient-to-br from-slate-50/50 to-white/30 dark:from-slate-800/30 dark:to-slate-900/20 border-b border-slate-200/50 dark:border-white/10">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.displayName}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">{user?.email}</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    <button
                                        onClick={() => {
                                            setLanguage(language === 'fr' ? 'en' : 'fr');
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                    >
                                        <Globe className="h-4 w-4 mr-3 text-slate-500" />
                                        {language === 'fr' ? 'Switch to English' : 'Passer en Français'}
                                    </button>
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                    >
                                        <User className="h-4 w-4 mr-3 text-slate-500" />
                                        {t('settings.myProfile')}
                                    </Link>
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                    >
                                        <SettingsIcon className="h-4 w-4 mr-3 text-slate-500" />
                                        {t('common.settings.title')}
                                    </Link>
                                    <Link
                                        to="/pricing"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-3 py-2.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/20 rounded-xl transition-colors"
                                    >
                                        <span className="w-4 h-4 mr-3 flex items-center justify-center font-serif italic font-black border border-current rounded-full text-[10px]">€</span>
                                        {t('settings.plansAndBilling')}
                                    </Link>
                                    <button
                                        aria-label="Donner un avis"
                                        onClick={() => { setShowUserMenu(false); setShowFeedback(true); }}
                                        className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                    >
                                        <MessageSquare className="h-4 w-4 mr-3 text-slate-500" />
                                        Donner un avis
                                    </button>
                                </div>
                                <div className="h-px bg-slate-200/50 dark:bg-white/10 mx-2"></div>
                                <div className="p-2">
                                    <button
                                        aria-label="Se déconnecter"
                                        onClick={() => { handleLogout(); setShowUserMenu(false); }}
                                        className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                    >
                                        <LogOut className="h-4 w-4 mr-3" />
                                        {t('common.logout')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
        </header>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
