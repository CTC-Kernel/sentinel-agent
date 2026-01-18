import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { appleEasing } from '../../utils/microInteractions';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    color?: 'slate' | 'blue' | 'indigo' | 'rose' | 'amber' | 'emerald';
    compact?: boolean;
    className?: string;
}

// Floating animation for the icon
const floatingAnimation = {
    y: [0, -8, 0],
    transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut'
    }
};

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({ icon: Icon, title, description, actionLabel, onAction, color = 'slate', compact = false, className = '' }) => {
    const colorStyles = {
        slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    };

    if (compact) {
        return (
            <motion.div
                className="flex flex-col items-center justify-center p-6 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: appleEasing }}
            >
                <motion.div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm border border-white/60 dark:border-white/5 backdrop-blur-sm ${colorStyles[color]}`}
                    animate={floatingAnimation}
                >
                    <Icon className="w-5 h-5" />
                </motion.div>
                <h3 className="text-sm font-bold text-foreground mb-1 tracking-tight">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">{description}</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            className={`flex flex-col items-center justify-center p-12 text-center ${className}`}
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
            }}
        >
            <motion.div
                className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-white/60 dark:border-white/5 backdrop-blur-sm ${colorStyles[color]}`}
                variants={{
                    hidden: { scale: 0, rotate: -180 },
                    visible: { scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 200, damping: 15 } }
                }}
                animate={floatingAnimation}
            >
                <Icon className="w-10 h-10" />
            </motion.div>
            <motion.h3
                className="text-xl font-bold text-foreground mb-2 tracking-tight"
                variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { ease: appleEasing } }
                }}
            >
                {title}
            </motion.h3>
            <motion.p
                className="text-muted-foreground max-w-md mb-8 leading-relaxed font-medium"
                variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { ease: appleEasing } }
                }}
            >
                {description}
            </motion.p>
            {actionLabel && onAction && (
                <motion.button
                    onClick={onAction}
                    aria-label={actionLabel}
                    className="px-8 py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                    variants={{
                        hidden: { opacity: 0, y: 20, scale: 0.9 },
                        visible: { opacity: 1, y: 0, scale: 1, transition: { ease: appleEasing } }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {actionLabel}
                </motion.button>
            )}
        </motion.div>
    );
});

EmptyState.displayName = 'EmptyState';
