/**
 * SupplierConcentrationTab Component
 * Embedded concentration risk dashboard for the Suppliers module
 * 
 * Displays vendor concentration metrics, SPOF alerts, category distribution,
 * dependency matrix, and diversification recommendations.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
    type LucideIcon,
} from '../ui/Icons';
import { useStore } from '../../store';
import { VendorConcentrationService } from '../../services/VendorConcentrationService';
import { CategoryChart } from '../vendor-concentration/CategoryChart';
import { DependencyMatrix } from '../vendor-concentration/DependencyMatrix';
import { SPOFAlerts } from '../vendor-concentration/SPOFAlerts';
import { ConcentrationRecommendations } from '../vendor-concentration/ConcentrationRecommendations';
import { ScrollableTabs } from '../ui/ScrollableTabs';
import type {
    ConcentrationMetrics,
    SPOFSummary,
    RecommendationsSummary,
    ConcentrationTrends,
    DependencyMatrix as DependencyMatrixType,
} from '../../types/vendorConcentration';
import { getTrendIndicator } from '../../types/vendorConcentration';

// ============================================================================
// Types
// ============================================================================

type ConcentrationTabId = 'overview' | 'matrix' | 'recommendations';

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
}) => {
    const colorClasses = {
        default: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
        warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
        danger: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        success: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    };

    const TrendIcon = trend?.direction === 'up'
        ? TrendingUp
        : trend?.direction === 'down'
            ? TrendingDown
            : Minus;

    const trendColor = trend?.direction === 'up'
        ? 'text-red-500'
        : trend?.direction === 'down'
            ? 'text-green-500'
            : 'text-slate-500';

    return (
        <div className="glass-panel p-5 rounded-2xl">
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
// Concentration Level Badge
// ============================================================================

interface ConcentrationBadgeProps {
    level: 'low' | 'moderate' | 'high';
}

const ConcentrationBadge: React.FC<ConcentrationBadgeProps> = ({ level }) => {
    const { t } = useTranslation();

    const styles = {
        low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        moderate: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
        high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[level]}`}>
            {t(`vendorConcentration.level.${level}`)}
        </span>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const SupplierConcentrationTab: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useStore();
    const organizationId = user?.organizationId;

    // State
    const [activeSubTab, setActiveSubTab] = useState<ConcentrationTabId>('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [metrics, setMetrics] = useState<ConcentrationMetrics | null>(null);
    const [spofSummary, setSpofSummary] = useState<SPOFSummary | null>(null);
    const [recommendations, setRecommendations] = useState<RecommendationsSummary | null>(null);
    const [trends, setTrends] = useState<ConcentrationTrends | null>(null);
    const [dependencyMatrix, setDependencyMatrix] = useState<DependencyMatrixType | null>(null);

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
                VendorConcentrationService.calculateConcentrationMetrics(organizationId, {}),
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
            console.error('Failed to load concentration data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationId]);

    // Memoized values
    const trendIndicator = useMemo(() => {
        if (!trends) return null;
        return getTrendIndicator(trends.trendDirection);
    }, [trends]);

    const subTabs = [
        { id: 'overview', label: t('vendorConcentration.tabs.overview'), icon: PieChart },
        { id: 'matrix', label: t('vendorConcentration.tabs.matrix'), icon: Grid3X3 },
        { id: 'recommendations', label: t('vendorConcentration.tabs.recommendations'), icon: Lightbulb },
    ];

    // Loading state
    if (isLoading && !metrics) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header with Refresh */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                        {t('vendorConcentration.title')}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                        {t('vendorConcentration.subtitle')}
                    </p>
                </div>
                <button
                    onClick={() => loadData(true)}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {t('common.refresh')}
                </button>
            </div>

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

            {/* Sub-Tabs */}
            <ScrollableTabs
                tabs={subTabs}
                activeTab={activeSubTab}
                onTabChange={(id) => setActiveSubTab(id as ConcentrationTabId)}
            />

            {/* Tab Content */}
            {activeSubTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Category Distribution Chart */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            {t('vendorConcentration.categoryDistribution.title')}
                        </h3>
                        {metrics && (
                            <CategoryChart
                                categories={metrics.categoryConcentration}
                                totalVendors={metrics.totalVendors}
                            />
                        )}
                    </div>

                    {/* SPOF Alerts */}
                    <div className="glass-panel p-6 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {t('vendorConcentration.spofAlerts.title')}
                            </h3>
                            {spofSummary && spofSummary.totalSPOFs > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600">
                                    {spofSummary.totalSPOFs} {t('vendorConcentration.spofAlerts.alertCount')}
                                </span>
                            )}
                        </div>
                        {spofSummary && (
                            <SPOFAlerts
                                summary={spofSummary}
                                onViewDetails={() => setActiveSubTab('recommendations')}
                            />
                        )}
                    </div>

                    {/* Trend Summary */}
                    {trends && trends.overallTrend.length > 0 && (
                        <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                                {t('vendorConcentration.trends.title')}
                            </h3>
                            <div className="flex items-center gap-4">
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

            {activeSubTab === 'matrix' && dependencyMatrix && (
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        {t('vendorConcentration.dependencyMatrix.title')}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6">
                        {t('vendorConcentration.dependencyMatrix.description')}
                    </p>
                    <DependencyMatrix matrix={dependencyMatrix} />
                </div>
            )}

            {activeSubTab === 'recommendations' && recommendations && (
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {t('vendorConcentration.recommendations.title')}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                                {t('vendorConcentration.recommendations.subtitle', {
                                    count: recommendations.totalRecommendations,
                                    reduction: recommendations.estimatedTotalRiskReduction,
                                })}
                            </p>
                        </div>
                        {recommendations.highPriority > 0 && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600">
                                {recommendations.highPriority} {t('vendorConcentration.recommendations.highPriority')}
                            </span>
                        )}
                    </div>
                    <ConcentrationRecommendations recommendations={recommendations} />
                </div>
            )}
        </div>
    );
};

export default SupplierConcentrationTab;
