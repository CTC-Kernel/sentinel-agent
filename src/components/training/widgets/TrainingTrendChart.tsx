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
  Legend,
} from 'recharts';
import { TrendingUp } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { useStore } from '../../../store';
import i18n from '../../../i18n';
import type { TrainingTrendPoint } from '../../../types/training';

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
    completed: 'hsl(var(--success))',
    assigned: 'hsl(var(--primary))',
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
      <div className="glass-panel p-5 rounded-2xl border border-white/10 h-[400px]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-48 rounded-md mb-2" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </div>
          </div>
        </div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  const hasData = data && data.some((d) => d.completed > 0 || d.assigned > 0);

  if (!hasData) {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-white/10 h-[400px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-success-bg">
            <TrendingUp className="w-5 h-5 text-success-text" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {t('training.dashboard.trend30Days')}
            </h3>
            <p className="text-xs text-muted-foreground">
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
    <div className="glass-panel p-5 rounded-2xl border border-white/10 h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-success-bg">
            <TrendingUp className="w-5 h-5 text-success-text" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {t('training.dashboard.trend30Days')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('training.dashboard.trend30DaysDesc')}
            </p>
          </div>
        </div>

        {/* Period totals */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-muted-foreground">
              {periodTotals.completed} {t('training.dashboard.completedLabel')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">
              {periodTotals.assigned} {t('training.dashboard.assignedLabel')}
            </span>
          </div>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={aggregatedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
              stroke={chartColors.grid}
              opacity={0.5}
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
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{
                stroke: chartColors.completed,
                strokeWidth: 1,
                strokeDasharray: '4 4',
                fill: 'hsl(var(--muted-foreground) / 0.1)',
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ top: -10, right: 0 }}
            />
            <Area
              type="monotone"
              dataKey="assigned"
              name={t('training.dashboard.assigned')}
              stroke={chartColors.assigned}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${assignedGradientId})`}
              animationDuration={1500}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name={t('training.dashboard.completed')}
              stroke={chartColors.completed}
              strokeWidth={2}
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
