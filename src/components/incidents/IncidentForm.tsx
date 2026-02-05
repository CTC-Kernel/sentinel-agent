import React, { useEffect } from 'react';
import { SubmitHandler, useWatch, Controller, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { toast } from '@/lib/toast';
import { incidentSchema, IncidentFormData } from '../../schemas/incidentSchema';
import { Criticality, UserProfile, BusinessProcess, Asset, Risk } from '../../types';
import { ShieldAlert } from '../ui/Icons';
import { AIAssistButton } from '../ai/AIAssistButton';
import { useStore } from '../../store';
import { useLocale } from '../../hooks/useLocale';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/button';
import { RichTextEditor } from '../ui/RichTextEditor';

import { PLAYBOOKS, INCIDENT_STATUSES, NOTIFICATION_STATUSES } from '../../data/incidentConstants';
import { NIS2DeadlineTimer } from './NIS2DeadlineTimer';
import { Incident } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';

// Error boundary for NIS2DeadlineTimer date calculations
class NIS2TimerErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error: Error) {
        ErrorLogger.error(error, 'NIS2DeadlineTimer.dateCalculation');
    }
    render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
    }
}

interface IncidentFormProps {
    onSubmit: SubmitHandler<IncidentFormData>;
    onCancel: () => void;
    initialData?: Partial<IncidentFormData>;
    users: UserProfile[];
    processes: BusinessProcess[];
    assets: Asset[];
    risks: Risk[];
    isLoading?: boolean;
    onDirtyChange?: (isDirty: boolean) => void;
}

import { useFormPersistence } from '../../hooks/utils/useFormPersistence';

