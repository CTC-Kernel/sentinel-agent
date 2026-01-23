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
    <div className={`relative z-40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-8 min-w-0 ${className}`}>
      <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-4 duration-500">

        {/* Title Section with Icon */}
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          {icon && (
            <div className="flex shrink-0 items-center justify-center w-48 h-32 sm:w-64 sm:h-40 lg:w-80 lg:h-52 rounded-5xl bg-slate-950 dark:bg-slate-900 shadow-2xl ring-1 ring-white/10 dark:ring-white/5 group-hover:scale-[1.02] group-hover:brightness-110 transition-all duration-500 relative overflow-hidden backdrop-blur-md">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent)]" />
              {icon}
            </div>
          )}
          <div className="min-w-0 flex flex-col gap-1 sm:gap-2 pt-1 sm:pt-2">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold font-display text-slate-900 dark:text-white tracking-tightest break-words leading-[1.1] drop-shadow-sm selection:bg-brand-500/30">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-[length:200%_auto] animate-shine">
                  {title}
                </span>
              </h1>
              {trustType && <SecurityBadge feature={trustType} className="translate-y-[2px] scale-110" />}
            </div>
            {subtitle && (
              <p className="text-base sm:text-lg lg:text-xl font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl sm:max-w-3xl lg:max-w-5xl tracking-tight">
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
