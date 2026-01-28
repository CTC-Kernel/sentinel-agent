import React from 'react';
import { Control, Document } from '../../../types';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { FileText, Paperclip, ExternalLink, X, Upload } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { formatDate } from '@/utils/date';

interface ComplianceEvidenceProps {
    control: Control;
    canEdit: boolean;
    documents: Document[];
    handlers: {
        updating: boolean;
        handleLinkDocument: (c: Control, did: string) => Promise<void>;
        handleUnlinkDocument: (c: Control, did: string) => Promise<void>;
        onUploadEvidence: (c: Control) => void;
    };
}

export const ComplianceEvidence: React.FC<ComplianceEvidenceProps> = ({
    control,
    canEdit,
    documents,
    handlers
}) => {
    const { updating, handleLinkDocument, handleUnlinkDocument, onUploadEvidence } = handlers;

    // Safe array access
    const safeDocuments = documents ?? [];

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 dark:border-border/40 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white">Preuves documentaires</h3>
                    {canEdit && (
                        <Button
                            onClick={() => onUploadEvidence(control)}
                            size="sm"
                            className="text-xs font-bold shadow-sm"
                        >
                            <Upload className="h-3 w-3 mr-1.5" />
                            Ajouter une preuve
                        </Button>
                    )}
                </div>
                <div className="space-y-3">
                    {control.evidenceIds?.map(docId => {
                        const doc = safeDocuments.find(d => d.id === docId);
                        if (!doc) return null;
                        return (
                            <div key={docId} className="flex items-center p-3 bg-white dark:bg-white/5 border border-border/40 dark:border-border/40 rounded-3xl hover:shadow-md transition-all">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg mr-3">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{doc.title}</h4>
                                    <p className="text-xs text-slate-500">{formatDate(doc.createdAt)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 dark:text-slate-300 hover:text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                    {canEdit && (
                                        <Button variant="ghost" size="icon" aria-label="Délier le document" onClick={() => handleUnlinkDocument(control, docId)} className="h-8 w-8 text-slate-500 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {(!control.evidenceIds || control.evidenceIds.length === 0) && (
                        <EmptyState icon={Paperclip} title="Aucune preuve" description="Liez des documents pour prouver la conformité." compact />
                    )}
                </div>

                {canEdit && (
                    <div className="mt-6 pt-6 border-t border-border/40 dark:border-white/5">
                        <CustomSelect
                            label="Ajouter une preuve existante"
                            value=""
                            onChange={(val) => handleLinkDocument(control, val as string)}
                            options={safeDocuments.filter(d => !control.evidenceIds?.includes(d.id)).map(d => ({ value: d.id, label: d.title }))}
                            placeholder="Sélectionner un document..."
                            disabled={updating}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
