/**
 * CopyButton Component
 * Reusable copy-to-clipboard button with visual feedback
 * Creates an "aha moment" with animation and haptic feedback
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from './Icons';
import { cn } from '../../lib/utils';
import { appleEasing } from '../../utils/microInteractions';

interface CopyButtonProps {
    /** Text to copy to clipboard */
    text: string;
    /** Optional label shown next to the icon */
    label?: string;
    /** Label to show when copied */
    copiedLabel?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Style variant */
    variant?: 'ghost' | 'outline' | 'filled';
    /** Additional class names */
    className?: string;
    /** Callback after successful copy */
    onCopy?: () => void;
    /** Duration in ms to show "copied" state */
    copiedDuration?: number;
    /** Show only icon (no label) */
    iconOnly?: boolean;
    /** Tooltip position */
    tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export const CopyButton: React.FC<CopyButtonProps> = ({
    text,
    label = 'Copier',
    copiedLabel = 'Copié !',
    size = 'sm',
    variant = 'ghost',
    className,
    onCopy,
    copiedDuration = 2000,
    iconOnly = false,
    tooltipPosition = 'top'
}) => {
    const [copied, setCopied] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);

            // Haptic feedback on mobile
            if ('vibrate' in navigator) {
                navigator.vibrate(50);
            }

            onCopy?.();

            setTimeout(() => {
                setCopied(false);
            }, copiedDuration);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }, [text, onCopy, copiedDuration]);

    const sizeClasses = {
        sm: iconOnly ? 'p-1.5' : 'px-2 py-1 text-xs',
        md: iconOnly ? 'p-2' : 'px-3 py-1.5 text-sm',
        lg: iconOnly ? 'p-2.5' : 'px-4 py-2 text-sm'
    };

    const iconSizes = {
        sm: 'h-3.5 w-3.5',
        md: 'h-4 w-4',
        lg: 'h-5 w-5'
    };

    const variantClasses = {
        ghost: 'text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10',
        outline: 'border border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800',
        filled: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
    };

    const tooltipPositionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    return (
        <div className="relative inline-flex">
            <motion.button
                type="button"
                onClick={handleCopy}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={cn(
                    'relative inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                    sizeClasses[size],
                    variantClasses[variant],
                    copied && 'text-success-600 dark:text-success-400',
                    className
                )}
                whileTap={{ scale: 0.95 }}
                aria-label={copied ? copiedLabel : label}
            >
                <AnimatePresence mode="wait">
                    {copied ? (
                        <motion.div
                            key="check"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ duration: 0.2, ease: appleEasing }}
                        >
                            <Check className={cn(iconSizes[size], 'text-success-500')} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="copy"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.2, ease: appleEasing }}
                        >
                            <Copy className={iconSizes[size]} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {!iconOnly && (
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={copied ? 'copied' : 'copy'}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                        >
                            {copied ? copiedLabel : label}
                        </motion.span>
                    </AnimatePresence>
                )}

                {/* Success sparkle effect */}
                {copied && (
                    <motion.div
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.5, 0] }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="absolute inset-0 bg-success-500/20 rounded-lg" />
                    </motion.div>
                )}
            </motion.button>

            {/* Tooltip for icon-only mode */}
            {iconOnly && (
                <AnimatePresence>
                    {showTooltip && !copied && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className={cn(
                                'absolute z-50 px-2 py-1 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md whitespace-nowrap pointer-events-none',
                                tooltipPositionClasses[tooltipPosition]
                            )}
                        >
                            {label}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};

/**
 * CopyField - Input field with integrated copy button
 * Useful for displaying IDs, tokens, or codes that need to be copied
 */
interface CopyFieldProps {
    /** Value to display and copy */
    value: string;
    /** Label for the field */
    label?: string;
    /** Make the value partially hidden (for sensitive data) */
    masked?: boolean;
    /** Additional class names */
    className?: string;
}

export const CopyField: React.FC<CopyFieldProps> = ({
    value,
    label,
    masked = false,
    className
}) => {
    const displayValue = masked && value.length > 8
        ? `${value.slice(0, 4)}${'•'.repeat(Math.min(value.length - 8, 12))}${value.slice(-4)}`
        : value;

    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <label className="text-xs font-medium text-muted-foreground">
                    {label}
                </label>
            )}
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                <code className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-300 truncate">
                    {displayValue}
                </code>
                <CopyButton
                    text={value}
                    iconOnly
                    size="sm"
                    variant="ghost"
                />
            </div>
        </div>
    );
};

export default CopyButton;
