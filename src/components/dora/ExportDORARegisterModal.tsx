/**
 * Export DORA Register Modal
 * Story 35-3: DORA Register Export
 *
 * Modal for exporting ICT provider register in various formats
 */

import React, { useState, useCallback } from 'react';
import { useLocale } from '../../hooks/useLocale';
import { toast } from '@/lib/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { CustomSelect } from '../ui/CustomSelect';
import { FileCode, FileSpreadsheet, FileText, Download, Loader2, CheckCircle, AlertTriangle } from '../ui/Icons';
import { DORAExportService, ExportFormat, DORAExportOptions } from '../../services/DORAExportService';
import { ICTProvider, ICTCriticality } from '../../types/dora';
import { useStore } from '../../store';
import { cn } from '../../lib/utils';
import { ErrorLogger } from '../../services/errorLogger';

interface ExportDORARegisterModalProps {
 isOpen: boolean;
 onClose: () => void;
 providers: ICTProvider[];
}

interface FormatOption {
 value: ExportFormat;
 label: string;
 description: string;
 icon: React.ComponentType<{ className?: string }>;
}

export const ExportDORARegisterModal: React.FC<ExportDORARegisterModalProps> = ({
 isOpen,
 onClose,
 providers
}) => {
 const { t, locale: i18nLocale } = useLocale();
 const { organization, user } = useStore();

 const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
 const [categoryFilter, setCategoryFilter] = useState<ICTCriticality | 'all'>('all');
 const [isExporting, setIsExporting] = useState(false);
 const [exportSuccess, setExportSuccess] = useState(false);

 const formatOptions: FormatOption[] = [
 {
 value: 'json',
 label: 'JSON (ESA)',
 description: t('dora.export.jsonDesc'),
 icon: FileCode
 },
 {
 value: 'excel',
 label: 'Excel',
 description: t('dora.export.excelDesc'),
 icon: FileSpreadsheet
 },
 {
 value: 'pdf',
 label: 'PDF',
 description: t('dora.export.pdfDesc'),
 icon: FileText
 }
 ];

 const categoryOptions = [
 { value: 'all', label: t('dora.export.allCategories') },
 { value: 'critical', label: t('dora.category.critical') },
 { value: 'important', label: t('dora.category.important') },
 { value: 'standard', label: t('dora.category.standard') }
 ];

 // Calculate preview stats
 const filteredProviders = categoryFilter === 'all'
 ? providers.filter(p => p.status === 'active')
 : providers.filter(p => p.status === 'active' && p.category === categoryFilter);

 const criticalCount = filteredProviders.filter(p => p.category === 'critical').length;
 const highRiskCount = filteredProviders.filter(p =>
 (p.riskAssessment?.concentration || 0) > 70
 ).length;

 const handleExport = useCallback(async () => {
 if (!organization) {
 toast.error(t('common.error'));
 return;
 }

 setIsExporting(true);

 try {
 const options: DORAExportOptions = {
 format: selectedFormat,
 categoryFilter,
 language: i18nLocale as 'fr' | 'en'
 };

 const orgInfo = {
 name: organization.name || 'Organization',
 lei: organization.lei || '',
 country: organization.country || 'FR'
 };

 let blob: Blob;
 let filename: string;

 switch (selectedFormat) {
 case 'json': {
  const result = await DORAExportService.generateJSON(providers, orgInfo, options);
  blob = result.blob;
  filename = result.filename;
  break;
 }
 case 'excel': {
  const result = await DORAExportService.generateExcel(providers, orgInfo, options);
  blob = result.blob;
  filename = result.filename;
  break;
 }
 case 'pdf': {
  const result = await DORAExportService.generatePDF(providers, orgInfo, options);
  blob = result.blob;
  filename = result.filename;
  break;
 }
 }

 // Download the file
 DORAExportService.downloadBlob(blob, filename);

 // Save export record
 await DORAExportService.saveExportRecord(organization.id!, {
 format: selectedFormat,
 exportedAt: new Date().toISOString(),
 exportedBy: user?.uid || 'unknown',
 exportedByName: user?.displayName || user?.email || 'Unknown',
 providerCount: filteredProviders.length,
 parameters: {
  categoryFilter: categoryFilter,
  includeHistorical: false
 },
 filename,
 fileSize: blob.size
 });

 setExportSuccess(true);
 toast.success(t('dora.export.success'));
 setTimeout(() => {
 setExportSuccess(false);
 onClose();
 }, 1500);
 } catch (error) {
 ErrorLogger.error(error, 'ExportDORARegisterModal.export');
 toast.error(t('dora.export.error'));
 } finally {
 setIsExporting(false);
 }
 }, [organization, selectedFormat, categoryFilter, providers, i18nLocale, user, t, onClose, filteredProviders.length]);

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
  <DialogTitle className="flex items-center gap-2">
  <Download className="w-5 h-5 text-blue-600" />
  {t('dora.export.title')}
  </DialogTitle>
 </DialogHeader>

 <div className="space-y-6 py-4">
  {/* Format Selection */}
  <div>
  <label className="block text-sm font-medium text-foreground mb-3">
  {t('dora.export.selectFormat')}
  </label>
  <div className="grid grid-cols-3 gap-3">
  {formatOptions.map((option) => {
  const Icon = option.icon;
  const isSelected = selectedFormat === option.value;
  return (
   <button
   key={option.value || 'unknown'}
   type="button"
   onClick={() => setSelectedFormat(option.value)}
   className={cn(
   'flex flex-col items-center p-4 rounded-3xl border-2 transition-all',
   isSelected
   ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
   : 'border-border/40 hover:border-border/40 dark:hover:border-slate-600'
   )}
   >
   <Icon className={cn(
   'w-8 h-8 mb-2',
   isSelected ? 'text-blue-600' : 'text-muted-foreground'
   )} />
   <span className={cn(
   'text-sm font-medium',
   isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-foreground'
   )}>
   {option.label}
   </span>
   <span className="text-xs text-muted-foreground mt-1 text-center">
   {option.description}
   </span>
   </button>
  );
  })}
  </div>
  </div>

  {/* Category Filter */}
  <div>
  <label className="block text-sm font-medium text-foreground mb-2">
  {t('dora.export.categoryFilter')}
  </label>
  <CustomSelect
  value={categoryFilter}
  onChange={(val) => setCategoryFilter(val as ICTCriticality | 'all')}
  options={categoryOptions}
  />
  </div>

  {/* Preview Summary */}
  <div className="bg-muted/50 rounded-3xl p-4">
  <h4 className="text-sm font-medium text-foreground mb-3">
  {t('dora.export.preview')}
  </h4>
  <div className="grid grid-cols-3 gap-4">
  <div className="text-center">
  <div className="text-2xl font-bold text-foreground">
   {filteredProviders.length}
  </div>
  <div className="text-xs text-muted-foreground">{t('dora.export.providers')}</div>
  </div>
  <div className="text-center">
  <div className="text-2xl font-bold text-red-600">
   {criticalCount}
  </div>
  <div className="text-xs text-muted-foreground">{t('dora.category.critical')}</div>
  </div>
  <div className="text-center">
  <div className="text-2xl font-bold text-amber-600">
   {highRiskCount}
  </div>
  <div className="text-xs text-muted-foreground">{t('dora.export.highRisk')}</div>
  </div>
  </div>

  {filteredProviders.length === 0 && (
  <div className="mt-3 flex items-center gap-2 text-amber-600">
  <AlertTriangle className="w-4 h-4" />
  <span className="text-sm">{t('dora.export.noProviders')}</span>
  </div>
  )}
  </div>

  {/* Format Info */}
  {selectedFormat === 'json' && (
  <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
  <div className="text-sm text-blue-700 dark:text-blue-300">
  {t('dora.export.esaCompliant')}
  </div>
  </div>
  )}
 </div>

 {exportSuccess && (
  <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-300">
  <CheckCircle className="w-5 h-5" />
  <span className="text-sm font-medium">{t('dora.export.successMessage', 'Export terminé avec succès !')}</span>
  </div>
 )}

 <DialogFooter>
  <Button
  variant="outline"
  onClick={onClose}
  disabled={isExporting}
  >
  {t('common.cancel')}
  </Button>
  <Button
  onClick={handleExport}
  disabled={isExporting || exportSuccess || filteredProviders.length === 0}
  className="gap-2"
  >
  {isExporting ? (
  <>
  <Loader2 className="w-4 h-4 animate-spin" />
  {t('dora.export.exporting')}
  </>
  ) : exportSuccess ? (
  <>
  <CheckCircle className="w-4 h-4" />
  {t('dora.export.exported', 'Exporté')}
  </>
  ) : (
  <>
  <Download className="w-4 h-4" />
  {t('dora.export.exportButton')}
  </>
  )}
  </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
};
