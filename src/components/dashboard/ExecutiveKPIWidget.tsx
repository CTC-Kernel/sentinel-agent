/**
 * ExecutiveKPIWidget Component
 * Displays 3 KPI cards for executives (direction role)
 * Implements ADR-004: Dashboard Configurable par Role
 * Per FR7: "Les dirigeants peuvent voir les 3 KPIs critiques sans jargon technique"
 */

import { useCallback } from 'react';
import { cn } from '../../lib/utils';
import { KPICard } from './KPICard';
import { useComplianceScore } from '../../hooks/useComplianceScore';
import { useCriticalRisks } from '../../hooks/useCriticalRisks';
import { useOngoingAudits } from '../../hooks/useOngoingAudits';
import {
  KPI_DEFINITIONS,
  getKPIColorScheme,
  type KPIType,
} from '../../config/kpiConfig';

export interface ExecutiveKPIWidgetProps {
  /** Organization/tenant ID for data fetching */
  organizationId: string;
  /** Card size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Click handler for KPI cards */
  onKPIClick?: (kpiType: KPIType) => void;
}

/**
 * Error state component
 */
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-destructive/10 rounded-lg border border-destructive/20">
      <svg
        className="w-8 h-8 text-destructive mb-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p className="text-sm text-destructive mb-3">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/80 rounded-md transition-colors"
      >
        Reessayer
      </button>
    </div>
  );
}

/**
 * ExecutiveKPIWidget - Displays the 3 executive KPIs
 *
 * @example
 * ```tsx
 * <ExecutiveKPIWidget
 *   organizationId="org-123"
 *   onKPIClick={(type) => navigate(`/dashboard/${type}`)}
 * />
 * ```
 */
export function ExecutiveKPIWidget({
  organizationId,
  size = 'md',
  className,
  onKPIClick,
}: ExecutiveKPIWidgetProps) {
  // Fetch data from all three sources
  const {
    score: complianceScore,
    trend: scoreTrend,
    loading: scoreLoading,
    error: scoreError,
    refetch: refetchScore,
  } = useComplianceScore(organizationId);

  const {
    count: criticalRisksCount,
    trend: risksTrend,
    loading: risksLoading,
    error: risksError,
    refetch: refetchRisks,
  } = useCriticalRisks(organizationId);

  const {
    count: ongoingAuditsCount,
    trend: auditsTrend,
    loading: auditsLoading,
    error: auditsError,
    refetch: refetchAudits,
  } = useOngoingAudits(organizationId);

  // Combined refetch
  const refetchAll = useCallback(() => {
    refetchScore();
    refetchRisks();
    refetchAudits();
  }, [refetchScore, refetchRisks, refetchAudits]);

  // Check for any errors
  const hasError = scoreError || risksError || auditsError;
  const errorMessage =
    scoreError?.message || risksError?.message || auditsError?.message;

  if (hasError) {
    return (
      <ErrorState
        message={errorMessage || 'Impossible de charger les KPIs'}
        onRetry={refetchAll}
      />
    );
  }

  // Prepare KPI data
  const scoreValue = complianceScore?.global ?? 0;
  const risksValue = criticalRisksCount ?? 0;
  const auditsValue = ongoingAuditsCount ?? 0;

  // Generate subtitle for risks
  const risksSubtitle =
    risksValue === 0
      ? 'Aucun risque critique'
      : risksValue === 1
        ? '1 necessite votre attention'
        : `${risksValue} necessitent votre attention`;

  // Generate subtitle for audits
  const auditsSubtitle =
    auditsValue === 0
      ? 'Aucun controle en cours'
      : auditsValue === 1
        ? '1 verification en cours'
        : `${auditsValue} verifications en cours`;

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
        className
      )}
      role="region"
      aria-label="Indicateurs cles de performance"
    >
      {/* KPI 1: Score Global (Sante Conformite) */}
      <KPICard
        title={KPI_DEFINITIONS.score_global.title}
        value={scoreLoading ? '-' : scoreValue}
        subtitle={KPI_DEFINITIONS.score_global.subtitleTemplate}
        trend={scoreTrend || undefined}
        colorScheme={getKPIColorScheme('score_global', scoreValue)}
        size={size}
        loading={scoreLoading}
        onClick={onKPIClick ? () => onKPIClick('score_global') : undefined}
      />

      {/* KPI 2: Risques Critiques (Points d'Attention) */}
      <KPICard
        title={KPI_DEFINITIONS.risques_critiques.title}
        value={risksLoading ? '-' : risksValue}
        subtitle={risksSubtitle}
        trend={risksTrend || undefined}
        colorScheme={getKPIColorScheme('risques_critiques', risksValue)}
        size={size}
        loading={risksLoading}
        invertTrendColors={true}
        onClick={
          onKPIClick ? () => onKPIClick('risques_critiques') : undefined
        }
      />

      {/* KPI 3: Audits En Cours (Controles Actifs) */}
      <KPICard
        title={KPI_DEFINITIONS.audits_en_cours.title}
        value={auditsLoading ? '-' : auditsValue}
        subtitle={auditsSubtitle}
        trend={auditsTrend || undefined}
        colorScheme={getKPIColorScheme('audits_en_cours', auditsValue)}
        size={size}
        loading={auditsLoading}
        onClick={onKPIClick ? () => onKPIClick('audits_en_cours') : undefined}
      />
    </div>
  );
}

export default ExecutiveKPIWidget;
