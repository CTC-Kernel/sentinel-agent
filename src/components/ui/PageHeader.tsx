import React from 'react';
import { Link } from 'react-router-dom';
import { SecurityBadge, SecurityFeature } from './SecurityBadge';
import { motion } from 'framer-motion';
import { ChevronRight } from './Icons';
import { useLocale } from '../../hooks/useLocale';

interface Breadcrumb {
    label: string;
    path?: string;
}

export interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    icon?: React.ReactNode;
    trustType?: SecurityFeature;
    className?: string;
    /** Compact mode for nested pages */
    compact?: boolean;
    /** Breadcrumbs for navigation (optional, rendered externally) */
    breadcrumbs?: Breadcrumb[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    actions,
    icon,
    trustType,
    className = '',
    compact = false,
    breadcrumbs,
}) => {
    const { t } = useLocale();

    return (
        <header className={`relative z-40 ${className}`}>
            {/* Background Glow Effect - subtle ambiance */}
            <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none opacity-60 mix-blend-screen" />

            <div className={`
 relative flex flex-col gap-6
 ${compact ? 'py-2' : 'py-4 lg:py-6'}
 border-b border-border/40
 `}>

                {/* Breadcrumbs */}
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav aria-label={t('ui.pageHeader.breadcrumbNav', { defaultValue: "Fil d'Ariane" })} className="flex items-center gap-1 text-sm text-muted-foreground">
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={crumb.label}>
                                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                {crumb.path ? (
                                    <Link
                                        to={crumb.path}
                                        className="font-medium hover:text-foreground transition-colors truncate max-w-[200px]"
                                    >
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    <span className="font-semibold text-foreground truncate max-w-[200px]">
                                        {crumb.label}
                                    </span>
                                )}
                            </React.Fragment>
                        ))}
                    </nav>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    {/* Left section: Icon + Title */}
                    <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 min-w-0 flex-1 group/header">

                        {/* Icon container - Premium Glass Design */}
                        {icon && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                className={`
  relative flex shrink-0 items-center justify-center
  ${compact ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl' : 'w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-[2rem] lg:rounded-[2.5rem]'}
  bg-card/50 backdrop-blur-2xl
  shadow-2xl shadow-black/5 dark:shadow-black/20
  ring-1 ring-border/40
  overflow-hidden
  transition-all duration-500 ease-out
  hover:scale-[1.02] hover:shadow-primary/10 hover:ring-primary/30
 `}
                            >
                                {/* Prismatic Shimmer Effect */}
                                <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,var(--primary)_360deg)] opacity-20 dark:opacity-40 animate-[spin_10s_linear_infinite]" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.4),transparent_70%)] opacity-50 contrast-125" />

                                {/* Inner Glow/Border refinement */}
                                <div className="absolute inset-[1px] rounded-[inherit] bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-10" />
                                <div className="absolute inset-[1px] rounded-[inherit] bg-card/40 backdrop-blur-xl" />

                                {/* Icon Content */}
                                <div className={`
  relative z-decorator flex items-center justify-center h-full w-full p-3 sm:p-4 lg:p-6
  ${compact ? '[&>svg]:w-10 [&>svg]:h-10 sm:[&>svg]:w-12 sm:[&>svg]:h-12' : '[&>svg]:w-12 [&>svg]:h-12 sm:[&>svg]:w-16 sm:[&>svg]:h-16 md:[&>svg]:w-20 md:[&>svg]:h-20 lg:[&>svg]:w-24 lg:[&>svg]:h-24'}
  [&>svg]:stroke-[1.25]
  [&>img]:w-full [&>img]:h-full [&>img]:object-contain [&>img]:drop-shadow-[0_10px_20px_rgba(0,0,0,0.2)]
  text-foreground/90
  transition-transform duration-700 group-hover/header:scale-110 group-hover/header:rotate-[-3deg]
 `}>
                                    {icon}
                                </div>
                            </motion.div>
                        )}

                        {/* Text Content */}
                        <div className="min-w-0 flex flex-col gap-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className={`
  ${compact ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl'}
  font-bold font-display tracking-tight leading-none
  text-foreground
  drop-shadow-sm dark:drop-shadow-lg
 `}>
                                    {title}
                                </h1>

                                {trustType && (
                                    <SecurityBadge
                                        feature={trustType}
                                        className="shadow-lg shadow-black/5 dark:shadow-black/20"
                                    />
                                )}
                            </div>

                            {subtitle && (
                                <p className={`
  ${compact ? 'text-sm' : 'text-base sm:text-lg'}
  text-muted-foreground/90 leading-relaxed max-w-2xl font-light tracking-wide
 `}>
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Actions section */}
                    {actions && (
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto shrink-0 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-backwards" style={{ animationDelay: '100ms' }}>
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
