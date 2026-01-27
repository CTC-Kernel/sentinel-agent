import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { LucideIcon } from '../ui/Icons';

export interface EmptyStateProps {
    image?: string;
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
    color?: 'slate' | 'blue' | 'indigo' | 'rose' | 'amber' | 'emerald';
    className?: string;
}

export const EmptyState = ({
    image,
    icon: Icon,
    title,
    description,
    action,
    color = 'slate',
    className
}: EmptyStateProps) => {
    const colorStyles = {
        slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 dark:bg-slate-800 dark:text-slate-400',
        blue: 'bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400',
        indigo: 'bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400',
        rose: 'bg-error-bg text-error-text',
        amber: 'bg-warning-bg text-warning-text',
        emerald: 'bg-success-bg text-success-text',
    };

    return (
        <div className={cn(
            "glass-panel flex flex-col items-center justify-center p-8 text-center min-h-[400px]",
            className
        )}>
            {image && !Icon && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="mb-6 relative"
                >
                    <div className="absolute inset-0 bg-brand-primary/20 blur-[50px] rounded-full transform scale-75" />
                    <img
                        src={image}
                        alt={title}
                        className="w-48 h-48 object-contain relative z-10 drop-shadow-2xl"
                    />
                </motion.div>
            )}

            {Icon && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="mb-6 relative"
                >
                    <div className={cn(
                        "w-20 h-20 rounded-4xl flex items-center justify-center shadow-sm backdrop-blur-sm",
                        colorStyles[color]
                    )}>
                        <Icon className="w-10 h-10" />
                    </div>
                </motion.div>
            )}

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
            >
                <h3 className="text-xl font-medium text-foreground mb-2">
                    {title}
                </h3>

                <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm leading-relaxed">
                    {description}
                </p>

                {action && (
                    <div className="mt-2">
                        {action}
                    </div>
                )}
            </motion.div>
        </div>
    );
};
