import React, { useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './button';
import { FileSpreadsheet, Upload, AlertCircle, FileText, Info } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useStore } from '../../store';

interface ImportGuidelinesModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    entityName: string;
    guidelines: {
        required: string[];
        optional?: string[];
        format?: string;
    };
    onImport: (file: File) => Promise<void>;
    onDownloadTemplate: () => void;
}

export const ImportGuidelinesModal: React.FC<ImportGuidelinesModalProps> = ({
    isOpen,
    onClose,
    title,
    entityName,
    guidelines,
    onImport,
    onDownloadTemplate
}) => {
    const { t } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'text/csv' || file.name.endsWith('.csv')) {
            setSelectedFile(file);
        } else {
            toast.error(t('common.import.invalidFormat', { format: '.csv' }));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const handleImport = async () => {
        if (!selectedFile) return;
        setIsUploading(true);
        try {
            await onImport(selectedFile);
            onClose();
            setSelectedFile(null);
            toast.success(t('common.import.success', { entity: entityName }));
        } catch {
            toast.error(t('common.import.error'));
        } finally {
            setIsUploading(false);
        }
    };

    const resetSelection = () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title || t('common.import.title', { entity: entityName })}
            maxWidth="max-w-3xl"
        >
            <div className="space-y-6 pt-2">
                {/* Guidelines Section */}
                <div className="bg-brand-50/50 dark:bg-brand-900/10 rounded-2xl p-5 border border-brand-100 dark:border-brand-900/20">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400 mt-1">
                            <Info className="w-5 h-5" />
                        </div>
                        <div className="space-y-3 flex-1">
                            <h4 className="font-semibold text-brand-900 dark:text-brand-100">
                                {t('common.import.guidelinesTitle')}
                            </h4>
                            <p className="text-sm text-brand-700 dark:text-brand-300 leading-relaxed">
                                {t('common.import.guidelinesDesc')}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div className="space-y-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-brand-800 dark:text-brand-200 opacity-70">
                                        {t('common.import.requiredColumns')}
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {guidelines.required.map(col => (
                                            <span key={col} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-white dark:bg-black/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/30">
                                                {col}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {guidelines.optional && guidelines.optional.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 opacity-70">
                                            {t('common.import.optionalColumns')}
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {guidelines.optional.map(col => (
                                                <span key={col} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    {col}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Action Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Template Download */}
                    <button
                        onClick={onDownloadTemplate}
                        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white mb-1">
                            {t('common.import.downloadTemplate')}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
                            {t('common.import.downloadTemplateDesc')}
                        </span>
                    </button>

                    {/* File Upload */}
                    {!selectedFile ? (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all cursor-pointer group ${isDragging
                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 scale-[1.02]'
                                : 'border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                                }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                hidden
                                accept=".csv"
                                onChange={handleFileSelect}
                            />
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                                <Upload className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white mb-1">
                                {t('common.import.uploadFile')}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                {t('common.import.dragDrop')}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-solid border-brand-500/50 bg-brand-50/50 dark:bg-brand-900/10 rounded-2xl relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); resetSelection(); }}
                                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <AlertCircle className="w-4 h-4" />
                            </button>
                            <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                                <FileText className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white mb-1 truncate max-w-[200px]">
                                {selectedFile.name}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                {(selectedFile.size / 1024).toFixed(1)} KB
                            </span>
                            <Button
                                onClick={handleImport}
                                disabled={isUploading}
                                className="w-full bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                            >
                                {isUploading ? t('common.loading') : t('common.import.confirm')}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-white/5">
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
