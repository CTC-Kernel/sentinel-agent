import React from 'react';
import { FileUploader } from '../ui/FileUploader';

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
    if (fileUrl) {
        return (
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-muted-foreground">Fichier associé</label>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-10 w-10 flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                            {fileType?.includes('pdf') ? 'PDF' : fileType?.includes('image') ? 'IMG' : 'DOC'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-200 truncate">{fileName || 'Document'}</p>
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">Voir le fichier</a>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                        Supprimer
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium mb-1 dark:text-muted-foreground">Fichier (Optionnel)</label>
            <FileUploader
                onUploadComplete={(url, name, hash, _isSecure, size, type) => onUploadSuccess(url, name, type || 'application/octet-stream', size || 0, hash)}
                category={storagePath}
                maxSizeMB={maxSizeMB}
                allowedTypes={[
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/*',
                    'text/plain',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ]}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDF, Word, Excel, Images (Max {maxSizeMB}Mo)</p>
        </div>
    );
};
