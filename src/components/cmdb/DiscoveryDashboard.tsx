/**
 * CMDB Discovery Dashboard
 *
 * Main dashboard for CMDB discovery and reconciliation monitoring.
 * Shows discovery stats, pending validations, and recent activity.
 *
 * @module components/cmdb/DiscoveryDashboard
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  ChevronRight,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/Skeleton';
import { Badge } from '../ui/Badge';
import { useStore } from '@/store';
import { useDiscoveryStats, useCMDBActivity } from '@/hooks/cmdb/useCMDBCIs';
import { useCMDBActions, usePendingValidationCount } from '@/stores/cmdbStore';
import { DiscoveryStats, CIClass, CMDBActivity } from '@/types/cmdb';
import { LucideIcon } from '../ui/Icons';
import { ValidationQueue } from './ValidationQueue';
import { cn } from '@/lib/utils';

// =============================================================================
// KPI CARD COMPONENT
// =============================================================================

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  color: 'default' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
  loading?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color,
  onClick,
  loading,
}) => {
  const colorClasses: Record<KPICardProps['color'], string> = {
    default: 'bg-muted/50 text-muted-foreground',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-destructive/10 text-destructive',
    info: 'bg-primary/10 text-primary',
  };

  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-apple-md hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {trend && (
              <p
                className={cn(
                  'text-xs mt-1',
                  trend.positive ? 'text-success' : 'text-muted-foreground'
                )}
              >
                {trend.positive ? '+' : ''}
                {trend.value} {trend.label}
              </p>
            )}
          </div>
          <div className={cn('p-3 rounded-2xl', colorClasses[color])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// =============================================================================
// CI CLASS DISTRIBUTION
// =============================================================================

interface ClassDistributionProps {
  stats: DiscoveryStats | null;
}

const CLASS_COLORS: Record<CIClass, string> = {
  Hardware: 'bg-blue-500',
  Software: 'bg-green-500',
  Service: 'bg-purple-500',
  Document: 'bg-yellow-500',
  Network: 'bg-orange-500',
  Cloud: 'bg-cyan-500',
  Container: 'bg-pink-500',
};

const ClassDistribution: React.FC<ClassDistributionProps> = ({ stats }) => {
  const { t } = useStore();

  // Use real distribution from stats
  const distribution = useMemo(() => {
    if (!stats?.classDistribution) {
      return [];
    }
    return Object.entries(stats.classDistribution)
      .filter(([, count]) => count > 0)
      .map(([ciClass, count]) => ({
        class: ciClass as CIClass,
        count,
        color: CLASS_COLORS[ciClass as CIClass] || 'bg-gray-500',
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats.classDistribution]);

  const total = distribution.reduce((sum, d) => sum + d.count, 0) || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('cmdb.distribution.title', { defaultValue: 'Distribution par Classe' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="h-3 rounded-full overflow-hidden flex mb-4">
          {distribution.map((item, idx) => (
            <div
              key={item.class}
              className={cn(item.color, idx === 0 && 'rounded-l-full', idx === distribution.length - 1 && 'rounded-r-full')}
              style={{ width: `${(item.count / total) * 100}%` }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2">
          {distribution.map((item) => (
            <div key={item.class} className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-full', item.color)} />
              <span className="text-sm text-muted-foreground">{item.class}</span>
              <span className="text-sm font-medium ml-auto">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// =============================================================================
// DATA QUALITY OVERVIEW
// =============================================================================

interface DataQualityOverviewProps {
  avgScore: number;
}

const DataQualityOverview: React.FC<DataQualityOverviewProps> = ({ avgScore }) => {
  const { t } = useStore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return t('cmdb.quality.excellent', { defaultValue: 'Excellente' });
    if (score >= 60) return t('cmdb.quality.good', { defaultValue: 'Bonne' });
    if (score >= 40) return t('cmdb.quality.fair', { defaultValue: 'Moyenne' });
    return t('cmdb.quality.poor', { defaultValue: 'Faible' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('cmdb.quality.title', { defaultValue: 'Qualité des Données' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            {/* Circular progress */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(avgScore / 100) * 352} 352`}
                strokeLinecap="round"
                className={getScoreColor(avgScore)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-3xl font-bold', getScoreColor(avgScore))}>
                {avgScore}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
        </div>
        <p className={cn('text-center mt-4 font-medium', getScoreColor(avgScore))}>
          {getScoreLabel(avgScore)}
        </p>
      </CardContent>
    </Card>
  );
};

// =============================================================================
// RECENT ACTIVITY
// =============================================================================

const ACTIVITY_ICONS: Record<CMDBActivity['type'], LucideIcon> = {
  create: Plus,
  update: RefreshCw,
  delete: AlertTriangle,
  sync: RefreshCw,
  reconcile: Server,
  approve: CheckCircle,
  reject: AlertTriangle,
};

const getActivityColor = (type: CMDBActivity['type']) => {
  switch (type) {
    case 'sync':
    case 'update':
      return 'text-primary';
    case 'approve':
    case 'create':
      return 'text-success';
    case 'reconcile':
      return 'text-info';
    case 'reject':
    case 'delete':
      return 'text-warning';
    default:
      return 'text-muted-foreground';
  }
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}j`;
};

