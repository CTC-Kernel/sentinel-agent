
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { businessProcessSchema, BusinessProcessFormData } from '../../schemas/continuitySchema';
import { Modal } from '../ui/Modal';
import { aiService } from '../../services/aiService';
import { Sparkles, Loader2, Plus, Trash2, Server, Truck } from 'lucide-react'; // Using Lucide directly or Icons if customized
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { Asset, Supplier, Risk, UserProfile } from '../../types';

// Use Icons.tsx exports if consistent project style requires it, but direct import is often cleaner for specific icons not in the barrel file.
// Checking Icons.tsx again... yes Sparkles is there.

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
    assets: Asset[];
    suppliers: Supplier[];
    risks: Risk[];
    users: UserProfile[];
}

export const ProcessFormModal: React.FC<ProcessFormModalProps> = ({
    isOpen, onClose, onSubmit, initialData, title, isEditing, assets, suppliers, risks, users
}) => {
    const { addToast } = useStore();
    const [isGenerating, setIsGenerating] = useState(false);

    const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<BusinessProcessFormData>({
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
            addToast("Veuillez saisir un nom de processus pour utiliser l'IA", "info");
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

            addToast("Suggestion appliquée avec succès", "success");
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto px-1 custom-scrollbar">

                {/* Header - AI Assistant */}
                {!isEditing && (
                    <div className="bg-brand-50/50 dark:bg-brand-900/10 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/20 mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-brand-700 dark:text-brand-300 flex items-center">
                                <Sparkles className="h-4 w-4 mr-2" />
                                Assistant IA & Modèles
                            </h4>
                            <div className="flex gap-2">
                                <select
                                    onChange={(e) => {
                                        const t = TEMPLATES.find(t => t.name === e.target.value);
                                        if (t) {
                                            setValue('name', t.name);
                                            setValue('description', t.description);
                                            setValue('rto', t.rto);
                                            setValue('rpo', t.rpo);
                                            setValue('priority', t.priority);
                                        }
                                    }}
                                    className="text-xs font-bold bg-white dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 px-3 py-1.5 rounded-lg border border-brand-200 dark:border-brand-900/30 hover:bg-brand-50 transition-colors outline-none cursor-pointer"
                                >
                                    <option value="">Choisir un modèle...</option>
                                    {TEMPLATES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleAISuggestion}
                                    disabled={isGenerating}
                                    className="text-xs font-bold bg-white dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 px-3 py-1.5 rounded-lg border border-brand-200 dark:border-brand-900/30 hover:bg-brand-50 transition-colors flex items-center gap-2"
                                >
                                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                    {isGenerating ? 'IA...' : 'Auto-complétion IA'}
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-brand-600/80 dark:text-brand-400">
                            Sélectionnez un modèle standard ou utilisez l'IA pour générer une proposition sur mesure.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom du Processus</label>
                            <input
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium transition-all"
                                placeholder="Ex: Paiement Fournisseurs"
                                {...register('name')}
                            />
                            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Responsable</label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium transition-all"
                                {...register('owner')}
                            >
                                <option value="">Sélectionner un responsable...</option>
                                {users.map(u => (
                                    <option key={u.uid} value={u.displayName || u.email}>{u.displayName || u.email}</option>
                                ))}
                            </select>
                            {errors.owner && <p className="text-xs text-red-500 mt-1">{errors.owner.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description</label>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none h-[124px] transition-all"
                            placeholder="Description complète des activités..."
                            {...register('description')}
                        />
                        {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Priorité</label>
                        <select className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500" {...register('priority')}>
                            {['Critique', 'Élevée', 'Moyenne', 'Faible'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">RTO (Temps)</label>
                        <input
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                            {...register('rto')}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">RPO (Données)</label>
                        <input
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500"
                            {...register('rpo')}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Dépendances Critiques</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <span className="text-xs font-semibold text-slate-400 mb-2 block flex items-center gap-1"><Server className="h-3 w-3" /> Actifs Internes</span>
                                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-white/10 rounded-xl p-2 bg-white dark:bg-black/20 custom-scrollbar">
                                    {assets.map(asset => (
                                        <label key={asset.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                value={asset.id}
                                                {...register('supportingAssetIds')}
                                                className="rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                            />
                                            <span className="text-sm font-medium dark:text-white truncate">{asset.name}</span>
                                        </label>
                                    ))}
                                    {assets.length === 0 && <p className="text-xs text-slate-400 p-2 italic">Aucun actif disponible</p>}
                                </div>
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-slate-400 mb-2 block flex items-center gap-1"><Truck className="h-3 w-3" /> Fournisseurs</span>
                                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-white/10 rounded-xl p-2 bg-white dark:bg-black/20 custom-scrollbar">
                                    <Controller
                                        name="supplierIds"
                                        control={control}
                                        render={({ field }) => (
                                            <div className="space-y-1">
                                                {suppliers.map(s => (
                                                    <label key={s.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={field.value?.includes(s.id)}
                                                            onChange={(e) => {
                                                                const current = field.value || [];
                                                                if (e.target.checked) field.onChange([...current, s.id]);
                                                                else field.onChange(current.filter(id => id !== s.id));
                                                            }}
                                                            className="rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                                        />
                                                        <span className="text-sm font-medium dark:text-white truncate">{s.name}</span>
                                                    </label>
                                                ))}
                                                {suppliers.length === 0 && <p className="text-xs text-slate-400 p-2 italic">Aucun fournisseur disponible</p>}
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Scénarios de Risques</label>
                        <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-white/10 rounded-xl p-2 bg-white dark:bg-black/20 custom-scrollbar">
                            <Controller
                                name="relatedRiskIds"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-1">
                                        {risks.map(r => (
                                            <label key={r.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={field.value?.includes(r.id)}
                                                    onChange={(e) => {
                                                        const current = field.value || [];
                                                        if (e.target.checked) field.onChange([...current, r.id]);
                                                        else field.onChange(current.filter(id => id !== r.id));
                                                    }}
                                                    className="rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                                />
                                                <div className="truncate">
                                                    <span className="text-sm font-medium dark:text-white block truncate">{r.threat}</span>
                                                    <span className="text-[10px] text-slate-400 block truncate">{r.vulnerability}</span>
                                                </div>
                                            </label>
                                        ))}
                                        {risks.length === 0 && <p className="text-xs text-slate-400 p-2 italic">Aucun risque disponible</p>}
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Plan de Reprise (Étapes)</label>
                        <button type="button" onClick={addRecoveryTask} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                            <Plus className="h-3 w-3" /> Ajouter une étape
                        </button>
                    </div>
                    <div className="space-y-3">
                        {watchedRecoveryTasks?.map((_, index) => (
                            <div key={index} className="flex gap-3 items-start bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                                <div className="mt-2.5 text-[10px] font-bold text-slate-400 w-5 text-center bg-white dark:bg-black/20 rounded h-5 leading-5 border border-slate-200 dark:border-white/10">{index + 1}</div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-6">
                                        <input placeholder="Action" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm" {...register(`recoveryTasks.${index}.title` as const)} />
                                    </div>
                                    <div className="md:col-span-4">
                                        <input placeholder="Responsable" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm" {...register(`recoveryTasks.${index}.owner` as const)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <input placeholder="Durée" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm" {...register(`recoveryTasks.${index}.duration` as const)} />
                                    </div>
                                </div>
                                <button type="button" onClick={() => removeRecoveryTask(index)} className="mt-2 text-slate-400 hover:text-red-500">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        {(!watchedRecoveryTasks || watchedRecoveryTasks.length === 0) && (
                            <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                                <p className="text-sm text-slate-400">Aucune étape définie. Utilisez l'assistant IA ou ajoutez-les manuellement.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-slate-700 dark:text-white">Annuler</button>
                    <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 disabled:opacity-50 flex items-center gap-2">
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isEditing ? 'Mettre à jour' : 'Créer le processus'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
