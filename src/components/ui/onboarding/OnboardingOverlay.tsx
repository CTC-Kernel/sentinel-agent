import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from './useOnboardingStore';
import { OnboardingCard } from './TourCard';
import { createPortal } from 'react-dom';
import { useStore } from '../../../store';

export const OnboardingOverlay: React.FC = () => {
    const { isActive, steps, currentStepIndex, nextStep, prevStep, skipTour } = useOnboardingStore();
    const demoMode = useStore(state => state.demoMode);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    const currentStep = steps[currentStepIndex];

    // Helper to get the target element
    const getStepElement = useCallback((step: typeof currentStep) => {
        if (!step?.target) return null;
        return document.querySelector(step.target);
    }, []);

    const updateRect = useCallback(() => {
        const element = getStepElement(currentStep);
        if (element) {
            const rect = element.getBoundingClientRect();
            // Check if element is visible/in viewport, maybe scroll to it?
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            setTargetRect(rect);
        } else {
            // Fallback for missing elements or center positioning?
            setTargetRect(null);
        }
    }, [currentStep, getStepElement]);

    useEffect(() => {
        if (isActive && currentStep) {
            // Wait a tick for any UI changes (like drawer opening)
            const timer = setTimeout(updateRect, 300);
            window.addEventListener('resize', updateRect);
            window.addEventListener('scroll', updateRect, true); // true for capture, to catch scrolling containers

            return () => {
                window.removeEventListener('resize', updateRect);
                window.removeEventListener('scroll', updateRect, true);
                clearTimeout(timer);
            };
        }
    }, [isActive, currentStep, currentStepIndex, updateRect]);

    useEffect(() => {
        if (demoMode && isActive) {
            skipTour();
        }
    }, [demoMode, isActive, skipTour]);

    if (!isActive || demoMode) return null;

    // Create a portal to render at the top level (body)
    return createPortal(
        <div className="fixed inset-0 z-max pointer-events-none overflow-hidden">
            <AnimatePresence>
                {/* Backdrop with SVG Mask for Spotlight */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-colors duration-500"
                >
                    {/* 
                     Using SVG mask or clip-path is cleaner for generic "holes"
                     But standard 'div' borders approach is easier for rounded spotlight. 
                     Let's verify the "Masterpiece" standard. A huge shadow box is a common trick.
                     Or simply: render 4 divs around the spotlight. 
                     
                     Actually, SVG is robust.
                    */}
                    <svg className="w-full h-full text-transparent">
                        <defs>
                            <mask id="spotlight-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                {targetRect && (
                                    <rect
                                        x={targetRect.x - 5}
                                        y={targetRect.y - 5}
                                        width={targetRect.width + 10}
                                        height={targetRect.height + 10}
                                        rx="12"
                                        fill="black"
                                    />
                                )}
                            </mask>
                        </defs>
                        <rect x="0" y="0" width="100%" height="100%" fill="black" mask="url(#spotlight-mask)" fillOpacity="0.6" />
                    </svg>
                </motion.div>

                {/* Animated Ring/Border around target */}
                {targetRect && (
                    <motion.div
                        layout
                        initial={false}
                        animate={{
                            top: targetRect.top - 5,
                            left: targetRect.left - 5,
                            width: targetRect.width + 10,
                            height: targetRect.height + 10,
                        }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300
                        }}
                        className="absolute border-2 border-white/50 shadow-[0_0_30px_rgba(255,255,255,0.3)] rounded-3xl pointer-events-none"
                    />
                )}

                {/* The Card */}
                {targetRect && (
                    <OnboardingCard
                        step={currentStep}
                        currentStepIndex={currentStepIndex}
                        totalSteps={steps.length}
                        targetRect={targetRect}
                        onNext={nextStep}
                        onPrev={prevStep}
                        onSkip={skipTour}
                    />
                )}
            </AnimatePresence>
        </div>,
        document.body
    );
};
