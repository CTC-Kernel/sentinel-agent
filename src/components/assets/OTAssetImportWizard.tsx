/**
 * OT Asset Import Wizard
 * Story 36-1: OT Asset Import Wizard
 *
 * Multi-step wizard for importing OT/ICS assets from CSV files.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
 Upload,
 FileText,
 Settings,
 Eye,
 CheckCircle,
 AlertTriangle,
 AlertCircle,
 Download,
 ChevronRight,
 ChevronLeft,
 Loader2,
 Table,
 Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '../../lib/toast';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import {
 OTAssetImportService,
 type CSVParseResult,
 type ColumnMapping,
 type OTAssetRow,
 type ImportResult
} from '../../services/OTAssetImportService';
import {
 generateOTCSVTemplate,
 OT_CSV_COLUMN_MAPPINGS
} from '../../data/otAssetConstants';
import { useLocale } from '../../hooks/useLocale';

// ============================================================================
// Types
// ============================================================================

interface OTAssetImportWizardProps {
 open: boolean;
 onClose: () => void;
 onImportComplete: (result: ImportResult) => void;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'import' | 'complete';

// ============================================================================
// Constants
// ============================================================================

const WIZARD_STEPS: Array<{ key: WizardStep; labelKey: string; icon: React.ElementType }> = [
 { key: 'upload', labelKey: 'otImport.steps.upload', icon: Upload },
 { key: 'mapping', labelKey: 'otImport.steps.mapping', icon: Settings },
 { key: 'preview', labelKey: 'otImport.steps.preview', icon: Eye },
 { key: 'import', labelKey: 'otImport.steps.import', icon: CheckCircle }
];

// ============================================================================
// Component
// ============================================================================

export const OTAssetImportWizard: React.FC<OTAssetImportWizardProps> = ({
 open,
 onClose,
 onImportComplete
}) => {
 const { t } = useLocale();
 const { organization } = useStore();
 const { user } = useAuth();

 // Wizard state
 const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
 const [csvData, setCsvData] = useState<CSVParseResult | null>(null);
 const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
 const [validatedRows, setValidatedRows] = useState<OTAssetRow[]>([]);
 const [importResult, setImportResult] = useState<ImportResult | null>(null);
 const [isImporting, setIsImporting] = useState(false);
 const [isDragging, setIsDragging] = useState(false);

 // Reset wizard state
 const resetWizard = useCallback(() => {
 setCurrentStep('upload');
 setCsvData(null);
 setColumnMappings([]);
 setValidatedRows([]);
 setImportResult(null);
 setIsImporting(false);
 }, []);

 // Handle file upload
 const handleFileUpload = useCallback((file: File) => {
 const reader = new FileReader();
 reader.onload = (e) => {
 const content = e.target?.result as string;
 const parsed = OTAssetImportService.parseCSV(content);

 if (parsed.rowCount === 0) {
 toast.error(
 t('otImport.errors.emptyFile', 'Fichier vide'),
 t('otImport.errors.emptyFileDesc', 'Le fichier CSV ne contient aucune donnée')
 );
 return;
 }

 setCsvData(parsed);

 // Auto-detect column mappings
 const detectedMappings = OTAssetImportService.detectColumnMappings(parsed.headers);
 setColumnMappings(detectedMappings);

 setCurrentStep('mapping');
 };
 reader.onerror = () => {
 toast.error(
 t('otImport.errors.readError', 'Erreur de lecture'),
 t('otImport.errors.readErrorDesc', 'Impossible de lire le fichier')
 );
 };
 reader.readAsText(file);
 }, [t]);

 // Handle drag and drop
 const handleDragOver = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(true);
 }, []);

 const handleDragLeave = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(false);
 }, []);

 const handleDrop = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(false);

 const files = e.dataTransfer.files;
 if (files.length > 0) {
 const file = files[0];
 if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
 handleFileUpload(file);
 } else {
 toast.error(
 t('otImport.errors.invalidFormat', 'Format invalide'),
 t('otImport.errors.invalidFormatDesc', 'Seuls les fichiers CSV sont acceptés')
 );
 }
 }
 }, [handleFileUpload, t]);

 // Handle file input change
 const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (files && files.length > 0) {
 handleFileUpload(files[0]);
 }
 }, [handleFileUpload]);

 // Update column mapping
 const updateMapping = useCallback((fieldName: string, csvColumn: string) => {
 setColumnMappings(prev => {
 const existing = prev.find(m => m.fieldName === fieldName);
 if (existing) {
 return prev.map(m =>
 m.fieldName === fieldName ? { ...m, csvColumn, confidence: 1 } : m
 );
 } else {
 return [...prev, { fieldName, csvColumn, confidence: 1 }];
 }
 });
 }, []);

 // Proceed to preview
 const proceedToPreview = useCallback(() => {
 if (!csvData) return;

 const validated = OTAssetImportService.validateAllRows(
 csvData.rows,
 csvData.headers,
 columnMappings
 );
 setValidatedRows(validated);
 setCurrentStep('preview');
 }, [csvData, columnMappings]);

 // Perform import
 const performImport = useCallback(async () => {
 if (!organization?.id || !user?.uid || validatedRows.length === 0) return;

 setIsImporting(true);
 setCurrentStep('import');

 try {
 const result = await OTAssetImportService.importOTAssets(validatedRows, {
 organizationId: organization.id,
 userId: user.uid
 });

 setImportResult(result);
 setCurrentStep('complete');
 onImportComplete(result);

 if (result.success && result.successCount > 0) {
 toast.success(
 t('otImport.success.title', 'Import réussi'),
 t('otImport.success.description', { defaultValue: '{{count}} assets OT importés', count: result.successCount })
 );
 }
 } catch {
 toast.error(
 t('otImport.errors.importFailed', 'Erreur d\'import'),
 t('otImport.errors.importFailedDesc', 'L\'import a échoué')
 );
 } finally {
 setIsImporting(false);
 }
 }, [organization?.id, user?.uid, validatedRows, onImportComplete, t]);

 // Download CSV template
 const downloadTemplate = useCallback(() => {
 const content = generateOTCSVTemplate();
 const blob = new Blob([content], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'ot_assets_template.csv';
 a.click();
 URL.revokeObjectURL(url);
 }, []);

 // Summary stats
 const previewStats = useMemo(() => {
 if (validatedRows.length === 0) return null;

 const valid = validatedRows.filter(r => r.isValid).length;
 const withErrors = validatedRows.filter(r => !r.isValid).length;
 const withWarnings = validatedRows.filter(r => r.isValid && r.warnings.length > 0).length;

 return { total: validatedRows.length, valid, withErrors, withWarnings };
 }, [validatedRows]);

 // Render step indicator
 const renderStepIndicator = () => (
 <div className="flex items-center justify-center mb-6">
 {WIZARD_STEPS.map((step, index) => {
 const isActive = step.key === currentStep;
 const isPast = WIZARD_STEPS.findIndex(s => s.key === currentStep) > index;
 const Icon = step.icon;

 return (
 <React.Fragment key={step.key || 'unknown'}>
 {index > 0 && (
 <div className={cn(
 'w-12 h-0.5 mx-2',
 isPast ? 'bg-green-500' : 'bg-muted'
 )} />
 )}
 <div className={cn(
 'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
 isActive && 'bg-info-bg text-info-text',
 isPast && 'bg-green-100 text-green-700',
 !isActive && !isPast && 'bg-muted text-muted-foreground'
 )}>
 {isPast ? (
 <Check className="h-4 w-4" />
 ) : (
 <span className="h-4 w-4 inline-flex items-center justify-center">
  {React.createElement(Icon, { className: "h-4 w-4" })}
 </span>
 )}
 <span className="hidden sm:inline">
 {t(step.labelKey)}
 </span>
 </div>
 </React.Fragment>
 );
 })}
 </div>
 );

 // Render upload step
 const renderUploadStep = () => (
 <div className="space-y-6">
 {/* Drag and drop zone */}
 <div
 className={cn(
 'border-2 border-dashed rounded-3xl p-12 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
 isDragging ? 'border-blue-500 bg-blue-50' : 'border-border/40 hover:border-border'
 )}
 onDragOver={handleDragOver}
 onDragLeave={handleDragLeave}
 onDrop={handleDrop}
 onClick={() => document.getElementById('csv-file-input')?.click()}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 document.getElementById('csv-file-input')?.click();
 }
 }}
 role="button"
 tabIndex={0}
 >
 <input
 id="csv-file-input"
 type="file"
 accept=".csv"
 onChange={handleFileInputChange}
 className="hidden"
 />
 <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
 <p className="text-lg font-medium text-foreground">
 {t('otImport.upload.dragDrop', 'Glissez votre fichier CSV ici')}
 </p>
 <p className="text-sm text-muted-foreground mt-1">
 {t('otImport.upload.orClick', 'ou cliquez pour sélectionner')}
 </p>
 </div>

 {/* Template download */}
 <Card className="p-4 rounded-3xl border-border/40 shadow-sm">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
 <FileText className="h-5 w-5 text-green-600" />
 </div>
 <div>
 <p className="font-medium text-foreground">
 {t('otImport.upload.template', 'Template CSV')}
 </p>
 <p className="text-sm text-muted-foreground">
 {t('otImport.upload.templateDesc', 'Téléchargez le modèle avec les colonnes requises')}
 </p>
 </div>
 </div>
 <Button variant="outline" onClick={downloadTemplate}>
 <Download className="h-4 w-4 mr-2" />
 {t('otImport.upload.downloadTemplate', 'Télécharger')}
 </Button>
 </div>
 </Card>
 </div>
 );

 // Render mapping step
 const renderMappingStep = () => {
 if (!csvData) return null;

 const requiredFields = ['name', 'networkSegment', 'otCriticality'];
 const optionalFields = Object.keys(OT_CSV_COLUMN_MAPPINGS).filter(f => !requiredFields.includes(f));

 const getMappedColumn = (fieldName: string) => {
 return columnMappings.find(m => m.fieldName === fieldName)?.csvColumn || '';
 };

 const renderFieldMapping = (fieldName: string, isRequired: boolean) => (
 <div key={fieldName || 'unknown'} className="flex items-center gap-4 py-2">
 <div className="w-40">
 <span className="text-sm font-medium">
 {t(`otImport.fields.${fieldName}`, fieldName)}
 </span>
 {isRequired && (
 <span className="text-destructive ml-1">*</span>
 )}
 </div>
 <ChevronRight className="h-4 w-4 text-muted-foreground" />
 <select
 value={getMappedColumn(fieldName)}
 onChange={(e) => updateMapping(fieldName, e.target.value)}
 className="flex-1 px-3 py-2 border rounded-3xl text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background"
 >
 <option value="">{t('otImport.mapping.selectColumn', '-- Sélectionner --')}</option>
 {csvData.headers.map(header => (
 <option key={header || 'unknown'} value={header}>{header}</option>
 ))}
 </select>
 {getMappedColumn(fieldName) && (
 <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
 <Check className="h-3 w-3 mr-1" />
 {t('otImport.mapping.mapped', 'Mappé')}
 </Badge>
 )}
 </div>
 );

 return (
 <div className="space-y-6">
 {/* File info */}
 <Card className="p-4 rounded-3xl border-border/40 shadow-sm">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
 <Table className="h-5 w-5 text-blue-600" />
 </div>
 <div>
 <p className="font-medium">{t('otImport.mapping.fileLoaded', 'Fichier chargé')}</p>
 <p className="text-sm text-muted-foreground">
 {csvData.rowCount} {t('otImport.mapping.rows', 'lignes')} • {csvData.headers.length} {t('otImport.mapping.columns', 'colonnes')}
 </p>
 </div>
 </div>
 </Card>

 {/* Required fields */}
 <div>
 <h3 className="text-sm font-semibold text-foreground mb-3">
 {t('otImport.mapping.requiredFields', 'Champs obligatoires')}
 </h3>
 <Card className="p-4 rounded-3xl border-border/40 shadow-sm">
 {requiredFields.map(f => renderFieldMapping(f, true))}
 </Card>
 </div>

 {/* Optional fields */}
 <div>
 <h3 className="text-sm font-semibold text-foreground mb-3">
 {t('otImport.mapping.optionalFields', 'Champs optionnels')}
 </h3>
 <Card className="p-4 max-h-64 overflow-y-auto rounded-3xl border-border/40 shadow-sm">
 {optionalFields.map(f => renderFieldMapping(f, false))}
 </Card>
 </div>
 </div>
 );
 };

 // Render preview step
 const renderPreviewStep = () => {
 if (!previewStats) return null;

 return (
 <div className="space-y-6">
 {/* Stats summary */}
 <div className="grid grid-cols-3 gap-4">
 <Card className="p-4 text-center">
 <p className="text-2xl font-bold text-blue-600">{previewStats.valid}</p>
 <p className="text-sm text-muted-foreground">{t('otImport.preview.valid', 'Valides')}</p>
 </Card>
 <Card className="p-4 text-center">
 <p className="text-2xl font-bold text-amber-600">{previewStats.withWarnings}</p>
 <p className="text-sm text-muted-foreground">{t('otImport.preview.warnings', 'Avertissements')}</p>
 </Card>
 <Card className="p-4 text-center">
 <p className="text-2xl font-bold text-destructive">{previewStats.withErrors}</p>
 <p className="text-sm text-muted-foreground">{t('otImport.preview.errors', 'Erreurs')}</p>
 </Card>
 </div>

 {/* Preview table */}
 <Card className="overflow-hidden rounded-3xl border-border/40 shadow-sm">
 <div className="max-h-80 overflow-y-auto">
 <table className="w-full text-sm">
 <thead className="bg-muted/50 sticky top-0">
 <tr>
  <th className="px-4 py-2 text-left">#</th>
  <th className="px-4 py-2 text-left">{t('otImport.fields.name', 'Nom')}</th>
  <th className="px-4 py-2 text-left">{t('otImport.fields.deviceType', 'Type')}</th>
  <th className="px-4 py-2 text-left">{t('otImport.fields.networkSegment', 'Segment')}</th>
  <th className="px-4 py-2 text-left">{t('otImport.preview.status', 'Statut')}</th>
 </tr>
 </thead>
 <tbody className="divide-y">
 {validatedRows.slice(0, 20).map(row => (
  <tr key={row.rowNumber || 'unknown'} className={cn(
  !row.isValid && 'bg-red-50',
  row.isValid && row.warnings.length > 0 && 'bg-amber-50'
  )}>
  <td className="px-4 py-2 text-muted-foreground">{row.rowNumber}</td>
  <td className="px-4 py-2 font-medium">{row.data.name || '-'}</td>
  <td className="px-4 py-2">{row.data.deviceType || '-'}</td>
  <td className="px-4 py-2">
  {row.data.networkSegment && (
  <Badge variant="outline">{row.data.networkSegment}</Badge>
  )}
  </td>
  <td className="px-4 py-2">
  {!row.isValid ? (
  <Badge variant="soft" status="error" className="gap-1">
  <AlertCircle className="h-3 w-3" />
  {row.errors.length} {t('otImport.preview.error', 'erreur(s)')}
  </Badge>
  ) : row.warnings.length > 0 ? (
  <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:text-amber-400 gap-1">
  <AlertTriangle className="h-3 w-3" />
  {row.warnings.length} {t('otImport.preview.warning', 'avert.')}
  </Badge>
  ) : (
  <Badge variant="outline" className="bg-green-100 text-green-700 dark:text-green-400 gap-1">
  <Check className="h-3 w-3" />
  OK
  </Badge>
  )}
  </td>
  </tr>
 ))}
 </tbody>
 </table>
 </div>
 {validatedRows.length > 20 && (
 <div className="px-4 py-2 bg-muted/50 text-sm text-muted-foreground text-center">
 {t('otImport.preview.showingFirst', { defaultValue: 'Affichage des 20 premières lignes sur {{total}}', total: validatedRows.length })}
 </div>
 )}
 </Card>
 </div>
 );
 };

 // Render import progress
 const renderImportStep = () => (
 <div className="flex flex-col items-center justify-center py-12">
 <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
 <p className="text-lg font-medium">
 {t('otImport.importing.title', 'Import en cours...')}
 </p>
 <p className="text-sm text-muted-foreground">
 {t('otImport.importing.description', 'Création des assets OT')}
 </p>
 </div>
 );

 // Render complete step
 const renderCompleteStep = () => {
 if (!importResult) return null;

 return (
 <div className="space-y-6">
 {/* Success message */}
 <div className="text-center py-6">
 <div className={cn(
 'mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4',
 importResult.success ? 'bg-green-100' : 'bg-amber-100'
 )}>
 {importResult.success ? (
 <CheckCircle className="h-8 w-8 text-green-600" />
 ) : (
 <AlertTriangle className="h-8 w-8 text-amber-600" />
 )}
 </div>
 <h3 className="text-xl font-semibold">
 {importResult.success
 ? t('otImport.complete.success', 'Import terminé')
 : t('otImport.complete.partial', 'Import partiel')}
 </h3>
 <p className="text-muted-foreground mt-1">
 {t('otImport.complete.summary', { defaultValue: '{{success}} sur {{total}} assets importés', success: importResult.successCount, total: importResult.totalRows })}
 </p>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-2 gap-4">
 <Card className="p-4 text-center bg-green-50">
 <p className="text-3xl font-bold text-green-600">{importResult.successCount}</p>
 <p className="text-sm text-green-700">{t('otImport.complete.created', 'Créés')}</p>
 </Card>
 <Card className="p-4 text-center bg-red-50">
 <p className="text-3xl font-bold text-destructive">{importResult.errorCount}</p>
 <p className="text-sm text-destructive">{t('otImport.complete.failed', 'Échoués')}</p>
 </Card>
 </div>

 {/* Error details */}
 {importResult.errors.length > 0 && (
 <Card className="p-4 rounded-3xl border-border/40 shadow-sm">
 <h4 className="font-medium text-destructive mb-2">
 {t('otImport.complete.errorDetails', 'Détail des erreurs')}
 </h4>
 <div className="max-h-40 overflow-y-auto space-y-2">
 {importResult.errors.slice(0, 10).map((err, i) => (
 <div key={i || 'unknown'} className="text-sm">
  <span className="font-medium">Ligne {err.rowNumber}:</span>{' '}
  {err.errors.map(e => e.message).join(', ')}
 </div>
 ))}
 </div>
 </Card>
 )}
 </div>
 );
 };

 // Render current step content
 const renderStepContent = () => {
 switch (currentStep) {
 case 'upload':
 return renderUploadStep();
 case 'mapping':
 return renderMappingStep();
 case 'preview':
 return renderPreviewStep();
 case 'import':
 return renderImportStep();
 case 'complete':
 return renderCompleteStep();
 default:
 return null;
 }
 };

 // Can proceed to next step
 const canProceed = useMemo(() => {
 switch (currentStep) {
 case 'upload':
 return csvData !== null;
 case 'mapping':
 // Must have at least name mapped
 return columnMappings.some(m => m.fieldName === 'name' && m.csvColumn);
 case 'preview':
 return validatedRows.some(r => r.isValid);
 default:
 return false;
 }
 }, [currentStep, csvData, columnMappings, validatedRows]);

 // Handle next step
 const handleNext = useCallback(() => {
 switch (currentStep) {
 case 'mapping':
 proceedToPreview();
 break;
 case 'preview':
 performImport();
 break;
 }
 }, [currentStep, proceedToPreview, performImport]);

 // Handle back
 const handleBack = useCallback(() => {
 switch (currentStep) {
 case 'mapping':
 setCurrentStep('upload');
 break;
 case 'preview':
 setCurrentStep('mapping');
 break;
 }
 }, [currentStep]);

 // Handle close
 const handleClose = useCallback(() => {
 resetWizard();
 onClose();
 }, [resetWizard, onClose]);

 return (
 <Dialog open={open} onOpenChange={handleClose}>
 <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Upload className="h-5 w-5 text-blue-600" />
 {t('otImport.title', 'Import d\'assets OT/ICS')}
 </DialogTitle>
 </DialogHeader>

 {/* Step indicator */}
 {currentStep !== 'complete' && renderStepIndicator()}

 {/* Step content */}
 <div className="min-h-[300px]">
 {renderStepContent()}
 </div>

 {/* Navigation buttons */}
 <div className="flex justify-between pt-4 border-t">
 <div>
 {currentStep !== 'upload' && currentStep !== 'import' && currentStep !== 'complete' && (
 <Button variant="outline" onClick={handleBack}>
 <ChevronLeft className="h-4 w-4 mr-1" />
 {t('common.back', 'Retour')}
 </Button>
 )}
 </div>
 <div className="flex gap-2">
 {currentStep === 'complete' ? (
 <Button onClick={handleClose}>
 {t('common.close', 'Fermer')}
 </Button>
 ) : currentStep !== 'import' ? (
 <>
 <Button variant="outline" onClick={handleClose}>
  {t('common.cancel', 'Annuler')}
 </Button>
 {currentStep !== 'upload' && (
  <Button onClick={handleNext} disabled={!canProceed || isImporting}>
  {isImporting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
  {currentStep === 'preview'
  ? t('otImport.actions.import', 'Importer')
  : t('common.next', 'Suivant')}
  <ChevronRight className="h-4 w-4 ml-1" />
  </Button>
 )}
 </>
 ) : null}
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
};

export default OTAssetImportWizard;
