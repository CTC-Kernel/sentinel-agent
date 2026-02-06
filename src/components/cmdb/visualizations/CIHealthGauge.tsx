/**
 * CI Health Gauge
 *
 * Premium animated gauge component for displaying CI health metrics.
 * Features Apple-style design with glassmorphism and smooth animations.
 *
 * @module components/cmdb/visualizations/CIHealthGauge
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
} from '../../ui/Icons';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface CIHealthGaugeProps {
  /** Data Quality Score (0-100) */
  dqsScore: number;
  /** Previous DQS score for trend */
  previousScore?: number;
  /** Status of the CI */
  status: string;
  /** Criticality level */
  criticality: string;
  /** Last reconciliation date */
  lastReconciliation?: Date;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show detailed metrics */
  showDetails?: boolean;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SIZE_CONFIG = {
  sm: { gauge: 120, icon: 16, text: 'text-2xl' },
  md: { gauge: 160, icon: 20, text: 'text-3xl' },
  lg: { gauge: 200, icon: 24, text: 'text-4xl' },
};

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: React.FC<{ className?: string }> }> = {
  In_Use: { color: 'text-success', bgColor: 'bg-success/10', icon: CheckCircle },
  In_Stock: { color: 'text-primary', bgColor: 'bg-primary/10', icon: Clock },
  In_Maintenance: { color: 'text-warning', bgColor: 'bg-warning/10', icon: AlertTriangle },
  Retired: { color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Minus },
  Missing: { color: 'text-destructive', bgColor: 'bg-destructive/10', icon: AlertTriangle },
};

const CRITICALITY_CONFIG: Record<string, { color: string; ring: string }> = {
  Critical: { color: 'text-destructive', ring: 'ring-destructive/50' },
  High: { color: 'text-orange-500', ring: 'ring-orange-500/50' },
  Medium: { color: 'text-warning', ring: 'ring-warning/50' },
  Low: { color: 'text-muted-foreground', ring: 'ring-muted' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'hsl(var(--success))';
  if (score >= 60) return 'hsl(var(--warning))';
  if (score >= 40) return 'hsl(38, 92%, 50%)';
  return 'hsl(var(--destructive))';
};

const getScoreGradient = (score: number): { start: string; end: string } => {
  if (score >= 80) return { start: '#22c55e', end: '#16a34a' };
  if (score >= 60) return { start: '#eab308', end: '#ca8a04' };
  if (score >= 40) return { start: '#f59e0b', end: '#d97706' };
  return { start: '#ef4444', end: '#dc2626' };
};

const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Très bien';
  if (score >= 70) return 'Bien';
  if (score >= 60) return 'Acceptable';
  if (score >= 40) return 'À améliorer';
  return 'Critique';
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CIHealthGauge: React.FC<CIHealthGaugeProps> = ({
  dqsScore,
  previousScore,
  status,
  criticality,
  lastReconciliation,
  size = 'md',
  showDetails = true,
  className,
}) => {
  const config = SIZE_CONFIG[size];
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.In_Use;
  const critConfig = CRITICALITY_CONFIG[criticality] || CRITICALITY_CONFIG.Medium;
  const scoreColor = getScoreColor(dqsScore);
  const gradient = getScoreGradient(dqsScore);

  // Calculate trend
  const trend = useMemo(() => {
    if (previousScore === undefined) return null;
    const diff = dqsScore - previousScore;
    if (diff > 5) return { direction: 'up', value: diff, icon: TrendingUp };
    if (diff < -5) return { direction: 'down', value: Math.abs(diff), icon: TrendingDown };
    return { direction: 'stable', value: 0, icon: Minus };
  }, [dqsScore, previousScore]);

  // Gauge data
  const gaugeData = [
    { name: 'score', value: dqsScore },
    { name: 'remaining', value: 100 - dqsScore },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden',
        className
      )}
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
      <div
        className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: scoreColor }}
      />

      {/* Tech corners */}
      <div className="pointer-events-none">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
      </div>

      <div className="flex items-center gap-6">
        {/* Gauge */}
        <div className="relative" style={{ width: config.gauge, height: config.gauge }}>
          {/* SVG Filters */}
          <svg width="0" height="0">
            <defs>
              <filter id="gaugeGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={gradient.start} />
                <stop offset="100%" stopColor={gradient.end} />
              </linearGradient>
            </defs>
          </svg>

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                innerRadius="70%"
                outerRadius="100%"
                startAngle={225}
                endAngle={-45}
                paddingAngle={0}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell
                  fill="url(#scoreGradient)"
                  style={{ filter: 'url(#gaugeGlow)' }}
                />
                <Cell fill="hsl(var(--muted) / 0.3)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className={cn('font-bold', config.text)}
              style={{ color: scoreColor }}
            >
              {dqsScore}
            </motion.span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              DQS
            </span>
          </div>

          {/* Rotating ring for critical items */}
          {criticality === 'Critical' && (
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-destructive"
                style={{ filter: 'drop-shadow(0 0 4px rgb(239 68 68))' }}
              />
            </motion.div>
          )}
        </div>

        {/* Details */}
        {showDetails && (
          <div className="flex-1 space-y-4">
            {/* Score label with trend */}
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{getScoreLabel(dqsScore)}</span>
              {trend && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    trend.direction === 'up' && 'bg-success/10 text-success',
                    trend.direction === 'down' && 'bg-destructive/10 text-destructive',
                    trend.direction === 'stable' && 'bg-muted text-muted-foreground'
                  )}
                >
                  <trend.icon className="h-3 w-3" />
                  {trend.value > 0 && `${trend.direction === 'up' ? '+' : '-'}${trend.value}%`}
                </motion.div>
              )}
            </div>

            {/* Status and Criticality */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={cn(
                  'p-3 rounded-2xl flex items-center gap-2',
                  statusConfig.bgColor
                )}
              >
                <statusConfig.icon className={cn('h-4 w-4', statusConfig.color)} />
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <p className={cn('text-sm font-semibold', statusConfig.color)}>
                    {status.replace('_', ' ')}
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  'p-3 rounded-2xl border-2',
                  critConfig.ring,
                  'bg-background/50'
                )}
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Criticité
                </p>
                <p className={cn('text-sm font-semibold', critConfig.color)}>
                  {criticality}
                </p>
              </div>
            </div>

            {/* Last reconciliation */}
            {lastReconciliation && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>
                  Dernière réconciliation:{' '}
                  <span className="font-medium text-foreground">
                    {lastReconciliation.toLocaleDateString()}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quality breakdown bar */}
      <div className="mt-4 pt-4 border-t border-border/40">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Qualité des données</span>
          <span className="font-medium">{dqsScore}%</span>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${dqsScore}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${gradient.start}, ${gradient.end})`,
              boxShadow: `0 0 10px ${gradient.start}40`,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default CIHealthGauge;
