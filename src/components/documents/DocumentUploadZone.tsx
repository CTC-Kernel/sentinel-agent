import React from 'react';
import { FileUploader } from '../ui/FileUploader';
import { useLocale } from '../../hooks/useLocale';

interface DocumentUploadZoneProps {
 fileUrl?: string; // Can be string or File mostly in forms, but usually string in Document object
 fileName?: string;
 fileType?: string;
 onUploadSuccess: (url: string, name: string, type: string, size: number, hash?: string) => void;
 onClear: () => void;
 maxSizeMB?: number; // Optional, default to 50
 storagePath?: string;
}

export const DocumentUploadZone: React.FC<DocumentUploadZoneProps> = ({
 fileUrl,
 fileName,
 fileType,
 onUploadSuccess,
 onClear,
 maxSizeMB = 50,
 storagePath = 'documents'
}) => {
 const { t } = useLocale();

 if (fileUrl) {
 return (
 <div className="mb-4">
 <div className="block text-sm font-medium mb-1 text-muted-foreground">{t('documents.upload.associatedFile', { defaultValue: 'Fichier associé' })}</div>
 <div className="flex items-center justify-between p-3 bg-muted rounded-3xl border border-border/40">
  <div className="flex items-center gap-3 overflow-hidden">
  <div className="h-10 w-10 flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
  {fileType?.includes('pdf') ? 'PDF' : fileType?.includes('image') ? 'IMG' : 'DOC'}
  </div>
  <div className="min-w-0">
  <p className="text-sm font-medium text-foreground truncate">{fileName || 'Document'}</p>
  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">{t('documents.upload.viewFile', { defaultValue: 'Voir le fichier' })}</a>
  </div>
  </div>
  <button
  type="button"
  onClick={onClear}
  aria-label={t('documents.upload.deleteFile', { defaultValue: 'Supprimer' })}
  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
  >
  {t('documents.upload.deleteFile', { defaultValue: 'Supprimer' })}
  </button>
 </div>
 </div>
 );
 }

 const allowedTypes = [
 'application/pdf',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'image/*',
 'text/plain',
 'application/vnd.ms-excel',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 ];

 return (
 <div className="mb-4">
 <div className="block text-sm font-medium mb-1 text-muted-foreground">{t('documents.upload.fileOptional', { defaultValue: 'Fichier (Optionnel)' })}</div>
 <p className="text-xs text-muted-foreground mb-2">
 {t('documents.upload.acceptedFormats', { defaultValue: 'Formats acceptés : PDF, Word (.doc, .docx), Excel (.xls, .xlsx), Images (JPG, PNG, etc.), Texte (.txt)', maxSize: maxSizeMB })} &mdash; Max {maxSizeMB}Mo
 </p>
 <FileUploader
 onUploadComplete={(url, name, hash, _isSecure, size, type) => onUploadSuccess(url, name, type || 'application/octet-stream', size || 0, hash)}
 category={storagePath}
 maxSizeMB={maxSizeMB}
 allowedTypes={allowedTypes}
 />
 <div className="flex flex-wrap gap-1.5 mt-2">
 {['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'TXT', 'JPG', 'PNG'].map(ext => (
  <span key={ext || 'unknown'} className="px-2 py-0.5 bg-muted rounded text-xs font-bold text-muted-foreground uppercase tracking-wider">
  .{ext.toLowerCase()}
  </span>
 ))}
 </div>
 </div>
 );
};
