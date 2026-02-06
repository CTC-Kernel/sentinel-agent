
import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, X } from './Icons';
import { useStore } from '../../store';

interface CSVImportProps {
 title: string;
 fields: { key: string; label: string; required?: boolean; type?: 'string' | 'number' | 'date' | 'email' }[];
 onImport: (data: Record<string, unknown>[]) => Promise<void>;
 onClose: () => void;
 templateData?: Record<string, unknown>[];
}

interface ValidationError {
 row: number;
 field: string;
 message: string;
}

export const CSVImport: React.FC<CSVImportProps> = ({ title, fields, onImport, onClose, templateData }) => {
 const [file, setFile] = useState<File | null>(null);
 const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
 const [errors, setErrors] = useState<ValidationError[]>([]);
 const [importing, setImporting] = useState(false);
 const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
 const [importedCount, setImportedCount] = useState(0);
 const { addToast, t } = useStore();

 const parseCSV = (text: string): Record<string, unknown>[] => {
 const lines = text.split('\n').filter(line => line.trim());
 if (lines.length === 0) return [];

 const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
 const data: Record<string, unknown>[] = [];

 for (let i = 1; i < lines.length; i++) {
 const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
 const row: Record<string, unknown> = {};

 headers.forEach((header, index) => {
 const field = fields.find(f => f.label.toLowerCase() === header.toLowerCase() || f.key.toLowerCase() === header.toLowerCase());
 if (field) {
  const value = values[index];

  if (field.type === 'number' && value) {
  row[field.key] = parseFloat(value) || 0;
  } else {
  row[field.key] = value || '';
  }
 }
 });

 data.push(row);
 }

 return data;
 };

 const validateData = (data: Record<string, unknown>[]): ValidationError[] => {
 const validationErrors: ValidationError[] = [];

 data.forEach((row, index) => {
 fields.forEach(field => {
 const value = row[field.key];

 if (field.required && (!value || value === '')) {
  validationErrors.push({
  row: index + 1,
  field: field.label,
  message: `${field.label} is required`
  });
 }

 if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
  validationErrors.push({
  row: index + 1,
  field: field.label,
  message: `${field.label} must be a valid email`
  });
 }

 if (value && field.type === 'number' && isNaN(Number(value))) {
  validationErrors.push({
  row: index + 1,
  field: field.label,
  message: `${field.label} must be a number`
  });
 }
 });
 });

 return validationErrors;
 };

 const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const uploadedFile = e.target.files?.[0];
 if (!uploadedFile) return;

 if (!uploadedFile.name.endsWith('.csv')) {
 addToast(t('common.toast.selectCsvFile', { defaultValue: 'Veuillez sélectionner un fichier CSV' }), 'error');
 return;
 }

 setFile(uploadedFile);

 const reader = new FileReader();
 reader.onload = (event) => {
 const text = event.target?.result as string;
 const data = parseCSV(text);
 const validationErrors = validateData(data);

 setParsedData(data);
 setErrors(validationErrors);
 setStep('preview');
 };
 reader.readAsText(uploadedFile);
 };

 const handleImport = async () => {
 if (errors.length > 0) {
 addToast(t('common.toast.fixErrorsBeforeImport', { defaultValue: "Veuillez corriger les erreurs avant d'importer" }), 'error');
 return;
 }

 setImporting(true);
 setStep('importing');

 try {
 await onImport(parsedData);
 setImportedCount(parsedData.length);
 setStep('complete');
 addToast(t('common.toast.importSuccess', { defaultValue: `${parsedData.length} éléments importés avec succès`, count: parsedData.length }), 'success');
 } catch {
 addToast(t('common.toast.importError', { defaultValue: "Erreur lors de l'importation" }), 'error');
 setStep('preview');
 } finally {
 setImporting(false);
 }
 };

 const downloadTemplate = () => {
 const headers = fields.map(f => f.label).join(',');
 const rows = templateData?.map(item =>
 fields.map(f => item[f.key] || '').join(',')
 ).join('\n') || '';

 const csv = `${headers}\n${rows}`;
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `template_${title.toLowerCase().replace(/\s/g, '_')}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 };

 return (
 <div className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] p-4 animate-fade-in">
 <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl border border-border/50 overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
 <div className="p-6 border-b border-border/40 bg-primary/10 flex justify-between items-center rounded-t-2xl">
  <h2 className="text-2xl font-bold text-primary dark:text-primary/30 tracking-tight">{title}</h2>
  <button aria-label="Fermer la fenêtre" onClick={onClose} className="p-2.5 hover:bg-muted/500 dark:hover:bg-muted rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  <X className="h-5 w-5" />
  </button>
 </div>

 <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
  {step === 'upload' && (
  <div className="space-y-6">
  <div className="text-center">
  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/15 dark:bg-primary flex items-center justify-center">
   <Upload className="h-10 w-10 text-primary" />
  </div>
  <h3 className="text-lg font-bold text-foreground mb-2">Importer depuis un fichier CSV</h3>
  <p className="text-sm text-muted-foreground">Uploadez votre fichier CSV pour importer en masse</p>
  </div>

  <div
  className="border-2 border-dashed border-border/40 rounded-2xl p-8 text-center hover:border-primary dark:hover:border-primary transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background"
  >
  <input type="file"
   accept=".csv"
   onChange={handleFileUpload}
   className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-decorator"
   id="csv-upload"
   aria-label="Importer un fichier CSV"
  />
  <div className="relative z-0">
   <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
   <p className="text-sm font-bold text-foreground text-muted-foreground">Cliquez pour sélectionner un fichier CSV</p>
   <p className="text-xs text-muted-foreground mt-1">ou glissez-déposez ici</p>
   {file && (
   <p className="text-xs text-primary mt-2 font-medium">
   Fichier sélectionné : {file.name}
   </p>
   )}
  </div>
  </div>

  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-xl">
  <p className="text-sm text-muted-foreground">Besoin d'un modèle ?</p>
  <button aria-label="Télécharger le modèle CSV" onClick={downloadTemplate} className="text-sm font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1">
   Télécharger le modèle CSV
  </button>
  </div>
  </div>
  )}

  {step === 'preview' && (
  <div className="space-y-4">
  <div className="flex justify-between items-center">
  <div>
   <h3 className="font-bold text-lg text-foreground">Aperçu - {parsedData.length} lignes</h3>
   {errors.length > 0 && (
   <p className="text-sm text-destructive mt-1">
   {errors.length} erreur{errors.length > 1 ? 's' : ''} détectée{errors.length > 1 ? 's' : ''}
   </p>
   )}
  </div>
  <div className="flex gap-2">
   <button aria-label="Annuler l'importation" onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
   Annuler
   </button>
   <button
   aria-label={`Importer ${parsedData.length} éléments`}
   onClick={handleImport}
   disabled={errors.length > 0}
   className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
   >
   Importer {parsedData.length} élément{parsedData.length > 1 ? 's' : ''}
   </button>
  </div>
  </div>

  {errors.length > 0 && (
  <div className="bg-error-bg border border-error-border rounded-xl p-4 space-y-2">
   <div className="flex items-center gap-2 mb-2">
   <AlertTriangle className="h-5 w-5 text-destructive" />
   <h4 className="font-bold text-red-900 dark:text-red-100">Erreurs de validation</h4>
   </div>
   <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
   {errors.slice(0, 10).map((err, i) => (
   <p key={`err-${i || 'unknown'}`} className="text-sm text-destructive">
   Ligne {err.row}: {err.message}
   </p>
   ))}
   {errors.length > 10 && (
   <p className="text-xs text-destructive font-medium">
   ... et {errors.length - 10} autre{errors.length - 10 > 1 ? 's' : ''} erreur{errors.length - 10 > 1 ? 's' : ''}
   </p>
   )}
   </div>
  </div>
  )}

  <div className="overflow-x-auto rounded-xl border border-border/40">
  <table className="w-full text-sm">
   <thead className="bg-muted/50">
   <tr>
   {fields.map(field => (
   <th key={field.key || 'unknown'} className="px-4 py-3 text-left font-bold text-foreground text-muted-foreground">
    {field.label} {field.required && <span className="text-destructive">*</span>}
   </th>
   ))}
   </tr>
   </thead>
   <tbody>
   {parsedData.slice(0, 5).map((row, i) => (
   <tr key={`row-${i || 'unknown'}`} className="border-t border-border/40 dark:border-white/5">
   {fields.map(field => (
    <td key={field.key || 'unknown'} className="px-4 py-3 text-muted-foreground">
    {String(row[field.key] || '-')}
    </td>
   ))}
   </tr>
   ))}
   </tbody>
  </table>
  </div>
  {parsedData.length > 5 && (
  <p className="text-xs text-muted-foreground text-center">...et {parsedData.length - 5} ligne{parsedData.length - 5 > 1 ? 's' : ''} supplémentaire{parsedData.length - 5 > 1 ? 's' : ''}</p>
  )}
  </div>
  )}

  {step === 'importing' && (
  <div className="text-center py-12">
  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
  <h3 className="text-lg font-bold text-foreground">
  {importing ? 'Importation en cours...' : 'Préparation...'}
  </h3>
  <p className="text-sm text-muted-foreground mt-2">Veuillez patienter</p>
  </div>
  )}

  {step === 'complete' && (
  <div className="text-center py-12">
  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-success-bg flex items-center justify-center">
  <CheckCircle2 className="h-10 w-10 text-success" />
  </div>
  <h3 className="text-lg font-bold text-foreground mb-2">Importation réussie !</h3>
  <p className="text-sm text-muted-foreground">{importedCount} élément{importedCount > 1 ? 's' : ''} importé{importedCount > 1 ? 's' : ''} avec succès</p>
  <button aria-label="Terminer l'importation" onClick={onClose} className="mt-6 px-6 py-3 bg-success text-success-foreground rounded-xl font-bold hover:bg-success/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  Terminer
  </button>
  </div>
  )}
 </div>
 </div>
 </div>
 );
};
