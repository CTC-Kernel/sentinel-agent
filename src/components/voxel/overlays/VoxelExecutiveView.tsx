/**
 * VoxelExecutiveView - Executive dashboard overlay for 3D visualization
 *
 * Provides a simplified view mode for executives showing:
 * - High-level KPIs
 * - Critical risks summary
 * - Overall compliance status
 * - Trend indicators
 *
 * @see Story VOX-9.8: Mode Direction
 * @see FR52: Executives can view simplified high-level dashboard
 */

import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Shield,
  Activity,
  Target,
  Users,
  Clock,
  ArrowRight,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type TrendDirection = 'up' | 'down' | 'stable';

export interface ExecutiveKPI {
  /** KPI identifier */
  id: string;
  /** Display label */
  label: string;
  /** Current value */
  value: number;
  /** Previous value for trend calculation */
  previousValue?: number;
  /** Unit for display (%, count, etc.) */
  unit?: string;
  /** Trend direction */
  trend?: TrendDirection;
  /** Change percentage */
  changePercent?: number;
  /** Is higher better? (for color coding) */
  higherIsBetter?: boolean;
  /** Icon type */
  icon?: 'shield' | 'alert' | 'activity' | 'target' | 'users';
}

export interface CriticalItem {
  /** Item identifier */
  id: string;
  /** Item title */
  title: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium';
  /** Days since identified */
  ageInDays: number;
  /** Assigned owner */
  owner?: string;
  /** Due date */
  dueDate?: Date;
}

export interface VoxelExecutiveViewProps {
  /** Whether the view is visible */
  visible?: boolean;
  /** KPIs to display */
  kpis?: ExecutiveKPI[];
  /** Critical items requiring attention */
  criticalItems?: CriticalItem[];
  /** Overall risk score (0-100) */
  riskScore?: number;
  /** Compliance score (0-100) */
  complianceScore?: number;
  /** Last updated timestamp */
  lastUpdated?: Date;
  /** Callback when clicking a critical item */
  onCriticalItemClick?: (itemId: string) => void;
  /** Callback when clicking view details */
  onViewDetails?: () => void;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_KPIS: ExecutiveKPI[] = [
  {
    id: 'risk-score',
    label: 'Risk Score',
    value: 72,
    previousValue: 78,
    trend: 'down',
    changePercent: -7.7,
    higherIsBetter: false,
    icon: 'alert',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    value: 89,
    previousValue: 85,
    unit: '%',
    trend: 'up',
    changePercent: 4.7,
    higherIsBetter: true,
    icon: 'shield',
  },
  {
    id: 'controls',
    label: 'Active Controls',
    value: 247,
    previousValue: 235,
    trend: 'up',
    changePercent: 5.1,
    higherIsBetter: true,
    icon: 'target',
  },
  {
    id: 'incidents',
    label: 'Open Incidents',
    value: 12,
    previousValue: 15,
    trend: 'down',
    changePercent: -20,
    higherIsBetter: false,
    icon: 'activity',
  },
];

const DEFAULT_CRITICAL_ITEMS: CriticalItem[] = [
  {
    id: 'risk-1',
    title: 'Unpatched production servers',
    severity: 'critical',
    ageInDays: 14,
    owner: 'IT Security',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'risk-2',
    title: 'Expired SSL certificates',
    severity: 'high',
    ageInDays: 5,
    owner: 'DevOps',
  },
  {
    id: 'risk-3',
    title: 'Access review overdue',
    severity: 'high',
    ageInDays: 30,
    owner: 'IAM Team',
  },
];

const ICON_MAP = {
  shield: Shield,
  alert: AlertTriangle,
  activity: Activity,
  target: Target,
  users: Users,
};

const SEVERITY_COLORS = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
};

// ============================================================================
// Helper Components
// ============================================================================

interface KPICardProps {
  kpi: ExecutiveKPI;
}

