import React, { useEffect } from 'react';
import { useForm, SubmitHandler, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { incidentSchema, IncidentFormData } from '../../schemas/incidentSchema';
import { Criticality, UserProfile, BusinessProcess, Asset, Risk } from '../../types';
import { ShieldAlert } from '../ui/Icons';
import { AIAssistButton } from '../ai/AIAssistButton';
import { useStore } from '../../store';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/button';
import { RichTextEditor } from '../ui/RichTextEditor';

import { PLAYBOOKS, INCIDENT_STATUSES, NOTIFICATION_STATUSES } from '../../data/incidentConstants';

interface IncidentFormProps {
    onSubmit: SubmitHandler<IncidentFormData>;
    onCancel: () => void;
    initialData?: Partial<IncidentFormData>;
    users: UserProfile[];
    processes: BusinessProcess[];
    assets: Asset[];
    risks: Risk[];
    isLoading?: boolean;
}

export const IncidentForm: React.FC<IncidentFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    users,
    processes,
    assets,
    risks,
    isLoading = false
}) => {
    const { addToast } = useStore();
    const { register, handleSubmit, setValue, control, getValues, formState: { errors } } = useForm<IncidentFormData>({
        resolver: zodResolver(incidentSchema),
        defaultValues: {
            title: '',
            description: '',
            severity: Criticality.MEDIUM,
            status: 'Nouveau',
            category: 'Autre',
            playbookStepsCompleted: [],
            affectedAssetId: '',
            relatedRiskId: '',
            affectedProcessId: '',
            reporter: '',
            financialImpact: 0,
            dateResolved: '',
            lessonsLearned: '',
            isSignificant: false,
            notificationStatus: 'Not Required',
            relevantAuthorities: [],
            ...initialData
        }
    });

    const affectedAssetId = useWatch({ control, name: 'affectedAssetId' });
    const isSignificant = useWatch({ control, name: 'isSignificant' });
    const title = useWatch({ control, name: 'title' });
    const category = useWatch({ control, name: 'category' });
    const severity = useWatch({ control, name: 'severity' });

    useEffect(() => {
        if (!affectedAssetId) return;
        const currentProcess = getValues('affectedProcessId');
        if (currentProcess) return;

        const relatedProcesses = processes.filter(p => p.supportingAssetIds?.includes(affectedAssetId));
        if (relatedProcesses.length === 1) {
            setValue('affectedProcessId', relatedProcesses[0].id, { shouldDirty: true });
            addToast(`Processus lié suggéré : ${relatedProcesses[0].name}`, 'info');
        }
    }, [affectedAssetId, processes, setValue, getValues, addToast]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6">
                <FloatingLabelInput
                    label="Titre de l'incident"
                    {...register('title')}
                    placeholder="Ex: Attaque Ransomware sur Serveur RH"
                    error={errors.title?.message}
                />

                {/* NIS 2 Section */}
                <div className="bg-red-50/50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30 space-y-4">
                    <div className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            className="h-5 w-5 rounded text-red-600 focus:ring-red-500 border-gray-300"
                            {...register('isSignificant')}
                        />
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                            <ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
                            Incident Significatif (NIS 2)
                        </label>
                    </div>

                    {isSignificant && (
                        <div className="animate-fade-in pl-8 space-y-4">
                            <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-red-100 dark:border-red-900/30">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">Délais de Notification</h4>
                                <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                                    <li className="flex justify-between"><span>Pré-notification (Early Warning)</span> <span className="font-bold">24h</span></li>
                                    <li className="flex justify-between"><span>Notification Initiale</span> <span className="font-bold">72h</span></li>
                                    <li className="flex justify-between"><span>Rapport Final</span> <span className="font-bold">1 mois</span></li>
                                </ul>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                <Button
                    type="button"
                    onClick={onCancel}
                    variant="ghost"
                    disabled={isLoading}
                    className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                    Annuler
                </Button>
                <Button
                    type="submit"
                    isLoading={isLoading}
                    className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm shadow-lg shadow-red-500/20 hover:scale-105 transition-all"
                >
                    Enregistrer
                </Button>
            </div>
        </form>
    );
};
