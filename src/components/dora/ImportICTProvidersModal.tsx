/**
 * Import ICT Providers Modal
 * DORA Art. 28 - Story 35.1
 * CSV import wizard for ICT Providers
 */

import React, { useState, useCallback } from 'react';
import { useLocale } from '../../hooks/useLocale';
import { toast } from '@/lib/toast';
import { Dialog, Transition } from '@headlessui/react';
import { Button } from '../ui/button';
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle } from '../ui/Icons';
import { ICTProviderService } from '../../services/ICTProviderService';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { ErrorLogger } from '../../services/errorLogger';

interface ImportICTProvidersModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSuccess: () => void;
}

export const ImportICTProvidersModal: React.FC<ImportICTProvidersModalProps> = ({
 isOpen,
 onClose,
 onSuccess
}) => {
 const { t } = useLocale();
 const { organization } = useStore();
 const { user } = useAuth();

 const [file, setFile] = useState<File | null>(null);
 const [isImporting, setIsImporting] = useState(false);
 const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

 const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 const selectedFile = e.target.files?.[0];
 if (selectedFile) {
 if (!selectedFile.name.endsWith('.csv')) {
 toast.error(t('dora.import.selectCsvFile'));
 return;
 }
 setFile(selectedFile);
 setResult(null);
 }
 }, [t]);

 const handleDrop = useCallback((e: React.DragEvent) => {
 e.preventDefault();
 const droppedFile = e.dataTransfer.files[0];
 if (droppedFile) {
 if (!droppedFile.name.endsWith('.csv')) {
 toast.error(t('dora.import.selectCsvFile'));
 return;
 }
 setFile(droppedFile);
 setResult(null);
 }
 }, [t]);

 const parseCSV = (content: string): Record<string, string>[] => {
 const lines = content.split('\n').filter(line => line.trim());
 if (lines.length < 2) return [];

 const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
 const rows: Record<string, string>[] = [];

 for (let i = 1; i < lines.length; i++) {
 const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
 const row: Record<string, string> = {};
 headers.forEach((header, index) => {
 row[header] = values[index] || '';
 });
 rows.push(row);
 }

 return rows;
 };

 const handleImport = async () => {
 if (!file || !organization?.id || !user?.uid) return;

 setIsImporting(true);
 try {
 const content = await file.text();
 const rows = parseCSV(content);

 if (rows.length === 0) {
 toast.error(t('dora.import.emptyOrInvalid'));
 return;
 }

 const importResult = await ICTProviderService.importFromCSV(
 rows,
 organization.id,
 user.uid
 );

 setResult(importResult);

 if (importResult.imported > 0) {
 toast.success(t('dora.import.success', { count: importResult.imported }));
 onSuccess();
 }

 if (importResult.errors.length > 0) {
 toast.error(t('dora.import.errorsFound', { count: importResult.errors.length }));
 }
 } catch (error) {
 ErrorLogger.error(error, 'ImportICTProvidersModal.import');
 toast.error(t('dora.import.error'));
 } finally {
 setIsImporting(false);
 }
 };

 const handleClose = () => {
 setFile(null);
 setResult(null);
 onClose();
 };

 return (
 <Transition.Root show={isOpen} as={React.Fragment}>
 <Dialog as="div" className="relative z-modal" onClose={handleClose}>
 <Transition.Child
  as={React.Fragment}
  enter="ease-out duration-300"
  enterFrom="opacity-0"
  enterTo="opacity-100"
  leave="ease-in duration-200"
  leaveFrom="opacity-100"
  leaveTo="opacity-0"
 >
  <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)]" />
 </Transition.Child>

 <div className="fixed inset-0 z-10 overflow-y-auto">
  <div className="flex min-h-full items-center justify-center p-4">
  <Transition.Child
  as={React.Fragment}
  enter="ease-out duration-300"
  enterFrom="opacity-0 scale-95"
  enterTo="opacity-100 scale-100"
  leave="ease-in duration-200"
  leaveFrom="opacity-100 scale-100"
  leaveTo="opacity-0 scale-95"
  >
  <Dialog.Panel className="relative w-full max-w-lg transform rounded-3xl bg-card p-6 shadow-2xl transition-all">
  <div className="absolute right-4 top-4">
   <button
   onClick={handleClose}
   className="text-muted-foreground hover:text-muted-foreground"
   >
   <X className="w-5 h-5" />
   </button>
  </div>

  <Dialog.Title className="text-xl font-bold text-foreground mb-4">
   {t('dora.import.title')}
  </Dialog.Title>

  {/* Dropzone */}
  <div
   onDrop={handleDrop}
   onDragOver={(e) => e.preventDefault()}
   className={`
   border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer
   ${file
   ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
   : 'border-border/40 hover:border-indigo-300 dark:hover:border-indigo-600'
   }
   `}
   onClick={() => document.getElementById('csv-upload')?.click()}
   onKeyDown={(e) => {
   if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
   document.getElementById('csv-upload')?.click();
   }
   }}
   role="button"
   tabIndex={0}
   aria-label={t('dora.import.uploadCsvAriaLabel', { defaultValue: 'Télécharger un fichier CSV' })}
  >
   <input
   id="csv-upload"
   type="file"
   accept=".csv"
   onChange={handleFileChange}
   className="hidden"
   />

   {file ? (
   <div className="flex flex-col items-center">
   <FileSpreadsheet className="w-12 h-12 text-green-500 mb-3" />
   <p className="font-medium text-foreground">{file.name}</p>
   <p className="text-sm text-muted-foreground mt-1">
   {(file.size / 1024).toFixed(1)} KB
   </p>
   </div>
   ) : (
   <div className="flex flex-col items-center">
   <Upload className="w-12 h-12 text-muted-foreground mb-3" />
   <p className="font-medium text-foreground">
   {t('dora.import.dropzone')}
   </p>
   <p className="text-sm text-muted-foreground mt-1">
   {t('dora.import.clickToSelect')}
   </p>
   </div>
   )}
  </div>

  {/* Expected Format */}
  <div className="mt-4 p-4 bg-muted/50 rounded-3xl">
   <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
   {t('dora.import.expectedColumns')}
   </p>
   <p className="text-sm text-muted-foreground font-mono">
   {t('dora.import.columnsList')}
   </p>
  </div>

  {/* Result */}
  {result && (
   <div className="mt-4 space-y-2">
   <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
   <CheckCircle className="w-5 h-5" />
   <span>{t('dora.import.providersImported', { count: result.imported })}</span>
   </div>
   {result.errors.length > 0 && (
   <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-3xl">
   <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
    <AlertCircle className="w-5 h-5" />
    <span>{t('dora.import.errorsCount', { count: result.errors.length })}</span>
   </div>
   <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
    {result.errors.map((err, i) => (
    <li key={i || 'unknown'}>{err}</li>
    ))}
   </ul>
   </div>
   )}
   </div>
  )}

  {/* Actions */}
  <div className="flex justify-end gap-3 mt-6">
   <Button variant="ghost" onClick={handleClose}>
   {t('common.cancel')}
   </Button>
   <Button
   onClick={handleImport}
   disabled={!file || isImporting}
   isLoading={isImporting}
   className="bg-gradient-to-r from-primary to-indigo-600 text-white"
   >
   {t('common.import.label')}
   </Button>
  </div>
  </Dialog.Panel>
  </Transition.Child>
  </div>
 </div>
 </Dialog>
 </Transition.Root>
 );
};
