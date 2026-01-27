/**
 * AnimatedScoreCounter Component
 *
 * A score counter with "slot machine" counting animation and celebration effects.
 * Creates "aha moments" when scores improve significantly.
 *
 * @example
 * ```tsx
 * <AnimatedScoreCounter
 *   value={78}
 *   previousValue={65}
 *   suffix="%"
 *   celebrateThreshold={10}
 * />
 * ```
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from '../Icons';
import { cn } from '@/lib/utils';
import {
  appleEasing,
  animateCounter,
  triggerConfetti,
  triggerHaptic,
  scaleInRotate,
} from '@/utils/microInteractions';

export interface AnimatedScoreCounterProps {
  /** Current score value */
  value: number;
  /** Previous score value for comparison (optional) */
  previousValue?: number;
  /** Suffix to display after the number (e.g., "%", "pts") */
  suffix?: string;
  /** Prefix to display before the number (e.g., "$", "#") */
  prefix?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Animation duration in milliseconds */
  duration?: number;
  /** Minimum improvement to trigger celebration effect */
  celebrateThreshold?: number;
  /** Whether to show the trend indicator */
  showTrend?: boolean;
  /** Whether to show the delta badge */
  showDelta?: boolean;
  /** Custom class name */
  className?: string;
  /** Decimal places to show */
  decimals?: number;
  /** Color based on value thresholds */
  colorThresholds?: {
    critical: number;
    warning: number;
    good: number;
  };
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
  /** Label to show above the score */
  label?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-6xl',
  xl: 'text-8xl',
};

const trendSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

const deltaSizeClasses = {
  sm: 'text-[11px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-2.5 py-1',
  xl: 'text-base px-3 py-1.5',
};

/**
 * Get color class based on value and thresholds
 */
const getValueColor = (
  value: number,
  thresholds?: { critical: number; warning: number; good: number }
): string => {
  if (!thresholds) return 'text-slate-900 dark:text-white';

  if (value >= thresholds.good) return 'text-green-500';
  if (value >= thresholds.warning) return 'text-yellow-500';
  if (value >= thresholds.critical) return 'text-orange-500';
  return 'text-red-500';
};

/**
 * Get trend direction
 */
const getTrend = (
  current: number,
  previous?: number
): 'up' | 'down' | 'stable' => {
  if (previous === undefined) return 'stable';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'stable';
};

export const AnimatedScoreCounter: React.FC<AnimatedScoreCounterProps> = ({
  value,
  previousValue,
  suffix = '',
  prefix = '',
  size = 'md',
  duration = 1500,
  celebrateThreshold = 10,
  showTrend = true,
  showDelta = true,
  className,
  decimals = 0,
  colorThresholds,
  onAnimationComplete,
  label,
  ariaLabel,
}) => {
  const [displayValue, setDisplayValue] = useState(previousValue ?? value);
  const [hasAnimated, setHasAnimated] = useState(false);
  const animationRef = useRef<(() => void) | null>(null);

  const trend = getTrend(value, previousValue);
  const delta = previousValue !== undefined ? value - previousValue : 0;
  const shouldCelebrate = delta >= celebrateThreshold;

  // Use refs for values that shouldn't trigger re-animation but are needed inside effect
  const callbackRef = useRef(onAnimationComplete);
  const celebrationRef = useRef({ shouldCelebrate, hasAnimated });

  // Update refs
  useEffect(() => {
    callbackRef.current = onAnimationComplete;
    celebrationRef.current = { shouldCelebrate, hasAnimated };
  }, [onAnimationComplete, shouldCelebrate, hasAnimated]);

  // Run counter animation on mount or value change
  useEffect(() => {
    // Cleanup previous animation
    if (animationRef.current) {
      animationRef.current();
    }

    // We use the previous value stored in state for continuity, or the prop if first run
    const startValue = displayValue;
    const targetValue = value;

    // Animate the counter
    animationRef.current = animateCounter(
      startValue,
      targetValue,
      duration,
      (v) => setDisplayValue(v),
      () => {
        setHasAnimated(true);

        // Trigger celebration if threshold met
        const { shouldCelebrate: should, hasAnimated: has } = celebrationRef.current;
        if (should && !has) {
          triggerConfetti({ particleCount: 80, spread: 60 });
          triggerHaptic('medium');
        }

        callbackRef.current?.();
      }
    );

    return () => {
      if (animationRef.current) {
        animationRef.current();
      }
    };
    // displayValue is updated by the animation itself, so we don't want it in dependencies to avoid loops
    // We only want to restart animation when 'value' (target) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <div
      className={cn('flex flex-col items-center gap-2', className)}
      role="status"
      aria-label={ariaLabel || `${label || 'Score'}: ${value}${suffix}`}
    >
      {/* Label */}
      {label && (
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-medium text-slate-500 dark:text-slate-300"
        >
          {label}
        </motion.span>
      )}

      {/* Main Score Display */}
      <div className="flex items-center gap-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ease: appleEasing, duration: 0.5 }}
          className={cn(
            'font-bold tabular-nums',
            sizeClasses[size],
            getValueColor(value, colorThresholds)
          )}
        >
          {/* Animated digit display */}
          <span className="inline-flex items-baseline">
            {prefix && <span className="text-muted-foreground">{prefix}</span>}
            <AnimatePresence mode="popLayout">
              {formattedValue.split('').map((char, index) => (
                <motion.span
                  key={`${index}-${char}`}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{
                    ease: appleEasing,
                    duration: 0.3,
                    delay: index * 0.02,
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </AnimatePresence>
            {suffix && (
              <span className="text-slate-400 ml-0.5">{suffix}</span>
            )}
          </span>
        </motion.div>

        {/* Delta Badge */}
        {showDelta && delta !== 0 && hasAnimated && (
          <motion.span
            variants={scaleInRotate}
            initial="hidden"
            animate="visible"
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full font-medium',
              deltaSizeClasses[size],
              delta > 0
                ? 'bg-green-100 text-green-600 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            )}
          >
            {delta > 0 ? '+' : ''}
            {delta.toFixed(decimals)}
            {suffix}
            {shouldCelebrate && ' 🎉'}
          </motion.span>
        )}
      </div>

      {/* Trend Indicator */}
      {showTrend && previousValue !== undefined && hasAnimated && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, ease: appleEasing }}
          className={cn(
            'flex items-center gap-1',
            trendSizeClasses[size],
            trend === 'up' && 'text-green-500',
            trend === 'down' && 'text-red-500',
            trend === 'stable' && 'text-slate-400'
          )}
        >
          {trend === 'up' && <TrendingUp className="w-4 h-4" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4" />}
          {trend === 'stable' && <Minus className="w-4 h-4" />}
          <span className="font-medium">
            {trend === 'up' && 'En progression'}
            {trend === 'down' && 'En baisse'}
            {trend === 'stable' && 'Stable'}
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default AnimatedScoreCounter;
