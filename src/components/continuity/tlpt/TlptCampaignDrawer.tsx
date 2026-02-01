import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TlptCampaign } from '../../../types';
import { tlptSchema, TlptFormData } from '../../../schemas/tlptSchema';
import { TlptFindings } from './TlptFindings';
import { InspectorLayout } from '../../ui/InspectorLayout';
import { Button } from '../../ui/button';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
import { DatePicker } from '../../ui/DatePicker';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { Loader2, ArrowRight, Trash, FileText, AlertTriangle } from '../../ui/Icons';
import { useTranslation } from 'react-i18next';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<TlptCampaign>) => Promise<void>;
    initialData?: TlptCampaign;
    title?: string;
    isLoading?: boolean;
    onDelete?: (id: string) => Promise<void>;
}

export const TlptCampaignDrawer: React.FC<Props> = ({ isOpen, onClose, onSubmit, initialData, title, isLoading, onDelete }) => {
    const { t } = useTranslation();
    const { control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<TlptFormData>({
        resolver: zodResolver(tlptSchema),
        defaultValues: {
            name: '',
            scope: '',
            provider: '',
            status: 'Planned',
            notes: '',
        }
    });

    const [activeTab, setActiveTab] = useState<'details' | 'findings'>('details');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (isOpen) {

            setActiveTab('details');
            if (initialData) {
                reset({
                    name: initialData.name,
                    scope: initialData.scope,
                    methodology: initialData.methodology,
                    provider: initialData.provider,
                    status: initialData.status,
                    startDate: initialData.startDate ? new Date(((initialData.startDate as unknown) as { seconds: number }).seconds ? ((initialData.startDate as unknown) as { seconds: number }).seconds * 1000 : initialData.startDate as Date | string | number) : undefined,
                    endDate: initialData.endDate ? new Date(((initialData.endDate as unknown) as { seconds: number }).seconds ? ((initialData.endDate as unknown) as { seconds: number }).seconds * 1000 : initialData.endDate as Date | string | number) : undefined,
                    budget: initialData.budget,
                    notes: initialData.notes
                });
            } else {
                reset({
                    name: '',
                    scope: '',
                    provider: '',
                    status: 'Planned',
                    notes: ''
                });
            }
        }
    }, [isOpen, initialData, reset]);

    const handleFormSubmit = async (data: TlptFormData) => {
        await onSubmit(data as unknown as Partial<TlptCampaign>);
    };

    const tabs = initialData ? [
        { id: 'details', label: t('tlpt.tabs.details', { defaultValue: 'Informations' }), icon: FileText },
        { id: 'findings', label: t('tlpt.tabs.findings', { defaultValue: 'Constatations' }), icon: AlertTriangle }
    ] : [];

    const footer = (
        <div className="flex justify-end gap-3 w-full">
            {onDelete && initialData && (
                <Button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    variant="ghost"
                    className="mr-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"
                >
                    <Trash className="w-4 h-4 mr-2" />
                    {t('common.delete', { defaultValue: 'Supprimer' })}
                </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
            <Button
                type="submit"
                form="tlpt-form"
                disabled={isLoading}
                className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20"
            >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                {initialData ? t('common.update', { defaultValue: 'Mettre à jour' }) : t('tlpt.create.submit', { defaultValue: 'Créer la campagne' })}
            </Button>
        </div>
    );

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={title || (initialData ? t('tlpt.edit.title', { defaultValue: 'Modifier Campagne TLPT' }) : t('tlpt.create.title', { defaultValue: 'Nouvelle Campagne TLPT' }))}
            subtitle={initialData ? t('tlpt.edit.subtitle', { defaultValue: "Gérez les détails, le périmètre et les résultats de l'exercice." }) : t('tlpt.create.subtitle', { defaultValue: 'Planifiez une nouvelle campagne de tests.' })}
            width={activeTab === 'findings' ? 'max-w-4xl' : 'max-w-xl'}
            icon={AlertTriangle} // Or another relevant icon
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as 'details' | 'findings')}
            footer={activeTab === 'details' ? footer : undefined}
            hasUnsavedChanges={isDirty}
        >
            {activeTab === 'details' ? (
                <form id="tlpt-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('tlpt.fields.campaignName', { defaultValue: 'Nom de la campagne' })}
                                    {...field}
                                    error={errors.name?.message}
                                />
                            )}
                        />
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label={t('tlpt.fields.status', { defaultValue: 'Statut' })}
                                    options={[
                                        { value: "Planned", label: t('tlpt.status.planned', { defaultValue: 'Planifié' }) },
                                        { value: "In Progress", label: t('tlpt.status.inProgress', { defaultValue: 'En cours' }) },
                                        { value: "Analysis", label: t('tlpt.status.analysis', { defaultValue: 'Analyse' }) },
                                        { value: "Remediation", label: t('tlpt.status.remediation', { defaultValue: 'Remédiation' }) },
                                        { value: "Closed", label: t('tlpt.status.closed', { defaultValue: 'Clôturé' }) }
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.status?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <Controller
                            name="methodology"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label={t('tlpt.fields.methodology', { defaultValue: 'Méthodologie' })}
                                    options={[
                                        { value: "TIBER-EU", label: "TIBER-EU" },
                                        { value: "Red Team", label: "Red Team" },
                                        { value: "Purple Team", label: "Purple Team" },
                                        { value: "Other", label: t('tlpt.options.other', { defaultValue: 'Autre' }) }
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.methodology?.message}
                                />
                            )}
                        />
                        <Controller
                            name="provider"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('tlpt.fields.provider', { defaultValue: 'Prestataire / Auditeur' })}
                                    {...field}
                                    error={errors.provider?.message}
                                />
                            )}
                        />
                    </div>

                    <div>
                        <Controller
                            name="scope"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('tlpt.fields.scope', { defaultValue: 'Périmètre (Scope)' })}
                                    {...field}
                                    error={errors.scope?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <Controller
                            name="startDate"
                            control={control}
                            render={({ field }) => (
                                <DatePicker
                                    label={t('tlpt.fields.startDate', { defaultValue: 'Date de début' })}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.startDate?.message}
                                />
                            )}
                        />
                        <Controller
                            name="endDate"
                            control={control}
                            render={({ field }) => (
                                <DatePicker
                                    label={t('tlpt.fields.endDate', { defaultValue: 'Date de fin (estimée)' })}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>

                    <div>
                        <Controller
                            name="notes"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('tlpt.fields.notes', { defaultValue: 'Notes & Observations' })}
                                    {...field}
                                    textarea
                                    className="min-h-[120px]"
                                />
                            )}
                        />
                    </div>
                </form>
            ) : (
                initialData && <TlptFindings campaign={initialData as TlptCampaign} />
            )}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={async () => {
                    if (onDelete && initialData) {
                        setIsDeleting(true);
                        try {
                            await onDelete(initialData.id);
                            onClose();
                        } finally {
                            setIsDeleting(false);
                            setShowDeleteConfirm(false);
                        }
                    }
                }}
                title={t('tlpt.delete.title', { defaultValue: 'Supprimer la campagne' })}
                message={t('tlpt.delete.message', { defaultValue: 'Êtes-vous sûr de vouloir supprimer cette campagne TLPT ? Cette action est irréversible.' })}
                type="danger"
                confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
                cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
                loading={isDeleting}
                closeOnConfirm={false}
            />
        </InspectorLayout>
    );
};
