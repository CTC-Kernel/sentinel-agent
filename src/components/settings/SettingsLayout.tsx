import React from 'react';
import { User, Shield, Building, Link, ChevronRight, Activity, Handshake, Layers, Server } from '../ui/Icons';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { hasPermission } from '../../utils/permissions';
import { motion, AnimatePresence } from 'framer-motion';
import { ResourceType, ActionType } from '../../types';

interface SettingsLayoutProps {
    currentTab: string;
    onTabChange: (tab: string) => void;
    children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ currentTab, onTabChange, children }) => {
    const { t, user } = useStore();

    const tabs = [
        { id: 'profile', label: t('settings.profile'), icon: User },
        { id: 'activity', label: t('settings.activity'), icon: Activity },
        { id: 'security', label: t('settings.security'), icon: Shield },
        { id: 'organization', label: t('settings.organization'), icon: Building, requiredPermission: { resource: 'Settings', action: 'manage' } },
        { id: 'system', label: t('settings.system') || 'Système', icon: Server, requiredPermission: { resource: 'Settings', action: 'read' } },
        { id: 'frameworks', label: t('settings.frameworks') || 'Référentiels', icon: Layers, requiredPermission: { resource: 'Settings', action: 'manage' } },
        { id: 'partners', label: t('settings.partners'), icon: Handshake, requiredPermission: { resource: 'Settings', action: 'manage' } },
        { id: 'integrations', label: t('settings.integrations'), icon: Link },
        { id: 'agents', label: 'Agents', icon: Server },
    ];

    const visibleTabs = tabs.filter(tab => !tab.requiredPermission || hasPermission(user, tab.requiredPermission.resource as ResourceType, tab.requiredPermission.action as ActionType));

    return (
        <div className="flex flex-col lg:flex-row gap-8 relative min-h-[calc(100vh-8rem)]">
            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-72 flex-shrink-0 z-30">
                <nav className="sticky top-24 space-y-4">

                    {/* Mobile: Glass Sticky Nav */}
                    <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 sticky top-[4.5rem] z-50 pb-4 pt-2">
                        <div className="glass-premium p-1.5 rounded-2xl flex overflow-x-auto no-scrollbar gap-1 border-none shadow-apple backdrop-blur-xl snap-x">
                            {visibleTabs.map(tab => {
                                const isActive = currentTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => onTabChange(tab.id)}
                                        className={cn(
                                            "relative flex items-center whitespace-nowrap px-4 py-2 rounded-lg font-medium text-sm transition-all flex-shrink-0 select-none snap-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                                            isActive ? "text-white" : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-slate-200"
                                        )}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeTabMobile"
                                                className="absolute inset-0 bg-gradient-to-r from-brand-600 to-brand-500 rounded-lg shadow-sm"
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center">
                                            <tab.icon className={cn("w-4 h-4 mr-2", isActive ? "text-white" : "text-current opacity-70")} />
                                            {tab.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Desktop: Vertical list */}
                    <div className="hidden lg:flex flex-col gap-2">
                        <div className="glass-premium p-2 rounded-3xl border border-border/50 bg-white/40 dark:bg-slate-900/40 shadow-apple-sm backdrop-blur-md">
                            {visibleTabs.map(tab => {
                                const isActive = currentTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => onTabChange(tab.id)}
                                        className={cn(
                                            "group flex items-center w-full px-4 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all text-left relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset",
                                            isActive
                                                ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                                                : "text-slate-500 dark:text-slate-300 hover:bg-slate-50/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200"
                                        )}
                                    >
                                        <tab.icon className={cn(
                                            "w-5 h-5 mr-3 transition-colors",
                                            isActive
                                                ? "text-white"
                                                : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                                        )} />
                                        <span className="flex-1">{tab.label}</span>
                                        {!isActive && (
                                            <ChevronRight className="w-4 h-4 text-muted-foreground -ml-4 opacity-0 group-hover:opacity-70 group-hover:ml-0 transition-all duration-300" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </nav>
            </aside>

            {/* Content Area */}
            <main className="flex-1 min-w-0">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div >
    );
};
