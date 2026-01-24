import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TourStep } from './types';
import { ChevronRight, ChevronLeft, X } from '../Icons';

interface OnboardingCardProps {
    step: TourStep;
    currentStepIndex: number;
    totalSteps: number;
    targetRect: DOMRect;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
}

export const OnboardingCard: React.FC<OnboardingCardProps> = ({
    step,
    currentStepIndex,
    totalSteps,
    targetRect,
    onNext,
    onPrev,
    onSkip
}) => {

    // Calculate Position
    const style = useMemo(() => {
        const gap = 20;
        const width = 320; // Card width
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Default to bottom
        let top = targetRect.bottom + gap;
        let left = targetRect.left + (targetRect.width / 2) - (width / 2);

        // Adjust Horizontal if off-screen
        if (left < 20) left = 20;
        if (left + width > viewportWidth - 20) left = viewportWidth - width - 20;

        // Auto-flip vertical if needed
        if (top + 200 > viewportHeight && targetRect.top > 300) {
            // Flip to top
            top = targetRect.top - gap - 200; // rough height estimate, dynamic would be better with ref
        }

        // Apply explicit overrides from step config if valid
        if (step.position === 'top') {
            top = targetRect.top - gap - 200; // Should really measure card height
        }
        if (step.position === 'right') {
            top = targetRect.top;
            left = targetRect.right + gap;
        }
        if (step.position === 'left') {
            top = targetRect.top;
            left = targetRect.left - width - gap;
        }

        return { top, left, width };
    }, [targetRect, step.position]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, top: style.top, left: style.left }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ width: style.width, position: 'absolute' }}
            className="z-[10000] pointer-events-auto"
        >
            <div className="relative overflow-hidden rounded-2xl border border-white/50 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90 ring-1 ring-black/5 dark:ring-white/10">
                {/* Glossy Gradient Overlay - Subtle */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none dark:from-white/5" />

                <div className="relative p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100/80 text-slate-700 dark:bg-white/10 dark:text-white text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-md">
                                Étape {currentStepIndex + 1}/{totalSteps}
                            </span>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2 leading-tight tracking-tight">
                                {step.title}
                            </h3>
                        </div>
                        <button
                            onClick={onSkip}
                            className="text-muted-foreground hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                            title="Quitter le tour"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <p className="text-slate-900 dark:text-white text-[15px] leading-relaxed mb-6 font-medium tracking-normal">
                        {step.description}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2">
                        {currentStepIndex > 0 ? (
                            <button
                                onClick={onPrev}
                                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Retour
                            </button>
                        ) : (
                            <div /> // Spacer
                        )}

                        <button
                            onClick={onNext}
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                        >
                            {currentStepIndex === totalSteps - 1 ? 'Terminer' : 'Suivant'}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* ProgressBar */}
                    <div className="absolute bottom-0 left-0 h-1 bg-slate-100 dark:bg-slate-800 w-full">
                        <motion.div
                            className="h-full bg-brand-500 dark:bg-brand-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
