/**
 * TrainingDashboard Component
 *
 * Main dashboard view for training management and compliance tracking.
 * Provides RSSI-level overview of training completion across the organization.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingDashboard
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Download,
  GraduationCap,
  AlertCircle,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/EmptyState';
import {
  TrainingKPICards,
  TrainingByDepartment,
  TrainingOverdueList,
  TrainingTrendChart,
} from './widgets';
import { useTrainingDashboard } from '../../hooks/training/useTrainingDashboard';
import { useStore } from '../../store';
import { staggerContainer, staggerItem } from '../../utils/microInteractions';

// ============================================================================
// Types
// ============================================================================

interface TrainingDashboardProps {
  onNavigateToOverdue?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const TrainingDashboard: React.FC<TrainingDashboardProps> = ({
  onNavigateToOverdue,
}) => {
  const { t } = useStore();
  const { data, isLoading, error, refresh, exportCSV } = useTrainingDashboard();

  // Error state
  if (error && !isLoading) {
    return (
      <div className="space-y-6">
        <Header
          t={t}
          onRefresh={refresh}
          onExport={exportCSV}
          isLoading={isLoading}
          hasData={false}
        />
        <EmptyState
          icon={AlertCircle}
          title={t('training.errors.dashboardLoadFailed')}
          description={error}
          actionLabel={t('common.retry')}
          onAction={refresh}
          semantic="error"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header
        t={t}
        onRefresh={refresh}
        onExport={exportCSV}
        isLoading={isLoading}
        hasData={!!data}
      />

      {/* KPI Cards */}
      <TrainingKPICards stats={data?.stats || null} isLoading={isLoading} />

      {/* Main Content Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Trend Chart - Full width on large screens */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <TrainingTrendChart
            data={data?.trend || []}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Department Stats */}
        <motion.div variants={staggerItem}>
          <TrainingByDepartment
            data={data?.byDepartment || []}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Overdue List */}
        <motion.div variants={staggerItem}>
          <TrainingOverdueList
            assignments={data?.overdueAssignments || []}
            isLoading={isLoading}
            onViewAll={onNavigateToOverdue}
            maxItems={5}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// Header Component
// ============================================================================

interface HeaderProps {
  t: (key: string) => string;
  onRefresh: () => void;
  onExport: () => void;
  isLoading: boolean;
  hasData: boolean;
}

const Header: React.FC<HeaderProps> = ({
  t,
  onRefresh,
  onExport,
  isLoading,
  hasData,
}) => (
  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="p-3 rounded-2xl bg-primary/10">
        <GraduationCap className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('training.dashboard.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('training.dashboard.description')}
        </p>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        disabled={!hasData || isLoading}
      >
        <Download className="w-4 h-4 mr-2" />
        {t('training.dashboard.exportCSV')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        {t('common.refresh')}
      </Button>
    </div>
  </div>
);

TrainingDashboard.displayName = 'TrainingDashboard';
