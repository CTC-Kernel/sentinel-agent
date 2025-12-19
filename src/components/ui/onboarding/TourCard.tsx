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
            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl dark:border-white/10 dark:bg-slate-900/40">
                {/* Glossy Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />

                <div className="relative p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-200 text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
                                Étape {currentStepIndex + 1}/{totalSteps}
                            </span>
                            <h3 className="text-xl font-bold text-white drop-shadow-sm">
                                {step.title}
                            </h3>
                        </div>
                        <button
                            onClick={onSkip}
                            className="text-white/40 hover:text-white transition-colors p-1"
                            title="Quitter le tour"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <p className="text-white/80 text-sm leading-relaxed mb-6">
                        {step.description}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        {currentStepIndex > 0 ? (
                            <button
                                onClick={onPrev}
                                className="flex items-center gap-1 text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Retour
                            </button>
                        ) : (
                            <div /> // Spacer
                        )}

                        <button
                            onClick={onNext}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-xl text-sm font-bold shadow-lg shadow-white/10 hover:scale-105 active:scale-95 transition-all"
                        >
                            {currentStepIndex === totalSteps - 1 ? 'Terminer' : 'Suivant'}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* ProgressBar */}
                    <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full">
                        <motion.div
                            className="h-full bg-brand-500"
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
