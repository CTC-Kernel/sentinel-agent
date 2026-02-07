/**
 * ScoreBreakdownPanel Component
 * Detailed breakdown of compliance score by category
 * Implements ADR-003: Score de Conformité Global
 */

import { cn } from '../../lib/utils';
import type { ScoreBreakdown, CalculationDetails } from '../../types/score.types';
import { getScoreTextColor, getScoreBgLightColor, formatScore } from '../../utils/scoreUtils';
import { useLocale } from '@/hooks/useLocale';

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
 <span className="font-medium text-foreground">{label}</span>
 <span className="text-xs text-muted-foreground">({weightPercent}%)</span>
 </div>
 <span className={cn('font-bold text-lg', colorClass)}>
 {formatScore(score)}
 </span>
 </div>

 {/* Mini progress bar */}
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div
 className={cn(
 'h-full rounded-full transition-all duration-500',
 score < 50 ? 'bg-error' : score <= 75 ? 'bg-warning' : 'bg-success'
 )}
 style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
 />
 </div>

 {details && (
 <p className="mt-1 text-xs text-muted-foreground">{details}</p>
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
 * breakdown={score.breakdown}
 * calculationDetails={score.calculationDetails}
 * isOpen={showBreakdown}
 * onClose={() => setShowBreakdown(false)}
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
 const { t } = useLocale();

 if (!isOpen) return null;

 // Generate details strings if calculation details provided
 const controlsDetails = calculationDetails
 ? t('score.controlsDetails', { defaultValue: '{{implemented}}/{{total}} contrôles implémentés', implemented: calculationDetails.implementedControls, total: calculationDetails.actionableControls })
 : undefined;

 const risksDetails = calculationDetails
 ? t('score.risksDetails', { defaultValue: '{{critical}} risques critiques sur {{total}}', critical: calculationDetails.criticalRisks, total: calculationDetails.totalRisks })
 : undefined;

 const documentsDetails = calculationDetails
 ? t('score.documentsDetails', { defaultValue: '{{valid}}/{{total}} documents valides', valid: calculationDetails.validDocuments, total: calculationDetails.totalDocuments })
 : undefined;

 const auditsDetails = calculationDetails
 ? t('score.auditsDetails', { defaultValue: '{{compliant}}/{{total}} constats conformes', compliant: calculationDetails.compliantFindings, total: calculationDetails.totalFindings })
 : undefined;

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


 return (
 <div
 className={cn(
 'bg-card rounded-2xl shadow-lg border border-border/40 p-4',
 className
 )}
 >
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-foreground">
 {t('score.breakdown', { defaultValue: 'Détail du Score' })}
 </h3>
 {onClose && (
 <button
 onClick={onClose}
 className="p-1 hover:bg-muted rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 aria-label={t('common.close', { defaultValue: 'Fermer' })}
 >
 <svg
 className="w-5 h-5 text-muted-foreground"
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
 label={t('score.controls', { defaultValue: 'Contrôles' })}
 score={breakdown.controls.score}
 weight={breakdown.controls.weight}
 details={controlsDetails}
 />

 <CategoryRow
 label={t('score.risks', { defaultValue: 'Risques' })}
 score={breakdown.risks.score}
 weight={breakdown.risks.weight}
 details={risksDetails}
 />

 <CategoryRow
 label={t('score.audits', { defaultValue: 'Audits' })}
 score={breakdown.audits.score}
 weight={breakdown.audits.weight}
 details={auditsDetails}
 />

 <CategoryRow
 label={t('score.documents', { defaultValue: 'Documents' })}
 score={breakdown.documents.score}
 weight={breakdown.documents.weight}
 details={documentsDetails}
 />

 {breakdown.training && (
 <CategoryRow
 label={t('score.training', { defaultValue: 'Formation' })}
 score={breakdown.training.score}
 weight={breakdown.training.weight}
 />
 )}
 </div>

 {/* Weight explanation */}
 <p className="mt-4 text-xs text-muted-foreground text-center">
 {t('score.weightExplanation', { defaultValue: 'Score global = Somme pondérée des catégories' })}
 </p>
 </div>
 );
}

export default ScoreBreakdownPanel;
