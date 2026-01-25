/**
 * VendorConcentration View
 * Story 37-4: Vendor Concentration Dashboard
 *
 * Main dashboard view for visualizing vendor concentration risks,
 * identifying single points of failure, and managing diversification.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorLogger } from '../services/errorLogger';
import {
  Building2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  PieChart,
  Grid3X3,
  Lightbulb,
  RefreshCw,
  Download,
  Filter,
  type LucideIcon,
} from '../components/ui/Icons';
import { useStore } from '../store';
import { VendorConcentrationService } from '../services/VendorConcentrationService';
import { CategoryChart } from '../components/vendor-concentration/CategoryChart';
import { DependencyMatrix } from '../components/vendor-concentration/DependencyMatrix';
import { SPOFAlerts } from '../components/vendor-concentration/SPOFAlerts';
import { ConcentrationRecommendations } from '../components/vendor-concentration/ConcentrationRecommendations';
import type {
  ConcentrationMetrics,
  SPOFSummary,
  RecommendationsSummary,
  ConcentrationTrends,
  ConcentrationFilters,
  DependencyMatrix as DependencyMatrixType,
} from '../types/vendorConcentration';
import { getTrendIndicator } from '../types/vendorConcentration';
import { PageHeader } from '../components/ui/PageHeader';

// ============================================================================
// Types
// ============================================================================

type TabId = 'overview' | 'matrix' | 'recommendations';

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    label: string;
  };
  color?: 'default' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
}

// ============================================================================
// Metric Card Component
// ============================================================================

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'default',
  onClick,
}) => {
  const colorClasses = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    warning: 'bg-warning-bg text-warning-text',
    danger: 'bg-error-bg text-error-text',
    success: 'bg-success-bg text-success-text',
  };

  const TrendIcon = trend?.direction === 'up'
    ? TrendingUp
    : trend?.direction === 'down'
      ? TrendingDown
      : Minus;

  const trendColor = trend?.direction === 'up'
    ? 'text-error-text'
    : trend?.direction === 'down'
      ? 'text-success-text'
      : 'text-slate-500';

  return (
    <div
      className={`
        glass-panel p-5 rounded-2xl
        ${onClick ? 'cursor-pointer hover:shadow-apple-md transition-shadow' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">
          {value}
        </div>
        <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Tab Button Component
// ============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
      ${active
        ? 'bg-brand-600 text-white shadow-apple'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
      }
    `}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

// ============================================================================
// Concentration Level Badge
// ============================================================================

interface ConcentrationBadgeProps {
  level: 'low' | 'moderate' | 'high';
}

const ConcentrationBadge: React.FC<ConcentrationBadgeProps> = ({ level }) => {
  const { t } = useTranslation();

  const styles = {
    low: 'bg-success-bg text-success-text',
    moderate: 'bg-warning-bg text-warning-text',
    high: 'bg-error-bg text-error-text',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[level]}`}>
      {t(`vendorConcentration.level.${level}`)}
    </span>
  );
};

// ============================================================================
// Main View Component
// ============================================================================

export const VendorConcentration: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useStore();
  const organizationId = user?.organizationId;

  // State
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<ConcentrationMetrics | null>(null);
  const [spofSummary, setSpofSummary] = useState<SPOFSummary | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsSummary | null>(null);
  const [trends, setTrends] = useState<ConcentrationTrends | null>(null);
  const [dependencyMatrix, setDependencyMatrix] = useState<DependencyMatrixType | null>(null);
  const [filters] = useState<ConcentrationFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Load data
  const loadData = async (refresh = false) => {
    if (!organizationId) return;

    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Check for cached metrics first (unless refreshing)
      if (!refresh) {
        const cached = await VendorConcentrationService.getCachedMetrics(
          organizationId,
          60
        );
        if (cached) {
          setMetrics(cached);
        }
      }

      // Load all data in parallel
      const [metricsData, spofData, recsData, trendsData, matrixData] = await Promise.all([
        VendorConcentrationService.calculateConcentrationMetrics(
          organizationId,
          filters
        ),
        VendorConcentrationService.identifySPOFs(organizationId),
        VendorConcentrationService.generateRecommendations(organizationId),
        VendorConcentrationService.getConcentrationTrends(organizationId, '90d'),
        VendorConcentrationService.buildDependencyMatrix(organizationId),
      ]);

      setMetrics(metricsData);
      setSpofSummary(spofData);
      setRecommendations(recsData);
      setTrends(trendsData);
      setDependencyMatrix(matrixData);
    } catch (error) {
      ErrorLogger.error(error, 'VendorConcentration.loadData');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, filters]);

  // Memoized values
  const trendIndicator = useMemo(() => {
    if (!trends) return null;
    return getTrendIndicator(trends.trendDirection);
  }, [trends]);

  // Loading state
  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title={t('vendorConcentration.title')}
        subtitle={t('vendorConcentration.subtitle')}
        icon={
          <img
            src="/images/operations.png"
            alt="Concentration"
            className="w-full h-full object-contain"
          />
        }
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${showFilters
                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }
              `}
              title={t('common.filters')}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.filters')}</span>
            </button>
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
              title={t('common.refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('common.refresh')}</span>
            </button>
            <button
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-all"
              title={t('common.export')}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.export')}</span>
            </button>
          </div>
        }
      />

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title={t('vendorConcentration.metrics.totalVendors')}
            value={metrics.totalVendors}
            subtitle={`${metrics.activeVendors} ${t('vendorConcentration.metrics.active')}`}
            icon={Building2}
            trend={trends ? {
              direction: trends.trendDirection === 'improving' ? 'down' : trends.trendDirection === 'worsening' ? 'up' : 'stable',
              value: trends.changePercentage,
              label: t('vendorConcentration.trends.change'),
            } : undefined}
          />
          <MetricCard
            title={t('vendorConcentration.metrics.spofCount')}
            value={metrics.spofCount}
            subtitle={spofSummary ? `${spofSummary.criticalSPOFs} ${t('vendorConcentration.metrics.critical')}` : undefined}
            icon={AlertTriangle}
            color={metrics.spofCount > 0 ? 'danger' : 'success'}
          />
          <MetricCard
            title={t('vendorConcentration.metrics.highDependency')}
            value={metrics.highDependencyCount}
            subtitle={t('vendorConcentration.metrics.vendorsWithHighDep')}
            icon={Target}
            color={metrics.highDependencyCount > 3 ? 'warning' : 'default'}
          />
          <MetricCard
            title={t('vendorConcentration.metrics.concentrationLevel')}
            value={
              <div className="flex items-center gap-2">
                <ConcentrationBadge level={metrics.concentrationLevel} />
              </div>
            }
            subtitle={`HHI: ${Math.round(metrics.overallHHI)}`}
            icon={PieChart}
            color={metrics.concentrationLevel === 'high' ? 'danger' : metrics.concentrationLevel === 'moderate' ? 'warning' : 'success'}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={PieChart}
          label={t('vendorConcentration.tabs.overview')}
        />
        <TabButton
          active={activeTab === 'matrix'}
          onClick={() => setActiveTab('matrix')}
          icon={Grid3X3}
          label={t('vendorConcentration.tabs.matrix')}
        />
        <TabButton
          active={activeTab === 'recommendations'}
          onClick={() => setActiveTab('recommendations')}
          icon={Lightbulb}
          label={t('vendorConcentration.tabs.recommendations')}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Distribution Chart */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {t('vendorConcentration.categoryDistribution.title')}
            </h2>
            {metrics && (
              <CategoryChart
                categories={metrics.categoryConcentration}
                totalVendors={metrics.totalVendors}
              />
            )}
          </div>

          {/* SPOF Alerts */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('vendorConcentration.spofAlerts.title')}
              </h2>
              {spofSummary && spofSummary.totalSPOFs > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-error-bg text-error-text">
                  {spofSummary.totalSPOFs} {t('vendorConcentration.spofAlerts.alertCount')}
                </span>
              )}
            </div>
            {spofSummary && (
              <SPOFAlerts
                summary={spofSummary}
                onViewDetails={() => setActiveTab('recommendations')}
              />
            )}
          </div>

          {/* Trend Summary */}
          {trends && trends.overallTrend.length > 0 && (
            <div className="glass-panel p-4 sm:p-6 rounded-2xl lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {t('vendorConcentration.trends.title')}
              </h2>
              <div className="flex items-center gap-4 flex-wrap">
                {trendIndicator && (
                  <div className={`flex items-center gap-2 ${trendIndicator.color}`}>
                    {trendIndicator.icon === 'up' && <TrendingUp className="h-5 w-5" />}
                    {trendIndicator.icon === 'down' && <TrendingDown className="h-5 w-5" />}
                    {trendIndicator.icon === 'right' && <Minus className="h-5 w-5" />}
                    <span className="font-medium">
                      {t(`vendorConcentration.trends.${trends.trendDirection}`)}
                    </span>
                  </div>
                )}
                <span className="text-slate-600 dark:text-muted-foreground">
                  {trends.changePercentage > 0
                    ? t('vendorConcentration.trends.changeBy', { value: trends.changePercentage })
                    : t('vendorConcentration.trends.noChange')
                  }
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'matrix' && dependencyMatrix && (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {t('vendorConcentration.dependencyMatrix.title')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6">
            {t('vendorConcentration.dependencyMatrix.description')}
          </p>
          <DependencyMatrix
            matrix={dependencyMatrix}
          />
        </div>
      )}

      {activeTab === 'recommendations' && recommendations && (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('vendorConcentration.recommendations.title')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                {t('vendorConcentration.recommendations.subtitle', {
                  count: recommendations.totalRecommendations,
                  reduction: recommendations.estimatedTotalRiskReduction,
                })}
              </p>
            </div>
            {recommendations.highPriority > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-error-bg text-error-text">
                {recommendations.highPriority} {t('vendorConcentration.recommendations.highPriority')}
              </span>
            )}
          </div>
          <ConcentrationRecommendations
            recommendations={recommendations}
          />
        </div>
      )}
    </div>
  );
};

export default VendorConcentration;
