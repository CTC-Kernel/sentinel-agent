import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, PieChart, LineChart, Activity, Plus, Lightbulb } from './Icons';
import { useStore } from '../../store';

interface EmptyChartStateProps {
    className?: string;
    message?: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: React.ReactNode;
    variant?: 'bar' | 'line' | 'pie' | 'radar' | 'default';
    /** Contextual tip explaining why the chart is empty or what data is needed */
    tip?: string;
}

export const EmptyChartState: React.FC<EmptyChartStateProps> = ({
    className = "",
    message,
    description,
    actionLabel,
    onAction,
    icon,
    variant = 'default',
    tip
}) => {
    const { t } = useStore();

    const displayMessage = message || t('common.emptyChart.noData');
    const displayDescription = description || t('common.emptyChart.addData');

    const getIcon = () => {
        if (icon) return icon;
        switch (variant) {
            case 'bar': return <BarChart3 className="w-12 h-12 text-muted-foreground/70" />;
            case 'pie': return <PieChart className="w-12 h-12 text-muted-foreground/70" />;
            case 'line': return <LineChart className="w-12 h-12 text-muted-foreground/70" />;
            case 'radar': return <Activity className="w-12 h-12 text-muted-foreground/70" />;
            default: return <BarChart3 className="w-12 h-12 text-muted-foreground/70" />;
        }
    };

    return (
        <div className={`h-full w-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center ${className}`}>
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative mb-6"
            >
                {/* Background decorative elements */}
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/20 to-purple-500/20 rounded-full blur-2xl animate-pulse-slow" />

                <div className="relative bg-card/50 backdrop-blur-sm p-6 rounded-full border border-border/50 shadow-inner group">
                    <motion.div
                        animate={{
                            y: [0, -5, 0],
                            rotate: [0, 5, 0, -5, 0]
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        {getIcon()}
                    </motion.div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="max-w-md space-y-2"
            >
                <h4 className="text-lg font-semibold text-foreground tracking-tight">
                    {displayMessage}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {displayDescription}
                </p>
            </motion.div>

            {actionLabel && onAction && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="mt-6"
                >
                    <button
                        onClick={onAction}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                    >
                        <Plus className="w-4 h-4" />
                        {actionLabel}
                    </button>
                </motion.div>
            )}

            {tip && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="mt-6 flex items-start gap-2 max-w-sm p-3 rounded-lg bg-info-bg/50 border border-info-border/30"
                >
                    <Lightbulb className="w-4 h-4 text-info-text flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-info-text leading-relaxed">{tip}</p>
                </motion.div>
            )}
        </div>
    );
};
