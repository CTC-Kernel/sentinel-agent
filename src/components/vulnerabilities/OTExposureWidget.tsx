/**
 * Story 36-4: OT Vulnerability Correlation - OT Exposure Dashboard Widget
 *
 * Dashboard widget showing OT vulnerability exposure:
 * - Total OT assets affected
 * - Critical vulnerabilities on safety systems
 * - Assets with no patch available
 * - Vulnerability trend by OT segment
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Server,
  Shield,
  AlertTriangle,
  TrendingUp,
  ExternalLink
} from '../ui/Icons';
import { ChartTooltip } from '../ui/ChartTooltip';
import { OTVulnerabilityService } from '@/services/OTVulnerabilityService';
import { useStore } from '@/store';
import type { OTExposureMetrics } from '@/types/otVulnerability';
import { SEGMENT_COLORS } from '@/components/voxel/OTNodeMesh';

// ============================================================================
// Types
// ============================================================================

interface OTExposureWidgetProps {
  /** Widget size variant */
  size?: 'compact' | 'full';
  /** Additional class name */
  className?: string;
  /** Click handler for drill-down */
  onDrillDown?: (filter: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: { value: number; direction: 'up' | 'down' };
  color?: string;
  onClick?: () => void;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  color = '#3b82f6',
  onClick,
  loading,
}) => {
  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-left w-full',
        'transition-all duration-200',
        onClick && 'hover:bg-slate-800 hover:border-slate-600 cursor-pointer'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }} className="opacity-80">
          {icon}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold text-white">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-xs flex items-center gap-0.5',
              trend.direction === 'up' ? 'text-red-400' : 'text-green-400'
            )}
          >
            <TrendingUp
              className={cn('h-3 w-3', trend.direction === 'down' && 'rotate-180')}
            />
            {trend.value}%
          </span>
        )}
      </div>
    </button>
  );
};

// ============================================================================
// Mini Trend Chart
// ============================================================================

interface MiniTrendChartProps {
  data: Array<{ date: string; critical: number; high: number }>;
  loading?: boolean;
}

