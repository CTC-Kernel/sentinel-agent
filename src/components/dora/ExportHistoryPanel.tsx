/**
 * Export History Panel
 * Story 35-3: DORA Register Export
 *
 * Displays history of DORA register exports
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { FileCode, FileSpreadsheet, FileText, Trash2, Clock, User, FileDown, Loader2 } from '../ui/Icons';
import { DORAExportService, DORAExportRecord, ExportFormat } from '../../services/DORAExportService';
import { useStore } from '../../store';
import { cn } from '../../lib/utils';
import { ErrorLogger } from '../../services/errorLogger';

interface ExportHistoryPanelProps {
    className?: string;
    onClose?: () => void;
}

export const ExportHistoryPanel: React.FC<ExportHistoryPanelProps> = ({
    className,
    onClose
}) => {
    const { t, i18n } = useTranslation();
    const { organization, user } = useStore();

    const [exports, setExports] = useState<DORAExportRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const locale = i18n.language === 'en' ? enUS : fr;
    const isAdmin = user?.role === 'admin' || user?.role === 'rssi';

    const loadExports = useCallback(async () => {
        if (!organization?.id) return;

        setLoading(true);
        try {
            const history = await DORAExportService.getExportHistory(organization.id);
            setExports(history);
        } catch (error) {
            ErrorLogger.error(error, 'ExportHistoryPanel.loadExports');
            toast.error(t('dora.export.historyError'));
        } finally {
            setLoading(false);
        }
    }, [organization?.id, t]);

    useEffect(() => {
        loadExports();
    }, [loadExports]);

    const handleDelete = useCallback(async (exportId: string) => {
        setDeletingId(exportId);
        try {
            await DORAExportService.deleteExportRecord(exportId);
            setExports(prev => prev.filter(e => e.id !== exportId));
            toast.success(t('dora.export.deleted'));
        } catch (error) {
            ErrorLogger.error(error, 'ExportHistoryPanel.deleteExport');
            toast.error(t('common.error'));
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    }, [t]);

    const getFormatIcon = (format: ExportFormat) => {
        switch (format) {
            case 'json':
                return FileCode;
            case 'excel':
                return FileSpreadsheet;
            case 'pdf':
                return FileText;
            default:
                return FileDown;
        }
    };

    const getFormatBadge = (format: ExportFormat) => {
        const config = {
            json: { status: 'info' as const, label: 'JSON' },
            excel: { status: 'success' as const, label: 'Excel' },
            pdf: { status: 'warning' as const, label: 'PDF' }
        };
        return config[format] || { status: 'neutral' as const, label: format };
    };

    const formatFileSize = (bytes?: number): string => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (loading) {
        return (
            <div className={cn('p-6', className)}>
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn('', className)}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t('dora.export.history')}
                </h3>
                {onClose && (
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        {t('common.close')}
                    </Button>
                )}
            </div>

            {exports.length === 0 ? (
                <div className="text-center py-12">
                    <FileDown className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-muted-foreground">
                        {t('dora.export.noHistory')}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {exports.map((exportRecord) => {
                        const FormatIcon = getFormatIcon(exportRecord.format);
                        const formatBadge = getFormatBadge(exportRecord.format);
                        const isDeleting = deletingId === exportRecord.id;

                        return (
                            <div
                                key={exportRecord.id}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                            <FormatIcon className="w-5 h-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {exportRecord.filename}
                                                </span>
                                                <Badge
                                                    status={formatBadge.status}
                                                    variant="soft"
                                                    size="sm"
                                                >
                                                    {formatBadge.label}
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(exportRecord.exportedAt), 'dd MMM yyyy HH:mm', { locale })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {exportRecord.exportedByName || 'Unknown'}
                                                </span>
                                                <span>
                                                    {exportRecord.providerCount} {t('dora.export.providers')}
                                                </span>
                                                {exportRecord.fileSize && (
                                                    <span>{formatFileSize(exportRecord.fileSize)}</span>
                                                )}
                                            </div>

                                            {exportRecord.parameters.categoryFilter !== 'all' && (
                                                <div className="mt-2">
                                                    <Badge variant="outline" size="sm">
                                                        {t(`dora.category.${exportRecord.parameters.categoryFilter}`)}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => exportRecord.id && setConfirmDeleteId(exportRecord.id)}
                                            disabled={isDeleting}
                                            className="text-muted-foreground hover:text-red-500"
                                        >
                                            {isDeleting ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDeleteId !== null}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                title={t('dora.export.deleteTitle', 'Supprimer l\'export')}
                message={t('dora.export.confirmDelete', 'Êtes-vous sûr de vouloir supprimer cet export ?')}
                type="danger"
                confirmText={t('common.delete', 'Supprimer')}
                cancelText={t('common.cancel', 'Annuler')}
            />
        </div>
    );
};
