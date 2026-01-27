/**
 * Micro-Interactions Utility Library
 *
 * Provides Apple-style animations and "aha moment" effects
 * for Sentinel GRC v2 application.
 */

import type { Variants, Transition } from 'framer-motion';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Apple-style cubic bezier easing - smooth spring feel */
export const appleEasing: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Standard durations */
export const DURATION = {
  fast: 0.2,
  normal: 0.4,
  slow: 0.6,
  counter: 1.5,
} as const;

// ============================================================================
// REUSABLE VARIANTS
// ============================================================================

/** Fade in with upward motion */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ease: appleEasing, duration: DURATION.normal },
  },
};

/** Fade in with downward motion */
export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ease: appleEasing, duration: DURATION.normal },
  },
};

/** Scale in from center */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
};

/** Scale in with rotation (for badges, icons) */
export const scaleInRotate: Variants = {
  hidden: { opacity: 0, scale: 0, rotate: -180 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 200, damping: 15 },
  },
};

/** Stagger container for list animations */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

/** Stagger item for use with staggerContainer */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 100 },
  },
};

/** Pulse animation for attention */
export const pulseAttention: Variants = {
  initial: { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.4)' },
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(59, 130, 246, 0.4)',
      '0 0 0 15px rgba(59, 130, 246, 0)',
    ],
    transition: { repeat: Infinity, duration: 1.5 },
  },
};

/** Slide in from right (for panels, drawers) */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { ease: appleEasing, duration: DURATION.normal },
  },
  exit: {
    opacity: 0,
    x: 100,
    transition: { ease: appleEasing, duration: DURATION.fast },
  },
};

/** Slide in from left */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { ease: appleEasing, duration: DURATION.normal },
  },
  exit: {
    opacity: 0,
    x: -100,
    transition: { ease: appleEasing, duration: DURATION.fast },
  },
};

// ============================================================================
// HOVER & TAP EFFECTS
// ============================================================================

/** Standard button hover effect */
export const buttonHover = {
  scale: 1.02,
  transition: { type: 'spring', stiffness: 400, damping: 17 },
};

/** Standard button tap effect */
export const buttonTap = {
  scale: 0.98,
};

/** Card hover effect with lift */
export const cardHover = {
  y: -4,
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

/** Card hover effect - subtle */
export const cardHoverSubtle = {
  y: -2,
  boxShadow: '0 10px 20px rgba(0, 0, 0, 0.08)',
  transition: { type: 'spring', stiffness: 400, damping: 25 },
};

/** Card hover effect with scale */
export const cardHoverScale = {
  scale: 1.02,
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
  transition: { type: 'spring', stiffness: 300, damping: 20 },
};

/** Card tap effect */
export const cardTap = {
  scale: 0.98,
  y: 0,
  transition: { duration: 0.1 },
};

/** Card entrance animation */
export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ease: appleEasing, duration: 0.4 },
  },
};

// ============================================================================
// TRANSITION PRESETS
// ============================================================================

/** Spring transition for bouncy effects */
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 20,
};

/** Smooth Apple-style transition */
export const smoothTransition: Transition = {
  ease: appleEasing,
  duration: DURATION.normal,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Trigger confetti celebration effect
 * Used for achievements, milestones, and significant improvements
 */
export const triggerConfetti = async (options?: {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
}) => {
  try {
    const confettiModule = await import('canvas-confetti');
    const confetti = confettiModule.default || confettiModule;
    confetti({
      particleCount: options?.particleCount ?? 100,
      spread: options?.spread ?? 70,
      origin: { y: options?.origin?.y ?? 0.6, x: options?.origin?.x ?? 0.5 },
      colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
    });
  } catch (error) {
    // Silently fail if confetti not available
    console.debug('Confetti not available:', error);
  }
};

/**
 * Trigger fireworks confetti for major achievements
 */
export const triggerFireworks = async () => {
  try {
    const confettiModule = await import('canvas-confetti');
    const confetti = confettiModule.default || confettiModule;
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  } catch (error) {
    console.debug('Confetti not available:', error);
  }
};

/**
 * Trigger haptic feedback on mobile devices
 */
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns: Record<string, number[]> = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30],
    };
    navigator.vibrate(patterns[type]);
  }
};

/**
 * Animate a number counting up/down
 * Returns a cleanup function
 */
export const animateCounter = (
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void
): (() => void) => {
  const startTime = Date.now();
  const difference = to - from;
  let animationFrame: number;

  const step = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out cubic)
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentValue = from + difference * easedProgress;

    onUpdate(Math.round(currentValue));

    if (progress < 1) {
      animationFrame = requestAnimationFrame(step);
    } else {
      onUpdate(to);
      onComplete?.();
    }
  };

  animationFrame = requestAnimationFrame(step);

  // Return cleanup function
  return () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  };
};

