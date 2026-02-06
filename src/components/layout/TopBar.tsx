import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Menu, X, Search, Moon, Sun, User, Settings as SettingsIcon, LogOut, Command, Shield, MessageSquare, Globe, Info } from '../ui/Icons';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/button';
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
    mobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ mobileOpen, setMobileOpen }) => {
    const { theme, toggleTheme, user, t, language, setLanguage } = useStore();
    const { updateUser } = useTeamData();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isTogglingTheme, setIsTogglingTheme] = useState(false);
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
        setIsLoggingOut(true);
        try {
            await signOut(auth);
        } catch (error) {
            ErrorLogger.error(error, 'TopBar.handleLogout');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleThemeToggle = useCallback(async () => {
        setIsTogglingTheme(true);
        toggleTheme();
        if (user) {
            try {
                const newTheme = theme === 'light' ? 'dark' : 'light';
                await updateUser(user.uid, { theme: newTheme });
            } catch (e) {
                ErrorLogger.error(e, 'TopBar.toggleTheme');
            } finally {
                setIsTogglingTheme(false);
            }
        } else {
            setIsTogglingTheme(false);
        }
    }, [toggleTheme, user, theme, updateUser]);

    return (
        <header className="h-16 pt-safe z-sticky sticky top-0 bg-[var(--glass-bg)] backdrop-blur-xl border-b border-[var(--glass-border)] transition-all duration-300 px-4 md:px-8 shadow-sm dark:shadow-none">
            <div className="h-full max-w-[1600px] mx-auto flex items-center justify-between">
                {/* Left: Mobile Menu & Search Trigger */}
                <div className="flex items-center flex-1 gap-4">
                    <button
                        aria-label={mobileOpen ? t('layout.topbar.closeMobileMenuAriaLabel', { defaultValue: 'Fermer le menu mobile' }) : t('layout.topbar.openMobileMenuAriaLabel', { defaultValue: 'Ouvrir le menu mobile' })}
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="p-2.5 -ml-2 text-muted-foreground hover:text-foreground transition-all lg:hidden rounded-lg hover:bg-muted"
                    >
                        <div className="relative h-5 w-5">
                            <Menu className={`h-5 w-5 absolute inset-0 transition-all duration-300 ${mobileOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-70 rotate-0 scale-100'}`} />
                            <X className={`h-5 w-5 absolute inset-0 transition-all duration-300 ${mobileOpen ? 'opacity-70 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'}`} />
                        </div>
                    </button>

                    {/* Breadcrumbs (Desktop) */}
                    <Breadcrumbs />

                    {/* Modern Search Bar Trigger */}
                    <button
                        aria-label={t('layout.topbar.searchAriaLabel', { defaultValue: 'Rechercher (Cmd+K)' })}
                        data-tour="command-palette"
                        onClick={openCommandPalette}
                        className="hidden md:flex items-center gap-2 px-3 py-2 bg-[var(--glass-bg)] hover:bg-[var(--glass-medium-bg)] border border-[var(--glass-border)] rounded-xl text-sm text-foreground/70 transition-all duration-normal ease-apple group max-w-48 shadow-sm hover:shadow-md"
                    >
                        <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-xs font-medium text-muted-foreground">{t('common.search')}</span>
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-background/50 border border-border/40 text-xs font-bold text-muted-foreground">
                            <Command className="h-2.5 w-2.5" />
                            <span>K</span>
                        </div>
                    </button>

                    {/* Mobile Search Icon */}
                    <button
                        aria-label={t('layout.topbar.searchMobileAriaLabel', { defaultValue: 'Rechercher' })}
                        onClick={openCommandPalette}
                        className="md:hidden p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                    >
                        <Search className="h-5 w-5" />
                    </button>
                </div>

                {/* Right: Actions & Profile */}
                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Plan Indicator */}
                    <div>
                        <PlanIndicator />
                    </div>

                    {isSuperAdmin && (
                        <Link
                            to="/admin_management"
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-error-bg text-error-text rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
                        >
                            <Shield className="h-4 w-4" />
                            {t('common.adminShort')}
                        </Link>
                    )}
                    <SyncIndicator />
                    <span data-tour="notifications">
                        <NotificationCenter />
                    </span>

                    <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>

                    <Tooltip content={theme === 'light' ? t('common.darkMode') : t('common.lightMode')} position="bottom">
                        <button
                            data-tour="theme-toggle"
                            onClick={handleThemeToggle}
                            disabled={isTogglingTheme}
                            className={`p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all focus:outline-none focus:ring-2 focus-visible:ring-primary ${isTogglingTheme ? 'opacity-50 cursor-wait animate-pulse' : ''}`}
                            aria-label={t('layout.topbar.toggleThemeAriaLabel', { defaultValue: 'Toggle Theme' })}
                        >
                            {isTogglingTheme ? <Spinner size="sm" /> : (theme === 'light' ? <Moon className="h-5 w-5" strokeWidth={2} /> : <Sun className="h-5 w-5" strokeWidth={2} />)}
                        </button>
                    </Tooltip>

                    <div className="relative" ref={userMenuRef}>
                        <button
                            aria-label={t('layout.topbar.userMenuAriaLabel', { defaultValue: 'Menu utilisateur' })}
                            data-tour="header-profile"
                            className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-[var(--glass-bg)] transition-all group focus:outline-none focus:ring-2 focus:ring-primary/20"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                        >
                            <div className="hidden sm:flex flex-col items-end mr-1">
                                <span className="text-sm font-bold text-foreground leading-none">{user?.displayName || t('common.user', { defaultValue: 'Utilisateur' })}</span>
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mt-0.5">{user?.role || t('common.defaultRole', { defaultValue: 'Utilisateur' })}</span>
                            </div>
                            <div className="relative">
                                <img
                                    alt={user?.displayName || t('layout.topbar.userAvatarAlt', { defaultValue: 'Avatar utilisateur' })}
                                    src={getDefaultAvatarUrl(user?.role)}
                                    className="h-9 w-9 rounded-full object-cover ring-2 ring-background shadow-md group-hover:scale-105 transition-transform"
                                />
                            </div>
                        </button>

                        {/* Dropdown Menu */}
                        {showUserMenu && (
                            <div className="absolute right-0 mt-3 w-64 bg-popover border border-[var(--glass-border)] rounded-xl overflow-hidden z-dropdown animate-scale-in origin-top-right shadow-premium ring-1 ring-white/5">
                                <div className="p-4 bg-muted/30 border-b border-border/40">
                                    <p className="text-sm font-bold text-foreground truncate">{user?.displayName}</p>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
                                </div>
                                <div className="p-2 space-y-0.5">
                                    <button
                                        onClick={() => {
                                            setLanguage(language === 'fr' ? 'en' : 'fr');
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors"
                                    >
                                        <Globe className="h-4 w-4 mr-3 text-muted-foreground" />
                                        {t('common.switchLanguage', { defaultValue: language === 'fr' ? 'Switch to English' : 'Passer en Français' })}
                                    </button>
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors"
                                    >
                                        <User className="h-4 w-4 mr-3 text-muted-foreground" />
                                        {t('settings.myProfile')}
                                    </Link>
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors"
                                    >
                                        <SettingsIcon className="h-4 w-4 mr-3 text-muted-foreground" />
                                        {t('common.settings.title')}
                                    </Link>
                                    <Link
                                        to="/pricing"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                    >
                                        <span className="w-4 h-4 mr-3 flex items-center justify-center font-serif italic font-black border border-current rounded-full text-[11px]">€</span>
                                        {t('settings.plansAndBilling')}
                                    </Link>
                                    <a
                                        href="https://cyber-threat-consulting.com/about"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setShowUserMenu(false)}
                                        className="flex items-center px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors"
                                    >
                                        <Info className="h-4 w-4 mr-3 text-muted-foreground" />
                                        {t('sidebar.about')}
                                    </a>
                                    <button
                                        aria-label={t('common.giveFeedback', { defaultValue: 'Donner un avis' })}
                                        onClick={() => { setShowUserMenu(false); setShowFeedback(true); }}
                                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors"
                                    >
                                        <MessageSquare className="h-4 w-4 mr-3 text-muted-foreground" />
                                        {t('common.giveFeedback', { defaultValue: 'Donner un avis' })}
                                    </button>
                                </div>
                                <div className="h-px bg-border/40 mx-2"></div>
                                <div className="p-2">
                                    <Button
                                        aria-label={t('layout.topbar.logoutAriaLabel', { defaultValue: 'Se déconnecter' })}
                                        variant="ghost"
                                        onClick={() => { handleLogout(); setShowUserMenu(false); }}
                                        isLoading={isLoggingOut}
                                        className="w-full justify-start px-3 py-2 text-sm font-medium text-error-text hover:bg-error-bg rounded-lg transition-colors border-none"
                                    >
                                        {!isLoggingOut && <LogOut className="h-4 w-4 mr-3" />}
                                        {t('common.logout')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
        </header >
    );
};

// Headless UI handles FocusTrap and keyboard navigation
