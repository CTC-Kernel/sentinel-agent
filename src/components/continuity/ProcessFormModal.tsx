import React, { useState } from 'react';
import { Button } from '../ui/button';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { businessProcessSchema, BusinessProcessFormData } from '../../schemas/continuitySchema';
import { Modal } from '../ui/Modal';
import { aiService } from '../../services/aiService';
import { Sparkles, Plus, Trash2, Server, Truck } from 'lucide-react';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { Asset, Supplier, Risk, UserProfile } from '../../types';

import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';

const TEMPLATES = [
    { name: 'Systèmes d\'Information (IT)', description: 'Maintenance et support des infrastructures critiques.', rto: '4h', rpo: '1h', priority: 'Critique' as const },
    { name: 'Ressources Humaines (Paie)', description: 'Gestion de la paie et administration du personnel.', rto: '24h', rpo: '24h', priority: 'Élevée' as const },
    { name: 'Service Client / Support', description: 'Assistance aux utilisateurs finaux et clients.', rto: '2h', rpo: '1h', priority: 'Critique' as const },
    { name: 'Finance & Comptabilité', description: 'Gestion de la trésorerie et facturation.', rto: '8h', rpo: '4h', priority: 'Élevée' as const },
    { name: 'Logistique & Supply Chain', description: 'Gestion des stocks et expéditions.', rto: '12h', rpo: '4h', priority: 'Moyenne' as const },
];


interface ProcessFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: BusinessProcessFormData) => Promise<void>;
    initialData?: Partial<BusinessProcessFormData>;
    title: string;
    isEditing?: boolean;
    isLoading?: boolean;
    assets: Asset[];
    suppliers: Supplier[];
    risks: Risk[];
    users: UserProfile[];
}

