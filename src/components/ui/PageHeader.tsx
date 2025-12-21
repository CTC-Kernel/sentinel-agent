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
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  icon,
  trustType,
  className = ''
}) => {

  return (
    <div className={`relative z-40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 min-w-0 ${className}`}>
      <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-4 duration-500">

        {/* Title Section with Icon */}
        <div className="flex items-start gap-4 sm:gap-5 min-w-0">
          {icon && (
            <div className="flex shrink-0 items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25 ring-1 ring-black/5 dark:ring-white/10 group-hover:scale-105 transition-transform duration-300 mt-1">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex flex-col gap-1.5 pt-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display text-foreground tracking-tight break-words leading-tight">
                {title}
              </h1>
              {trustType && <SecurityBadge feature={trustType} className="translate-y-[1px]" />}
            </div>
            {subtitle && (
              <p className="text-sm sm:text-base font-medium text-muted-foreground leading-relaxed max-w-3xl">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
};
