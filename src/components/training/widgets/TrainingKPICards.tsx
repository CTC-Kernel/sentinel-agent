/**
 * TrainingKPICards Widget
 *
 * Displays key performance indicators for training statistics.
 * Part of the Training Dashboard (NIS2 Art. 21.2g).
 *
 * @module TrainingKPICards
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
} from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { useStore } from '../../../store';
import type { TrainingStats } from '../../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingKPICardsProps {
  stats: TrainingStats | null;
  isLoading: boolean;
}

interface KPICardProps {
  title: string;
  value: number | string;
  icon: React.ElementType<{ className?: string }>;
  color: 'primary' | 'success' | 'warning' | 'error';
  suffix?: string;
  delay?: number;
}

// ============================================================================
// KPI Card Component
// ============================================================================

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  suffix = '',
  delay = 0,
}) => {
  const colorClasses = {
    primary: {
      bg: 'bg-primary/10',
      text: 'text-primary',
    },
    success: {
      bg: 'bg-success-bg',
      text: 'text-success-text',
    },
    warning: {
      bg: 'bg-warning-bg',
      text: 'text-warning-text',
    },
    error: {
      bg: 'bg-error-bg',
      text: 'text-error-text',
    },
  };

  const classes = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all hover:shadow-elevation-md"
    >
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-xl ${classes.bg}`}>
          <Icon className={`w-6 h-6 ${classes.text}`} />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold text-foreground">
          {value}
          {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{title}</div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Skeleton Component
// ============================================================================

const KPICardSkeleton: React.FC = () => (
  <div className="glass-panel p-5 rounded-2xl border border-white/10">
    <div className="flex items-center justify-between">
      <Skeleton className="w-12 h-12 rounded-xl" />
    </div>
    <div className="mt-4">
      <Skeleton className="h-9 w-20 rounded-md mb-2" />
      <Skeleton className="h-4 w-32 rounded-md" />
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const TrainingKPICards: React.FC<TrainingKPICardsProps> = ({
  stats,
  isLoading,
}) => {
  const { t } = useStore();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const kpis: KPICardProps[] = [
    {
      title: t('training.stats.total'),
      value: stats.total,
      icon: GraduationCap,
      color: 'primary',
      delay: 0,
    },
    {
      title: t('training.stats.completed'),
      value: stats.completed,
      icon: CheckCircle,
      color: 'success',
      delay: 0.05,
    },
    {
      title: t('training.stats.overdue'),
      value: stats.overdue,
      icon: AlertTriangle,
      color: 'error',
      delay: 0.1,
    },
    {
      title: t('training.stats.completionRate'),
      value: stats.completionRate,
      icon: TrendingUp,
      color: stats.completionRate >= 80 ? 'success' : stats.completionRate >= 50 ? 'warning' : 'error',
      suffix: '%',
      delay: 0.15,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  );
};

TrainingKPICards.displayName = 'TrainingKPICards';

// Also export Users icon usage for in-progress stats if needed
export { Users };
