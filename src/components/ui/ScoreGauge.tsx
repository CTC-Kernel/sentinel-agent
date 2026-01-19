/**
 * ScoreGauge Component
 * Animated circular gauge for displaying compliance score (Apple Health Style)
 * Implements ADR-003: Score de Conformité Global
 * Enhanced with micro-interactions for "aha moments"
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from './Icons';
import { cn } from '../../lib/utils';
import { getScoreTextColor, getScoreLevel } from '../../utils/scoreUtils';
import { SCORE_GRADIENT_COLORS } from '../../theme/chartTheme';
import { appleEasing, animateCounter, triggerConfetti, triggerHaptic } from '../../utils/microInteractions';

export type ScoreGaugeSize = 'sm' | 'md' | 'lg';

export interface ScoreGaugeProps {
  /** Score value from 0 to 100 */
  score: number;
  /** Previous score for comparison and delta display */
  previousScore?: number;
  /** Size variant */
  size?: ScoreGaugeSize;
  /** Enable animation on score changes */
  showAnimation?: boolean;
  /** Show the score number in center */
  showLabel?: boolean;
  /** Show delta badge when score changes */
  showDelta?: boolean;
  /** Show trend indicator */
  showTrend?: boolean;
  /** Minimum improvement to trigger celebration */
  celebrateThreshold?: number;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for opening breakdown */
  onClick?: () => void;
  /** Accessible label */
  ariaLabel?: string;
}

/** Size configurations */
const SIZE_CONFIG: Record<ScoreGaugeSize, { diameter: number; strokeWidth: number; fontSize: string }> = {
  sm: { diameter: 80, strokeWidth: 6, fontSize: 'text-xl' },
  md: { diameter: 120, strokeWidth: 8, fontSize: 'text-2xl' },
  lg: { diameter: 180, strokeWidth: 10, fontSize: 'text-4xl' },
};

// Use centralized gradient colors from chartTheme
const GRADIENT_COLORS = SCORE_GRADIENT_COLORS;

/**
 * ScoreGauge - Circular progress gauge component with micro-interactions
 *
 * @example
 * ```tsx
 * <ScoreGauge
 *   score={75}
 *   previousScore={65}
 *   size="lg"
 *   showDelta
 *   celebrateThreshold={10}
 *   onClick={() => setShowBreakdown(true)}
 * />
 * ```
 */
export function ScoreGauge({
  score,
  previousScore,
  size = 'md',
  showAnimation = true,
  showLabel = true,
  showDelta = false,
  showTrend = false,
  celebrateThreshold = 10,
  className,
  onClick,
  ariaLabel,
}: ScoreGaugeProps) {
  const config = SIZE_CONFIG[size];
  const { diameter, strokeWidth, fontSize } = config;

  // Animated display value state
  // If animation is disabled, we start directly with the target score
  const [displayValue, setDisplayValue] = useState(showAnimation ? (previousScore ?? score) : score);
  const [hasAnimated, setHasAnimated] = useState(!showAnimation);
  const animationRef = useRef<(() => void) | null>(null);

  // SVG calculations
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  // Center position
  const center = diameter / 2;

  // Get colors - use scoreUtils for consistency
  const scoreLevel = getScoreLevel(normalizedScore);
  const gradientColors = GRADIENT_COLORS[scoreLevel];
  const textColorClass = getScoreTextColor(normalizedScore);

  // Unique gradient ID for this instance
  const [gradientId] = useState(() => `score-gradient-${Math.random().toString(36).substr(2, 9)}`);

  // Critical score pulse animation
  const isCritical = normalizedScore < 30;

  // Delta calculations
  const delta = previousScore !== undefined ? score - previousScore : 0;
  const shouldCelebrate = delta >= celebrateThreshold;
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';

  // Animate counter on score change
  useEffect(() => {
    if (!showAnimation) {
      // If animation is disabled, we handle this in the initial state or a separate effect that doesn't conflict
      return;
    }

    // Cleanup previous animation
    if (animationRef.current) {
      animationRef.current();
    }

    const startValue = hasAnimated ? displayValue : (previousScore ?? 0);

    animationRef.current = animateCounter(
      startValue,
      normalizedScore,
      1200, // duration
      (v) => setDisplayValue(v),
      () => {
        setHasAnimated(true);
        // Trigger celebration if threshold met
        if (shouldCelebrate && !hasAnimated) {
          triggerConfetti({ particleCount: 60, spread: 50 });
          triggerHaptic('medium');
        }
      }
    );

    return () => {
      if (animationRef.current) {
        animationRef.current();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedScore, showAnimation]);

  // Memoize the gauge path for performance
  const gaugeStyle = useMemo(() => ({
    strokeDasharray: circumference,
    strokeDashoffset: strokeDashoffset,
    transition: showAnimation ? 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
  }), [circumference, strokeDashoffset, showAnimation]);

  const isClickable = !!onClick;

  // Delta badge size based on gauge size
  const deltaBadgeClass = size === 'lg' ? 'text-sm px-2 py-1' : size === 'md' ? 'text-xs px-1.5 py-0.5' : 'text-[10px] px-1 py-0.5';

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ease: appleEasing, duration: 0.5 }}
        className={cn(
          'relative inline-flex items-center justify-center',
          isClickable && 'cursor-pointer hover:scale-105 transition-transform',
          isCritical && showAnimation && 'animate-pulse',
        )}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        role="meter"
        aria-valuenow={normalizedScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel || `Score de conformité: ${normalizedScore}%`}
        tabIndex={isClickable ? 0 : undefined}
      >
        <svg
          width={diameter}
          height={diameter}
          viewBox={`0 0 ${diameter} ${diameter}`}
          className="transform -rotate-90"
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColors.start} />
              <stop offset="100%" stopColor={gradientColors.end} />
            </linearGradient>
          </defs>

          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />

          {/* Score arc with gradient */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            stroke={`url(#${gradientId})`}
            style={gaugeStyle}
          />
        </svg>

        {/* Center label with animated counter */}
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={displayValue}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ ease: appleEasing, duration: 0.2 }}
                className={cn('font-bold tabular-nums', fontSize, textColorClass)}
              >
                {Math.round(displayValue)}
              </motion.span>
            </AnimatePresence>
          </div>
        )}

        {/* Delta badge */}
        {showDelta && delta !== 0 && hasAnimated && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.8 }}
            className={cn(
              'absolute -top-1 -right-1 rounded-full font-bold',
              deltaBadgeClass,
              delta > 0
                ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'
            )}
          >
            {delta > 0 ? '+' : ''}{delta}
            {shouldCelebrate && ' 🎉'}
          </motion.div>
        )}
      </motion.div>

      {/* Trend indicator */}
      {showTrend && previousScore !== undefined && hasAnimated && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, ease: appleEasing }}
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            trend === 'up' && 'text-green-500',
            trend === 'down' && 'text-red-500',
            trend === 'stable' && 'text-slate-400'
          )}
        >
          {trend === 'up' && <TrendingUp className="w-3 h-3" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3" />}
          {trend === 'stable' && <Minus className="w-3 h-3" />}
          <span>
            {trend === 'up' && 'En progression'}
            {trend === 'down' && 'En baisse'}
            {trend === 'stable' && 'Stable'}
          </span>
        </motion.div>
      )}
    </div>
  );
}

export default ScoreGauge;
