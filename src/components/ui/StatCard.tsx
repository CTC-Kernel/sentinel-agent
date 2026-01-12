import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from './Icons';
import { cn } from '../../lib/utils';

type StatCardIconComponent = React.ElementType<{ className?: string; strokeWidth?: number }>;

interface StatCardProps {
    title: string;
    value: string | number;
    icon: StatCardIconComponent;
    trend?: {
        value: number;
        label: string;
    };
    colorClass: string;
    onClick?: () => void;
    loading?: boolean;
    sparklineData?: number[];
    /** Aria label for accessibility when card is clickable */
    ariaLabel?: string;
}

export const StatCard: React.FC<StatCardProps> = React.memo(({
    title,
    value,
    icon: Icon,
    trend,
    colorClass,
    onClick,
    loading = false,
    sparklineData,
    ariaLabel
}) => {
    // Keyboard handler for accessibility
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    const isInteractive = !!onClick;
    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend.value > 0) return <TrendingUp className="h-3 w-3" />;
        if (trend.value < 0) return <TrendingDown className="h-3 w-3" />;
        return <Minus className="h-3 w-3" />;
    };

    const getTrendColor = () => {
        if (!trend) return '';
        if (trend.value > 0) return 'text-success-text bg-success-bg ring-success-border/50';
        if (trend.value < 0) return 'text-error-text bg-error-bg ring-error-border/50';
        return 'text-slate-600 dark:text-slate-400 bg-slate-500/10 dark:bg-white/5 ring-slate-500/20 dark:ring-white/10';
    };

    return (
        <motion.div
            variants={{
                initial: { opacity: 0, y: 20, filter: 'blur(8px)' },
                in: { opacity: 1, y: 0, filter: 'blur(0px)' }
            }}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            tabIndex={isInteractive ? 0 : undefined}
            role={isInteractive ? 'button' : undefined}
            aria-label={isInteractive ? (ariaLabel || `Voir les détails: ${title}`) : undefined}
            className={cn(
                'relative group p-6 rounded-4xl border transition-all duration-500 overflow-hidden',
                'glass-premium',
                'hover:shadow-apple-xl dark:hover:shadow-brand-900/20',
                'hover:-translate-y-1',
                isInteractive && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'
            )}
        >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex flex-col h-full justify-between relative z-10">
                {/* Header with icon and trend */}
                <div className="flex justify-between items-start mb-6">
                    <div className={`p-3.5 rounded-2xl ${colorClass} bg-opacity-10 ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                        <Icon className={`h-6 w-6 ${colorClass.replace('bg-', 'text-')}`} strokeWidth={2} />
                    </div>

                    {trend && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset shadow-sm ${getTrendColor()}`}>
                            {getTrendIcon()}
                            {Math.abs(trend.value)}% {trend.label}
                        </span>
                    )}
                </div>

                {/* Value and title */}
                <div>
                    {loading ? (
                        <div className="h-10 w-24 bg-slate-200/50 dark:bg-white/5 rounded-xl animate-pulse mb-2"></div>
                    ) : (
                        <h3 className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-white font-display">
                            {value}
                        </h3>
                    )}
                    <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 mt-1 tracking-wide uppercase">
                        {title}
                    </p>
                </div>

                {/* Sparkline (optional) */}
                {sparklineData && sparklineData.length > 0 && (
                    <div className="mt-4 h-8 flex items-end gap-0.5">
                        {(() => {
                            const data = sparklineData;
                            const maxVal = Math.max(...data);
                            return data.map((val, idx) => {
                                const height = (val / maxVal) * 100;
                                return (
                                    <div
                                        key={`spark-${idx}`}
                                        className={`flex-1 rounded-t ${colorClass} opacity-30 transition-all hover:opacity-60`}
                                        style={{ height: `${height}%` }}
                                    />
                                );
                            });
                        })()}
                    </div>
                )}
            </div>
        </motion.div>
    );
});

StatCard.displayName = 'StatCard';
