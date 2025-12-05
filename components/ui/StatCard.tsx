import React from 'react';
import { TrendingUp, TrendingDown, Minus } from './Icons';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: any;
    trend?: {
        value: number;
        label: string;
    };
    colorClass: string;
    onClick?: () => void;
    loading?: boolean;
    sparklineData?: number[];
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    colorClass,
    onClick,
    loading = false,
    sparklineData
}) => {
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
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 ring-slate-200 dark:ring-slate-700';
    };

    return (
        <div
            onClick={onClick}
            className={`relative group glass-panel p-6 rounded-[2rem] hover:shadow-apple transition-all duration-500 hover:-translate-y-1 overflow-hidden border border-white/60 dark:border-white/5 ${onClick ? 'cursor-pointer' : ''}`}
        >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>

            <div className="flex flex-col h-full justify-between relative z-10">
                {/* Header with icon and trend */}
                <div className="flex justify-between items-start mb-6">
                    <div className={`p-3.5 rounded-[1.2rem] ${colorClass} bg-opacity-10 ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm group-hover:scale-110 transition-transform duration-500`}>
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
                        <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse mb-2"></div>
                    ) : (
                        <h3 className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-white font-display">
                            {value}
                        </h3>
                    )}
                    <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mt-1 tracking-wide">
                        {title}
                    </p>
                </div>

                {/* Sparkline (optional) */}
                {sparklineData && sparklineData.length > 0 && (
                    <div className="mt-4 h-8 flex items-end gap-0.5">
                        {sparklineData.map((val, idx) => {
                            const maxVal = Math.max(...sparklineData);
                            const height = (val / maxVal) * 100;
                            return (
                                <div
                                    key={idx}
                                    className={`flex-1 rounded-t ${colorClass} opacity-30 transition-all hover:opacity-60`}
                                    style={{ height: `${height}%` }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
