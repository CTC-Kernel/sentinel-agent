/**
 * COMEX Financial Dashboard
 * Epic 39: Financial Risk Quantification
 * Story 39-4: Executive Financial Dashboard
 *
 * Executive-level dashboard for cyber risk financial reporting.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  DollarSign,
  Target,
  BarChart3,
  PieChart,
  ChevronRight,
  Download,
  Info
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/progress';
import type { FAIRModelConfig } from '../../types/fair';

// ============================================================================
// Types
// ============================================================================

interface COMEXDashboardProps {
  configurations: FAIRModelConfig[];
  currency?: 'EUR' | 'USD' | 'GBP';
  onExport?: () => void;
  onDrillDown?: (configId: string) => void;
}

interface RiskSummary {
  totalALE: number;
  totalVaR95: number;
  totalVaR99: number;
  averageControlStrength: number;
  topRisks: {
    id: string;
    name: string;
    ale: number;
    var95: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  byCategory: Record<string, { ale: number; count: number }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (
  value: number,
  currency: 'EUR' | 'USD' | 'GBP' = 'EUR',
  compact: boolean = false
): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    notation: compact && value >= 1000000 ? 'compact' : 'standard'
  }).format(value);
};

const getRiskLevel = (ale: number): { level: string; color: string; bgColor: string } => {
  if (ale < 100000) return { level: 'Low', color: 'text-green-600', bgColor: 'bg-green-100' };
  if (ale < 500000) return { level: 'Medium', color: 'text-amber-600', bgColor: 'bg-amber-100' };
  if (ale < 2000000) return { level: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  return { level: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' };
};

// ============================================================================
// KPI Card Component
// ============================================================================

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'text-blue-600'
}) => (
  <Card className="p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      <div className="p-2 rounded-lg bg-muted">{icon}</div>
    </div>
    {trend && (
      <div className="flex items-center gap-1 mt-3 pt-3 border-t">
        {trend.value >= 0 ? (
          <TrendingUp className="h-4 w-4 text-red-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-green-500" />
        )}
        <span
          className={cn(
            'text-sm font-medium',
            trend.value >= 0 ? 'text-red-500' : 'text-green-500'
          )}
        >
          {trend.value >= 0 ? '+' : ''}
          {trend.value.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">{trend.label}</span>
      </div>
    )}
  </Card>
);

// ============================================================================
// Risk Table Component
// ============================================================================

interface RiskTableProps {
  risks: RiskSummary['topRisks'];
  currency: 'EUR' | 'USD' | 'GBP';
  onDrillDown?: (id: string) => void;
}

const RiskTable: React.FC<RiskTableProps> = ({ risks, currency, onDrillDown }) => {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-3 text-sm font-medium text-muted-foreground">
              {t('comex.risk', 'Risque')}
            </th>
            <th className="pb-3 text-sm font-medium text-muted-foreground text-right">
              {t('comex.ale', 'ALE')}
            </th>
            <th className="pb-3 text-sm font-medium text-muted-foreground text-right">
              {t('comex.var95', 'VaR 95%')}
            </th>
            <th className="pb-3 text-sm font-medium text-muted-foreground text-center">
              {t('comex.trend', 'Tendance')}
            </th>
            <th className="pb-3 text-sm font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody>
          {risks.map((risk, index) => {
            const riskLevel = getRiskLevel(risk.ale);
            return (
              <tr key={risk.id} className="border-b last:border-0 hover:bg-muted/50">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{risk.name}</p>
                      <Badge className={cn('text-xs mt-1', riskLevel.bgColor, riskLevel.color)}>
                        {riskLevel.level}
                      </Badge>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-right font-mono font-medium">
                  {formatCurrency(risk.ale, currency)}
                </td>
                <td className="py-3 text-right font-mono">
                  {formatCurrency(risk.var95, currency)}
                </td>
                <td className="py-3 text-center">
                  {risk.trend === 'up' && (
                    <span className="inline-flex items-center text-red-500">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                  )}
                  {risk.trend === 'down' && (
                    <span className="inline-flex items-center text-green-500">
                      <TrendingDown className="h-4 w-4" />
                    </span>
                  )}
                  {risk.trend === 'stable' && (
                    <span className="inline-flex items-center text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {onDrillDown && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDrillDown(risk.id)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const COMEXDashboard: React.FC<COMEXDashboardProps> = ({
  configurations,
  currency = 'EUR',
  onExport,
  onDrillDown
}) => {
  const { t } = useTranslation();

  // Calculate summary from configurations
  const summary = useMemo<RiskSummary>(() => {
    const configsWithResults = configurations.filter(c => c.lastSimulation);

    const totalALE = configsWithResults.reduce(
      (sum, c) => sum + (c.lastSimulation?.annualLossExpectancy.total || 0),
      0
    );

    const totalVaR95 = configsWithResults.reduce(
      (sum, c) => sum + (c.lastSimulation?.valueAtRisk.var95 || 0),
      0
    );

    const totalVaR99 = configsWithResults.reduce(
      (sum, c) => sum + (c.lastSimulation?.valueAtRisk.var99 || 0),
      0
    );

    const averageControlStrength =
      configsWithResults.length > 0
        ? configsWithResults.reduce(
            (sum, c) => sum + (c.vulnerability.controlStrength.overall || 0),
            0
          ) / configsWithResults.length
        : 0;

    // Top risks by ALE
    const topRisks = configsWithResults
      .map(c => ({
        id: c.id,
        name: c.name,
        ale: c.lastSimulation?.annualLossExpectancy.total || 0,
        var95: c.lastSimulation?.valueAtRisk.var95 || 0,
        trend: 'stable' as const // Would need historical data for real trends
      }))
      .sort((a, b) => b.ale - a.ale)
      .slice(0, 5);

    // Group by preset scenario type (if available)
    const byCategory: Record<string, { ale: number; count: number }> = {};
    configsWithResults.forEach(c => {
      const category = c.presetId?.split('-')[0] || 'other';
      if (!byCategory[category]) {
        byCategory[category] = { ale: 0, count: 0 };
      }
      byCategory[category].ale += c.lastSimulation?.annualLossExpectancy.total || 0;
      byCategory[category].count += 1;
    });

    return {
      totalALE,
      totalVaR95,
      totalVaR99,
      averageControlStrength,
      topRisks,
      byCategory
    };
  }, [configurations]);

  const overallRiskLevel = getRiskLevel(summary.totalALE);
  const configsWithSimulation = configurations.filter(c => c.lastSimulation).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {t('comex.title', 'Tableau de bord COMEX')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('comex.subtitle', 'Vue exécutive des risques cyber financiers')}
            </p>
          </div>
        </div>
        {onExport && (
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            {t('common.export', 'Exporter')}
          </Button>
        )}
      </div>

      {/* Coverage indicator */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm">
            {t('comex.coverage', '{{count}} risques quantifiés sur {{total}}', {
              count: configsWithSimulation,
              total: configurations.length
            })}
          </span>
        </div>
        <Progress
          value={(configsWithSimulation / Math.max(configurations.length, 1)) * 100}
          className="w-32 h-2"
        />
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('comex.totalALE', 'ALE Totale')}
          value={formatCurrency(summary.totalALE, currency)}
          subtitle={t('comex.aleSubtitle', 'Perte annuelle attendue')}
          icon={<DollarSign className="h-5 w-5 text-red-500" />}
          color={overallRiskLevel.color}
        />
        <KPICard
          title={t('comex.totalVaR', 'VaR 95% Totale')}
          value={formatCurrency(summary.totalVaR95, currency)}
          subtitle={t('comex.varSubtitle', 'Pire cas à 95%')}
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        />
        <KPICard
          title={t('comex.controlStrength', 'Force Contrôles')}
          value={`${summary.averageControlStrength.toFixed(0)}%`}
          subtitle={t('comex.controlSubtitle', 'Moyenne organisation')}
          icon={<Shield className="h-5 w-5 text-blue-500" />}
          color={summary.averageControlStrength >= 60 ? 'text-green-600' : 'text-amber-600'}
        />
        <KPICard
          title={t('comex.riskCount', 'Risques Analysés')}
          value={String(configsWithSimulation)}
          subtitle={t('comex.riskCountSubtitle', 'Avec simulation FAIR')}
          icon={<Target className="h-5 w-5 text-purple-500" />}
        />
      </div>

      {/* Top Risks and Category Breakdown */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Risks Table */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('comex.topRisks', 'Top 5 Risques par ALE')}
          </h3>
          {summary.topRisks.length > 0 ? (
            <RiskTable
              risks={summary.topRisks}
              currency={currency}
              onDrillDown={onDrillDown}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('comex.noRisks', 'Aucun risque quantifié')}
            </div>
          )}
        </Card>

        {/* Risk by Category */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-indigo-500" />
            {t('comex.byCategory', 'Par catégorie')}
          </h3>
          <div className="space-y-4">
            {Object.entries(summary.byCategory).length > 0 ? (
              Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b.ale - a.ale)
                .map(([category, data]) => {
                  const percentage = summary.totalALE > 0
                    ? (data.ale / summary.totalALE) * 100
                    : 0;
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="capitalize">{category}</span>
                        <span className="font-medium">
                          {formatCurrency(data.ale, currency, true)}
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.count} risque{data.count > 1 ? 's' : ''} • {percentage.toFixed(0)}%
                      </p>
                    </div>
                  );
                })
            ) : (
              <p className="text-muted-foreground text-sm">
                {t('comex.noCategories', 'Pas de données')}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* VaR Comparison */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          {t('comex.varComparison', 'Comparaison Value at Risk')}
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
            <p className="text-sm text-muted-foreground mb-1">ALE (Moyenne)</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalALE, currency, true)}
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-950">
            <p className="text-sm text-muted-foreground mb-1">VaR 95%</p>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(summary.totalVaR95, currency, true)}
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
            <p className="text-sm text-muted-foreground mb-1">VaR 99%</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalVaR99, currency, true)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          {t('comex.varNote', 'VaR représente la perte maximale attendue avec le niveau de confiance indiqué')}
        </p>
      </Card>

      {/* Executive Summary */}
      <Card className="p-6 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <h3 className="font-semibold mb-3">
          {t('comex.executiveSummary', 'Synthèse Exécutive')}
        </h3>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>
            {t('comex.summaryText',
              'L\'exposition totale au risque cyber est estimée à {{ale}} par an (ALE), avec un risque de perte maximale de {{var95}} à 95% de confiance. {{count}} scénarios de risque ont été quantifiés avec le modèle FAIR. La force moyenne des contrôles est de {{control}}%.',
              {
                ale: formatCurrency(summary.totalALE, currency),
                var95: formatCurrency(summary.totalVaR95, currency),
                count: configsWithSimulation,
                control: summary.averageControlStrength.toFixed(0)
              }
            )}
          </p>
          {summary.topRisks.length > 0 && (
            <p>
              {t('comex.topRiskNote',
                'Le risque principal "{{name}}" représente {{percent}}% de l\'ALE totale.',
                {
                  name: summary.topRisks[0]?.name || '',
                  percent: summary.totalALE > 0
                    ? ((summary.topRisks[0]?.ale || 0) / summary.totalALE * 100).toFixed(0)
                    : 0
                }
              )}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default COMEXDashboard;