/**
 * Generate stagger delay for list items
 */
export const getStaggerDelay = (index: number, baseDelay = 0.1): number => {
  return index * baseDelay;
};

/**
 * Calculate impact color based on value (0-1)
 */
export const getImpactColor = (impact: number): string => {
  if (impact >= 0.7) return 'rgb(239, 68, 68)'; // red-500
  if (impact >= 0.4) return 'rgb(249, 115, 22)'; // orange-500
  if (impact >= 0.2) return 'rgb(234, 179, 8)'; // yellow-500
  return 'rgb(34, 197, 94)'; // green-500
};

/**
 * Get severity color class
 */
export const getSeverityColorClass = (severity: 'critical' | 'high' | 'medium' | 'low'): string => {
  const colors = {
    critical: 'text-red-500 bg-red-50 dark:bg-red-900/30 border-red-200',
    high: 'text-orange-500 bg-orange-50 dark:bg-orange-900/30 border-orange-200',
    medium: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200',
    low: 'text-green-500 bg-green-50 dark:bg-green-900/30 border-green-200',
  };
  return colors[severity];
};

// ============================================================================
// ANIMATION KEYFRAMES (for CSS)
// ============================================================================

export const keyframes = {
  /** Pulse ring effect */
  pulseRing: `
    @keyframes pulse-ring {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
      100% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
    }
  `,
  /** Checkmark draw */
  checkmarkDraw: `
    @keyframes checkmark-draw {
      0% { stroke-dashoffset: 100; }
      100% { stroke-dashoffset: 0; }
    }
  `,
  /** Float animation */
  float: `
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `,
};

// ============================================================================
// ACTION FEEDBACK UTILITIES
// ============================================================================

export type ActionFeedbackType = 'success' | 'error' | 'warning' | 'info';

/**
 * Trigger feedback for save action
 * Combines haptic feedback with optional confetti for success
 */
export const triggerSaveFeedback = (success: boolean = true) => {
  if (success) {
    triggerHaptic('medium');
    // Small celebration for successful save
    triggerConfetti({ particleCount: 30, spread: 40, origin: { y: 0.7 } });
  } else {
    triggerHaptic('heavy');
  }
};

/**
 * Trigger feedback for delete action
 * Warning haptic feedback
 */
export const triggerDeleteFeedback = () => {
  triggerHaptic('heavy');
};

/**
 * Trigger feedback for form submission success
 */
export const triggerSubmitFeedback = (success: boolean = true) => {
  if (success) {
    triggerHaptic('light');
    triggerConfetti({ particleCount: 50, spread: 60 });
  } else {
    triggerHaptic('heavy');
  }
};

/**
 * Create a pulse animation on an element
 */
export const pulseElement = (element: HTMLElement, color: string = 'rgba(59, 130, 246, 0.4)') => {
  const originalBoxShadow = element.style.boxShadow;
  element.style.transition = 'box-shadow 0.3s ease-out';
  element.style.boxShadow = `0 0 0 0 ${color}`;

  requestAnimationFrame(() => {
    element.style.boxShadow = `0 0 0 10px transparent`;
    setTimeout(() => {
      element.style.boxShadow = originalBoxShadow;
    }, 300);
  });
};

/**
 * Shake an element to indicate error
 */
export const shakeElement = (element: HTMLElement) => {
  const originalTransform = element.style.transform;
  element.style.transition = 'transform 0.1s ease-in-out';

  const shake = [0, -5, 5, -5, 5, -3, 3, 0];
  let i = 0;

  const interval = setInterval(() => {
    if (i >= shake.length) {
      clearInterval(interval);
      element.style.transform = originalTransform;
      return;
    }
    element.style.transform = `translateX(${shake[i]}px)`;
    i++;
  }, 50);
};

/**
 * Bounce an element briefly
 */
export const bounceElement = (element: HTMLElement) => {
  element.style.transition = `transform 0.3s ${appleEasing.join(',')}`;
  element.style.transform = 'scale(1.05)';

  setTimeout(() => {
    element.style.transform = 'scale(1)';
  }, 150);
};

export default {
  appleEasing,
  DURATION,
  fadeInUp,
  fadeInDown,
  scaleIn,
  scaleInRotate,
  staggerContainer,
  staggerItem,
  pulseAttention,
  slideInRight,
  slideInLeft,
  buttonHover,
  buttonTap,
  cardHover,
  cardHoverSubtle,
  cardHoverScale,
  cardTap,
  cardEntrance,
  springTransition,
  smoothTransition,
  triggerConfetti,
  triggerFireworks,
  triggerHaptic,
  animateCounter,
  getStaggerDelay,
  getImpactColor,
  getSeverityColorClass,
  // Action feedback
  triggerSaveFeedback,
  triggerDeleteFeedback,
  triggerSubmitFeedback,
  pulseElement,
  shakeElement,
  bounceElement,
};
