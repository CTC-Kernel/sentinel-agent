import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TourStep } from './types';
import { ChevronRight, ChevronLeft, X } from '../Icons';
import { useLocale } from '../../../hooks/useLocale';

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
 const { t } = useLocale();

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
 className="z-supreme pointer-events-auto"
 >
 <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/95 dark:bg-card/95 shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/10">
 {/* Glossy Gradient Overlay - Subtle */}
 <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none" />

 <div className="relative p-6">
  {/* Header */}
  <div className="flex justify-between items-start mb-4">
  <div className="space-y-1">
  <span className="inline-block px-2.5 py-1 rounded-full bg-muted/80 text-foreground dark:bg-white/10 dark:text-white text-xs font-bold uppercase tracking-widest border border-border/40 shadow-sm backdrop-blur-md">
  {t('onboarding.step', { defaultValue: 'Étape' })} {currentStepIndex + 1}/{totalSteps}
  </span>
  <h3 className="text-xl font-bold text-foreground mt-2 leading-tight tracking-tight">
  {step.title}
  </h3>
  </div>
  <button
  onClick={onSkip}
  className="text-muted-foreground hover:text-foreground text-muted-foreground dark:hover:text-foreground transition-colors p-1.5 hover:bg-muted dark:hover:bg-muted rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  title={t('onboarding.skipTour', { defaultValue: 'Quitter le tour' })}
  >
  <X className="w-5 h-5" />
  </button>
  </div>

  {/* Content */}
  <p className="text-foreground text-base leading-relaxed mb-6 font-medium tracking-normal">
  {step.description}
  </p>

  {/* Actions */}
  <div className="flex items-center justify-between pt-2">
  {currentStepIndex > 0 ? (
  <button
  onClick={onPrev}
  className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted dark:hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
  <ChevronLeft className="w-4 h-4" />
  {t('onboarding.back', { defaultValue: 'Retour' })}
  </button>
  ) : (
  <div /> // Spacer
  )}

  <button
  onClick={onNext}
  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  {currentStepIndex === totalSteps - 1 ? t('onboarding.finish', { defaultValue: 'Terminer' }) : t('onboarding.next', { defaultValue: 'Suivant' })}
  <ChevronRight className="w-4 h-4" />
  </button>
  </div>

  {/* ProgressBar */}
  <div className="absolute bottom-0 left-0 h-1 bg-muted w-full">
  <motion.div
  className="h-full bg-primary dark:bg-primary/60 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
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
