/**
 * Simulation Results Component
 * Epic 39: Financial Risk Quantification
 * Story 39-2: Monte Carlo Simulation
 *
 * Visualization of Monte Carlo simulation results.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Target,
  Info,
  Download,
  RefreshCw,
  ChevronRight
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/progress';
import { Tooltip } from '../ui/Tooltip';
import type { SimulationResults as SimulationResultsType } from '../../types/fair';

// ============================================================================
// Types
// ============================================================================

interface SimulationResultsProps {
  results: SimulationResultsType;
  currency?: 'EUR' | 'USD' | 'GBP';
  onRunAgain?: () => void;
  onExport?: () => void;
  loading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (
  value: number,
  currency: 'EUR' | 'USD' | 'GBP' = 'EUR',
  compact: boolean = false
): string => {
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact && value >= 1000000 ? 'compact' : 'standard'
  });
  return formatter.format(value);
};

const formatNumber = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: decimals
  }).format(value);
};

const getRiskLevel = (ale: number): { level: string; color: string; bgColor: string } => {
  if (ale < 50000) {
    return { level: 'low', color: 'text-green-600', bgColor: 'bg-green-100' };
  }
  if (ale < 200000) {
    return { level: 'medium', color: 'text-amber-600', bgColor: 'bg-amber-100' };
  }
  if (ale < 1000000) {
    return { level: 'high', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  }
  return { level: 'critical', color: 'text-red-600', bgColor: 'bg-red-100' };
};

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  highlight?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  description,
  icon,
  trend,
  highlight
}) => (
  <Card
    className={cn(
      'p-4 transition-all',
      highlight && 'ring-2 ring-primary/20 bg-primary/5'
    )}
  >
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              'p-1 rounded',
              trend === 'up' && 'text-red-500 bg-red-100',
              trend === 'down' && 'text-green-500 bg-green-100',
              trend === 'neutral' && 'text-slate-500 bg-slate-100'
            )}
          >
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-4 w-4" />
            ) : null}
          </span>
        )}
        {icon}
      </div>
    </div>
  </Card>
);

// ============================================================================
// Histogram Component
// ============================================================================

interface HistogramProps {
  bins: number[];
  frequencies: number[];
  percentiles: Record<number, number>;
  currency: 'EUR' | 'USD' | 'GBP';
}

const Histogram: React.FC<HistogramProps> = ({ bins, frequencies, percentiles, currency }) => {
  const maxFreq = Math.max(...frequencies);
  const var95Index = bins.findIndex((b) => b >= (percentiles[95] || 0));
  const var99Index = bins.findIndex((b) => b >= (percentiles[99] || 0));

  return (
    <div className="space-y-2">
      <div className="flex items-end h-40 gap-0.5">
        {frequencies.map((freq, i) => {
          const height = (freq / maxFreq) * 100;
          const isVar95 = i === var95Index;
          const isVar99 = i === var99Index;
          const isAbove95 = i >= var95Index;

          return (
            <Tooltip
              key={i}
              content={
                <div>
                  <p className="font-medium">{formatCurrency(bins[i], currency)}</p>
                  <p className="text-xs text-muted-foreground">{freq} occurrences</p>
                </div>
              }
            >
              <div
                className={cn(
                  'flex-1 rounded-t transition-colors cursor-pointer',
                  isVar99 ? 'bg-red-500' : isVar95 ? 'bg-amber-500' : isAbove95 ? 'bg-red-300' : 'bg-blue-400',
                  'hover:opacity-80'
                )}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </Tooltip>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(bins[0] || 0, currency, true)}</span>
        <span>{formatCurrency(bins[bins.length - 1] || 0, currency, true)}</span>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const SimulationResults: React.FC<SimulationResultsProps> = ({
  results,
  currency = 'EUR',
  onRunAgain,
  onExport,
  loading
}) => {
  const { t } = useTranslation();

  const riskLevel = useMemo(
    () => getRiskLevel(results.annualLossExpectancy.total),
    [results.annualLossExpectancy.total]
  );

  const confidenceRange = useMemo(() => {
    const p5 = results.statistics.percentiles[5] || 0;
    const p95 = results.statistics.percentiles[95] || 0;
    return { low: p5, high: p95 };
  }, [results.statistics.percentiles]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', riskLevel.bgColor)}>
            <BarChart3 className={cn('h-5 w-5', riskLevel.color)} />
          </div>
          <div>
            <h3 className="font-semibold">
              {t('fair.results.title', 'Résultats de simulation')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatNumber(results.iterations, 0)} {t('fair.results.iterations', 'itérations')}
              {' • '}
              {t('fair.results.executionTime', '{{time}}ms', {
                time: Math.round(results.executionTimeMs)
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              {t('common.export', 'Exporter')}
            </Button>
          )}
          {onRunAgain && (
            <Button variant="outline" size="sm" onClick={onRunAgain} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('fair.results.runAgain', 'Relancer')}
            </Button>
          )}
        </div>
      </div>

      {/* Warnings */}
      {results.warnings && results.warnings.length > 0 && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                {t('fair.results.warnings', 'Points d\'attention')}
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                {results.warnings.map((warning, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <ChevronRight className="h-3 w-3" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label={t('fair.results.ale', 'ALE (Perte annuelle attendue)')}
          value={formatCurrency(results.annualLossExpectancy.total, currency)}
          description={t('fair.results.aleDesc', 'Moyenne des pertes annuelles')}
          highlight
        />
        <MetricCard
          label={t('fair.results.median', 'Médiane')}
          value={formatCurrency(results.statistics.median, currency)}
          description={t('fair.results.medianDesc', '50ème percentile')}
        />
        <MetricCard
          label={t('fair.results.var95', 'VaR 95%')}
          value={formatCurrency(results.valueAtRisk.var95, currency)}
          description={t('fair.results.var95Desc', 'Pire cas à 95%')}
          icon={<Target className="h-4 w-4 text-amber-500" />}
        />
        <MetricCard
          label={t('fair.results.var99', 'VaR 99%')}
          value={formatCurrency(results.valueAtRisk.var99, currency)}
          description={t('fair.results.var99Desc', 'Pire cas extrême')}
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        />
      </div>

      {/* Distribution Histogram */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">
            {t('fair.results.distribution', 'Distribution des pertes')}
          </h4>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-400" />
              <span className="text-muted-foreground">Normal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-muted-foreground">VaR 95%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-muted-foreground">VaR 99%</span>
            </div>
          </div>
        </div>
        <Histogram
          bins={results.histogram.bins}
          frequencies={results.histogram.frequencies}
          percentiles={results.statistics.percentiles}
          currency={currency}
        />
      </Card>

      {/* Confidence Range */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">
            {t('fair.results.confidenceRange', 'Intervalle de confiance (90%)')}
          </h4>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-green-600">{formatCurrency(confidenceRange.low, currency)}</span>
            <span className="font-medium">{formatCurrency(results.statistics.mean, currency)}</span>
            <span className="text-red-600">{formatCurrency(confidenceRange.high, currency)}</span>
          </div>
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-gradient-to-r from-green-400 via-amber-400 to-red-400"
              style={{ left: '5%', right: '5%' }}
            />
            <div
              className="absolute h-full w-1 bg-foreground"
              style={{
                left: `${
                  ((results.statistics.mean - confidenceRange.low) /
                    (confidenceRange.high - confidenceRange.low)) *
                    90 +
                  5
                }%`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>P5 - {t('fair.results.bestCase', 'Meilleur cas')}</span>
            <span>{t('fair.results.mean', 'Moyenne')}</span>
            <span>P95 - {t('fair.results.worstCase', 'Pire cas')}</span>
          </div>
        </div>
      </Card>

      {/* Statistics Details */}
      <Card className="p-6">
        <h4 className="font-medium mb-4">
          {t('fair.results.statistics', 'Statistiques détaillées')}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t('fair.results.stdDev', 'Écart-type')}</p>
            <p className="font-medium">
              {formatCurrency(results.statistics.standardDeviation, currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('fair.results.skewness', 'Asymétrie')}</p>
            <p className="font-medium">{formatNumber(results.statistics.skewness)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('fair.results.kurtosis', 'Kurtosis')}</p>
            <p className="font-medium">{formatNumber(results.statistics.kurtosis)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('fair.results.range', 'Étendue')}</p>
            <p className="font-medium">
              {formatCurrency(results.statistics.min, currency, true)} -{' '}
              {formatCurrency(results.statistics.max, currency, true)}
            </p>
          </div>
        </div>

        {/* Percentiles */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-3">
            {t('fair.results.percentiles', 'Percentiles')}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(results.statistics.percentiles)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([p, value]) => (
                <Badge key={p} variant="outline" className="font-mono">
                  P{p}: {formatCurrency(value, currency, true)}
                </Badge>
              ))}
          </div>
        </div>
      </Card>

      {/* ALE Breakdown */}
      {results.annualLossExpectancy.secondary > 0 && (
        <Card className="p-6">
          <h4 className="font-medium mb-4">
            {t('fair.results.aleBreakdown', 'Répartition des pertes')}
          </h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('fair.results.primaryLoss', 'Pertes primaires')}</span>
                <span className="font-medium">
                  {formatCurrency(results.annualLossExpectancy.primary, currency)}
                </span>
              </div>
              <Progress
                value={
                  (results.annualLossExpectancy.primary / results.annualLossExpectancy.total) * 100
                }
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('fair.results.secondaryLoss', 'Pertes secondaires')}</span>
                <span className="font-medium">
                  {formatCurrency(results.annualLossExpectancy.secondary, currency)}
                </span>
              </div>
              <Progress
                value={
                  (results.annualLossExpectancy.secondary / results.annualLossExpectancy.total) * 100
                }
                className="h-2"
              />
            </div>
          </div>
        </Card>
      )}

      {/* CVaR Section */}
      <Card className="p-6">
        <h4 className="font-medium mb-4">
          {t('fair.results.cvar', 'Conditional VaR (Tail Risk)')}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950">
            <p className="text-sm text-amber-600 dark:text-amber-400">CVaR 95%</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
              {formatCurrency(results.valueAtRisk.cvar95, currency)}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              {t('fair.results.cvar95Desc', 'Moyenne si dépassement VaR 95%')}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
            <p className="text-sm text-red-600 dark:text-red-400">CVaR 99%</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">
              {formatCurrency(results.valueAtRisk.cvar99, currency)}
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
              {t('fair.results.cvar99Desc', 'Moyenne si dépassement VaR 99%')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SimulationResults;
