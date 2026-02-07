import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight } from './Icons';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface ContextualAlertProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: React.ReactNode;
    variant?: 'info' | 'warning' | 'destructive' | 'success';
    className?: string;
}

export const ContextualAlert: React.FC<ContextualAlertProps> = ({
    isOpen,
    onClose,
    title,
    description,
    actionLabel,
    onAction,
    icon,
    variant = 'info',
    className
}) => {
    const variantStyles = {
        info: 'from-info-bg/80 to-info-bg/40 border-info-border/40 text-info-text shadow-info/10',
        warning: 'from-warning-bg/80 to-warning-bg/40 border-warning-border/40 text-warning-text shadow-warning/10',
        destructive: 'from-error-bg/80 to-error-bg/40 border-error-border/40 text-error-text shadow-error/10',
        success: 'from-success-bg/80 to-success-bg/40 border-success-border/40 text-success-text shadow-success/10'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={cn(
                        "relative overflow-hidden mb-6",
                        className
                    )}
                >
                    <div className={cn(
                        "glass-premium border rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-br shadow-xl",
                        variantStyles[variant]
                    )}>
                        {/* Prismatic Effect Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-prismatic-flow pointer-events-none" />

                        <div className="flex items-center gap-4 relative z-10 w-full">
                            <div className={cn(
                                "p-3 rounded-2xl bg-white/10 dark:bg-black/10 flex-shrink-0 animate-pulse-subtle shadow-inner",
                                variant === 'info' && 'text-primary',
                                variant === 'warning' && 'text-warning',
                                variant === 'destructive' && 'text-destructive',
                                variant === 'success' && 'text-success'
                            )}>
                                {icon || <Sparkles className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-foreground text-sm sm:text-base tracking-tight leading-tight">
                                    {title}
                                </h4>
                                <p className="text-xs sm:text-sm text-foreground/70 font-medium leading-relaxed mt-0.5 line-clamp-2 sm:line-clamp-none">
                                    {description}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 relative z-10 w-full sm:w-auto shrink-0">
                            {actionLabel && onAction && (
                                <Button
                                    variant="ghost"
                                    onClick={onAction}
                                    className={cn(
                                        "h-10 px-5 rounded-2xl text-xs font-bold transition-all shadow-sm group",
                                        variant === 'info' && 'bg-primary/10 hover:bg-primary/20 text-primary',
                                        variant === 'warning' && 'bg-warning/10 hover:bg-warning/20 text-warning',
                                        variant === 'destructive' && 'bg-destructive/10 hover:bg-destructive/20 text-destructive',
                                        variant === 'success' && 'bg-success/10 hover:bg-success/20 text-success'
                                    )}
                                >
                                    {actionLabel}
                                    <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground/60 transition-colors"
                                aria-label="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
