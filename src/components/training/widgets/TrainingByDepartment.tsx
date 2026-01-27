/**
 * TrainingByDepartment Widget
 *
 * Bar chart showing training completion by department.
 * Part of the Training Dashboard (NIS2 Art. 21.2g).
 *
 * @module TrainingByDepartment
 */

import React, { useId } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Building2 } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { useStore } from '../../../store';
import type { DepartmentTrainingStats } from '../../../types/training';

// ============================================================================
// Types
// ============================================================================

interface TrainingByDepartmentProps {
  data: DepartmentTrainingStats[];
  isLoading: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const getBarColor = (completionRate: number): string => {
  if (completionRate >= 80) return 'hsl(var(--success))';
  if (completionRate >= 50) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
};

// ============================================================================
// Component
// ============================================================================

export const TrainingByDepartment: React.FC<TrainingByDepartmentProps> = ({
  data,
  isLoading,
}) => {
  const { t, theme } = useStore();
  const gradientId = useId();

  const chartColors = {
    grid: theme === 'dark' ? 'hsl(var(--border) / 0.35)' : 'hsl(var(--border) / 0.6)',
    text: 'hsl(var(--muted-foreground))',
    primary: 'hsl(var(--primary))',
  };

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

  if (!data || data.length === 0) {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-white/10 h-[400px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/10">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {t('training.dashboard.byDepartment')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('training.dashboard.byDepartmentDesc')}
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center h-[300px]">
          <EmptyState
            icon={Building2}
            title={t('training.empty.noData')}
            description={t('training.empty.noDataDesc')}
            compact
          />
        </div>
      </div>
    );
  }

  // Take top 8 departments for display
  const displayData = data.slice(0, 8);

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 h-[400px]">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/10">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">
            {t('training.dashboard.byDepartment')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('training.dashboard.byDepartmentDesc')}
          </p>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={displayData}
            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            layout="vertical"
          >
            <defs>
              <linearGradient id={`${gradientId}-bar`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.8} />
                <stop offset="100%" stopColor={chartColors.primary} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke={chartColors.grid}
              opacity={0.5}
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: chartColors.text, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="category"
              dataKey="department"
              tick={{ fontSize: 11, fill: chartColors.text, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(value) => `${value}%`}
                />
              }
              cursor={{ fill: chartColors.grid, opacity: 0.3 }}
            />
            <Bar
              dataKey="completionRate"
              name={t('training.stats.completionRate')}
              radius={[0, 4, 4, 0]}
              animationDuration={1000}
            >
              {displayData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry.completionRate)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

TrainingByDepartment.displayName = 'TrainingByDepartment';