const MiniTrendChart: React.FC<MiniTrendChartProps> = ({ data, loading }) => {
  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-slate-500 dark:text-slate-300 text-sm">
        Aucune donnée
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={96}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload) return null;
            return (
              <ChartTooltip
                active={active}
                payload={payload.map(p => ({
                  name: String(p.dataKey || 'unknown'),
                  value: Number(p.value) || 0,
                  color: p.color || '#000',
                  payload: p.payload
                })) as Array<{
                  name: string;
                  value: number | string;
                  color: string;
                  payload?: Record<string, unknown>;
                  dataKey?: string;
                  [key: string]: unknown;
                }>}
                label={label}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="critical"
          stroke="#ef4444"
          fill="url(#criticalGradient)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="high"
          stroke="#f97316"
          fill="url(#highGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ============================================================================
// Segment Distribution Mini Chart
// ============================================================================

interface SegmentChartProps {
  data: { IT: number; OT: number; DMZ: number };
  loading?: boolean;
}

const SegmentChart: React.FC<SegmentChartProps> = ({ data, loading }) => {
  if (loading) {
    return <Skeleton className="h-20 w-20 rounded-full mx-auto" />;
  }

  const chartData = [
    { name: 'IT', value: data.IT, color: SEGMENT_COLORS.IT },
    { name: 'OT', value: data.OT, color: SEGMENT_COLORS.OT },
    { name: 'DMZ', value: data.DMZ, color: SEGMENT_COLORS.DMZ },
  ].filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-20 flex items-center justify-center text-slate-500 dark:text-slate-300 text-sm">
        Aucune donnée
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={25}
              outerRadius={40}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="text-white font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Top Affected Assets List
// ============================================================================

interface TopAssetsListProps {
  assets: Array<{
    assetId: string;
    assetName: string;
    vulnerabilityCount: number;
    highestSeverity: string;
  }>;
  onAssetClick?: (assetId: string) => void;
  loading?: boolean;
}

const TopAssetsList: React.FC<TopAssetsListProps> = ({ assets, onAssetClick, loading }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="text-center text-slate-500 dark:text-slate-300 text-sm py-4">
        Aucun actif OT affecté
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {assets.map((asset, index) => (
        <button
          key={asset.assetId}
          onClick={() => onAssetClick?.(asset.assetId)}
          className={cn(
            'flex items-center justify-between w-full p-2 rounded-lg',
            'bg-slate-800/30 hover:bg-slate-800/50 transition-colors',
            'text-left'
          )}
        >
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs w-4">{index + 1}.</span>
            <Server className="h-4 w-4 text-orange-400" />
            <span className="text-sm text-white truncate max-w-[150px]">
              {asset.assetName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 rounded text-[11px] font-medium"
              style={{
                backgroundColor: `${SEVERITY_COLORS[asset.highestSeverity as keyof typeof SEVERITY_COLORS]}20`,
                color: SEVERITY_COLORS[asset.highestSeverity as keyof typeof SEVERITY_COLORS],
              }}
            >
              {asset.highestSeverity}
            </span>
            <span className="text-muted-foreground text-xs">{asset.vulnerabilityCount} CVE</span>
          </div>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// Main OTExposureWidget Component
// ============================================================================

export const OTExposureWidget: React.FC<OTExposureWidgetProps> = ({
  size = 'full',
  className,
  onDrillDown,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organization } = useStore();
  const [metrics, setMetrics] = useState<OTExposureMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!organization?.id) return;

      try {
        setLoading(true);
        const data = await OTVulnerabilityService.getOTExposureMetrics(organization.id);
        setMetrics(data);
        setError(null);
      } catch {
        setError(t('otVulnerability.errors.loadFailed', 'Failed to load OT exposure metrics'));
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [organization?.id, t]);

  // Transform trend data for chart
  const trendData = useMemo(() => {
    if (!metrics?.trend) return [];

    return metrics.trend.slice(-7).map((point) => ({
      date: new Date(point.date).toLocaleDateString('fr-FR', { weekday: 'short' }),
      critical: point.critical,
      high: point.total - point.critical,
    }));
  }, [metrics?.trend]);

  // Handle drill-down navigation
  const handleDrillDown = (filter: string) => {
    if (onDrillDown) {
      onDrillDown(filter);
    } else {
      navigate(`/vulnerabilities?filter=${filter}`);
    }
  };

  const handleAssetClick = (assetId: string) => {
    navigate(`/assets/${assetId}`);
  };

  if (error) {
    return (
      <div className={cn('p-6 rounded-2xl bg-slate-900/50 border border-slate-800', className)}>
        <div className="text-center text-red-400">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Compact version
  if (size === 'compact') {
    return (
      <div className={cn('p-4 rounded-xl bg-slate-900/50 border border-slate-800', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-orange-400" />
            <h3 className="text-sm font-medium text-white">
              {t('otVulnerability.widget.title', 'OT Exposure')}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDrillDown('ot')}
            className="h-7 text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            {t('common.viewAll', 'View all')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label={t('otVulnerability.widget.affected', 'Affected')}
            value={metrics?.totalAffectedAssets || 0}
            icon={<Server className="h-4 w-4" />}
            loading={loading}
          />
          <StatCard
            label={t('otVulnerability.widget.critical', 'Critical')}
            value={metrics?.criticalOnSafetySystems || 0}
            icon={<AlertTriangle className="h-4 w-4" />}
            color="#ef4444"
            loading={loading}
          />
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className={cn('p-6 rounded-2xl bg-slate-900/50 border border-slate-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10">
            <Server className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('otVulnerability.widget.title', 'OT Vulnerability Exposure')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('otVulnerability.widget.subtitle', 'Industrial asset vulnerability status')}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => handleDrillDown('ot')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          {t('common.viewDetails', 'View details')}
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('otVulnerability.widget.totalAffected', 'OT Assets Affected')}
          value={metrics?.totalAffectedAssets || 0}
          icon={<Server className="h-4 w-4" />}
          color={SEGMENT_COLORS.OT}
          onClick={() => handleDrillDown('ot-affected')}
          loading={loading}
        />
        <StatCard
          label={t('otVulnerability.widget.criticalSafety', 'Critical on Safety')}
          value={metrics?.criticalOnSafetySystems || 0}
          icon={<Shield className="h-4 w-4" />}
          color="#ef4444"
          onClick={() => handleDrillDown('critical-safety')}
          loading={loading}
        />
        <StatCard
          label={t('otVulnerability.widget.highProduction', 'High on Production')}
          value={metrics?.highOnProductionSystems || 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="#f97316"
          onClick={() => handleDrillDown('high-production')}
          loading={loading}
        />
        <StatCard
          label={t('otVulnerability.widget.noPatch', 'No Patch Available')}
          value={metrics?.assetsWithoutPatch || 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="#ef4444"
          onClick={() => handleDrillDown('no-patch')}
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Trend Chart */}
        <div className="col-span-2">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            {t('otVulnerability.widget.trend', '7-Day Trend')}
          </h4>
          <MiniTrendChart data={trendData} loading={loading} />
        </div>

        {/* Segment Distribution */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            {t('otVulnerability.widget.bySegment', 'By Segment')}
          </h4>
          <SegmentChart
            data={metrics?.bySegment || { IT: 0, OT: 0, DMZ: 0 }}
            loading={loading}
          />
        </div>
      </div>

      {/* Top Affected Assets */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">
          {t('otVulnerability.widget.topAffected', 'Most Vulnerable OT Assets')}
        </h4>
        <TopAssetsList
          assets={metrics?.topAffectedAssets || []}
          onAssetClick={handleAssetClick}
          loading={loading}
        />
      </div>

      {/* Average Score Footer */}
      {!loading && metrics && (
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {t('otVulnerability.widget.avgScore', 'Average OT-Adjusted Score')}
          </span>
          <span
            className={cn(
              'text-sm font-semibold',
              metrics.averageAdjustedScore >= 7
                ? 'text-red-400'
                : metrics.averageAdjustedScore >= 4
                  ? 'text-amber-400'
                  : 'text-green-400'
            )}
          >
            {metrics.averageAdjustedScore.toFixed(1)} / 10
          </span>
        </div>
      )}
    </div>
  );
};

export default OTExposureWidget;
