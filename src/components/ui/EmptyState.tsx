import React from 'react';
import { LucideIcon, Lightbulb, ArrowRight } from './Icons';
import { motion, TargetAndTransition } from 'framer-motion';
import { appleEasing } from '../../utils/microInteractions';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    /** Secondary action for alternative path */
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    /** Contextual tip to help user understand next steps */
    tip?: string;
    /** Quick steps to get started */
    quickSteps?: string[];
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

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({ icon: Icon, title, description, actionLabel, onAction, secondaryActionLabel, onSecondaryAction, tip, quickSteps, color = 'slate', semantic, compact = false, className = '' }) => {
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
                className={`w-20 h-20 rounded-4xl flex items-center justify-center mb-6 shadow-elevation-sm border border-white/60 dark:border-white/5 backdrop-blur-sm ${colorStyle}`}
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
                className="text-muted-foreground max-w-md mb-6 leading-relaxed font-medium"
                variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { ease: appleEasing } }
                }}
            >
                {description}
            </motion.p>

            {/* Quick steps guide */}
            {quickSteps && quickSteps.length > 0 && (
                <motion.div
                    className="mb-6 text-left w-full max-w-sm"
                    variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0, transition: { ease: appleEasing } }
                    }}
                >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pour commencer</p>
                    <ol className="space-y-2">
                        {quickSteps.map((step, index) => (
                            <li key={index} className="flex items-start gap-3 text-sm text-foreground/80">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                    {index + 1}
                                </span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ol>
                </motion.div>
            )}

            {/* Action buttons */}
            <motion.div
                className="flex flex-col sm:flex-row items-center gap-3"
                variants={{
                    hidden: { opacity: 0, y: 20, scale: 0.9 },
                    visible: { opacity: 1, y: 0, scale: 1, transition: { ease: appleEasing } }
                }}
            >
                {actionLabel && onAction && (
                    <motion.button
                        onClick={onAction}
                        aria-label={actionLabel}
                        className="px-8 py-3.5 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-elevation-md shadow-primary hover:shadow-elevation-lg hover:shadow-primary transition-all duration-normal ease-apple focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background inline-flex items-center gap-2"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {actionLabel}
                        <ArrowRight className="w-4 h-4" />
                    </motion.button>
                )}
                {secondaryActionLabel && onSecondaryAction && (
                    <motion.button
                        onClick={onSecondaryAction}
                        aria-label={secondaryActionLabel}
                        className="px-6 py-3 text-muted-foreground hover:text-foreground rounded-xl font-medium text-sm transition-colors duration-normal"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {secondaryActionLabel}
                    </motion.button>
                )}
            </motion.div>

            {/* Contextual tip */}
            {tip && (
                <motion.div
                    className="mt-8 flex items-start gap-2 max-w-sm p-4 rounded-xl bg-info-bg/50 border border-info-border/30"
                    variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0, transition: { ease: appleEasing, delay: 0.2 } }
                    }}
                >
                    <Lightbulb className="w-4 h-4 text-info-text flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-info-text leading-relaxed">{tip}</p>
                </motion.div>
            )}
        </motion.div>
    );
});

EmptyState.displayName = 'EmptyState';
