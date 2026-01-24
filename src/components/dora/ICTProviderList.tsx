/**
 * ICT Provider List Component
 * DORA Art. 28 - Story 35.1
 * List view for ICT Providers with filtering and actions
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../ui/Badge';
import { RowActionsMenu, RowActionItem } from '../ui/RowActionsMenu';
import { Edit2, Trash2, Eye, Copy, AlertCircle, CheckCircle, Globe, Clock, AlertTriangle } from '../ui/Icons';
import { ICTProvider, ICTCriticality } from '../../types/dora';
import { format, differenceInDays } from 'date-fns';
import { parseDate } from '../../utils/dateUtils';
import { fr } from 'date-fns/locale';
import { useLocale } from '../../hooks/useLocale';

interface ICTProviderListProps {
    providers: ICTProvider[];
    loading: boolean;
    onSelect: (provider: ICTProvider) => void;
    onEdit: (provider: ICTProvider) => void;
    onDelete: (id: string) => Promise<void>;
    onDuplicate?: (provider: ICTProvider) => void;
}

type ProviderWithId = ICTProvider & { id: string };

export const ICTProviderList: React.FC<ICTProviderListProps> = ({
    providers,
    loading,
    onSelect,
    onEdit,
    onDelete,
    onDuplicate
}) => {
    const { t } = useTranslation();
    const { locale } = useLocale();
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    const safeProviders = useMemo(() => {
        return providers.filter((p): p is ProviderWithId => !!p.id);
    }, [providers]);

    const handleDelete = useCallback(async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (deletingIds.has(id)) return;
        setDeletingIds(prev => new Set(prev).add(id));
        try {
            await onDelete(id);
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [deletingIds, onDelete]);

    const getCategoryBadge = useCallback((category: ICTCriticality) => {
        switch (category) {
            case 'critical':
                return <Badge status="error" variant="soft" size="sm">{t('dora.category.critical')}</Badge>;
            case 'important':
                return <Badge status="warning" variant="soft" size="sm">{t('dora.category.important')}</Badge>;
            default:
                return <Badge status="neutral" variant="soft" size="sm">{t('dora.category.standard')}</Badge>;
        }
    }, [t]);

    const getContractStatus = useCallback((endDate: string | unknown) => {
        if (!endDate) return null;

        const end = typeof endDate === 'string' ? new Date(endDate) : null;
        if (!end || isNaN(end.getTime())) return null;

        const daysLeft = differenceInDays(end, new Date());

        if (daysLeft < 0) {
            return <Badge status="error" variant="outline" size="sm">{t('dora.contract.expired')}</Badge>;
        } else if (daysLeft <= 30) {
            return <Badge status="error" variant="outline" size="sm">{t('dora.contract.expiringIn', { days: daysLeft })}</Badge>;
        } else if (daysLeft <= 90) {
            return <Badge status="warning" variant="outline" size="sm">{t('dora.contract.expiringIn', { days: daysLeft })}</Badge>;
        }
        return null;
    }, [t]);

    const formatDate = useCallback((dateValue: string | unknown) => {
        if (!dateValue) return '-';
        try {
            const date = typeof dateValue === 'string' ? new Date(dateValue) : null;
            if (!date || isNaN(date.getTime())) return '-';
            return format(date, locale === 'fr' ? 'dd MMM yyyy' : 'MMM dd, yyyy', { locale: fr });
        } catch {
            return '-';
        }
    }, [locale]);

    const isReassessmentDue = (provider: ICTProvider, thresholdDays: number = 365): boolean => {
        const lastAssessment = parseDate(provider.riskAssessment?.lastAssessment);
        if (!lastAssessment) return true; // No assessment = overdue
        const daysSince = differenceInDays(new Date(), lastAssessment);
        return daysSince >= thresholdDays;
    };

    const isHighRisk = (provider: ICTProvider): boolean => {
        const concentration = provider.riskAssessment?.concentration || 0;
        return concentration > 70 || (provider.category === 'critical' && concentration > 50);
    };

    const columns = useMemo<ColumnDef<ProviderWithId>[]>(() => [
        {
            accessorKey: 'category',
            header: t('dora.fields.category'),
            cell: ({ row }) => getCategoryBadge(row.original.category),
            size: 100
        },
        {
            accessorKey: 'name',
            header: t('dora.fields.name'),
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[250px]" title={row.original.name}>
                        {row.original.name}
                    </span>
                    {row.original.services && row.original.services.length > 0 && (
                        <span className="text-xs text-slate-500 mt-0.5">
                            {row.original.services.length} service{row.original.services.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            )
        },
        {
            accessorKey: 'compliance.doraCompliant',
            header: 'DORA',
            cell: ({ row }) => (
                <div className="flex items-center gap-1">
                    {row.original.compliance?.doraCompliant ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                    {row.original.compliance?.locationEU && (
                        <Globe className="w-4 h-4 text-blue-500" aria-label="EU" />
                    )}
                </div>
            ),
            size: 80
        },
        {
            accessorKey: 'contractInfo.endDate',
            header: t('dora.contract.endDate'),
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <span className="text-sm text-slate-600 dark:text-muted-foreground">
                        {formatDate(row.original.contractInfo?.endDate)}
                    </span>
                    {getContractStatus(row.original.contractInfo?.endDate)}
                </div>
            ),
            size: 150
        },
        {
            accessorKey: 'riskAssessment.concentration',
            header: t('dora.risk.concentration'),
            cell: ({ row }) => {
                const concentration = row.original.riskAssessment?.concentration || 0;
                const color = concentration > 70 ? 'bg-red-500' : concentration > 40 ? 'bg-amber-500' : 'bg-green-500';
                return (
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${color} transition-all`}
                                style={{ width: `${concentration}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{concentration}%</span>
                    </div>
                );
            },
            size: 130
        },
        {
            accessorKey: 'status',
            header: t('dora.fields.status'),
            cell: ({ row }) => {
                const status = row.original.status || 'active';
                const reassessmentDue = isReassessmentDue(row.original);
                const highRisk = isHighRisk(row.original);
                const getStatusConfig = (s: string) => {
                    switch (s) {
                        case 'active':
                            return { status: 'success' as const, label: t('dora.status.active') };
                        case 'inactive':
                            return { status: 'neutral' as const, label: t('dora.status.inactive') };
                        case 'pending':
                            return { status: 'warning' as const, label: t('dora.status.pending') };
                        case 'terminated':
                            return { status: 'error' as const, label: t('dora.status.terminated') };
                        default:
                            return { status: 'neutral' as const, label: status };
                    }
                };
                const config = getStatusConfig(status);
                return (
                    <div className="flex flex-col gap-1">
                        <Badge status={config.status} variant="outline" size="sm">
                            {config.label}
                        </Badge>
                        {reassessmentDue && (
                            <Badge status="warning" variant="soft" size="sm" className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {t('dora.risk.reassessmentDue')}
                            </Badge>
                        )}
                        {highRisk && (
                            <Badge status="error" variant="soft" size="sm" className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {t('dora.risk.highRisk')}
                            </Badge>
                        )}
                    </div>
                );
            },
            size: 130
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const isDeleting = deletingIds.has(row.original.id);
                const menuItems: RowActionItem[] = [
                    {
                        label: t('common.view'),
                        icon: Eye,
                        onClick: () => onSelect(row.original)
                    },
                    {
                        label: t('common.edit'),
                        icon: Edit2,
                        onClick: () => onEdit(row.original)
                    },
                    ...(onDuplicate ? [{
                        label: t('common.duplicate'),
                        icon: Copy,
                        onClick: () => onDuplicate(row.original)
                    }] : []),
                    {
                        label: t('common.delete'),
                        icon: Trash2,
                        onClick: () => handleDelete(row.original.id),
                        variant: 'danger' as const,
                        disabled: isDeleting
                    }
                ];

                return (
                    <div className="flex justify-end">
                        <RowActionsMenu
                            items={menuItems}
                            aria-label={`Actions pour ${row.original.name}`}
                        />
                    </div>
                );
            },
            size: 80
        }
    ], [t, deletingIds, onSelect, onEdit, handleDelete, onDuplicate, formatDate, getCategoryBadge, getContractStatus]);

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                ))}
            </div>
        );
    }

    if (safeProviders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Globe className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {t('dora.providers.emptyTitle')}
                </h3>
                <p className="text-slate-500 dark:text-muted-foreground max-w-md">
                    {t('dora.providers.emptyDesc')}
                </p>
            </div>
        );
    }

    return (
        <DataTable
            data={safeProviders}
            columns={columns}
            onRowClick={(row: ProviderWithId) => onSelect(row)}
        />
    );
};
