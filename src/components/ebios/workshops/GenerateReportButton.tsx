/**
 * Generate Report Button for EBIOS Workshops
 * Story 15.6: Génération de la Note de Cadrage
 *
 * Displays a button to generate and download workshop reports
 * Only enabled when all required sections are complete
 */

import React, { useState, useMemo } from 'react';
import { useLocale } from '../../../hooks/useLocale';
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
 const { t } = useLocale();
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
 1: t('ebios.reportTitles.noteDeCadrage', { defaultValue: 'Note de Cadrage' }),
 2: t('ebios.reportTitles.riskSourceAnalysis', { defaultValue: 'Analyse des Sources de Risque' }),
 3: t('ebios.reportTitles.strategicScenarios', { defaultValue: 'Scénarios Stratégiques' }),
 4: t('ebios.reportTitles.operationalScenarios', { defaultValue: 'Scénarios Opérationnels' }),
 5: t('ebios.reportTitles.treatmentPlan', { defaultValue: 'Plan de Traitement' }),
 };

 const handleGenerateReport = async () => {
 if (!completionStatus.overall) {
 setError(t('ebios.errors.completeAllSections', { defaultValue: 'Please complete all sections before generating the report.' }));
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
 setError(t('ebios.errors.workshopReportNotAvailable', { defaultValue: `La génération du rapport pour l'Atelier ${workshopNumber} n'est pas encore disponible.` }));
 }
 } catch (err) {
 ErrorLogger.error(err, 'GenerateReportButton.generateReport');
 setError(t('ebios.errors.reportGenerationFailed', { defaultValue: 'Une erreur est survenue lors de la génération du rapport.' }));
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
 { key: 'missions', label: t('ebios.completionItems.missions', { defaultValue: 'Missions essentielles' }), completed: completionStatus.details.missions },
 { key: 'essentialAssets', label: t('ebios.completionItems.essentialAssets', { defaultValue: 'Biens essentiels' }), completed: completionStatus.details.essentialAssets },
 { key: 'supportingAssets', label: t('ebios.completionItems.supportingAssets', { defaultValue: 'Biens supports' }), completed: completionStatus.details.supportingAssets },
 { key: 'fearedEvents', label: t('ebios.completionItems.fearedEvents', { defaultValue: 'Événements redoutés' }), completed: completionStatus.details.fearedEvents },
 { key: 'securityBaseline', label: t('ebios.completionItems.securityBaseline', { defaultValue: 'Socle de sécurité' }), completed: completionStatus.details.securityBaseline },
 ];

 const completedCount = items.filter((i) => i.completed).length;
 const allComplete = completedCount === items.length;

 return (
 <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/40">
 <div className="flex items-center gap-2 mb-2">
 {allComplete ? (
 <CheckCircle className="w-4 h-4 text-green-500" />
 ) : (
 <AlertCircle className="w-4 h-4 text-amber-500" />
 )}
 <span className="text-sm font-medium text-foreground text-muted-foreground">
 {allComplete
 ? t('ebios.allSectionsComplete', { defaultValue: 'Toutes les sections sont complètes' })
 : t('ebios.sectionsComplete', { defaultValue: `${completedCount}/${items.length} sections complètes` })}
 </span>
 </div>
 <ul className="space-y-1">
 {items.map((item) => (
 <li key={item.key || 'unknown'} className="flex items-center gap-2 text-xs">
 {item.completed ? (
 <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
 ) : (
 <div className="w-3 h-3 rounded-full border border-border/40 flex-shrink-0" />
 )}
 <span
 className={cn(
  'text-muted-foreground',
  item.completed && 'text-foreground'
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
 <span>{t('ebios.generating', { defaultValue: 'Génération...' })}</span>
 </>
 ) : (
 <>
 <FileText className="w-4 h-4" />
 <span>{t('ebios.generate', { defaultValue: 'Générer' })} {reportTitles[workshopNumber]}</span>
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