export const IncidentForm: React.FC<IncidentFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    users,
    processes,
    assets,
    risks,
    isLoading = false,
    onDirtyChange
}) => {
    const { addToast } = useStore();
    const { t } = useLocale();
    const { register, handleSubmit, setValue, control, getValues, watch, reset, formState: { errors, isDirty } } = useZodForm<typeof incidentSchema>({
        schema: incidentSchema,
        mode: 'onChange',
        shouldUnregister: false,
        defaultValues: {
            title: '',
            description: '',
            severity: Criticality.MEDIUM,
            status: 'Nouveau',
            // ...
            ...initialData
        }
    });

    // Persistence Hook
    const { clearDraft } = useFormPersistence<IncidentFormData>('sentinel_incident_draft_new', {
        watch,
        reset
    }, {
        enabled: !initialData || !('id' in initialData)
    });

    const handleFormSubmit: SubmitHandler<IncidentFormData> = async (data) => {
        await onSubmit(data);
        clearDraft();
    };


    const scrollToFirstError = (fieldErrors: FieldErrors<IncidentFormData>) => {
        const firstErrorKey = Object.keys(fieldErrors)[0];
        if (firstErrorKey) {
            const el = document.getElementById('incident-form')?.querySelector(`[name="${firstErrorKey}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (el as HTMLElement).focus?.();
            }
        }
    };

    const onInvalid = (fieldErrors: FieldErrors<IncidentFormData>) => {
        const missingFields = Object.keys(fieldErrors).join(', ');
        toast.error(t('incidents.form.invalid', { defaultValue: 'Formulaire invalide' }) + `. ${t('incidents.form.fieldsInError', { defaultValue: 'Champs en erreur' })} : ${missingFields}`);
        scrollToFirstError(fieldErrors);
    };

    const affectedAssetId = useWatch({ control, name: 'affectedAssetId' });
    const isSignificant = useWatch({ control, name: 'isSignificant' });
    const title = useWatch({ control, name: 'title' });
    const category = useWatch({ control, name: 'category' });
    const severity = useWatch({ control, name: 'severity' });

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        if (!affectedAssetId) return;
        const currentProcess = getValues('affectedProcessId');
        if (currentProcess) return;

        const relatedProcesses = processes.filter(p => p.supportingAssetIds?.includes(affectedAssetId));
        if (relatedProcesses.length === 1) {
            setValue('affectedProcessId', relatedProcesses[0].id, { shouldDirty: true });
            addToast(t('incidents.form.suggestedProcess', { defaultValue: 'Processus li\u00e9 sugg\u00e9r\u00e9' }) + ` : ${relatedProcesses[0].name}`, 'info');
        }
    }, [affectedAssetId, processes, setValue, getValues, addToast, t]);

    return (
        <form id="incident-form" onSubmit={handleSubmit(handleFormSubmit, onInvalid)} className="space-y-6">
            <div className="space-y-6">
                <FloatingLabelInput
                    label={t('incidents.form.title', { defaultValue: "Titre de l'incident" })}
                    {...register('title')}
                    placeholder={t('incidents.form.titlePlaceholder', { defaultValue: 'Ex: Attaque Ransomware sur Serveur RH' })}
                    error={errors.title?.message}
                />

                {/* NIS 2 Section */}
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-error/30 space-y-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-error-bg/50 to-transparent pointer-events-none" />
                    <div className="relative z-10">
                        <div className="flex items-center space-x-3">
                            <input {...register('isSignificant')}
                                id="is-significant"
                                type="checkbox"
                                className="h-5 w-5 rounded-lg text-error focus:ring-error border-border/40"
                            />
                            <label htmlFor="is-significant" className="text-sm font-bold text-foreground flex items-center">
                                <ShieldAlert className="h-4 w-4 mr-2 text-error" />
                                {t('incidents.form.nis2Significant', { defaultValue: 'Incident Significatif (NIS 2)' })}
                            </label>
                        </div>

                        {isSignificant && (
                            <div className="animate-fade-in pl-8 space-y-4 mt-4">
                                <div className="bg-muted/10 p-4 rounded-xl">
                                    <NIS2TimerErrorBoundary fallback={
                                        <div className="text-sm text-muted-foreground p-3 bg-warning-bg rounded-lg border border-warning-border/30">
                                            {t('incidents.form.nis2TimerError', { defaultValue: 'Impossible de calculer les d\u00e9lais NIS 2. V\u00e9rifiez les dates saisies.' })}
                                        </div>
                                    }>
                                        <NIS2DeadlineTimer
                                            incident={{
                                                ...initialData,
                                                ...getValues(),
                                                id: (initialData as Partial<IncidentFormData> & { id?: string })?.id || 'new',
                                                organizationId: useStore.getState().organization?.id || 'current',
                                                reporter: useStore.getState().user?.uid || 'current',
                                                dateReported: getValues('dateReported') || new Date().toISOString(),
                                            } as Incident}
                                        />
                                    </NIS2TimerErrorBoundary>
                                </div>

                                <Controller
                                    name="notificationStatus"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label="Statut Notification"
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            options={[...NOTIFICATION_STATUSES]}
                                        />
                                    )}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative">
                    <Controller
                        control={control}
                        name="description"
                        render={({ field }) => (
                            <RichTextEditor
                                label="Description détaillée"
                                value={field.value || ''}
                                onChange={field.onChange}
                                error={errors.description?.message}
                            />
                        )}
                    />
                    <div className="absolute right-2 top-2 z-10">
                        <AIAssistButton
                            context={{
                                title: title || '',
                                category: category || '',
                                severity: severity || '',
                                affectedAsset: assets.find(a => a.id === affectedAssetId)?.name || ''
                            }}
                            fieldName="description"
                            onSuggest={(val: string) => setValue('description', val)}
                            prompt="Rédige une description détaillée et professionnelle pour cet incident de sécurité. Inclus les éléments factuels probables basés sur le titre et la catégorie. Utilise du HTML riche pour la mise en forme."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <Controller
                        name="category"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Catégorie (Playbook)"
                                value={field.value || ''}
                                onChange={field.onChange}
                                options={Object.keys(PLAYBOOKS).map(c => ({ value: c, label: c }))}
                            />
                        )}
                    />

                    <Controller
                        name="severity"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Sévérité"
                                value={field.value || ''}
                                onChange={field.onChange}
                                options={Object.values(Criticality).map(c => ({ value: c, label: c }))}
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Statut"
                                value={field.value || ''}
                                onChange={field.onChange}
                                options={INCIDENT_STATUSES.map(s => ({ value: s, label: s }))}
                            />
                        )}
                    />

                    <Controller
                        name="affectedAssetId"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Actif Impacté"
                                value={field.value || ''}
                                onChange={field.onChange}
                                options={[
                                    { value: '', label: 'Aucun / Inconnu' },
                                    ...assets.map(a => ({ value: a.id, label: a.name }))
                                ]}
                            />
                        )}
                    />

                    <Controller
                        name="affectedProcessId"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Processus Impacté"
                                value={field.value || ''}
                                onChange={field.onChange}
                                options={[
                                    { value: '', label: 'Aucun / Inconnu' },
                                    ...processes.map(p => ({ value: p.id, label: p.name }))
                                ]}
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <Controller
                        name="relatedRiskId"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Lier à un Risque Identifié"
                                value={field.value || ''}
                                onChange={field.onChange}
                                options={[
                                    { value: '', label: 'Non lié' },
                                    ...risks.map(r => ({ value: r.id, label: `${r.threat} (Score: ${r.score})` }))
                                ]}
                            />
                        )}
                    />

                    <Controller
                        name="reporter"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Déclaré par"
                                value={field.value || ''}
                                onChange={field.onChange}
                                options={[
                                    { value: '', label: 'Sélectionner...' },
                                    ...users.map(u => ({ value: u.displayName || u.email, label: u.displayName || u.email }))
                                ]}
                            />
                        )}
                    />

                    <FloatingLabelInput
                        label="Coût estimé (€)"
                        type="number"
                        {...register('financialImpact', { valueAsNumber: true })}
                        placeholder="0.00"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-border/40">
                <Button
                    type="button"
                    onClick={onCancel}
                    variant="ghost"
                    disabled={isLoading}
                    className="px-6 py-3 text-sm font-bold text-muted-foreground hover:bg-muted/10 rounded-xl transition-all duration-normal ease-apple"
                >
                    Annuler
                </Button>
                <Button
                    type="submit"
                    isLoading={isLoading}
                    className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-normal ease-apple"
                >
                    Enregistrer
                </Button>
            </div>
        </form >
    );
};
