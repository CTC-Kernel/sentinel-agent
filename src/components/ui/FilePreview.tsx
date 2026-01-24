import React, { useState } from 'react';
import { X, Download, ExternalLink, FileText, File } from '../ui/Icons';
import { Button } from './button';

interface FilePreviewProps {
    url: string;
    fileName: string;
    fileType: string;
    onClose: () => void;
    onDownload?: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
    url,
    fileName,
    fileType,
    onClose,
    onDownload,
}) => {
    const [loading, setLoading] = useState(true);

    const isImage = fileType.startsWith('image/');
    const isPDF = fileType === 'application/pdf';

    const getFileIcon = () => {
        if (isImage) return <FileText className="h-12 w-12 text-blue-500" />;
        if (isPDF) return <FileText className="h-12 w-12 text-red-500" />;
        return <File className="h-12 w-12 text-slate-600" />;
    };

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getFileIcon()}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                {fileName}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-muted-foreground">
                                {fileType}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {onDownload && (
                            <button
                                onClick={onDownload}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                title="Télécharger"
                            >
                                <Download className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                            </button>
                        )}
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            title="Ouvrir dans un nouvel onglet"
                        >
                            <ExternalLink className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                            <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-800/50 p-4">
                    {isImage && (
                        <div className="flex items-center justify-center h-full">
                            <img alt={fileName}
                                src={url}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                onLoad={() => setLoading(false)}
                            />
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-blue-600" />
                                </div>
                            )}
                        </div>
                    )}

                    {isPDF && (
                        <iframe
                            src={url}
                            className="w-full h-full min-h-[600px] rounded-lg"
                            title={fileName}
                            onLoad={() => setLoading(false)}
                        />
                    )}

                    {!isImage && !isPDF && (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            {getFileIcon()}
                            <p className="text-slate-600 dark:text-muted-foreground">
                                Aperçu non disponible pour ce type de fichier
                            </p>
                            <Button asChild>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Ouvrir le fichier
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
