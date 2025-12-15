import React from 'react';
import { User, Shield, Building, Link, Server } from '../ui/Icons';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { hasPermission } from '../../utils/permissions';


interface SettingsLayoutProps {
    currentTab: string;
    onTabChange: (tab: string) => void;
    children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ currentTab, onTabChange, children }) => {
    const { t, user } = useStore();


    const tabs = [
        { id: 'profile', label: t('settings.profile'), icon: User },
        { id: 'security', label: t('settings.security'), icon: Shield },
        { id: 'organization', label: t('settings.organization'), icon: Building, requiredPermission: { resource: 'Settings', action: 'manage' } },
        { id: 'integrations', label: t('settings.integrations'), icon: Link },
        { id: 'system', label: t('settings.systemAndLogs'), icon: Server, requiredPermission: { resource: 'Settings', action: 'read' } },
    ];

    const visibleTabs = tabs.filter(tab => !tab.requiredPermission || hasPermission(user, tab.requiredPermission.resource as any, tab.requiredPermission.action as any));

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-8rem)]">
            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-64 flex-shrink-0">
                <nav className="sticky top-24 space-y-1">
                    {/* Mobile: Horizontal scrollable tabs */}
                    <div className="lg:hidden flex overflow-x-auto pb-4 gap-2 no-scrollbar">
                        {visibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={cn(
                                    "flex items-center whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-sm transition-all",
                                    currentTab === tab.id
                                        ? "bg-brand-600 text-white shadow-lg shadow-brand-500/20"
                                        : "bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                                )}
                            >
                                <tab.icon className={cn("w-4 h-4 mr-2", currentTab === tab.id ? "text-white" : "text-slate-500")} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Desktop: Vertical list */}
                    <div className="hidden lg:flex flex-col gap-2">
                        {visibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={cn(
                                    "flex items-center w-full px-4 py-3 rounded-2xl font-bold text-sm transition-all text-left group relative overflow-hidden",
                                    currentTab === tab.id
                                        ? "bg-white dark:bg-white/10 text-brand-600 dark:text-white shadow-sm ring-1 ring-border"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                                )}
                            >
                                {currentTab === tab.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-600 rounded-l-2xl" />
                                )}
                                <tab.icon className={cn(
                                    "w-5 h-5 mr-3 transition-colors",
                                    currentTab === tab.id ? "text-brand-600 dark:text-brand-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                                )} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </nav>
            </aside>

            {/* Content Area */}
            <main className="flex-1 min-w-0">
                {children}
            </main>
        </div>
    );
};
