/**
 * CMDB Premium Dashboard
 *
 * AAA-quality dashboard with glassmorphic widgets, animated stats,
 * and interactive visualizations for Configuration Management.
 *
 * @module components/cmdb/dashboard/CMDBPremiumDashboard
 */

import React, { useMemo } from 'react';
import { motion, Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import {
  Server,
  Database,
  Globe,
  Cloud,
  FileText,
  Network,
  Box,
  Activity,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Plus,
  ChevronRight,
  Layers,
  GitBranch,
  Zap,
  Shield,
  BarChart3,
} from '../../ui/Icons';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { useStore } from '@/store';
import { useDiscoveryStats } from '@/hooks/cmdb/useCMDBCIs';
import { useCMDBActions, usePendingValidationCount } from '@/stores/cmdbStore';
import { DiscoveryStats, CIClass } from '@/types/cmdb';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface CMDBPremiumDashboardProps {
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CI_CLASS_CONFIG: Record<CIClass, { icon: React.FC<{ className?: string; style?: React.CSSProperties }>; color: string; gradient: string }> = {
  Hardware: { icon: Server, color: '#3B82F6', gradient: 'from-blue-500 to-blue-600' },
  Software: { icon: Database, color: '#22C55E', gradient: 'from-green-500 to-green-600' },
  Service: { icon: Globe, color: '#8B5CF6', gradient: 'from-purple-500 to-purple-600' },
  Cloud: { icon: Cloud, color: '#06B6D4', gradient: 'from-cyan-500 to-cyan-600' },
  Document: { icon: FileText, color: '#F59E0B', gradient: 'from-amber-500 to-amber-600' },
  Network: { icon: Network, color: '#EF4444', gradient: 'from-red-500 to-red-600' },
  Container: { icon: Box, color: '#EC4899', gradient: 'from-pink-500 to-pink-600' },
};

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// =============================================================================
// TECH CORNERS COMPONENT
// =============================================================================

const TechCorners: React.FC<{ className?: string; color?: string }> = ({
  className,
  color = 'border-primary/40',
}) => (
  <div className={cn('pointer-events-none', className)}>
    <div className={cn('absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg', color)} />
    <div className={cn('absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg', color)} />
    <div className={cn('absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg', color)} />
    <div className={cn('absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg', color)} />
  </div>
);

// =============================================================================
// PREMIUM KPI CARD
// =============================================================================

interface PremiumKPICardProps {
  title: string;
  value: number | string;
  icon: React.FC<{ className?: string }>;
  trend?: { value: number; positive: boolean };
  color: string;
  gradient: string;
  onClick?: () => void;
  loading?: boolean;
  pulse?: boolean;
}

const PremiumKPICard: React.FC<PremiumKPICardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color,
  gradient,
  onClick,
  loading,
  pulse,
}) => {
  if (loading) {
    return (
      <motion.div
        variants={cardVariants}
        className="glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden"
      >
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-10 w-20" />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden cursor-pointer',
        'hover:shadow-apple-lg transition-shadow duration-300'
      )}
      onClick={onClick}
    >
      <TechCorners />

      {/* Background gradient */}
      <div
        className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none"
        style={{ backgroundColor: color }}
      />

      {/* Pulse indicator */}
      {pulse && (
        <motion.div
          className="absolute top-4 right-4 w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
            {title}
          </p>
          <motion.p
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="text-3xl font-bold"
          >
            {value}
          </motion.p>
          {trend && (
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp
                className={cn(
                  'h-3 w-3',
                  trend.positive ? 'text-success' : 'text-destructive rotate-180'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium',
                  trend.positive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.positive ? '+' : ''}{trend.value}%
              </span>
            </div>
          )}
        </div>

        <div
          className={cn('p-4 rounded-2xl bg-gradient-to-br', gradient)}
          style={{ boxShadow: `0 8px 32px ${color}30` }}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// CI CLASS DISTRIBUTION WIDGET
// =============================================================================

interface CIClassDistributionProps {
  stats: DiscoveryStats | null;
  loading?: boolean;
}

const CIClassDistribution: React.FC<CIClassDistributionProps> = ({ stats, loading }) => {
  const { t } = useStore();

  // Mock distribution based on total
  const distribution = useMemo(() => {
    const total = stats?.total || 0;
    return [
      { class: 'Hardware' as CIClass, count: Math.floor(total * 0.40), percent: 40 },
      { class: 'Software' as CIClass, count: Math.floor(total * 0.25), percent: 25 },
      { class: 'Service' as CIClass, count: Math.floor(total * 0.15), percent: 15 },
      { class: 'Network' as CIClass, count: Math.floor(total * 0.10), percent: 10 },
      { class: 'Cloud' as CIClass, count: Math.floor(total * 0.07), percent: 7 },
      { class: 'Container' as CIClass, count: Math.floor(total * 0.03), percent: 3 },
    ];
  }, [stats?.total]);

  const pieData = distribution.map((d) => ({
    name: d.class,
    value: d.count,
    color: CI_CLASS_CONFIG[d.class].color,
  }));

  if (loading) {
    return (
      <motion.div
        variants={cardVariants}
        className="glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden"
      >
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-40 w-40 rounded-full mx-auto" />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      className="glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden"
    >
      <TechCorners />

      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
        <Layers className="h-4 w-4" />
        {t('cmdb.distribution.title', { defaultValue: 'Distribution par Classe' })}
      </h3>

      <div className="flex items-center gap-6">
        {/* Pie Chart */}
        <div className="relative w-40 h-40">
          <svg width="0" height="0">
            <defs>
              <filter id="pieGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                innerRadius="55%"
                outerRadius="95%"
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="none"
                    style={{ filter: 'url(#pieGlow)' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{stats?.total || 0}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total CIs
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          {distribution.map((item) => {
            const config = CI_CLASS_CONFIG[item.class];
            return (
              <motion.div
                key={item.class}
                whileHover={{ scale: 1.05, x: 4 }}
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: `${config.color}20` }}
                >
                  <config.icon className="h-3 w-3" style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.class}</p>
                  <p className="text-[10px] text-muted-foreground">{item.percent}%</p>
                </div>
                <span className="text-xs font-bold">{item.count}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// DATA QUALITY GAUGE WIDGET
// =============================================================================

interface DataQualityGaugeProps {
  score: number;
  loading?: boolean;
}

const DataQualityGauge: React.FC<DataQualityGaugeProps> = ({ score, loading }) => {
  const { t } = useStore();

  const getScoreColor = (s: number) => {
    if (s >= 80) return '#22C55E';
    if (s >= 60) return '#EAB308';
    if (s >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const scoreColor = getScoreColor(score);

  if (loading) {
    return (
      <motion.div
        variants={cardVariants}
        className="glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden"
      >
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-32 w-32 rounded-full mx-auto" />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      className="glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden"
    >
      <TechCorners />

      {/* Background glow */}
      <div
        className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: scoreColor }}
      />

      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        {t('cmdb.quality.title', { defaultValue: 'Qualité des Données' })}
      </h3>

      <div className="flex flex-col items-center">
        {/* Gauge */}
        <div className="relative w-36 h-36">
          <svg width="0" height="0">
            <defs>
              <filter id="qualityGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="qualityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={scoreColor} stopOpacity="1" />
                <stop offset="100%" stopColor={scoreColor} stopOpacity="0.7" />
              </linearGradient>
            </defs>
          </svg>

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { value: score },
                  { value: 100 - score },
                ]}
                innerRadius="70%"
                outerRadius="100%"
                startAngle={180}
                endAngle={0}
                paddingAngle={0}
                dataKey="value"
              >
                <Cell fill="url(#qualityGradient)" style={{ filter: 'url(#qualityGlow)' }} />
                <Cell fill="hsl(var(--muted) / 0.3)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center score */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="text-4xl font-bold"
              style={{ color: scoreColor }}
            >
              {score}
            </motion.span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              DQS Moyen
            </span>
          </div>
        </div>

        {/* Quality breakdown */}
        <div className="w-full mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Excellent', range: '80-100', color: '#22C55E', count: 45 },
            { label: 'Bon', range: '60-79', color: '#EAB308', count: 30 },
            { label: 'À améliorer', range: '<60', color: '#EF4444', count: 12 },
          ].map((item) => (
            <div
              key={item.label}
              className="text-center p-2 rounded-xl bg-muted/30"
            >
              <div
                className="w-2 h-2 rounded-full mx-auto mb-1"
                style={{ backgroundColor: item.color }}
              />
              <p className="text-xs font-medium">{item.count}</p>
              <p className="text-[9px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// DISCOVERY ACTIVITY CHART
// =============================================================================

interface DiscoveryActivityChartProps {
  loading?: boolean;
}

const DiscoveryActivityChart: React.FC<DiscoveryActivityChartProps> = ({ loading }) => {
  const { t } = useStore();

  // Mock activity data
  const activityData = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => ({
      date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      }),
      discovered: Math.floor(Math.random() * 20) + 5,
      reconciled: Math.floor(Math.random() * 15) + 3,
    }));
  }, []);

  if (loading) {
    return (
      <motion.div
        variants={cardVariants}
        className="glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden"
      >
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-48 w-full" />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      className="glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden"
    >
      <TechCorners />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t('cmdb.activity.title', { defaultValue: 'Activité de Découverte' })}
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>Découverts</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span>Réconciliés</span>
          </div>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activityData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="discoveredGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="reconciledGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              className="text-muted-foreground"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="discovered"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#discoveredGradient)"
            />
            <Area
              type="monotone"
              dataKey="reconciled"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              fill="url(#reconciledGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

// =============================================================================
// VALIDATION QUEUE MINI WIDGET
// =============================================================================

interface ValidationQueueMiniProps {
  pendingCount: number;
  loading?: boolean;
  onViewAll?: () => void;
}

const ValidationQueueMini: React.FC<ValidationQueueMiniProps> = ({
  pendingCount,
  loading,
  onViewAll,
}) => {
  const { t } = useStore();

  // Mock pending items
  const mockItems = [
    { name: 'SRV-PROD-15', type: 'Hardware', confidence: 95, action: 'merge' },
    { name: 'DB-REPLICA-03', type: 'Software', confidence: 78, action: 'review' },
    { name: 'API-GATEWAY-NEW', type: 'Service', confidence: 42, action: 'manual' },
  ];

  if (loading) {
    return (
      <motion.div
        variants={cardVariants}
        className="glass-premium p-6 rounded-3xl border border-border/40 relative overflow-hidden"
      >
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-20 w-full" />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      className="glass-premium p-6 rounded-3xl border border-warning/20 relative overflow-hidden"
    >
      <TechCorners color="border-warning/40" />

      {/* Background pulse for pending items */}
      {pendingCount > 0 && (
        <motion.div
          className="absolute inset-0 bg-warning/5 pointer-events-none"
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {t('cmdb.validation.pending', { defaultValue: 'En attente' })}
          <Badge variant="soft" className="bg-warning/10 text-warning ml-2">
            {pendingCount}
          </Badge>
        </h3>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          Voir tout
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-2">
        {mockItems.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="p-2 rounded-lg bg-warning/10">
              <Server className="h-4 w-4 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">{item.type}</p>
            </div>
            <Badge
              variant="soft"
              className={cn(
                'text-[10px]',
                item.confidence >= 80 && 'bg-success/10 text-success',
                item.confidence >= 50 && item.confidence < 80 && 'bg-warning/10 text-warning',
                item.confidence < 50 && 'bg-destructive/10 text-destructive'
              )}
            >
              {item.confidence}%
            </Badge>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CMDBPremiumDashboard: React.FC<CMDBPremiumDashboardProps> = ({ className }) => {
  const { t } = useStore();
  const navigate = useNavigate();
  const { openInspector } = useCMDBActions();
  const pendingCount = usePendingValidationCount();

  const { data: stats, isLoading: statsLoading, refetch } = useDiscoveryStats();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={cn('space-y-6 p-6 max-w-7xl mx-auto', className)}
    >
      {/* Header */}
      <motion.div
        variants={cardVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {t('cmdb.dashboard.title', { defaultValue: 'CMDB Discovery' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('cmdb.dashboard.subtitle', {
              defaultValue: 'Configuration Management Database - Vue d\'ensemble',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh', { defaultValue: 'Actualiser' })}
          </Button>
          <Button onClick={() => openInspector()} className="bg-gradient-to-r from-primary to-purple-600">
            <Plus className="h-4 w-4 mr-2" />
            {t('cmdb.newCI', { defaultValue: 'Nouveau CI' })}
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PremiumKPICard
          title={t('cmdb.stats.total', { defaultValue: 'Total CIs' })}
          value={stats?.total || 0}
          icon={Server}
          trend={{ value: 12, positive: true }}
          color="#3B82F6"
          gradient="from-blue-500 to-blue-600"
          onClick={() => navigate('/cmdb/cis')}
          loading={statsLoading}
        />
        <PremiumKPICard
          title={t('cmdb.stats.pending', { defaultValue: 'En Attente' })}
          value={stats?.pending || 0}
          icon={Clock}
          color="#EAB308"
          gradient="from-amber-500 to-amber-600"
          onClick={() => navigate('/cmdb/validation')}
          loading={statsLoading}
          pulse={!!stats?.pending && stats.pending > 0}
        />
        <PremiumKPICard
          title={t('cmdb.stats.matched', { defaultValue: 'Réconciliés' })}
          value={stats?.matched || 0}
          icon={CheckCircle}
          trend={{ value: 8, positive: true }}
          color="#22C55E"
          gradient="from-green-500 to-green-600"
          loading={statsLoading}
        />
        <PremiumKPICard
          title={t('cmdb.stats.missing', { defaultValue: 'Manquants' })}
          value={stats?.missing || 0}
          icon={AlertTriangle}
          color="#EF4444"
          gradient="from-red-500 to-red-600"
          loading={statsLoading}
          pulse={!!stats?.missing && stats.missing > 5}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Activity Chart */}
        <div className="lg:col-span-2">
          <DiscoveryActivityChart loading={statsLoading} />
        </div>

        {/* Right Column - Quality Gauge */}
        <DataQualityGauge score={stats?.avgDataQualityScore || 0} loading={statsLoading} />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution Chart */}
        <div className="lg:col-span-2">
          <CIClassDistribution stats={stats || null} loading={statsLoading} />
        </div>

        {/* Validation Queue Mini */}
        <ValidationQueueMini
          pendingCount={pendingCount}
          loading={statsLoading}
          onViewAll={() => navigate('/cmdb/validation')}
        />
      </div>

      {/* Quick Actions */}
      <motion.div
        variants={cardVariants}
        className="glass-premium p-6 rounded-3xl border border-border/40"
      >
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          {t('cmdb.quickActions.title', { defaultValue: 'Actions Rapides' })}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: GitBranch, label: 'Relations', path: '/cmdb/relationships', color: '#8B5CF6' },
            { icon: BarChart3, label: 'Impact', path: '/cmdb/impact', color: '#EF4444' },
            { icon: RefreshCw, label: 'Reconciliation', path: '/cmdb/reconciliation', color: '#22C55E' },
            { icon: Layers, label: 'Topologie', path: '/cmdb/topology', color: '#06B6D4' },
          ].map((action) => (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.path)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-all"
            >
              <div
                className="p-2 rounded-xl"
                style={{ backgroundColor: `${action.color}20` }}
              >
                <action.icon className="h-5 w-5" style={{ color: action.color }} />
              </div>
              <span className="font-medium">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CMDBPremiumDashboard;
