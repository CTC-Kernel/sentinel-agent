/**
 * ScoreBreakdownPanel Component
 * Detailed breakdown of compliance score by category
 * Implements ADR-003: Score de Conformité Global
 */

import { cn } from '../../lib/utils';
import type { ScoreBreakdown, CalculationDetails } from '../../types/score.types';
import { getScoreTextColor, getScoreBgLightColor, formatScore } from '../../utils/scoreUtils';

export interface ScoreBreakdownPanelProps {
  /** Score breakdown by category */
  breakdown: ScoreBreakdown;
  /** Optional calculation details */
  calculationDetails?: CalculationDetails;
  /** Whether to show the panel */
  isOpen?: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
}

interface CategoryRowProps {
  label: string;
  score: number;
  weight: number;
  details?: string;
}

/**
 * Single category row with mini progress bar
 */
function CategoryRow({ label, score, weight, details }: CategoryRowProps) {
  const colorClass = getScoreTextColor(score);
  const bgClass = getScoreBgLightColor(score);
  const weightPercent = Math.round(weight * 100);

  return (
    <div className={cn('p-3 rounded-lg', bgClass)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-white">{label}</span>
          <span className="text-xs text-slate-500">({weightPercent}%)</span>
        </div>
        <span className={cn('font-bold text-lg', colorClass)}>
          {formatScore(score)}
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            score < 50 ? 'bg-red-500' : score <= 75 ? 'bg-orange-500' : 'bg-green-500'
          )}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>

      {details && (
        <p className="mt-1 text-xs text-slate-500">{details}</p>
      )}
    </div>
  );
}

/**
 * ScoreBreakdownPanel - Detailed breakdown modal/panel
 *
 * @example
 * ```tsx
 * <ScoreBreakdownPanel
 *   breakdown={score.breakdown}
 *   calculationDetails={score.calculationDetails}
 *   isOpen={showBreakdown}
 *   onClose={() => setShowBreakdown(false)}
 * />
 * ```
 */
export function ScoreBreakdownPanel({
  breakdown,
  calculationDetails,
  isOpen = true,
  onClose,
  className,
}: ScoreBreakdownPanelProps) {
  if (!isOpen) return null;

  // Generate details strings if calculation details provided
  const controlsDetails = calculationDetails
    ? `${calculationDetails.implementedControls}/${calculationDetails.actionableControls} contrôles implémentés`
    : undefined;

  const risksDetails = calculationDetails
    ? `${calculationDetails.criticalRisks} risques critiques sur ${calculationDetails.totalRisks}`
    : undefined;

  const documentsDetails = calculationDetails
    ? `${calculationDetails.validDocuments}/${calculationDetails.totalDocuments} documents valides`
    : undefined;

  const auditsDetails = calculationDetails
    ? `${calculationDetails.compliantFindings}/${calculationDetails.totalFindings} constats conformes`
    : undefined;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-border/40 dark:border-slate-700 p-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Détail du Score
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <svg
              className="w-5 h-5 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        <CategoryRow
          label="Contrôles"
          score={breakdown.controls.score}
          weight={breakdown.controls.weight}
          details={controlsDetails}
        />

        <CategoryRow
          label="Risques"
          score={breakdown.risks.score}
          weight={breakdown.risks.weight}
          details={risksDetails}
        />

        <CategoryRow
          label="Audits"
          score={breakdown.audits.score}
          weight={breakdown.audits.weight}
          details={auditsDetails}
        />

        <CategoryRow
          label="Documents"
          score={breakdown.documents.score}
          weight={breakdown.documents.weight}
          details={documentsDetails}
        />
      </div>

      {/* Weight explanation */}
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-300 text-center">
        Score global = Somme pondérée des catégories
      </p>
    </div>
  );
}

export default ScoreBreakdownPanel;
