import React, { useState } from 'react';
import { Control, Document } from '../../../types';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { Skeleton } from '../../ui/Skeleton';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { FileText, Paperclip, ExternalLink, X, Upload, Loader2 } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { formatDate } from '@/utils/date';
import { useLocale } from '@/hooks/useLocale';

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
    const { t } = useLocale();
    const { updating, handleLinkDocument, handleUnlinkDocument, onUploadEvidence } = handlers;
    const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);
    const [linkingDocId, setLinkingDocId] = useState<string | null>(null);

    // Safe array access
    const safeDocuments = documents ?? [];
    const isDocumentsLoading = !documents;

    const handleConfirmUnlink = async () => {
        if (unlinkTarget) {
            await handleUnlinkDocument(control, unlinkTarget);
            setUnlinkTarget(null);
        }
    };

    const handleLinkWithLoading = async (docId: string) => {
        setLinkingDocId(docId);
        try {
            await handleLinkDocument(control, docId);
        } finally {
            setLinkingDocId(null);
        }
    };

    if (isDocumentsLoading) {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 dark:border-border/40 shadow-sm">
                    <Skeleton className="h-6 w-48 mb-6" />
                    <div className="space-y-3">
                        <Skeleton className="h-16 rounded-3xl" />
                        <Skeleton className="h-16 rounded-3xl" />
                    </div>
                </div>
            </div>
        );
    }

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
                                        <Button variant="ghost" size="icon" aria-label={t('compliance.unlinkDocument', { defaultValue: 'Délier le document' })} onClick={() => setUnlinkTarget(docId)} disabled={updating} className="h-8 w-8 text-slate-500 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {(!control.evidenceIds || control.evidenceIds.length === 0) && (
                        <div>
                            <EmptyState icon={Paperclip} title={t('compliance.noEvidence', { defaultValue: 'Aucune preuve' })} description={t('compliance.linkDocumentsForCompliance', { defaultValue: 'Liez des documents pour prouver la conformité.' })} compact />
                            {canEdit && (
                                <div className="flex justify-center mt-4">
                                    <Button
                                        onClick={() => onUploadEvidence(control)}
                                        size="sm"
                                        variant="outline"
                                        className="text-xs font-bold"
                                    >
                                        <Upload className="h-3 w-3 mr-1.5" />
                                        {t('compliance.addEvidence', { defaultValue: 'Ajouter une preuve' })}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {canEdit && (
                    <div className="mt-6 pt-6 border-t border-border/40 dark:border-white/5">
                        <CustomSelect
                            label={t('compliance.addExistingEvidence', { defaultValue: 'Ajouter une preuve existante' })}
                            value=""
                            onChange={(val) => handleLinkWithLoading(val as string)}
                            options={safeDocuments.filter(d => !control.evidenceIds?.includes(d.id)).map(d => ({ value: d.id, label: d.title }))}
                            placeholder={t('compliance.selectDocument', { defaultValue: 'Sélectionner un document...' })}
                            disabled={updating || !!linkingDocId}
                        />
                    </div>
                )}
            </div>

            {/* Unlink Confirmation Dialog */}
            <ConfirmModal
                isOpen={!!unlinkTarget}
                onClose={() => setUnlinkTarget(null)}
                onConfirm={handleConfirmUnlink}
                title={t('compliance.unlinkEvidenceTitle', { defaultValue: 'Délier la preuve' })}
                message={t('compliance.unlinkEvidenceMessage', { defaultValue: 'Êtes-vous sûr de vouloir délier ce document ? Le document ne sera pas supprimé.' })}
                confirmText={t('compliance.unlinkConfirm', { defaultValue: 'Délier' })}
                cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
                type="warning"
            />
        </div>
    );
};
