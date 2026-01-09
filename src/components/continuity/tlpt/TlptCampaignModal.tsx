import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TlptCampaign } from '../../../types';
import { tlptSchema, TlptFormData } from '../../../schemas/tlptSchema';
import { TlptFindings } from './TlptFindings';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/button';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
import { DatePicker } from '../../ui/DatePicker';
import { Loader2, ArrowRight, Trash } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<TlptCampaign>) => Promise<void>;
    initialData?: TlptCampaign;
    title?: string;
    isLoading?: boolean;
    onDelete?: (id: string) => Promise<void>;
}

export const TlptCampaignModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, initialData, title, isLoading, onDelete }) => {
    const { control, handleSubmit, reset, formState: { errors } } = useForm<TlptFormData>({
        resolver: zodResolver(tlptSchema),
        defaultValues: {
            name: '',
            scope: '',
            provider: '',
            status: 'Planned',
            notes: '',
        }
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                reset({
                    name: initialData.name,
                    scope: initialData.scope,
                    methodology: initialData.methodology,
                    provider: initialData.provider,
                    status: initialData.status,
                    startDate: initialData.startDate ? new Date(initialData.startDate.seconds ? initialData.startDate.seconds * 1000 : initialData.startDate) : undefined,
                    endDate: initialData.endDate ? new Date(initialData.endDate.seconds ? initialData.endDate.seconds * 1000 : initialData.endDate) : undefined,
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

    const [activeTab, setActiveTab] = React.useState<'details' | 'findings'>('details');

    // Reset tab when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setActiveTab('details');
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || (initialData ? "Modifier Campagne" : "Nouvelle Campagne TLPT")} maxWidth={activeTab === 'findings' ? 'max-w-4xl' : 'max-w-2xl'}>
            {initialData && (
                <div className="flex space-x-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl mb-6">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'details'
                            ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                            }`}
                    >
                        Informations Générales
                    </button>
                    <button
                        onClick={() => setActiveTab('findings')}
                        className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'findings'
                            ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                            }`}
                    >
                        Constatations & Vulnérabilités
                    </button>
                </div>
            )}

            {activeTab === 'details' ? (
                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Nom de la campagne"
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
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    label="Périmètre (Scope)"
                                    {...field}
                                    error={errors.scope?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Controller
                            name="startDate"
                            control={control}
                            render={({ field }) => (
                                <DatePicker
                                    label="Date de début"
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
                                    label="Date de fin (estimée)"
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
                                    label="Notes & Observations"
                                    {...field}
                                    textarea
                                    className="min-h-[100px]"
                                />
                            )}
                        />
                    </div>

                    <div className="flex justify-end pt-4 gap-2">
                        {onDelete && initialData && (
                            <Button
                                type="button"
                                onClick={() => {
                                    if (confirm('Supprimer cette campagne ?')) {
                                        onDelete(initialData.id).then(() => onClose());
                                    }
                                }}
                                variant="ghost"
                                className="mr-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <Trash className="w-4 h-4 mr-2" />
                                Supprimer
                            </Button>
                        )}
                        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
                        <Button type="submit" disabled={isLoading} className="gap-2 bg-brand-600 text-white hover:bg-brand-700">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                            {initialData ? "Mettre à jour" : "Créer la campagne"}
                        </Button>
                    </div>
                </form>
            ) : (
                initialData && <TlptFindings campaign={initialData as TlptCampaign} />
            )}
        </Modal>
    );
};
