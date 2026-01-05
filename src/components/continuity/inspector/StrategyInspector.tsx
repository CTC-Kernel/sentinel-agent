import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { InspectorLayout } from '../../ui/InspectorLayout';
import { Asset } from '../../../types';
import { Loader2, Save, Clock, ShieldCheck, Server } from 'lucide-react';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
import { Button } from '../../ui/button';
import { strategySchema, StrategyFormData } from '../../../schemas/continuitySchema';

interface StrategyInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: StrategyFormData) => Promise<void>;
    initialData?: Partial<StrategyFormData>;
    assets: Asset[];
    isEditing?: boolean;
    isLoading?: boolean;
}

const DatabaseIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s 9-1.34 9-3V5"></path></svg>
);

export const StrategyInspector: React.FC<StrategyInspectorProps> = ({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    assets,
    isEditing,
    isLoading
}) => {
    const { handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<StrategyFormData>({
        resolver: zodResolver(strategySchema),
        defaultValues: {
            title: initialData?.title || '',
            type: initialData?.type || undefined,
            rto: initialData?.rto || '',
            rpo: initialData?.rpo || '',
            description: initialData?.description || '',
            linkedAssets: initialData?.linkedAssets || []
        }
    });

    useEffect(() => {
        if (isOpen && initialData) {
            setValue('title', initialData.title || '');
            if (initialData.type) {
                setValue('type', initialData.type);
            }
            setValue('rto', initialData.rto || '');
            setValue('rpo', initialData.rpo || '');
            setValue('description', initialData.description || '');
            setValue('linkedAssets', initialData.linkedAssets || []);
        } else if (isOpen && !initialData) {
            // Reset if opening new
            setValue('title', '');
            setValue('type', undefined as any);
            setValue('rto', '');
            setValue('rpo', '');
            setValue('description', '');
            setValue('linkedAssets', []);
        }
    }, [initialData, isOpen, setValue]);

    const handleFormSubmit = async (data: StrategyFormData) => {
        await onSubmit(data);
        onClose();
    };

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? "Modifier la Stratégie" : "Nouvelle Stratégie"}
            subtitle="Définissez les paramètres de résilience et de reprise."
            icon={ShieldCheck}
            width="max-w-2xl"
            footer={
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
                    <Button
                        onClick={handleSubmit(handleFormSubmit)}
                        disabled={isSubmitting || isLoading}
                        className="bg-brand-600 text-white hover:bg-brand-700"
                    >
                        {isSubmitting || isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {isEditing ? 'Mettre à jour' : 'Enregistrer'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-8">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        Stratégie de Continuité
                    </h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                        Définissez comment vos actifs critiques doivent être protégés et restaurés.
                    </p>
                </div>

                <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-full">
                            <Controller
                                name="title"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Nom de la stratégie"
                                        placeholder="Ex: Réplication Cross-Region S3"
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={errors.title?.message}
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-full">
                            <Controller
                                name="type"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Type de stratégie"
                                        options={[
                                            { value: "Active-Active", label: "Active-Active (Haute Dispo)" },
                                            { value: "Active-Passive", label: "Active-Passive (Failover)" },
                                            { value: "Cold Standby", label: "Cold Standby (Redémarrage manuel)" },
                                            { value: "Cloud DR", label: "Cloud Disaster Recovery" },
                                            { value: "Backup Only", label: "Backup & Restore uniquement" }
                                        ]}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        error={errors.type?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
                        <div className="col-span-full mb-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Objectifs de Reprise (SLA)</span>
                        </div>
                        <div className="relative">
                            <Controller
                                name="rto"
                                control={control}
                                render={({ field }) => (
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400 z-10" />
                                        <FloatingLabelInput
                                            label="RTO (Recovery Time)"
                                            placeholder="ex: 4h"
                                            value={field.value}
                                            onChange={field.onChange}
                                            className="pl-10"
                                            error={errors.rto?.message}
                                        />
                                    </div>
                                )}
                            />
                        </div>
                        <div className="relative">
                            <Controller
                                name="rpo"
                                control={control}
                                render={({ field }) => (
                                    <div className="relative">
                                        <DatabaseIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400 z-10" />
                                        <FloatingLabelInput
                                            label="RPO (Data Loss)"
                                            placeholder="ex: 15min"
                                            value={field.value}
                                            onChange={field.onChange}
                                            className="pl-10"
                                            error={errors.rpo?.message}
                                        />
                                    </div>
                                )}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Controller
                            name="description"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Description technique"
                                    placeholder="Détaillez le fonctionnement de la stratégie..."
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    textarea
                                    className="min-h-[100px]"
                                    error={errors.description?.message}
                                />
                            )}
                        />

                        <Controller
                            name="linkedAssets"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Actifs Couverts"
                                    options={assets.map(a => ({ value: a.id, label: a.name }))}
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    multiple
                                    placeholder="Sélectionner les actifs..."
                                />
                            )}
                        />
                    </div>
                </form>
            </div>
        </InspectorLayout>
    );
};