const RecentActivity: React.FC = () => {
  const { t } = useStore();
  const { data: activities = [], isLoading } = useCMDBActivity(10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t('cmdb.activity.title', { defaultValue: 'Activité Récente' })}
        </CardTitle>
        <Button variant="ghost" size="sm">
          {t('common.viewAll', { defaultValue: 'Voir tout' })}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('cmdb.activity.empty', { defaultValue: 'Aucune activité récente' })}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type] || RefreshCw;
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg bg-muted/50', getActivityColor(activity.type))}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{formatTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const DiscoveryDashboard: React.FC = () => {
  const { t } = useStore();
  const navigate = useNavigate();
  const { openInspector } = useCMDBActions();
  const pendingCount = usePendingValidationCount();

  const { data: stats, isLoading: statsLoading, refetch } = useDiscoveryStats();

  const handleRefresh = () => {
    refetch();
  };

  const handleNewCI = () => {
    openInspector();
  };

  const handleViewAll = () => {
    navigate('/cmdb/cis');
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {t('cmdb.discovery.title', { defaultValue: 'CMDB Discovery' })}
          </h1>
          <p className="text-muted-foreground">
            {t('cmdb.discovery.subtitle', { defaultValue: 'Découverte et réconciliation des Configuration Items' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh', { defaultValue: 'Actualiser' })}
          </Button>
          <Button onClick={handleNewCI}>
            <Plus className="h-4 w-4 mr-2" />
            {t('cmdb.newCI', { defaultValue: 'Nouveau CI' })}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('cmdb.stats.total', { defaultValue: 'Total CIs' })}
          value={stats?.total || 0}
          icon={Server}
          trend={{ value: stats?.createdToday || 0, label: t('cmdb.stats.today', { defaultValue: "aujourd'hui" }), positive: true }}
          color="info"
          onClick={handleViewAll}
          loading={statsLoading}
        />
        <KPICard
          title={t('cmdb.stats.pending', { defaultValue: 'En Attente' })}
          value={stats?.pending || 0}
          icon={Clock}
          color={stats?.pending && stats.pending > 10 ? 'warning' : 'default'}
          onClick={() => navigate('/cmdb/validation')}
          loading={statsLoading}
        />
        <KPICard
          title={t('cmdb.stats.matched', { defaultValue: 'Réconciliés' })}
          value={stats?.matched || 0}
          icon={CheckCircle}
          color="success"
          loading={statsLoading}
        />
        <KPICard
          title={t('cmdb.stats.missing', { defaultValue: 'Manquants' })}
          value={stats?.missing || 0}
          icon={AlertTriangle}
          color={stats?.missing && stats.missing > 5 ? 'danger' : 'default'}
          loading={statsLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Validation Queue - 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {t('cmdb.validation.title', { defaultValue: 'Queue de Validation' })}
                </CardTitle>
                {pendingCount > 0 && (
                  <Badge variant="soft" className="bg-warning/10 text-warning">
                    {pendingCount}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cmdb/validation')}>
                {t('common.viewAll', { defaultValue: 'Voir tout' })}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <ValidationQueue maxItems={5} compact />
            </CardContent>
          </Card>
        </div>

        {/* Side panels - 1 column */}
        <div className="space-y-6">
          <DataQualityOverview avgScore={stats?.avgDataQualityScore || 0} />
          <ClassDistribution stats={stats || null} />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
};

export default DiscoveryDashboard;
