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
  const colorConfig = {
    primary: {
      bg: 'bg-brand-50',
      text: 'text-brand-500',
      border: 'group-hover:border-brand-300',
    },
    success: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-500',
      border: 'group-hover:border-emerald-500/30',
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-500',
      border: 'group-hover:border-amber-500/30',
    },
    error: {
      bg: 'bg-red-50',
      text: 'text-red-500',
      border: 'group-hover:border-red-500/30',
    },
  };

  const config = colorConfig[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.23, 1, 0.32, 1] }} // Apple-like ease
      className={`glass-premium p-6 rounded-3xl border border-white/10 transition-all duration-300 hover:shadow-apple-md group relative overflow-hidden ${config.border}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-2xl ${config.bg} transition-transform group-hover:scale-110 duration-300`}>
            <Icon className={`w-6 h-6 ${config.text}`} />
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-foreground tracking-tight">
              {value}
            </span>
            {suffix && <span className="text-sm font-semibold text-muted-foreground">{suffix}</span>}
          </div>
          <div className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-wide opacity-80 group-hover:opacity-70 transition-opacity">
            {title}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Skeleton Component
// ============================================================================

const KPICardSkeleton: React.FC = () => (
  <div className="glass-premium p-6 rounded-3xl border border-white/10">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="w-12 h-12 rounded-2xl" />
    </div>
    <div>
      <Skeleton className="h-8 w-24 rounded-lg mb-2" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
      delay: 0.1,
    },
    {
      title: t('training.stats.overdue'),
      value: stats.overdue,
      icon: AlertTriangle,
      color: 'error',
      delay: 0.2,
    },
    {
      title: t('training.stats.completionRate'),
      value: stats.completionRate,
      icon: TrendingUp,
      color: stats.completionRate >= 80 ? 'success' : stats.completionRate >= 50 ? 'warning' : 'error',
      suffix: '%',
      delay: 0.3,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  );
};

TrainingKPICards.displayName = 'TrainingKPICards';

// Also export Users icon usage for in-progress stats if needed
export { Users };
