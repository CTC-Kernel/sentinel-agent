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

import { createPortal } from 'react-dom';

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
    // Lock body scroll when expanded
    React.useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isExpanded]);

    const CardContent = (
        <>
            {/* Header */}
            <div className={`px-6 py-5 border-b border-white/10 flex justify-between items-center backdrop-blur-md transition-colors duration-300 ${isExpanded ? 'bg-background/80' : 'bg-white/5 dark:bg-black/5'}`}>
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="p-2 rounded-xl bg-gradient-to-br from-white/80 to-white/40 dark:from-white/10 dark:to-white/5 shadow-sm ring-1 ring-white/20 text-brand-600 dark:text-brand-400">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-base font-bold text-foreground leading-tight tracking-tight">{title}</h3>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground font-medium mt-0.5 uppercase tracking-wider opacity-80">{subtitle}</p>
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
                            className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            aria-label={isExpanded ? "Minimize" : "Maximize"}
                        >
                            {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 relative transition-all duration-300 ${isExpanded ? 'overflow-auto p-6 custom-scrollbar bg-background/50' : 'overflow-hidden'}`}>
                <div className={`h-full ${!isExpanded ? 'bg-transparent' : ''}`}>
                    {loading ? (
                        <div className="p-6 h-full">
                            <Skeleton className="h-full w-full rounded-xl bg-black/5 dark:bg-white/5" />
                        </div>
                    ) : (
                        <div className={!isExpanded ? 'p-0 h-full' : ''}>
                            {children}
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    // Expanded View (Modal)
    if (isExpanded) {
        return createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
                    onClick={onToggleExpand}
                    aria-hidden="true"
                />

                {/* Modal Container */}
                <div
                    className="relative w-full max-w-6xl h-[85vh] glass-panel rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 dark:border-white/10 ring-1 ring-black/5"
                    role="dialog"
                    aria-modal="true"
                >
                    {CardContent}
                </div>
            </div>,
            document.body
        );
    }

    // Default View (Card)
    return (
        <div
            className={`
                glass-panel p-0 rounded-[2rem] overflow-hidden shadow-sm flex flex-col group 
                hover:shadow-apple hover:-translate-y-1 transition-all duration-300
                h-full border border-white/60 dark:border-white/10 relative
                bg-gradient-to-br from-white/40 to-white/10 dark:from-slate-900/40 dark:to-slate-900/20
                ${className}
            `}
        >
            {/* Hover Shine Effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-shine" />

            <div className="relative z-10 flex flex-col h-full">
                {CardContent}
            </div>
        </div>
    );
};

