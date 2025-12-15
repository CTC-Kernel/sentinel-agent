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
            <div className={`px-6 py-5 border-b border-border/60 flex justify-between items-start backdrop-blur-sm ${isExpanded ? 'bg-background' : 'bg-background/50'}`}>
                <div className="flex items-start gap-4">
                    {icon && (
                        <div className="p-2.5 bg-background rounded-xl shadow-sm text-muted-foreground ring-1 ring-border/60">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-base font-bold text-foreground leading-tight">{title}</h3>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-wider">{subtitle}</p>
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
                            className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                            aria-label={isExpanded ? "Minimize" : "Maximize"}
                        >
                            {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 relative ${isExpanded ? 'overflow-auto p-6 custom-scrollbar' : 'overflow-hidden p-0'}`}>
                <div className={`h-full ${!isExpanded ? 'bg-card/40' : ''}`}>
                    {loading ? <Skeleton className="h-full w-full" /> : children}
                </div>
            </div>
        </>
    );

    // Expanded View (Modal)
    if (isExpanded) {
        return createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onToggleExpand}
                    aria-hidden="true"
                />

                {/* Modal Container */}
                <div
                    className="relative w-full max-w-6xl h-[85vh] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10"
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
                glass-panel p-0 rounded-[2rem] overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-all duration-300
                h-full bg-card/40 backdrop-blur-md
                ${className}
            `}
        >
            {CardContent}
        </div>
    );
};
