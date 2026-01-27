/**
 * Generate Report Button for EBIOS Workshops
 * Story 15.6: Génération de la Note de Cadrage
 *
 * Displays a button to generate and download workshop reports
 * Only enabled when all required sections are complete
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Loader2, CheckCircle, AlertCircle } from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/button';
import { EbiosReportService } from '../../../services/EbiosReportService';
import type { EbiosAnalysis, Workshop1Data } from '../../../types/ebios';
import { useAuth } from '../../../hooks/useAuth';
import { ErrorLogger } from '../../../services/errorLogger';

interface GenerateReportButtonProps {
  analysis: EbiosAnalysis;
  workshopNumber: 1 | 2 | 3 | 4 | 5;
  organizationName?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  showCompletionStatus?: boolean;
}

export const GenerateReportButton: React.FC<GenerateReportButtonProps> = ({
  analysis,
  workshopNumber,
  organizationName,
  className,
  variant = 'default',
  size = 'default',
  showCompletionStatus = true,
}) => {
  useTranslation(); // For potential future i18n
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check completion status for Workshop 1
  const completionStatus = useMemo(() => {
    if (workshopNumber !== 1) {
      // For now, only Workshop 1 report is implemented
      return { overall: false, details: null };
    }

    const workshop1Data = analysis.workshops[1].data as Workshop1Data;
    const details = EbiosReportService.getWorkshop1CompletionDetails(workshop1Data);
    return { overall: details.overall, details };
  }, [analysis, workshopNumber]);

  // Report titles by workshop
  const reportTitles: Record<number, string> = {
    1: 'Note de Cadrage',
    2: 'Analyse des Sources de Risque',
    3: 'Scénarios Stratégiques',
    4: 'Scénarios Opérationnels',
    5: 'Plan de Traitement',
  };

  const handleGenerateReport = async () => {
    if (!completionStatus.overall) {
      setError('Veuillez compléter toutes les sections avant de générer le rapport.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      if (workshopNumber === 1) {
        EbiosReportService.downloadWorkshop1Report(analysis, {
          organizationName,
          author: user?.displayName || user?.email || undefined,
          includeBaselineDetails: true,
        });
      } else {
        // Other workshops not yet implemented
        setError(`La génération du rapport pour l'Atelier ${workshopNumber} n'est pas encore disponible.`);
      }
    } catch (err) {
      ErrorLogger.error(err, 'GenerateReportButton.generateReport');
      setError('Une erreur est survenue lors de la génération du rapport.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Render completion checklist
  const renderCompletionStatus = () => {
    if (!showCompletionStatus || workshopNumber !== 1 || !completionStatus.details) {
      return null;
    }

    const items = [
      { key: 'missions', label: 'Missions essentielles', completed: completionStatus.details.missions },
      { key: 'essentialAssets', label: 'Biens essentiels', completed: completionStatus.details.essentialAssets },
      { key: 'supportingAssets', label: 'Biens supports', completed: completionStatus.details.supportingAssets },
      { key: 'fearedEvents', label: 'Événements redoutés', completed: completionStatus.details.fearedEvents },
      { key: 'securityBaseline', label: 'Socle de sécurité', completed: completionStatus.details.securityBaseline },
    ];

    const completedCount = items.filter((i) => i.completed).length;
    const allComplete = completedCount === items.length;

    return (
      <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          {allComplete ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
          <span className="text-sm font-medium text-slate-700 dark:text-muted-foreground">
            {allComplete
              ? 'Toutes les sections sont complètes'
              : `${completedCount}/${items.length} sections complètes`}
          </span>
        </div>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-xs">
              {item.completed ? (
                <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
              )}
              <span
                className={cn(
                  'text-slate-600 dark:text-slate-300',
                  item.completed && 'text-slate-900 dark:text-slate-200'
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center gap-2">
        <Button
          onClick={handleGenerateReport}
          disabled={isGenerating || !completionStatus.overall}
          variant={variant}
          size={size}
          className={cn(
            'gap-2',
            !completionStatus.overall && 'opacity-70 cursor-not-allowed'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Génération...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              <span>Générer {reportTitles[workshopNumber]}</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {renderCompletionStatus()}
    </div>
  );
};

/**
 * Compact version for inline use
 */
export const GenerateReportButtonCompact: React.FC<Omit<GenerateReportButtonProps, 'showCompletionStatus' | 'size'>> = (
  props
) => {
  return (
    <GenerateReportButton
      {...props}
      showCompletionStatus={false}
      variant="outline"
      size="sm"
    />
  );
};

export default GenerateReportButton;
