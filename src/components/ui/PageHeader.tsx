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
            <div className="flex shrink-0 items-center justify-center w-40 h-28 sm:w-52 sm:h-36 lg:w-72 lg:h-48 xl:w-80 xl:h-56 rounded-3xl bg-slate-950 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-950 shadow-2xl shadow-slate-300/20 dark:shadow-slate-800/30 ring-2 ring-slate-200/60 dark:ring-slate-700/40 group-hover:scale-105 group-hover:shadow-3xl group-hover:-translate-y-1 transition-all duration-500 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-white/10 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-15 transition-opacity duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-200/20 via-slate-100/10 to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/8 to-transparent opacity-0 group-hover:opacity-8 transition-opacity duration-500"></div>
              <div className="absolute -inset-1 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-sm"></div>
              {icon}
            </div>
          )}
          <div className="min-w-0 flex flex-col gap-2 sm:gap-3 pt-1 sm:pt-2">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold font-display text-slate-900 dark:text-white tracking-tight break-words leading-tight drop-shadow-sm">
                {title}
              </h1>
              {trustType && <SecurityBadge feature={trustType} className="translate-y-[2px] scale-110" />}
            </div>
            {subtitle && (
              <p className="text-sm sm:text-base lg:text-lg font-medium text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl sm:max-w-3xl lg:max-w-4xl drop-shadow-xs">
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
