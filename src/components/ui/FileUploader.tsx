import React, { useState, useRef } from 'react';
import { Upload, X, File, CheckCircle2, AlertTriangle, ShieldCheck } from '../ui/Icons';
import { uploadFile, validateFile, formatFileSize, generateFilePath } from '../../services/fileUploadService';
import { useStore } from '../../store';
import CryptoJS from 'crypto-js';

interface FileUploaderProps {
    onUploadComplete: (url: string, fileName: string, hash?: string, isSecure?: boolean, size?: number) => void;
    category: string;
    maxSizeMB?: number;
    allowedTypes?: string[];
    multiple?: boolean;
    disabled?: boolean;
    disabledMessage?: string;
    compact?: boolean;
    label?: string;
    initialFile?: File; // New prop
}

export const FileUploader: React.FC<FileUploaderProps> = ({
    onUploadComplete,
    category,
    maxSizeMB = 10,
    allowedTypes = ['image/*', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    multiple = false,
    disabled = false,
    disabledMessage = "Upload désactivé",
    compact = false,
    label,
    initialFile
}) => {
    const { user } = useStore();
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSecure, setIsSecure] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle initial file
    React.useEffect(() => {
        if (initialFile) {
            const validation = validateFile(initialFile, maxSizeMB, allowedTypes);
            if (validation.valid) {
                setSelectedFile(initialFile);
            } else {
                setError(validation.error || 'Invalid file');
            }
        }
    }, [initialFile, maxSizeMB, allowedTypes]); // Check dependencies

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        const validation = validateFile(file, maxSizeMB, allowedTypes);

        if (!validation.valid) {
            setError(validation.error || 'Invalid file');
            return;
        }

        setSelectedFile(file);
    };

    const calculateHash = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const binary = e.target?.result;
                if (binary) {
                    const wordArray = CryptoJS.lib.WordArray.create(binary as unknown as ArrayBuffer);
                    const hash = CryptoJS.SHA256(wordArray).toString();
                    resolve(hash);
                } else {
                    reject(new Error("Failed to read file"));
                }
            };
            reader.onerror = () => reject(new Error("File read error"));
            reader.readAsArrayBuffer(file);
        });
    };

    const handleUpload = async () => {
        if (!selectedFile || !user) return;

        setUploading(true);
        setError(null);
        setProgress(0);

        try {
            // Calculate hash if secure mode is enabled or always for integrity
            const hash = await calculateHash(selectedFile);

            const path = generateFilePath(user.organizationId || 'default', category, selectedFile.name);

            // Use uploadBytesResumable for real progress
            const downloadURL = await uploadFile(selectedFile, path, {
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
                uploadedBy: user.uid,
                organizationId: user.organizationId,
                hash: hash,
                isSecure: isSecure.toString()
            }, (progress) => {
                setProgress(progress);
            });

            setProgress(100);

            setTimeout(() => {
                onUploadComplete(downloadURL, selectedFile.name, hash, isSecure, selectedFile.size);
                setSelectedFile(null);
                setProgress(0);
                setUploading(false);
                setIsSecure(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }, 500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
            setUploading(false);
            setProgress(0);
        }
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setError(null);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-4">
            {/* File Input */}
            {!selectedFile && (
                <div className="relative">
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        multiple={multiple}
                        accept={allowedTypes.join(',')}
                        className="hidden"
                        id="file-upload"
                        disabled={disabled}
                    />
                    <label
                        htmlFor={disabled ? undefined : "file-upload"}
                        className={`flex flex-col items-center justify-center w-full ${compact ? 'h-20' : 'h-32'} border-2 border-dashed rounded-2xl transition-colors ${disabled ? 'border-slate-200 bg-slate-100 cursor-not-allowed' : 'border-slate-300 dark:border-slate-600 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50 dark:bg-slate-800/50'}`}
                    >
                        {disabled ? (
                            <div className="text-center">
                                <AlertTriangle className={`text-slate-500 mx-auto ${compact ? 'h-5 w-5' : 'h-8 w-8 mb-2'}`} />
                                <p className="text-sm font-medium text-slate-600">{disabledMessage}</p>
                            </div>
                        ) : (
                            <>
                                <Upload className={`text-slate-500 ${compact ? 'h-5 w-5 mb-1' : 'h-8 w-8 mb-2'}`} />
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    {label || "Cliquez pour sélectionner un fichier"}
                                </p>
                                {!compact && (
                                    <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                                        Max {maxSizeMB}MB • PDF, Images, Excel
                                    </p>
                                )}
                            </>
                        )}
                    </label>
                </div>
            )}

            {/* Selected File */}
            {selectedFile && (
                <div className="glass-panel p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-slate-900/30 flex items-center justify-center">
                                <File className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {selectedFile.name}
                                </p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    {formatFileSize(selectedFile.size)}
                                </p>
                            </div>
                        </div>
                        {!uploading && (
                            <button
                                onClick={handleCancel}
                                className="ml-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <X className="h-4 w-4 text-slate-500" />
                            </button>
                        )}
                    </div>

                    {/* Security Toggle */}
                    {!uploading && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 mb-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className={`h-5 w-5 ${isSecure ? 'text-emerald-500' : 'text-slate-500'}`} />
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Document Stratégique</p>
                                    <p className="text-[10px] text-slate-600">Active le filigrane et la vérification d'intégrité</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSecure(!isSecure)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isSecure ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${isSecure ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    )}

                    {/* Progress Bar */}
                    {uploading && (
                        <div className="mt-3">
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                Upload en cours... {progress}%
                            </p>
                        </div>
                    )}

                    {/* Upload Button */}
                    {!uploading && (
                        <button
                            onClick={handleUpload}
                            className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Téléverser
                        </button>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}
            {/* Success Message */}
            {progress === 100 && !uploading && (
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-600 dark:text-green-400">Fichier téléversé avec succès !</p>
                </div>
            )}
        </div>
    );
};
