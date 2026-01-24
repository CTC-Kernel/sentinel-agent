import React from 'react';
import { TechCorner } from '../ui/TechCorner';
import { GlassCard } from '../ui/GlassCard';
import { Maximize2, Minimize2 } from '../ui/Icons';
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

    // Tier system for visual hierarchy
    tier?: 'standard' | 'featured' | 'hero';
}

/**
 * Tier-based styling for visual hierarchy
 */
const TIER_STYLES = {
    standard: '',
    featured: 'ring-1 ring-primary/10 shadow-apple-md',
    hero: 'ring-2 ring-primary/20 shadow-glow',
};

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
    expandable = false,
    tier = 'standard'
}) => {
    const tierStyle = TIER_STYLES[tier];
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
            <div className={`px-4 py-4 md:px-6 md:py-5 border-b border-muted/30 flex justify-between items-center backdrop-blur-md transition-colors duration-300 ${isExpanded ? 'bg-background/80' : 'bg-muted/10'}`}>
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="p-2 rounded-xl bg-primary/10 shadow-sm ring-1 ring-primary/20 text-primary">
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
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onToggleExpand();
                                }
                            }}
                            className="p-2.5 hover:bg-muted/50 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                            aria-label={isExpanded ? "Réduire la carte" : "Agrandir la carte"}
                            aria-expanded={isExpanded}
                            role="button"
                            tabIndex={0}
                        >
                            {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 relative transition-all duration-300 ${isExpanded ? 'overflow-auto p-4 md:p-6 custom-scrollbar bg-background/50' : 'overflow-hidden'}`}>
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
            <div className="fixed inset-0 z-max flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
                    onClick={onToggleExpand}
                    aria-hidden="true"
                />

                {/* Modal Container */}
                <div
                    className="relative w-full max-w-6xl h-[85vh] glass-panel rounded-5xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-muted ring-1 ring-black/5"
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
        <GlassCard
            className={`
                p-0 flex flex-col group h-full relative
                ${tierStyle}
                ${className}
            `}
            hoverEffect={true}
        >
            {/* Tech Corners */}
            <TechCorner position="top-left" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="top-right" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="bottom-left" className="opacity-0 group-hover:opacity-100" />
            <TechCorner position="bottom-right" className="opacity-0 group-hover:opacity-100" />

            {/* Hover Shine Effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-shine" />

            <div className="relative z-10 flex flex-col h-full">
                {CardContent}
            </div>
        </GlassCard>
    );
};

