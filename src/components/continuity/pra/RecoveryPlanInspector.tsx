import React, { useEffect } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { recoveryPlanSchema, RecoveryPlanFormData } from '../../../schemas/continuitySchema';
import { InspectorLayout } from '../../ui/InspectorLayout';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
import { Button } from '../../ui/button';
import { UserProfile, Asset, RecoveryPlan } from '../../../types';
import { Controller } from 'react-hook-form';
import { Clock, Save, Loader2, FileText, Shield } from 'lucide-react';

interface RecoveryPlanInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RecoveryPlanFormData) => Promise<void>;
    isLoading: boolean;
    initialData?: RecoveryPlan;
    users: UserProfile[];
    assets: Asset[];
}

export const RecoveryPlanInspector: React.FC<RecoveryPlanInspectorProps> = ({
    isOpen,
    onClose,
    onSubmit,
    isLoading,
    initialData,
    users,
    assets
}) => {
    const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useZodForm<typeof recoveryPlanSchema>({
        schema: recoveryPlanSchema,
        defaultValues: {
            title: '',
            type: 'IT System',
            rto: '',
            rpo: '',
            description: '',
            ownerId: '',
            status: 'Draft',
            steps: [],
            triggers: [],
            linkedAssetIds: []
        }
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setValue('title', initialData.title);
                setValue('type', initialData.type);
                setValue('rto', initialData.rto);
                setValue('rpo', initialData.rpo);
                setValue('description', initialData.description || '');
                setValue('ownerId', initialData.ownerId);
                setValue('status', initialData.status);
                setValue('linkedAssetIds', initialData.linkedAssetIds || []);
            } else {
                reset({
                    title: '',
                    type: 'IT System',
                    rto: '',
                    rpo: '',
                    description: '',
                    ownerId: '',
                    status: 'Draft',
                    steps: [],
                    triggers: [],
                    linkedAssetIds: []
                });
            }
        }
    }, [isOpen, initialData, setValue, reset]);

    const handleFormSubmit = async (data: RecoveryPlanFormData) => {
        await onSubmit(data);
        onClose();
    };

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "Modifier le Plan" : "Nouveau Plan de Reprise"}
            subtitle="Définissez les procédures de résilience."
            icon={Shield}
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Annuler</Button>
                    <Button
                        onClick={handleSubmit(handleFormSubmit)}
                        disabled={isLoading || isSubmitting}
                        className="bg-brand-600 text-white hover:bg-brand-700"
                    >
                        {(isLoading || isSubmitting) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {initialData ? 'Mettre à jour' : 'Créer le Plan'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-white/10 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Informations Générales</h3>
                            <p className="text-sm text-slate-500">Identité et périmètre du plan.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-full">
                        <FloatingLabelInput
                            label="Titre du Plan"
                            placeholder="Ex: Restauration base de données critique"
                            {...register('title')}
                            error={errors.title?.message}
                        />
                    </div>

                    <div className="col-span-1">
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Type de Plan"
                                    options={[
                                        { value: 'IT System', label: 'Système IT' },
                                        { value: 'Business Process', label: 'Processus Métier' },
                                        { value: 'Facility', label: 'Site / Bâtiment' },
                                        { value: 'Crisis Comm', label: 'Communication Crise' }
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.type?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-1">
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Statut"
                                    options={[
                                        { value: 'Draft', label: 'Brouillon' },
                                        { value: 'Active', label: 'Actif' },
                                        { value: 'Testing', label: 'En Test' },
                                        { value: 'Archived', label: 'Archivé' }
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.status?.message}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="col-span-full pb-2 border-b border-slate-200 dark:border-white/10 mb-2">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-brand-500" />
                            Objectifs de Performance (SLA)
                        </h4>
                    </div>

                    <FloatingLabelInput
                        label="RTO (Temps)"
                        placeholder="Ex: 4h"
                        {...register('rto')}
                        error={errors.rto?.message}
                    />

                    <FloatingLabelInput
                        label="RPO (Données)"
                        placeholder="Ex: 15min"
                        {...register('rpo')}
                        error={errors.rpo?.message}
                    />
                </div>

                <div className="space-y-4">
                    <Controller
                        name="ownerId"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Responsable du Plan"
                                options={users.map(u => ({ value: u.uid, label: u.displayName || u.email || 'Inconnu' }))}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Sélectionner un responsable"
                                error={errors.ownerId?.message}
                            />
                        )}
                    />

                    <Controller
                        name="linkedAssetIds"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Actifs concernés"
                                options={assets.map(a => ({ value: a.id, label: a.name }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                multiple
                                placeholder="Sélectionner les actifs..."
                            />
                        )}
                    />

                    <FloatingLabelInput
                        label="Description & Portée"
                        placeholder="Décrivez l'objectif et le périmètre de ce plan..."
                        {...register('description')}
                        textarea
                        className="min-h-[100px]"
                        error={errors.description?.message}
                    />
                </div>
            </div>
        </InspectorLayout>
    );
};
