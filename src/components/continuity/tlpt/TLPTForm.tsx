import React from 'react';
import { Controller, SubmitHandler } from 'react-hook-form';
import { useZodForm } from '../../../hooks/useZodForm';
import { TlptCampaign } from '../../../types';
import { tlptSchema, TlptFormData } from '../../../schemas/tlptSchema';
import { Button } from '../../ui/button';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
import { DatePicker } from '../../ui/DatePicker';
import { Loader2, ArrowRight } from '../../ui/Icons';

interface TLPTFormProps {
    initialData?: TlptCampaign;
    onSubmit: (data: Partial<TlptCampaign>) => Promise<void>;
    onCancel?: () => void;
    isLoading?: boolean;
    isEditing?: boolean;
    readOnly?: boolean;
}

export const TLPTForm: React.FC<TLPTFormProps> = ({
    initialData,
    onSubmit,
    onCancel,
    isLoading,
    isEditing,
    readOnly
}) => {
    const defaultValues: TlptFormData = initialData ? {
        name: initialData.name,
        scope: initialData.scope,
        methodology: initialData.methodology,
        provider: initialData.provider,
        status: initialData.status,
        startDate: initialData.startDate ? new Date(((initialData.startDate as unknown) as { seconds: number }).seconds ? ((initialData.startDate as unknown) as { seconds: number }).seconds * 1000 : initialData.startDate as Date | string | number) : new Date(),
        endDate: initialData.endDate ? new Date(((initialData.endDate as unknown) as { seconds: number }).seconds ? ((initialData.endDate as unknown) as { seconds: number }).seconds * 1000 : initialData.endDate as Date | string | number) : undefined,
        budget: initialData.budget,
        notes: initialData.notes
    } : {
        name: '',
        scope: '',
        methodology: 'Red Team',
        provider: '',
        status: 'Planned',
        startDate: new Date(),
        notes: ''
    };

    const { control, handleSubmit, formState: { errors } } = useZodForm<typeof tlptSchema>({
        schema: tlptSchema,
        mode: 'onChange',
        defaultValues
    });

    const handleFormSubmit: SubmitHandler<TlptFormData> = async (data) => {
        await onSubmit(data as unknown as Partial<TlptCampaign>);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
            <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Informations Générales</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Nom de la campagne"
                                {...field}
                                value={field.value || ''}
                                error={errors.name?.message}
                                readOnly={readOnly}
                            />
                        )}
                    />
                    <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Statut"
                                options={[
                                    { value: "Planned", label: "Planifié" },
                                    { value: "In Progress", label: "En cours" },
                                    { value: "Analysis", label: "Analyse" },
                                    { value: "Remediation", label: "Remédiation" },
                                    { value: "Closed", label: "Clôturé" }
                                ]}
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.status?.message}
                                disabled={readOnly}
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                    <Controller
                        name="methodology"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Méthodologie"
                                options={[
                                    { value: "TIBER-EU", label: "TIBER-EU" },
                                    { value: "Red Team", label: "Red Team" },
                                    { value: "Purple Team", label: "Purple Team" },
                                    { value: "Other", label: "Autre" }
                                ]}
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.methodology?.message}
                                disabled={readOnly}
                            />
                        )}
                    />
                    <Controller
                        name="provider"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Prestataire / Auditeur"
                                {...field}
                                value={field.value || ''}
                                error={errors.provider?.message}
                                readOnly={readOnly}
                            />
                        )}
                    />
                </div>

                <div className="mt-4">
                    <Controller
                        name="scope"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Périmètre (Scope)"
                                {...field}
                                value={field.value || ''}
                                error={errors.scope?.message}
                                readOnly={readOnly}
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                    <Controller
                        name="startDate"
                        control={control}
                        render={({ field }) => (
                            <DatePicker
                                label="Date de début"
                                value={field.value}
                                onChange={field.onChange}
                                error={errors.startDate?.message}
                            // readOnly={readOnly} - Unsupported
                            />
                        )}
                    />
                    <Controller
                        name="endDate"
                        control={control}
                        render={({ field }) => (
                            <DatePicker
                                label="Date de fin (estimée)"
                                value={field.value}
                                onChange={field.onChange}
                            // readOnly={readOnly} - Unsupported
                            />
                        )}
                    />
                </div>

                <div className="mt-4">
                    <Controller
                        name="notes"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Notes & Observations"
                                {...field}
                                value={field.value || ''}
                                textarea
                                className="min-h-[100px]"
                                readOnly={readOnly}
                            />
                        )}
                    />
                </div>
            </div>

            {!readOnly && (
                <div className="flex justify-end gap-3 pt-4">
                    {onCancel && (
                        <Button type="button" variant="ghost" onClick={onCancel}>
                            Annuler
                        </Button>
                    )}
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="gap-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-brand-500/20 font-bold"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        {isEditing ? "Mettre à jour" : "Créer la campagne"}
                    </Button>
                </div>
            )}
        </form>
    );
};
