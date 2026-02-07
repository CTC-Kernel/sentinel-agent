import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { slideUpVariants } from './animationVariants';

export interface SmartInsight {
    label: string;
    value: string | number;
    subValue?: string;
    icon: React.ReactNode;
    trend?: {
        value: number;
        label: string;
        isPositive: boolean;
    };
    variant?: 'primary' | 'secondary' | 'warning' | 'destructive' | 'success';
}

interface SmartSummaryProps {
    insights: SmartInsight[];
    className?: string;
    loading?: boolean;
}

export const SmartSummary: React.FC<SmartSummaryProps> = ({
    insights,
    className,
    loading = false
}) => {
    const variantStyles = {
        primary: 'border-primary/20 bg-primary/5 text-primary shadow-primary/5',
        secondary: 'border-secondary/20 bg-secondary/5 text-secondary shadow-secondary/5',
        warning: 'border-warning/20 bg-warning/5 text-warning shadow-warning/5',
        destructive: 'border-destructive/20 bg-destructive/5 text-destructive shadow-destructive/5',
        success: 'border-success/20 bg-success/5 text-success shadow-success/5'
    };

    if (loading) {
        return (
            <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8", className)}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={`skeleton-${i}`} className="h-24 rounded-3xl bg-muted/20 animate-pulse border border-border/40" />
                ))}
            </div>
        );
    }

    return (
        <motion.div
            variants={slideUpVariants}
            className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8", className)}
        >
            {insights.map((insight) => (
                <motion.div
                    key={insight.label}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className={cn(
                        "glass-premium border rounded-3xl p-5 relative overflow-hidden group transition-all duration-300",
                        variantStyles[insight.variant || 'primary']
                    )}
                >
                    {/* Background Glow */}
                    <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-current opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />

                    <div className="flex justify-between items-start relative z-10">
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
                                {insight.label}
                            </p>
                            <h4 className="text-2xl font-black tracking-tight text-foreground">
                                {insight.value}
                            </h4>
                            {insight.subValue && (
                                <p className="text-xs font-semibold text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
                                    {insight.subValue}
                                </p>
                            )}
                        </div>
                        <div className="p-2.5 rounded-2xl bg-white/10 dark:bg-black/10 shadow-inner group-hover:scale-110 transition-transform">
                            {insight.icon}
                        </div>
                    </div>

                    {insight.trend && (
                        <div className="mt-4 flex items-center gap-1.5 relative z-10">
                            <span className={cn(
                                "text-xs font-bold px-2 py-0.5 rounded-full",
                                insight.trend.isPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                            )}>
                                {insight.trend.value > 0 ? '+' : ''}{insight.trend.value}%
                            </span>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                {insight.trend.label}
                            </span>
                        </div>
                    )}
                </motion.div>
            ))}
        </motion.div>
    );
};
