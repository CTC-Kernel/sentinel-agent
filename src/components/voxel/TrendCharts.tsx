/**
 * Story 31.8 - Trend Charts
 * Story 31.9 - Predictive Trends (integrated)
 *
 * Line charts showing Voxel metrics over time with predictive projections.
 * Uses recharts for visualization.
 */

import React, { useState, useCallback, useEffect, useMemo, useId } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Layers,
  ShieldAlert,
  CheckCircle2,
} from '../ui/Icons';
import { format, parseISO, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase';

// ============================================================================
// Types
// ============================================================================

interface TrendDataPoint {
  date: string;
  formattedDate: string;
  nodes: number;
  risks: number;
  anomalies: number;
  compliance: number;
  // Predicted values (for Story 31.9)
  predictedNodes?: number;
  predictedRisks?: number;
  predictedAnomalies?: number;
  predictedCompliance?: number;
  // Confidence bounds
  nodesLower?: number;
  nodesUpper?: number;
}

type TimeRange = '7d' | '30d' | '90d' | '1y';
type MetricType = 'nodes' | 'risks' | 'anomalies' | 'compliance';

interface TrendChartsProps {
  /** CSS class name */
  className?: string;
  /** Initial time range */
  initialTimeRange?: TimeRange;
  /** Whether to show predictive trends */
  showPredictions?: boolean;
  /** Number of days to predict */
  predictionDays?: number;
}

interface TrendWarning {
  metric: MetricType;
  message: string;
  severity: 'warning' | 'critical';
}

interface VoxelSnapshot {
  date: string;
  metrics?: {
    nodes?: { total: number };
    risks?: { total: number };
    anomalies?: { active: number };
    compliance?: { implementationRate: number };
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simple linear regression for trend prediction
 */
function linearRegression(data: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.y || 0, r2: 0 };

  const sumX = data.reduce((acc, d) => acc + d.x, 0);
  const sumY = data.reduce((acc, d) => acc + d.y, 0);
  const sumXY = data.reduce((acc, d) => acc + d.x * d.y, 0);
  const sumX2 = data.reduce((acc, d) => acc + d.x * d.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const ssTot = data.reduce((acc, d) => acc + Math.pow(d.y - yMean, 2), 0);
  const ssRes = data.reduce((acc, d) => acc + Math.pow(d.y - (slope * d.x + intercept), 2), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

/**
 * Generate predictions for future dates
 */
function generatePredictions(
  data: TrendDataPoint[],
  metric: MetricType,
  daysToPredict: number
): { predictions: TrendDataPoint[]; warning: TrendWarning | null } {
  if (data.length < 7) return { predictions: [], warning: null };

  // Prepare data for regression
  const regressionData = data.map((d, i) => ({
    x: i,
    y: d[metric] as number,
  }));

  const { slope, intercept } = linearRegression(regressionData);

  // Generate predictions
  const predictions: TrendDataPoint[] = [];
  const lastDate = parseISO(data[data.length - 1].date);
  const stdDev = Math.sqrt(
    regressionData.reduce((acc, d) => acc + Math.pow(d.y - (slope * d.x + intercept), 2), 0) /
    regressionData.length
  );

  for (let i = 1; i <= daysToPredict; i++) {
    const predictedDate = new Date(lastDate);
    predictedDate.setDate(predictedDate.getDate() + i);
    const x = data.length + i - 1;
    const predictedValue = Math.max(0, Math.round(slope * x + intercept));

    predictions.push({
      date: format(predictedDate, 'yyyy-MM-dd'),
      formattedDate: format(predictedDate, 'dd/MM', { locale: fr }),
      nodes: 0,
      risks: 0,
      anomalies: 0,
      compliance: 0,
      [`predicted${metric.charAt(0).toUpperCase() + metric.slice(1)}`]: predictedValue,
      [`${metric}Lower`]: Math.max(0, Math.round(predictedValue - 2 * stdDev)),
      [`${metric}Upper`]: Math.round(predictedValue + 2 * stdDev),
    } as TrendDataPoint);
  }

  // Check for concerning trends
  let warning: TrendWarning | null = null;
  const lastValue = data[data.length - 1][metric] as number;
  const predictedValue = predictions[predictions.length - 1]?.[
    `predicted${metric.charAt(0).toUpperCase() + metric.slice(1)}` as keyof TrendDataPoint
  ] as number;

  if (metric === 'anomalies' && slope > 0 && predictedValue > lastValue * 1.5) {
    warning = {
      metric,
      message: `Les anomalies pourraient augmenter de ${Math.round((predictedValue / lastValue - 1) * 100)}% dans les ${daysToPredict} prochains jours`,
      severity: slope > 0.5 ? 'critical' : 'warning',
    };
  } else if (metric === 'compliance' && slope < -0.5) {
    warning = {
      metric,
      message: `La conformite pourrait baisser a ${predictedValue}% dans les ${daysToPredict} prochains jours`,
      severity: predictedValue < 70 ? 'critical' : 'warning',
    };
  }

  return { predictions, warning };
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Time range selector
 */
function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  const ranges: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7J' },
    { value: '30d', label: '30J' },
    { value: '90d', label: '90J' },
    { value: '1y', label: '1A' },
  ];

  return (
    <div className="flex bg-muted rounded-lg p-1 gap-1">
      {ranges.map((range) => (
        <Button
          key={range.value}
          variant={value === range.value ? 'secondary' : 'ghost'}
          size="sm"
          className="px-3 py-1 h-7 text-xs"
          onClick={() => onChange(range.value)}
        >
          {range.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Trend warning banner
 */
function TrendWarningBanner({ warnings }: { warnings: TrendWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning, index) => (
        <div
          key={`${warning.metric}-${index}`}
          className={cn(
            'flex items-center gap-2 p-3 rounded-lg text-sm',
            warning.severity === 'critical'
              ? 'bg-red-500/10 text-red-700 dark:text-red-400'
              : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
          )}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Custom tooltip for charts
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Metric summary card
 */
function MetricSummary({
  label,
  value,
  change,
  icon: Icon,
  trend,
}: {
  label: string;
  value: number | string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold">{value}</span>
        {change !== undefined && (
          <span
            className={cn(
              'text-xs flex items-center gap-0.5',
              change > 0 ? 'text-emerald-500' : change < 0 ? 'text-red-500' : 'text-muted-foreground'
            )}
          >
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TrendCharts({
  className,
  initialTimeRange = '30d',
  showPredictions = true,
  predictionDays = 30,
}: TrendChartsProps) {
  const gradientId = useId();
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart colors based on theme
  const chartColors = {
    nodes: 'hsl(var(--primary))',
    risks: 'hsl(0, 84%, 60%)', // Red
    anomalies: 'hsl(38, 92%, 50%)', // Orange
    compliance: 'hsl(142, 71%, 45%)', // Green
    predicted: 'hsl(var(--muted-foreground))',
    grid: 'hsl(var(--border) / 0.5)',
  };

  // Calculate days for time range
  const daysForRange = useMemo(() => {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  }, [timeRange]);

  // Fetch trend data
  const fetchTrendData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const startDate = format(subDays(new Date(), daysForRange), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');

      const getSnapshots = httpsCallable(functions, 'getVoxelSnapshots');
      const result = await getSnapshots({
        startDate,
        endDate,
        limit: daysForRange,
      });

      const response = result.data as { success: boolean; snapshots: VoxelSnapshot[] };
      if (response.success) {
        const trendData: TrendDataPoint[] = response.snapshots
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((snapshot) => ({
            date: snapshot.date,
            formattedDate: format(parseISO(snapshot.date), 'dd/MM', { locale: fr }),
            nodes: snapshot.metrics?.nodes?.total || 0,
            risks: snapshot.metrics?.risks?.total || 0,
            anomalies: snapshot.metrics?.anomalies?.active || 0,
            compliance: snapshot.metrics?.compliance?.implementationRate || 0,
          }));

        setData(trendData);
      } else {
        setError('Impossible de charger les donnees');
      }
    } catch (err) {
      console.error('Failed to fetch trend data:', err);
      setError('Erreur lors du chargement des tendances');
    } finally {
      setIsLoading(false);
    }
  }, [daysForRange]);

  // Fetch data on mount and when time range changes
  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  // Generate predictions
  const { chartData, warnings } = useMemo(() => {
    if (!showPredictions || data.length < 7) {
      return { chartData: data, warnings: [] };
    }

    const warnings: TrendWarning[] = [];
    const metrics: MetricType[] = ['nodes', 'risks', 'anomalies', 'compliance'];
    const allPredictions: TrendDataPoint[] = [];

    metrics.forEach((metric) => {
      const { predictions, warning } = generatePredictions(data, metric, predictionDays);
      if (warning) warnings.push(warning);

      // Merge predictions
      predictions.forEach((pred, i) => {
        if (!allPredictions[i]) {
          allPredictions[i] = pred;
        } else {
          allPredictions[i] = { ...allPredictions[i], ...pred };
        }
      });
    });

    // Mark last actual data point
    const chartData = [...data, ...allPredictions];

    return { chartData, warnings };
  }, [data, showPredictions, predictionDays]);

  // Calculate summaries
  const summaries = useMemo(() => {
    if (data.length < 2) return null;

    const first = data[0];
    const last = data[data.length - 1];

    const calcChange = (current: number, previous: number) =>
      previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);

    return {
      nodes: {
        value: last.nodes,
        change: calcChange(last.nodes, first.nodes),
        trend: last.nodes > first.nodes ? 'up' : last.nodes < first.nodes ? 'down' : 'stable',
      },
      risks: {
        value: last.risks,
        change: calcChange(last.risks, first.risks),
        trend: last.risks > first.risks ? 'up' : last.risks < first.risks ? 'down' : 'stable',
      },
      anomalies: {
        value: last.anomalies,
        change: calcChange(last.anomalies, first.anomalies),
        trend: last.anomalies > first.anomalies ? 'up' : last.anomalies < first.anomalies ? 'down' : 'stable',
      },
      compliance: {
        value: `${last.compliance}%`,
        change: last.compliance - first.compliance,
        trend: last.compliance > first.compliance ? 'up' : last.compliance < first.compliance ? 'down' : 'stable',
      },
    } as const;
  }, [data]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchTrendData}>
              Reessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Tendances Voxel
            </CardTitle>
            <CardDescription>
              Evolution des metriques sur {timeRange === '1y' ? '1 an' : `${daysForRange} jours`}
              {showPredictions && ' + predictions'}
            </CardDescription>
          </div>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warnings */}
        {warnings.length > 0 && <TrendWarningBanner warnings={warnings} />}

        {/* Summary cards */}
        {summaries && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricSummary
              label="Noeuds"
              value={summaries.nodes.value}
              change={summaries.nodes.change}
              trend={summaries.nodes.trend}
              icon={Layers}
            />
            <MetricSummary
              label="Risques"
              value={summaries.risks.value}
              change={summaries.risks.change}
              trend={summaries.risks.trend}
              icon={ShieldAlert}
            />
            <MetricSummary
              label="Anomalies"
              value={summaries.anomalies.value}
              change={summaries.anomalies.change}
              trend={summaries.anomalies.trend}
              icon={AlertTriangle}
            />
            <MetricSummary
              label="Conformite"
              value={summaries.compliance.value}
              change={summaries.compliance.change}
              trend={summaries.compliance.trend}
              icon={CheckCircle2}
            />
          </div>
        )}

        {/* Main chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id={`${gradientId}-nodes`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.nodes} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColors.nodes} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend />

              {/* Vertical line separating actual from predicted */}
              {showPredictions && data.length > 0 && (
                <ReferenceLine
                  x={data[data.length - 1].formattedDate}
                  stroke={chartColors.predicted}
                  strokeDasharray="3 3"
                  label={{
                    value: 'Predictions',
                    position: 'top',
                    fontSize: 10,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                />
              )}

              {/* Actual data lines */}
              <Line
                type="monotone"
                dataKey="nodes"
                stroke={chartColors.nodes}
                strokeWidth={2}
                dot={false}
                name="Noeuds"
              />
              <Line
                type="monotone"
                dataKey="anomalies"
                stroke={chartColors.anomalies}
                strokeWidth={2}
                dot={false}
                name="Anomalies"
              />

              {/* Predicted lines (dashed) */}
              {showPredictions && (
                <>
                  <Line
                    type="monotone"
                    dataKey="predictedNodes"
                    stroke={chartColors.nodes}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Noeuds (prediction)"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedAnomalies"
                    stroke={chartColors.anomalies}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Anomalies (prediction)"
                    connectNulls
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Compliance chart (separate for clarity) */}
        <div className="h-48">
          <p className="text-sm font-medium mb-2">Evolution de la conformite</p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id={`${gradientId}-compliance`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.compliance} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColors.compliance} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<ChartTooltip />} />

              <Area
                type="monotone"
                dataKey="compliance"
                stroke={chartColors.compliance}
                fill={`url(#${gradientId}-compliance)`}
                strokeWidth={2}
                name="Conformite"
              />

              {showPredictions && (
                <Line
                  type="monotone"
                  dataKey="predictedCompliance"
                  stroke={chartColors.compliance}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Conformite (prediction)"
                  connectNulls
                />
              )}

              {/* Warning threshold */}
              <ReferenceLine
                y={70}
                stroke="hsl(38, 92%, 50%)"
                strokeDasharray="3 3"
                label={{
                  value: 'Seuil d\'alerte (70%)',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'hsl(38, 92%, 50%)',
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default TrendCharts;
