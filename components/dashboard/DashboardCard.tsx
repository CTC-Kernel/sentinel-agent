import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';

interface DashboardCardProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerAction?: React.ReactNode;
    loading?: boolean;

    // Expandable props
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    expandable?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
    title,
    subtitle,
    icon,
    children,
    className = '',
    headerAction,
    loading = false,
    isExpanded = false,
    onToggleExpand,
    expandable = false
}) => {
    return (
        <div
            className={`
                glass-panel p-0 rounded-[2rem] overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-all duration-300
                ${isExpanded ? 'fixed inset-4 z-50 bg-white dark:bg-slate-900 !m-0 !rounded-[1rem] shadow-2xl animate-in fade-in zoom-in-95' : 'h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-md'}
                ${className}
            `}
        >
            {/* Header */}
            <div className={`px-6 py-5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-start backdrop-blur-sm ${isExpanded ? 'bg-slate-50 dark:bg-black/20' : 'bg-slate-50/50 dark:bg-white/5'}`}>
                <div className="flex items-start gap-4">
                    {icon && (
                        <div className="p-2.5 bg-white dark:bg-white/10 rounded-xl shadow-sm text-slate-600 dark:text-slate-300 ring-1 ring-slate-900/5 dark:ring-white/10">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
                        {subtitle && (
                            <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{subtitle}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {headerAction}

                    {expandable && onToggleExpand && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpand();
                            }}
                            className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 relative ${isExpanded ? 'overflow-auto p-6 custom-scrollbar' : 'overflow-hidden p-0'}`}>
                {/* Backdrop if not expanded is handled by parent container opacity/color usually, 
                    but here we want the content area to be specific.
                */}
                <div className={`h-full ${!isExpanded ? 'bg-white/40 dark:bg-transparent' : ''}`}>
                    {loading ? <Skeleton className="h-full w-full" /> : children}
                </div>
            </div>

            {/* Overlay background for expanded mode */}
            {isExpanded && (
                <div
                    className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-[2px] -z-10"
                    onClick={onToggleExpand}
                    aria-hidden="true"
                />
            )}
        </div>
    );
};
