/**
 * TrainingTrendChart Widget
 *
 * Line chart showing training completion trends over time.
 * Part of the Training Dashboard (NIS2 Art. 21.2g).
 *
 * @module TrainingTrendChart
 */

import React, { useId, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { useStore } from '../../../store';
import i18n from '../../../i18n';
import type { TrainingTrendPoint } from '../../../types/training';
import { SENTINEL_PALETTE, CHART_STYLES } from '../../../theme/chartTheme';

// ============================================================================
// Types
// ============================================================================

interface TrainingTrendChartProps {
  data: TrainingTrendPoint[];
  isLoading: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const TrainingTrendChart: React.FC<TrainingTrendChartProps> = ({
  data,
  isLoading,
}) => {
  const { t, theme } = useStore();
  const completedGradientId = useId();
  const assignedGradientId = useId();

  const chartColors = {
    grid: theme === 'dark' ? 'hsl(var(--border) / 0.35)' : 'hsl(var(--border) / 0.6)',
    text: 'hsl(var(--muted-foreground))',
    completed: SENTINEL_PALETTE.success,
    assigned: SENTINEL_PALETTE.primary,
  };

  // Aggregate data for smoother display (weekly)
  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Group by week for smoother trends
    const weeks: Record<string, { completed: number; assigned: number; endDate: string }> = {};

    data.forEach((point, index) => {
      const weekIndex = Math.floor(index / 7);
      const weekKey = `W${weekIndex}`;

      if (!weeks[weekKey]) {
        weeks[weekKey] = { completed: 0, assigned: 0, endDate: point.date };
      }

      weeks[weekKey].completed += point.completed;
      weeks[weekKey].assigned += point.assigned;
      weeks[weekKey].endDate = point.date;
    });

    return Object.entries(weeks).map(([_, value]) => ({
      date: value.endDate,
      completed: value.completed,
      assigned: value.assigned,
    }));
  }, [data]);

  // Calculate totals for the period
  const periodTotals = useMemo(() => {
    return data.reduce(
      (acc, point) => ({
        completed: acc.completed + point.completed,
        assigned: acc.assigned + point.assigned,
      }),
      { completed: 0, assigned: 0 }
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="glass-premium p-6 rounded-3xl border border-white/10 h-[400px]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div>
              <Skeleton className="h-5 w-48 rounded-md mb-2" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </div>
          </div>
        </div>
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    );
  }

  const hasData = data && data.some((d) => d.completed > 0 || d.assigned > 0);

  if (!hasData) {
    return (
      <div className="glass-premium p-6 rounded-3xl border border-white/10 h-[400px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-success-bg/20">
            <TrendingUp className="w-5 h-5 text-success-text" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">
              {t('training.dashboard.trend30Days')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('training.dashboard.trend30DaysDesc')}
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center h-[300px]">
          <EmptyState
            icon={TrendingUp}
            title={t('training.empty.noTrendData')}
            description={t('training.empty.noTrendDataDesc')}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-premium p-6 rounded-3xl border border-white/10 h-[400px] relative overflow-hidden group/chart hover:shadow-apple-lg transition-all duration-300">
      {/* Dynamic Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-success-bg/20">
            <TrendingUp className="w-5 h-5 text-success-text" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">
              {t('training.dashboard.trend30Days')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('training.dashboard.trend30DaysDesc')}
            </p>
          </div>
        </div>

        {/* Period totals */}
        <div className="flex items-center gap-6 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors.completed }} />
            <span className="text-foreground">
              {periodTotals.completed} <span className="text-muted-foreground font-normal">{t('training.dashboard.completedLabel')}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors.assigned }} />
            <span className="text-foreground">
              {periodTotals.assigned} <span className="text-muted-foreground font-normal">{t('training.dashboard.assignedLabel')}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="h-[300px] relative z-10 -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={aggregatedData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id={completedGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.completed} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColors.completed} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={assignedGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.assigned} stopOpacity={0.2} />
                <stop offset="95%" stopColor={chartColors.assigned} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={CHART_STYLES.grid.stroke}
              opacity={CHART_STYLES.grid.opacity}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: chartColors.text, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              dy={10}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString(i18n.language, {
                  day: '2-digit',
                  month: '2-digit',
                })
              }
            />
            <YAxis
              tick={{ fontSize: 11, fill: chartColors.text }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={CHART_STYLES.grid}
            />
            <Area
              type="monotone"
              dataKey="assigned"
              name={t('training.dashboard.assigned')}
              stroke={chartColors.assigned}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#${assignedGradientId})`}
              animationDuration={1500}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name={t('training.dashboard.completed')}
              stroke={chartColors.completed}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#${completedGradientId})`}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

TrainingTrendChart.displayName = 'TrainingTrendChart';
