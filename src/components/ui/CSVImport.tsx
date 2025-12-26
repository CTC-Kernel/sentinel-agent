
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
    const { addToast } = useStore();

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
                        message: `${field.label} est requis`
                    });
                }

                if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
                    validationErrors.push({
                        row: index + 1,
                        field: field.label,
                        message: `${field.label} doit être un email valide`
                    });
                }

                if (value && field.type === 'number' && isNaN(Number(value))) {
                    validationErrors.push({
                        row: index + 1,
                        field: field.label,
                        message: `${field.label} doit être un nombre`
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
            addToast('Veuillez sélectionner un fichier CSV', 'error');
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
            addToast('Veuillez corriger les erreurs avant d\'importer', 'error');
            return;
        }

        setImporting(true);
        setStep('importing');

        try {
            await onImport(parsedData);
            setImportedCount(parsedData.length);
            setStep('complete');
            addToast(`${parsedData.length} éléments importés avec succès`, 'success');
        } catch {
            addToast('Erreur lors de l\'importation', 'error');
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
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-4xl border border-white/20 overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-brand-50/30 dark:bg-brand-900/10 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-brand-900 dark:text-brand-100 tracking-tight">{title}</h2>
                    <button aria-label="Fermer la fenêtre" onClick={onClose} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                                    <Upload className="h-10 w-10 text-brand-600 dark:text-brand-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Importer depuis un fichier CSV</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Uploadez votre fichier CSV pour importer en masse</p>
                            </div>

                            <div className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-500 transition-colors">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="csv-upload"
                                />
                                <label htmlFor="csv-upload" className="cursor-pointer">
                                    <Upload className="h-12 w-12 text-slate-500 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Cliquez pour sélectionner un fichier CSV</p>
                                    <p className="text-xs text-slate-600 mt-1">ou glissez-déposez ici</p>
                                    {file && (
                                        <p className="text-xs text-brand-600 dark:text-brand-400 mt-2 font-medium">
                                            Fichier sélectionné : {file.name}
                                        </p>
                                    )}
                                </label>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <p className="text-sm text-slate-600 dark:text-slate-400">Besoin d'un modèle ?</p>
                                <button aria-label="Télécharger le modèle CSV" onClick={downloadTemplate} className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:underline">
                                    Télécharger le modèle CSV
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Aperçu - {parsedData.length} lignes</h3>
                                    {errors.length > 0 && (
                                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                            {errors.length} erreur{errors.length > 1 ? 's' : ''} détectée{errors.length > 1 ? 's' : ''}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button aria-label="Annuler l'importation" onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                                        Annuler
                                    </button>
                                    <button
                                        aria-label={`Importer ${parsedData.length} éléments`}
                                        onClick={handleImport}
                                        disabled={errors.length > 0}
                                        className="px-4 py-2 text-sm font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Importer {parsedData.length} élément{parsedData.length > 1 ? 's' : ''}
                                    </button>
                                </div>
                            </div>

                            {errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="h-5 w-5 text-red-600" />
                                        <h4 className="font-bold text-red-900 dark:text-red-100">Erreurs de validation</h4>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                                        {errors.slice(0, 10).map((err, i) => (
                                            <p key={`err-${i}`} className="text-sm text-red-700 dark:text-red-300">
                                                Ligne {err.row}: {err.message}
                                            </p>
                                        ))}
                                        {errors.length > 10 && (
                                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                                ... et {errors.length - 10} autre{errors.length - 10 > 1 ? 's' : ''} erreur{errors.length - 10 > 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                                        <tr>
                                            {fields.map(field => (
                                                <th key={field.key} className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-300">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedData.slice(0, 5).map((row, i) => (
                                            <tr key={`row-${i}`} className="border-t border-slate-200 dark:border-white/5">
                                                {fields.map(field => (
                                                    <td key={field.key} className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                        {String(row[field.key] || '-')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {parsedData.length > 5 && (
                                <p className="text-xs text-slate-600 text-center">...et {parsedData.length - 5} ligne{parsedData.length - 5 > 1 ? 's' : ''} supplémentaire{parsedData.length - 5 > 1 ? 's' : ''}</p>
                            )}
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {importing ? 'Importation en cours...' : 'Préparation...'}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Veuillez patienter</p>
                        </div>
                    )}

                    {step === 'complete' && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Importation réussie !</h3>
                            <p className="text-sm text-slate-600 dark:test-slate-400">{importedCount} élément{importedCount > 1 ? 's' : ''} importé{importedCount > 1 ? 's' : ''} avec succès</p>
                            <button aria-label="Terminer l'importation" onClick={onClose} className="mt-6 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors">
                                Terminer
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
