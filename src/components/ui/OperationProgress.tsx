/**
 * OperationProgress Component
 * Shows detailed progress for long-running operations
 * Includes progress bar, current item, ETA, and cancel option
 */

/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle, Clock } from './Icons';
import { Button } from './button';
import { cn } from '../../lib/utils';
import { appleEasing } from '../../utils/microInteractions';

export interface OperationStep {
    id: string;
    label: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    error?: string;
}

interface OperationProgressProps {
    /** Title of the operation */
    title: string;
    /** Description of what's happening */
    description?: string;
    /** Current progress (0-100) */
    progress: number;
    /** Number of items processed */
    processedCount?: number;
    /** Total number of items */
    totalCount?: number;
    /** Current item being processed */
    currentItem?: string;
    /** Steps in the operation (for multi-step operations) */
    steps?: OperationStep[];
    /** Whether the operation can be cancelled */
    cancellable?: boolean;
    /** Called when user cancels */
    onCancel?: () => void;
    /** Operation completed successfully */
    isComplete?: boolean;
    /** Operation failed */
    isError?: boolean;
    /** Error message */
    errorMessage?: string;
    /** Start time of the operation (for ETA calculation) */
    startTime?: Date;
    /** Additional className */
    className?: string;
    /** Variant: modal (overlay), inline, or toast */
    variant?: 'modal' | 'inline' | 'toast';
}

/**
 * Format remaining time for display
 */
