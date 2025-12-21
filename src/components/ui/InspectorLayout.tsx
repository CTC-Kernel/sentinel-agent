import React from 'react';
import { Drawer } from './Drawer';
import { ScrollableTabs } from './ScrollableTabs';
import { LucideIcon } from 'lucide-react';

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
    disableFocusTrap = false
}) => {
    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            width={width}
            breadcrumbs={breadcrumbs}
            disableFocusTrap={disableFocusTrap}
            title={
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-3">
                            <span>{title}</span>
                            {statusBadge}
                        </div>
                    </div>
                </div>
            }
            subtitle={subtitle}
            actions={actions}
        >
            <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
                {/* Sticky Tabs Header */}
                {tabs.length > 0 && onTabChange && (
                    <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 px-6 pt-2">
                        <ScrollableTabs
                            tabs={tabs}
                            activeTab={activeTab || tabs[0].id}
                            onTabChange={onTabChange}
                            className="w-full"
                        />
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-6 py-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in duration-300 slide-in-from-bottom-4">
                            {children}
                        </div>
                    )}
                </div>
            </div>
        </Drawer>
    );
};
