import React from 'react';
import { LucideIcon } from './Icons';
import { motion, TargetAndTransition } from 'framer-motion';
import { appleEasing } from '../../utils/microInteractions';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    /** @deprecated Use 'semantic' prop instead for design token compliance */
    color?: 'slate' | 'blue' | 'indigo' | 'rose' | 'amber' | 'emerald';
    /** Semantic color using design tokens */
    semantic?: 'neutral' | 'info' | 'primary' | 'error' | 'warning' | 'success';
    compact?: boolean;
    className?: string;
}

// Floating animation for the icon
const floatingAnimation: TargetAndTransition = {
    y: [0, -8, 0],
    transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut'
    }
};

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({ icon: Icon, title, description, actionLabel, onAction, color = 'slate', semantic, compact = false, className = '' }) => {
    // Legacy color mapping (deprecated)
    const legacyColorStyles = {
        slate: 'bg-muted text-muted-foreground',
        blue: 'bg-info-bg text-info-text',
        indigo: 'bg-primary/10 text-primary',
        rose: 'bg-error-bg text-error-text',
        amber: 'bg-warning-bg text-warning-text',
        emerald: 'bg-success-bg text-success-text',
    };

    // Semantic color mapping using design tokens
    const semanticColorStyles = {
        neutral: 'bg-muted text-muted-foreground',
        info: 'bg-info-bg text-info-text',
        primary: 'bg-primary/10 text-primary',
        error: 'bg-error-bg text-error-text',
        warning: 'bg-warning-bg text-warning-text',
        success: 'bg-success-bg text-success-text',
    };

    // Use semantic if provided, otherwise fall back to legacy color
    const colorStyle = semantic
        ? semanticColorStyles[semantic]
        : legacyColorStyles[color];

    if (compact) {
        return (
            <motion.div
                className="flex flex-col items-center justify-center p-6 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: appleEasing }}
            >
                <motion.div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-elevation-xs border border-white/60 dark:border-white/5 backdrop-blur-sm ${colorStyle}`}
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
                className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-elevation-sm border border-white/60 dark:border-white/5 backdrop-blur-sm ${colorStyle}`}
                variants={{
                    hidden: { scale: 0, rotate: -180 },
                    visible: { scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 200, damping: 15 } }
                }}
                animate={floatingAnimation}
            >
                <Icon className="w-10 h-10" />
            </motion.div>
            <motion.h3
                className="text-xl font-bold font-display text-foreground mb-2 tracking-tight"
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
                    className="px-8 py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-elevation-md shadow-primary hover:shadow-elevation-lg hover:shadow-primary transition-all duration-normal ease-apple focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background"
                    variants={{
                        hidden: { opacity: 0, y: 20, scale: 0.9 },
                        visible: { opacity: 1, y: 0, scale: 1, transition: { ease: appleEasing } }
                    }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {actionLabel}
                </motion.button>
            )}
        </motion.div>
    );
});

EmptyState.displayName = 'EmptyState';