const KPICard: React.FC<KPICardProps> = ({ kpi }) => {
  const IconComponent = kpi.icon ? ICON_MAP[kpi.icon] : Activity;

  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;

  const getTrendColor = () => {
    if (!kpi.trend || kpi.trend === 'stable') return '#6B7280';
    const isPositive = kpi.trend === 'up' ? kpi.higherIsBetter : !kpi.higherIsBetter;
    return isPositive ? '#10B981' : '#EF4444';
  };

  return (
    <div
      className="p-4 rounded-3xl"
      style={{
        background: 'rgba(30, 41, 59, 0.6)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(59, 130, 246, 0.15)' }}
        >
          <IconComponent className="w-5 h-5 text-blue-400" />
        </div>
        {kpi.trend && (
          <div className="flex items-center gap-1" style={{ color: getTrendColor() }}>
            <TrendIcon className="w-4 h-4" />
            {kpi.changePercent !== undefined && (
              <span className="text-xs font-medium">
                {kpi.changePercent > 0 ? '+' : ''}
                {kpi.changePercent.toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">
        {kpi.value.toLocaleString()}
        {kpi.unit && <span className="text-lg text-muted-foreground">{kpi.unit}</span>}
      </div>
      <div className="text-xs text-muted-foreground">{kpi.label}</div>
    </div>
  );
};

interface CriticalItemRowProps {
  item: CriticalItem;
  onClick?: () => void;
}

const CriticalItemRow: React.FC<CriticalItemRowProps> = ({ item, onClick }) => {
  const color = SEVERITY_COLORS[item.severity];

  return (
    <button
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/30 transition-colors text-left"
      onClick={onClick}
      aria-label={`View ${item.title}`}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
        aria-label={`${item.severity} severity`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{item.ageInDays}d old</span>
          {item.owner && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-500">{item.owner}</span>
            </>
          )}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-500 dark:text-slate-300 flex-shrink-0" />
    </button>
  );
};

interface ScoreGaugeProps {
  label: string;
  score: number;
  color: string;
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ label, score, color }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-2">{label}</span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const VoxelExecutiveView: React.FC<VoxelExecutiveViewProps> = ({
  visible = true,
  kpis = DEFAULT_KPIS,
  criticalItems = DEFAULT_CRITICAL_ITEMS,
  riskScore = 72,
  complianceScore = 89,
  lastUpdated,
  onCriticalItemClick,
  onViewDetails,
  className = '',
}) => {
  // Calculate risk score color
  const riskColor = useMemo(() => {
    if (riskScore <= 30) return '#10B981';
    if (riskScore <= 60) return '#F59E0B';
    return '#EF4444';
  }, [riskScore]);

  // Calculate compliance score color
  const complianceColor = useMemo(() => {
    if (complianceScore >= 80) return '#10B981';
    if (complianceScore >= 60) return '#F59E0B';
    return '#EF4444';
  }, [complianceScore]);

  // Format last updated
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return null;
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return lastUpdated.toLocaleDateString();
  }, [lastUpdated]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 ${className}`}
      style={{
        background: 'linear-gradient(to top, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.9) 60%, transparent)',
        paddingTop: '60px',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Executive Dashboard</h2>
              {formattedLastUpdated && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>Updated {formattedLastUpdated}</span>
                </div>
              )}
            </div>
          </div>
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center gap-2"
              aria-label="View detailed dashboard"
            >
              View Details
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Score gauges */}
          <div
            className="col-span-3 p-4 rounded-3xl flex items-center justify-around"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            }}
          >
            <ScoreGauge label="Risk Score" score={riskScore} color={riskColor} />
            <div className="w-px h-16 bg-slate-700" />
            <ScoreGauge label="Compliance" score={complianceScore} color={complianceColor} />
          </div>

          {/* KPIs */}
          <div className="col-span-6 grid grid-cols-4 gap-3">
            {kpis.slice(0, 4).map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>

          {/* Critical items */}
          <div
            className="col-span-3 rounded-3xl overflow-hidden"
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            }}
          >
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-white">Attention Required</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                {criticalItems.length}
              </span>
            </div>
            <div className="p-2 max-h-32 overflow-y-auto">
              {criticalItems.slice(0, 3).map((item) => (
                <CriticalItemRow
                  key={item.id}
                  item={item}
                  onClick={() => onCriticalItemClick?.(item.id)}
                />
              ))}
              {criticalItems.length === 0 && (
                <div className="p-4 text-center text-slate-500 dark:text-slate-300 text-sm">
                  No critical items
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoxelExecutiveView;
