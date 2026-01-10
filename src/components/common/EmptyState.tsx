import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

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
        slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        blue: 'bg-blue-50 dark:bg-slate-900 text-blue-600 dark:bg-slate-900/20 dark:text-blue-400',
        indigo: 'bg-indigo-50 dark:bg-slate-900 text-indigo-600 dark:bg-slate-900/20 dark:text-indigo-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    };

    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-8 text-center min-h-[400px]",
            "rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm",
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
                        "w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-sm border border-white/60 dark:border-white/5 backdrop-blur-sm",
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
                <h3 className="text-xl font-medium text-white mb-2">
                    {title}
                </h3>

                <p className="text-slate-400 max-w-md mx-auto mb-6 text-sm leading-relaxed">
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
