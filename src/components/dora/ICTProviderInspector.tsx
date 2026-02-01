/**
 * ICT Provider Inspector Component
 * DORA Art. 28 - Story 35.1
 * Detail panel for viewing ICT Provider information
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ICTProvider } from '../../types/dora';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import {
    Building2,
    FileText,
    Shield,
    AlertTriangle,
    Server,
    Edit2,
    Globe,
    Mail,
    Phone,
    ExternalLink,
    Calendar,
    CheckCircle,
    XCircle
} from '../ui/Icons';
import { format, differenceInDays } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';

interface ICTProviderInspectorProps {
    provider: ICTProvider;
    onEdit: () => void;
}

export const ICTProviderInspector: React.FC<ICTProviderInspectorProps> = ({
    provider,
    onEdit
}) => {
    const { t } = useTranslation();
    const { dateFnsLocale } = useLocale();

    const getCategoryBadge = () => {
        switch (provider.category) {
            case 'critical':
                return <Badge status="error" variant="soft">{t('dora.category.critical')}</Badge>;
            case 'important':
                return <Badge status="warning" variant="soft">{t('dora.category.important')}</Badge>;
            default:
                return <Badge status="neutral" variant="soft">{t('dora.category.standard')}</Badge>;
        }
    };

    const formatDate = (dateValue: string | unknown) => {
        if (!dateValue) return '-';
        try {
            const date = typeof dateValue === 'string' ? new Date(dateValue) : null;
            if (!date || isNaN(date.getTime())) return '-';
            return format(date, 'dd MMMM yyyy', { locale: dateFnsLocale });
        } catch {
            return '-';
        }
    };

    const getContractDaysLeft = () => {
        if (!provider.contractInfo?.endDate) return null;
        const end = typeof provider.contractInfo.endDate === 'string'
            ? new Date(provider.contractInfo.endDate)
            : null;
        if (!end || isNaN(end.getTime())) return null;
        return differenceInDays(end, new Date());
    };

    const daysLeft = getContractDaysLeft();

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border/40 dark:border-white/5">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            {getCategoryBadge()}
                            {provider.compliance?.doraCompliant ? (
                                <Badge status="success" variant="outline" size="sm">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    DORA
                                </Badge>
                            ) : (
                                <Badge status="warning" variant="outline" size="sm">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Non-DORA
                                </Badge>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {provider.name}
                        </h2>
                        {provider.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-300 mt-1 line-clamp-2">
                                {provider.description}
                            </p>
                        )}
                    </div>
                    <Button onClick={onEdit} variant="outline" size="sm" aria-label={t('dora.provider.edit', { defaultValue: 'Modifier le fournisseur' })}>
                        <Edit2 className="w-4 h-4 mr-1" />
                        {t('common.edit')}
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Contract Warning */}
                {daysLeft !== null && daysLeft <= 90 && (
                    <div className={`p-4 rounded-2xl border ${
                        daysLeft <= 0
                            ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 dark:bg-red-900/20 dark:border-red-800'
                            : daysLeft <= 30
                            ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 dark:bg-red-900/20 dark:border-red-800'
                            : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 dark:bg-amber-900/20 dark:border-amber-800'
                    }`}>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className={`w-5 h-5 ${
                                daysLeft <= 30 ? 'text-red-500' : 'text-amber-500'
                            }`} />
                            <span className={`font-medium ${
                                daysLeft <= 30 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                            }`}>
                                {daysLeft <= 0
                                    ? t('dora.contract.expired')
                                    : t('dora.contract.expiringIn', { days: daysLeft })}
                            </span>
                        </div>
                    </div>
                )}

                {/* Services Section */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        {t('dora.fields.services')} ({provider.services?.length || 0})
                    </h3>
                    <div className="space-y-2">
                        {provider.services?.map((service, index) => (
                            <div
                                key={service.id || index}
                                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl flex items-center justify-between"
                            >
                                <div>
                                    <span className="font-medium text-slate-900 dark:text-white">
                                        {service.name}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-300 ml-2">
                                        {t(`dora.service.types.${service.type}`)}
                                    </span>
                                </div>
                                <Badge
                                    status={service.criticality === 'critical' ? 'error' : service.criticality === 'important' ? 'warning' : 'neutral'}
                                    variant="outline"
                                    size="sm"
                                >
                                    {t(`dora.category.${service.criticality}`)}
                                </Badge>
                            </div>
                        ))}
                        {(!provider.services || provider.services.length === 0) && (
                            <p className="text-sm text-slate-500 dark:text-slate-300 italic">{t('dora.provider.noServices', { defaultValue: 'Aucun service defini' })}</p>
                        )}
                    </div>
                </section>

                {/* Contract Section */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {t('dora.contract.title')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                            <span className="text-xs text-slate-500 dark:text-slate-300 block mb-1">{t('dora.contract.startDate')}</span>
                            <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                {formatDate(provider.contractInfo?.startDate)}
                            </span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                            <span className="text-xs text-slate-500 dark:text-slate-300 block mb-1">{t('dora.contract.endDate')}</span>
                            <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                {formatDate(provider.contractInfo?.endDate)}
                            </span>
                        </div>
                        <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                            <span className="text-xs text-slate-500 dark:text-slate-300 block mb-1">{t('dora.contract.exitStrategy')}</span>
                            <span className="text-sm text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
                                {provider.contractInfo?.exitStrategy || '-'}
                            </span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                            <span className="text-xs text-slate-500 dark:text-slate-300 block mb-1">{t('dora.contract.auditRights')}</span>
                            <span className="font-medium">
                                {provider.contractInfo?.auditRights ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                )}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Compliance Section */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {t('dora.compliance.title')}
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                            <span className="text-sm text-slate-600 dark:text-muted-foreground">{t('dora.compliance.locationEU')}</span>
                            {provider.compliance?.locationEU ? (
                                <Badge status="success" variant="soft" size="sm">
                                    <Globe className="w-3 h-3 mr-1" />
                                    UE
                                </Badge>
                            ) : (
                                <Badge status="warning" variant="soft" size="sm">{t('dora.compliance.outsideEU', { defaultValue: 'Hors UE' })}</Badge>
                            )}
                        </div>
                        {provider.compliance?.headquartersCountry && (
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                                <span className="text-sm text-slate-600 dark:text-muted-foreground">{t('dora.compliance.headquartersCountry')}</span>
                                <span className="font-medium text-slate-900 dark:text-white">
                                    {provider.compliance.headquartersCountry}
                                </span>
                            </div>
                        )}
                        {provider.compliance?.certifications && provider.compliance.certifications.length > 0 && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                                <span className="text-xs text-slate-500 dark:text-slate-300 block mb-2">{t('dora.compliance.certifications')}</span>
                                <div className="flex flex-wrap gap-2">
                                    {provider.compliance.certifications.map((cert, i) => (
                                        <Badge key={i || 'unknown'} status="brand" variant="outline" size="sm">
                                            {cert}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Risk Section */}
                <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t('dora.risk.title')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                            <span className="text-xs text-slate-500 dark:text-slate-300 block mb-2">{t('dora.risk.concentration')}</span>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${
                                            (provider.riskAssessment?.concentration || 0) > 70
                                                ? 'bg-red-500'
                                                : (provider.riskAssessment?.concentration || 0) > 40
                                                ? 'bg-amber-500'
                                                : 'bg-green-500'
                                        }`}
                                        style={{ width: `${provider.riskAssessment?.concentration || 0}%` }}
                                    />
                                </div>
                                <span className="text-sm font-bold">
                                    {provider.riskAssessment?.concentration || 0}%
                                </span>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                            <span className="text-xs text-slate-500 dark:text-slate-300 block mb-1">{t('dora.risk.substitutability')}</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                                {t(`dora.risk.${provider.riskAssessment?.substitutability || 'medium'}Substitutability`)}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                {(provider.contactName || provider.contactEmail || provider.contactPhone || provider.website) && (
                    <section>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            {t('dora.provider.contact', { defaultValue: 'Contact' })}
                        </h3>
                        <div className="space-y-2">
                            {provider.contactName && (
                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-muted-foreground">
                                    <Building2 className="w-4 h-4" />
                                    {provider.contactName}
                                </div>
                            )}
                            {provider.contactEmail && (
                                <a
                                    href={`mailto:${provider.contactEmail}`}
                                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                                >
                                    <Mail className="w-4 h-4" />
                                    {provider.contactEmail}
                                </a>
                            )}
                            {provider.contactPhone && (
                                <a
                                    href={`tel:${provider.contactPhone}`}
                                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                                >
                                    <Phone className="w-4 h-4" />
                                    {provider.contactPhone}
                                </a>
                            )}
                            {provider.website && (
                                <a
                                    href={provider.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {provider.website}
                                </a>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};