const formatETA = (seconds: number): string => {
    if (seconds < 60) {
        return `${Math.ceil(seconds)}s`;
    }
    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.ceil(seconds % 60);
        return `${minutes}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.ceil((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
};

export const OperationProgress: React.FC<OperationProgressProps> = ({
    title,
    description,
    progress,
    processedCount,
    totalCount,
    currentItem,
    steps,
    cancellable = false,
    onCancel,
    isComplete = false,
    isError = false,
    errorMessage,
    startTime,
    className,
    variant = 'inline'
}) => {
    const [eta, setEta] = useState<string | null>(null);

    // Calculate ETA based on elapsed time and progress
    // Uses interval to update periodically - setState only called in interval callback
    useEffect(() => {
        // Early return for invalid conditions - no setState needed
        if (!startTime || progress <= 0 || progress >= 100 || isComplete || isError) {
            return;
        }

        const calculateEta = () => {
            const elapsed = (Date.now() - startTime.getTime()) / 1000;
            const estimatedTotal = elapsed / (progress / 100);
            const remaining = estimatedTotal - elapsed;

            if (remaining > 0 && remaining < 86400) { // Max 24h
                setEta(formatETA(remaining));
            } else {
                setEta(null);
            }
        };

        // Update every second for real-time ETA (interval callback is allowed)
        const interval = setInterval(calculateEta, 1000);
        return () => {
            clearInterval(interval);
            setEta(null); // Reset on cleanup
        };
    }, [progress, startTime, isComplete, isError]);

    const progressColor = useMemo(() => {
        if (isError) return 'bg-error-500';
        if (isComplete) return 'bg-success-500';
        return 'bg-brand-500';
    }, [isError, isComplete]);

    const StatusIcon = isError ? AlertCircle : isComplete ? CheckCircle2 : Loader2;
    const statusColor = isError ? 'text-error-500' : isComplete ? 'text-success-500' : 'text-brand-500';

    const content = (
        <div className={cn('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-xl', isError ? 'bg-error-100 dark:bg-error-900/30' : isComplete ? 'bg-success-100 dark:bg-success-900/30' : 'bg-brand-100 dark:bg-brand-900')}>
                        <StatusIcon className={cn('h-5 w-5', statusColor, !isComplete && !isError && 'animate-spin')} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {title}
                        </h3>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                {cancellable && !isComplete && !isError && onCancel && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onCancel}
                        className="h-8 w-8 text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                        aria-label="Annuler l'opération"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        className={cn('absolute inset-y-0 left-0 rounded-full', progressColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3, ease: appleEasing }}
                    />
                    {!isComplete && !isError && (
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                            animate={{ x: ['0%', '200%'] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        />
                    )}
                </div>

                {/* Progress Details */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        {processedCount !== undefined && totalCount !== undefined && (
                            <span className="font-medium tabular-nums">
                                {processedCount} / {totalCount}
                            </span>
                        )}
                        {currentItem && (
                            <span className="truncate max-w-[200px]" title={currentItem}>
                                {currentItem}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {eta && !isComplete && !isError && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                ~{eta}
                            </span>
                        )}
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                            {Math.round(progress)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {isError && errorMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl"
                >
                    <p className="text-sm text-error-600 dark:text-error-400">{errorMessage}</p>
                </motion.div>
            )}

            {/* Steps (for multi-step operations) */}
            {steps && steps.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-2"
                        >
                            <div className={cn(
                                'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                                step.status === 'completed' && 'bg-success-100 dark:bg-success-900/30 text-success-600',
                                step.status === 'processing' && 'bg-brand-100 dark:bg-brand-900 text-brand-600',
                                step.status === 'error' && 'bg-error-100 dark:bg-error-900/30 text-error-600',
                                step.status === 'pending' && 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            )}>
                                {step.status === 'completed' ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                ) : step.status === 'processing' ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : step.status === 'error' ? (
                                    <AlertCircle className="h-3 w-3" />
                                ) : (
                                    index + 1
                                )}
                            </div>
                            <span className={cn(
                                'text-sm',
                                step.status === 'completed' && 'text-success-600 dark:text-success-400',
                                step.status === 'processing' && 'text-brand-600 dark:text-brand-400 font-medium',
                                step.status === 'error' && 'text-error-600 dark:text-error-400',
                                step.status === 'pending' && 'text-muted-foreground'
                            )}>
                                {step.label}
                            </span>
                            {step.error && (
                                <span className="text-xs text-error-500">({step.error})</span>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );

    // Render based on variant
    if (variant === 'modal') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 p-6"
                >
                    {content}
                </motion.div>
            </div>
        );
    }

    if (variant === 'toast') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-6 right-6 z-50 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 p-4"
            >
                {content}
            </motion.div>
        );
    }

    // Inline variant
    return (
        <div className={cn('bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-4', className)}>
            {content}
        </div>
    );
};

/**
 * useOperationProgress - Hook to manage operation progress state
 */
export interface UseOperationProgressOptions {
    totalItems?: number;
    steps?: string[];
}

export const useOperationProgress = (options: UseOperationProgressOptions = {}) => {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [currentItem, setCurrentItem] = useState<string>();
    const [startTime, setStartTime] = useState<Date>();
    const [isComplete, setIsComplete] = useState(false);
    const [isError, setIsError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const [steps, setSteps] = useState<OperationStep[]>(() =>
        options.steps?.map((label, i) => ({
            id: `step-${i}`,
            label,
            status: 'pending' as const
        })) || []
    );

    const start = () => {
        setIsRunning(true);
        setStartTime(new Date());
        setProgress(0);
        setProcessedCount(0);
        setIsComplete(false);
        setIsError(false);
        setErrorMessage(undefined);
        setCurrentItem(undefined);
        if (options.steps) {
            setSteps(options.steps.map((label, i) => ({
                id: `step-${i}`,
                label,
                status: 'pending'
            })));
        }
    };

    const updateProgress = (processed: number, current?: string) => {
        setProcessedCount(processed);
        if (options.totalItems) {
            setProgress((processed / options.totalItems) * 100);
        }
        if (current) setCurrentItem(current);
    };

    const setStepStatus = (stepIndex: number, status: OperationStep['status'], error?: string) => {
        setSteps(prev => prev.map((step, i) =>
            i === stepIndex ? { ...step, status, error } : step
        ));
    };

    const complete = () => {
        setProgress(100);
        setIsComplete(true);
        setIsRunning(false);
    };

    const fail = (message: string) => {
        setIsError(true);
        setErrorMessage(message);
        setIsRunning(false);
    };

    const reset = () => {
        setIsRunning(false);
        setProgress(0);
        setProcessedCount(0);
        setCurrentItem(undefined);
        setStartTime(undefined);
        setIsComplete(false);
        setIsError(false);
        setErrorMessage(undefined);
    };

    return {
        isRunning,
        progress,
        processedCount,
        currentItem,
        startTime,
        isComplete,
        isError,
        errorMessage,
        steps,
        start,
        updateProgress,
        setProgress,
        setStepStatus,
        complete,
        fail,
        reset
    };
};

export default OperationProgress;