export const ProcessFormModal: React.FC<ProcessFormModalProps> = ({
    isOpen, onClose, onSubmit, initialData, title, isEditing, assets, suppliers, risks, users
}) => {
    const { addToast, t } = useStore();
    const [isGenerating, setIsGenerating] = useState(false);

    const { handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<BusinessProcessFormData>({
        resolver: zodResolver(businessProcessSchema),
        defaultValues: {
            name: initialData?.name || '',
            description: initialData?.description || '',
            owner: initialData?.owner || '',
            rto: initialData?.rto || '4h',
            rpo: initialData?.rpo || '1h',
            priority: initialData?.priority || 'Moyenne',
            supportingAssetIds: initialData?.supportingAssetIds || [],
            drpDocumentId: initialData?.drpDocumentId || '',
            relatedRiskIds: initialData?.relatedRiskIds || [],
            supplierIds: initialData?.supplierIds || [],
            recoveryTasks: initialData?.recoveryTasks || []
        }
    });

    const watchedRecoveryTasks = watch('recoveryTasks');

    const handleAISuggestion = async () => {
        const name = watch('name');
        const desc = watch('description');

        if (!name || name.length < 3) {
            addToast(t('continuity.ai.enterName'), "info");
            return;
        }

        setIsGenerating(true);
        try {
            const suggestion = await aiService.suggestContinuityPlan(name, desc || name);

            setValue('rto', suggestion.rto);
            setValue('rpo', suggestion.rpo);
            setValue('priority', suggestion.priority);

            const newTasks = suggestion.recoveryTasks.map((t, i) => ({
                id: crypto.randomUUID(),
                title: t.title,
                owner: t.owner,
                duration: t.duration,
                description: t.description,
                order: i + 1
            }));
            setValue('recoveryTasks', newTasks);

            addToast(t('continuity.ai.suggestionApplied'), "success");
            addToast(suggestion.reasoning, "info"); // Show reasoning as info
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'ProcessFormModal.handleAISuggestion', 'UNKNOWN_ERROR'); // AI_FAILED not in type
        } finally {
            setIsGenerating(false);
        }
    };

    const addRecoveryTask = () => {
        const current = watchedRecoveryTasks || [];
        setValue('recoveryTasks', [
            ...current,
            { id: crypto.randomUUID(), title: '', owner: '', duration: '', order: current.length + 1 }
        ]);
    };

    const removeRecoveryTask = (index: number) => {
        const current = watchedRecoveryTasks || [];
        setValue('recoveryTasks', current.filter((_, i) => i !== index));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto p-4 sm:p-6 custom-scrollbar">

                {/* Header - AI Assistant */}
                {!isEditing && (
                    <div className="bg-brand-50/50 dark:bg-brand-900/10 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/20 mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-brand-700 dark:text-brand-300 flex items-center">
                                <Sparkles className="h-4 w-4 mr-2" />
                                {t('continuity.ai.assistant')}
                            </h4>
                            <div className="flex gap-2">
                                <div className="w-64">
                                    <CustomSelect
                                        label={t('common.template')}
                                        options={[
                                            { value: "", label: t('common.selectTemplate') },
                                            ...TEMPLATES.map(t => ({ value: t.name, label: t.name }))
                                        ]}
                                        value={watch('name')} // Using name as a proxy for the template selection logic
                                        onChange={(val: string | string[]) => {
                                            if (Array.isArray(val)) return;
                                            const t = TEMPLATES.find(temp => temp.name === val);
                                            if (t) {
                                                setValue('name', t.name);
                                                setValue('description', t.description);
                                                setValue('rto', t.rto);
                                                setValue('rpo', t.rpo);
                                                setValue('priority', t.priority);
                                            }
                                        }}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleAISuggestion}
                                    disabled={isGenerating}
                                    className="text-xs px-3 py-1.5 h-auto bg-white dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-900/30 hover:bg-brand-50"
                                    isLoading={isGenerating}
                                >
                                    {!isGenerating && <Sparkles className="h-3 w-3 mr-2" />}
                                    {isGenerating ? 'IA...' : t('continuity.ai.autocomplete')}
                                </Button>


                            </div>
                        </div>
                        <p className="text-xs text-brand-600/80 dark:text-brand-400">
                            {t('continuity.ai.desc')}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <Controller
                                name="name"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label={t('continuity.processName')}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder={t('continuity.placeholders.name')}
                                        error={errors.name?.message}
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <Controller
                                name="owner"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label={t('common.owner')}
                                        options={[
                                            { value: "", label: t('continuity.selectOwner') },
                                            ...users.map(u => ({ value: u.displayName || u.email || '', label: u.displayName || u.email || '' }))
                                        ]}
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={errors.owner?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div>
                        <Controller
                            name="description"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('common.description')}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder={t('continuity.placeholders.description')}
                                    textarea
                                    error={errors.description?.message}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                    <div>
                        <Controller
                            name="priority"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label={t('common.priority')}
                                    options={['Critique', 'Élevée', 'Moyenne', 'Faible'].map(p => ({ value: p, label: p }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                    <div>
                        <Controller
                            name="rto"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('continuity.rto')}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                    <div>
                        <Controller
                            name="rpo"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('continuity.rpo')}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-3">{t('continuity.criticalDependencies')}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <span className="text-xs font-semibold text-slate-500 mb-2 block flex items-center gap-1"><Server className="h-3 w-3" /> {t('continuity.internalAssets')}</span>
                                <Controller
                                    name="supportingAssetIds"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label=""
                                            options={assets.map(a => ({ value: a.id, label: a.name }))}
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            multiple
                                            placeholder={t('continuity.selectAssets')}
                                        />
                                    )}
                                />
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-slate-500 mb-2 block flex items-center gap-1"><Truck className="h-3 w-3" /> {t('common.suppliers')}</span>
                                <Controller
                                    name="supplierIds"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label=""
                                            options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            multiple
                                            placeholder={t('continuity.selectSuppliers')}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-3">{t('continuity.riskScenarios')}</h4>
                        <Controller
                            name="relatedRiskIds"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label=""
                                    options={risks.map(r => ({ value: r.id, label: `${r.threat} (${r.vulnerability})` }))}
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    multiple
                                    placeholder={t('continuity.selectRisks')}
                                />
                            )}
                        />
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600">{t('continuity.recoveryPlan')}</label>
                        <Button
                            variant="ghost"
                            onClick={addRecoveryTask}
                            className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            {t('common.addStep')}
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {watchedRecoveryTasks?.map((_, index) => (
                            <div key={`resource-${index}`} className="flex gap-3 items-start bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                                <div className="mt-2.5 text-[10px] font-bold text-slate-500 w-5 text-center bg-white dark:bg-black/20 rounded h-5 leading-5 border border-slate-200 dark:border-white/10">{index + 1}</div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-6">
                                        <Controller
                                            name={`recoveryTasks.${index}.title` as const}
                                            control={control}
                                            render={({ field }) => (
                                                <FloatingLabelInput
                                                    label={t('common.action')}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-4">
                                        <Controller
                                            name={`recoveryTasks.${index}.owner` as const}
                                            control={control}
                                            render={({ field }) => (
                                                <FloatingLabelInput
                                                    label={t('common.owner')}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Controller
                                            name={`recoveryTasks.${index}.duration` as const}
                                            control={control}
                                            render={({ field }) => (
                                                <FloatingLabelInput
                                                    label={t('common.duration')}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={() => removeRecoveryTask(index)}
                                    className="mt-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    aria-label={`Supprimer l'étape ${index + 1}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {(!watchedRecoveryTasks || watchedRecoveryTasks.length === 0) && (
                            <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                                <p className="text-sm text-slate-500">{t('continuity.noSteps')}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-white/10">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" isLoading={isSubmitting} className="bg-brand-600 text-white">
                        {isEditing ? t('common.update') : t('continuity.createProcess')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
