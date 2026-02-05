import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Control } from '../../types';
import { RefreshCw } from '../ui/Icons';
import { Button } from '../ui/button';
import { StatsService } from '../../services/statsService';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { EmptyChartState } from '../ui/EmptyChartState';
import { Skeleton } from '../ui/Skeleton';
import { ComplianceScoreCard } from './dashboard/ComplianceScoreCard';
import { ComplianceCharts } from './dashboard/ComplianceCharts';
import { ComplianceCriticalControls } from './dashboard/ComplianceCriticalControls';
import { ComplianceDomainDetails } from './dashboard/ComplianceDomainDetails';
import { PriorityActionsList } from './dashboard/PriorityActionsList';

interface ComplianceDashboardProps {
 controls: Control[];
 onFilterChange?: (status: string | null) => void;
 currentFramework?: string;
 onSeedData?: () => void;
 loading?: boolean;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ controls, onFilterChange, currentFramework = 'ISO27001', onSeedData, loading }) => {
 const { user } = useStore();
 const { t } = useTranslation();
 const [trend, setTrend] = useState<number | undefined>(undefined);
 const [trendError, setTrendError] = useState<string | null>(null);

 const totalControls = controls.length;

 // Trend calculation
 useEffect(() => {
 const fetchTrend = async () => {
 if (!user?.organizationId) return;
 try {
 // Get last 30 days history
 const history = await StatsService.getHistory(user.organizationId, 30);
 if (history.length >= 2) {
  const current = history[history.length - 1].metrics.complianceRate;
  const previous = history[0].metrics.complianceRate; // Compare with 30 days ago (or oldest available)
  setTrend(Math.round(current - previous));
 }
 } catch (error) {
 ErrorLogger.error(error, 'ComplianceDashboard.fetchTrend');
 setTrendError(t('compliance.dashboard.trendError', 'Impossible de charger la tendance'));
 }
 };
 fetchTrend();
 }, [user?.organizationId, t]);

 if (loading) {
 return (
 <div className="space-y-6 w-full min-w-0">
 {/* Summary Card Skeleton */}
 <div className="glass-premium p-6 md:p-8 rounded-3xl border border-border/40 shadow-lg flex flex-col xl:flex-row gap-8">
  <div className="flex items-center gap-6 min-w-[240px]">
  <Skeleton className="w-24 h-24 rounded-full" />
  <div className="space-y-2">
  <Skeleton className="h-6 w-32" />
  <Skeleton className="h-4 w-24" />
  </div>
  </div>
  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
  {[1, 2, 3].map(i => (
  <Skeleton key={`skeleton-${i || 'unknown'}`} className="h-24 w-full rounded-2xl" />
  ))}
  </div>
 </div>

 {/* Charts Skeleton */}
 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
  {[1, 2, 3].map(i => (
  <div key={`skeleton-${i || 'unknown'}`} className="glass-premium p-4 sm:p-6 rounded-3xl h-[350px] border border-border/40">
  <Skeleton className="h-6 w-48 mb-6" />
  <Skeleton className="h-full w-full rounded-2xl" />
  </div>
  ))}
 </div>
 </div>
 );
 }

 const getFrameworkLabel = (fw: string) => {
 const labels: Record<string, string> = {
 'ISO27001': 'ISO 27001',
 'ISO22301': 'ISO 22301',
 'NIS2': 'NIS 2',
 'DORA': 'DORA',
 'GDPR': 'RGPD',
 'SOC2': 'SOC 2',
 'HDS': 'HDS',
 'PCI_DSS': 'PCI DSS',
 'NIST_CSF': 'NIST CSF'
 };
 return labels[fw] || fw;
 };

 return (
 <div className="space-y-6 w-full min-w-0">
 {/* Trend Error Banner */}
 {trendError && (
 <div className="p-3 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
  <span>{trendError}</span>
 </div>
 )}

 {/* Summary Card */}
 <ComplianceScoreCard
 controls={controls}
 currentFramework={currentFramework}
 trend={trend}
 onFilterChange={onFilterChange}
 />

 {totalControls > 0 ? (
 <>
  {/* Charts and Priority Actions */}
  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
  <div className="xl:col-span-2">
  <ComplianceCharts
  controls={controls}
  currentFramework={currentFramework}
  />
  </div>
  <div className="xl:col-span-1">
  <PriorityActionsList
  controls={controls}
  currentFramework={currentFramework}
  maxActions={5}
  />
  </div>
  </div>

  {/* Critical Controls Not Implemented */}
  <ComplianceCriticalControls controls={controls} />

  {/* Domain Details */}
  <ComplianceDomainDetails
  controls={controls}
  currentFramework={currentFramework}
  />
 </>
 ) : (
 <div className="flex flex-col items-center justify-center space-y-4 py-8">
  <EmptyChartState
  variant="bar"
  message={t('compliance.dashboard.noFrameworksTitle', 'Référentiel non initialisé')}
  description={t('compliance.dashboard.noFrameworksDesc', { framework: getFrameworkLabel(currentFramework), defaultValue: `Les contrôles pour {{framework}} ne sont pas encore chargés.` })}
  className="glass-premium border-dashed border border-border/40 p-12 w-full max-w-2xl mx-auto shadow-sm"
  />
  {onSeedData && (
  <div className="flex gap-4">
  <Button
  onClick={onSeedData}
  variant="premium"
  size="lg"
  className="gap-2 shadow-xl shadow-primary/20"
  >
  <RefreshCw className="w-5 h-5 animate-spin-slow" />
  <span>
   {t('compliance.dashboard.initializeIso', { framework: getFrameworkLabel(currentFramework), defaultValue: `Initialiser le référentiel {{framework}}` })}
  </span>
  </Button>
  </div>
  )}
 </div>
 )}
 </div>
 );
};
