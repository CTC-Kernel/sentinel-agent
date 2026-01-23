import React from 'react';
import { SecurityBadge, SecurityFeature } from './SecurityBadge';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  trustType?: SecurityFeature;
  className?: string;
  /** Compact mode for nested pages */
  compact?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  icon,
  trustType,
  className = '',
  compact = false
}) => {

  return (
    <header className={`relative z-40 ${className}`}>
      {/* Main header container */}
      <div className={`
        flex flex-col sm:flex-row justify-between items-start sm:items-center
        gap-4 ${compact ? 'py-4' : 'py-6'}
        border-b border-slate-200/60 dark:border-white/5
      `}>
        {/* Left section: Icon + Title */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Icon container - refined and compact */}
          {icon && (
            <div className={`
              flex shrink-0 items-center justify-center
              ${compact ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-2xl'}
              bg-gradient-to-br from-slate-900 to-slate-800
              dark:from-slate-800 dark:to-slate-900
              shadow-elevation-md ring-1 ring-white/10
              transition-all duration-normal ease-apple
              hover:shadow-elevation-lg hover:scale-[1.02]
            `}>
              <div className="text-white">
                {icon}
              </div>
            </div>
          )}

          {/* Title block */}
          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className={`
                ${compact ? 'text-xl' : 'text-2xl sm:text-[1.75rem]'}
                font-bold font-display text-foreground
                tracking-tight leading-tight
              `}>
                {title}
              </h1>
              {trustType && (
                <SecurityBadge
                  feature={trustType}
                  className={compact ? 'scale-90' : ''}
                />
              )}
            </div>
            {subtitle && (
              <p className={`
                ${compact ? 'text-sm' : 'text-sm sm:text-base'}
                text-muted-foreground leading-relaxed
                max-w-2xl
              `}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Actions section */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};
