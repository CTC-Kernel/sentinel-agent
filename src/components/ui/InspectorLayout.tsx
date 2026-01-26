import React from 'react';
import { Drawer } from './Drawer';
import { ScrollableTabs } from './ScrollableTabs';
import { LucideIcon } from './Icons';

interface TabItem {
    id: string;
    label: string;
    icon?: LucideIcon;
    badge?: number | string;
}

interface InspectorLayoutProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: LucideIcon;
    statusBadge?: React.ReactNode;
    width?: string;
    actions?: React.ReactNode;
    tabs?: TabItem[];
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
    children: React.ReactNode;
    loading?: boolean;
    breadcrumbs?: { label: string; onClick?: () => void }[];
    disableFocusTrap?: boolean;
    footer?: React.ReactNode;
    disableContentPadding?: boolean;
    disableContentScroll?: boolean;
    hasUnsavedChanges?: boolean;
}

export const InspectorLayout: React.FC<InspectorLayoutProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon: Icon,
    statusBadge,
    width = 'max-w-6xl',
    actions,
    tabs = [],
    activeTab,
    onTabChange,
    children,
    loading = false,
    breadcrumbs,
    disableFocusTrap = true,
    footer,
    disableContentPadding = false,
    disableContentScroll = false,
    hasUnsavedChanges = false // Default to false
}) => {
    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            width={width}
            breadcrumbs={breadcrumbs}
            disableFocusTrap={disableFocusTrap}
            disableScroll={true}
            hasUnsavedChanges={hasUnsavedChanges}
            title={
                <div className="flex items-center gap-3 relative z-10">
                    {Icon && (
                        <div className="p-2.5 bg-brand-500/10 dark:bg-brand-500/20 rounded-xl text-slate-700 dark:text-brand-400 shadow-sm border border-brand-500/20 dark:border-brand-500/30">
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-slate-100">{title}</span>
                            {statusBadge}
                        </div>
                    </div>
                </div>
            }
            subtitle={<div className="relative z-10">{subtitle}</div>}
            actions={<div className="relative z-10">{actions}</div>}
        >
            <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
                {/* Header Background Pattern */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-brand-500/5 to-transparent pointer-events-none z-0" />


                {/* Sticky Tabs Header */}
                {tabs.length > 0 && onTabChange && (
                    <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/60 dark:border-white/10 px-6 pt-2 supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-slate-900/80 supports-[backdrop-filter]:backdrop-blur-md">
                        <ScrollableTabs
                            tabs={tabs}
                            activeTab={activeTab || tabs[0].id}
                            onTabChange={onTabChange}
                            className="w-full"
                        />
                    </div>
                )}

                {/* Content Area */}
                <div className={`flex-1 ${disableContentScroll ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} ${disableContentPadding ? '' : 'px-6 py-8'}`}>
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                        </div>
                    ) : (
                        <div key={activeTab} className="animate-in fade-in duration-300 slide-in-from-bottom-2 h-full">
                            {children}
                        </div>
                    )}
                </div>

                {/* Sticky Footer */}
                {footer && (
                    <div className="p-6 border-t border-slate-200/60 dark:border-white/5 bg-white/95 dark:bg-slate-900/95 shrink-0 supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-slate-900/80 supports-[backdrop-filter]:backdrop-blur-md">
                        {footer}
                    </div>
                )}
            </div>
        </Drawer>
    );
};
