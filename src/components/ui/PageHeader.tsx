import React from 'react';
import { SecurityBadge, SecurityFeature } from './SecurityBadge';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
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
      {/* Background Glow Effect - subtle ambiance */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none opacity-50 mix-blend-screen" />

      <div className={`
        relative flex flex-col gap-6
        ${compact ? 'py-2' : 'py-4 lg:py-6'}
        border-b border-[color:var(--glass-border)]
      `}>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          {/* Left section: Icon + Title */}
          <div className="flex items-center gap-6 sm:gap-8 min-w-0 flex-1 group/header">

            {/* Icon container - Premium Glass Design */}
            {icon && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={`
                  relative flex shrink-0 items-center justify-center
                  ${compact ? 'w-24 h-24 rounded-2xl' : 'w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 rounded-5xl'}
                  bg-white/60 dark:bg-slate-950/40 backdrop-blur-2xl
                  shadow-2xl shadow-black/5 dark:shadow-black/20
                  ring-1 ring-[color:var(--glass-border)]
                  overflow-hidden
                  transition-all duration-500 ease-out
                  hover:scale-[1.02] hover:shadow-primary/5 hover:ring-primary/20
                `}
              >
                {/* Dynamic Glass Reflections */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-transparent to-transparent opacity-50" />
                <div className="absolute -inset-[100%] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-10 animate-[spin_8s_linear_infinite]" style={{ animationDuration: '20s' }} />

                {/* Inner Bevel */}
                <div className="absolute inset-[1px] rounded-[inherit] bg-white/20 dark:bg-black/40 backdrop-blur-md" />

                {/* Icon Content */}
                <div className={`
                  relative z-10 flex items-center justify-center h-full w-full p-6
                  ${compact ? '[&>svg]:w-12 [&>svg]:h-12' : '[&>svg]:w-24 [&>svg]:h-24 sm:[&>svg]:w-28 sm:[&>svg]:h-28'}
                  [&>svg]:stroke-[1.5]
                  [&>img]:w-full [&>img]:h-full [&>img]:object-contain [&>img]:drop-shadow-2xl
                  text-slate-900 dark:text-white
                  transition-transform duration-500 group-hover/header:scale-110 group-hover/header:rotate-[-4deg]
                `}>
                  {icon}
                </div>
              </motion.div>
            )}

            {/* Text Content */}
            <div className="min-w-0 flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className={`
                  ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl lg:text-5xl'}
                  font-bold font-display tracking-tight leading-none
                  text-slate-900 dark:text-white
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
                  text-slate-600 dark:text-slate-300/90 leading-relaxed max-w-2xl font-light tracking-wide
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
