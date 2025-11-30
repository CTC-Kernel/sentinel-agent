import React, { useEffect } from 'react';
import { useForm, SubmitHandler, Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assetSchema, AssetFormData } from '../../schemas/assetSchema';
import { Asset, UserProfile, Supplier, Criticality } from '../../types';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { Sparkles, AlertTriangle, ShieldCheck } from '../ui/Icons';
import { aiService } from '../../services/aiService';
import { ErrorLogger } from '../../services/errorLogger';

interface AssetFormProps {
    onSubmit: (data: AssetFormData) => Promise<void>;
    onCancel: () => void;
    initialData?: Asset | null;
    usersList: UserProfile[];
    suppliers: Supplier[];
    isEditing?: boolean;
}

export const AssetForm: React.FC<AssetFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    usersList,
    suppliers,
    isEditing = false
}) => {
    const { control, handleSubmit, reset, formState: { errors }, setValue, watch, getValues } = useForm<AssetFormData>({
        resolver: zodResolver(assetSchema) as Resolver<AssetFormData>,
        defaultValues: {
            name: '',
            type: 'Matériel',
            owner: '',
            confidentiality: Criticality.LOW,
            integrity: Criticality.LOW,
            availability: Criticality.LOW,
            location: '',
            purchaseDate: '',
            purchasePrice: 0,
            warrantyEnd: '',
            lifecycleStatus: 'Neuf',
            scope: [],
            supplierId: ''
        }
    });

    const [suggestingField, setSuggestingField] = React.useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            reset({
                name: initialData.name,
                type: initialData.type,
                owner: initialData.owner,
                confidentiality: initialData.confidentiality,
                integrity: initialData.integrity,
                availability: initialData.availability,
                location: initialData.location,
                purchaseDate: initialData.purchaseDate || '',
                purchasePrice: initialData.purchasePrice || 0,
                warrantyEnd: initialData.warrantyEnd || '',
                lifecycleStatus: initialData.lifecycleStatus || 'Neuf',
                scope: initialData.scope || [],
                supplierId: initialData.supplierId || '',
                // Preserve other fields if needed, but schema only covers these
            });
        }
    }, [initialData, reset]);

    const handleSuggestField = async (field: keyof AssetFormData) => {
        const currentName = getValues('name');
        if (!currentName && field !== 'name') return;

        setSuggestingField(field);
        try {
            let prompt = '';
            if (field === 'name') {
                prompt = "Suggère un nom d'actif informatique réaliste et professionnel (ex: Serveur Dell PowerEdge, MacBook Pro 16, CRM Salesforce). Réponds uniquement avec le nom.";
            } else if (field === 'type') {
                prompt = `Quel est le type de l'actif "${currentName}" ? Choix possibles : Matériel, Logiciel, Données, Service, Humain. Réponds uniquement avec le type.`;
            } else if (field === 'confidentiality') {
                prompt = `Quelle est la confidentialité probable pour l'actif "${currentName}" ? Choix : Faible, Moyenne, Élevée, Critique. Réponds uniquement avec le niveau.`;
            }

            const suggestion = await aiService.generateText(prompt);
            if (suggestion) {
                // Clean up suggestion
                const cleanSuggestion = suggestion.replace(/^["']|["']$/g, '').trim();

                // Validate against enum if needed
                if (field === 'type' && !['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'].includes(cleanSuggestion)) {
                    // Fallback or ignore
                } else if (field === 'confidentiality' && !Object.values(Criticality).includes(cleanSuggestion as Criticality)) {
                    // Fallback
                } else {
                    setValue(field, cleanSuggestion as AssetFormData[keyof AssetFormData], { shouldDirty: true });
                }
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AssetForm.handleSuggestField', 'FETCH_FAILED');
        } finally {
            setSuggestingField(null);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-6">
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Informations Principales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-1 md:col-span-2">
                        <div className="relative">
                            <Controller
                                name="name"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Nom de l'actif"
                                        {...field}
                                        error={errors.name?.message}
                                    />
                                )}
                            />
                            <button
                                type="button"
                                onClick={() => handleSuggestField('name')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 transition-colors"
                                title="Suggérer un nom"
                            >
                                <Sparkles className={`h-4 w-4 ${suggestingField === 'name' ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Type</label>
                        <select
                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium"
                            {...control.register('type')}
                        >
                            {['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'].map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
                        <button
                            type="button"
                            onClick={() => handleSuggestField('type')}
                            className="absolute right-8 top-1/2 -translate-y-1/2 mt-4 text-slate-400 hover:text-brand-500 transition-colors"
                            title="Suggérer le type"
                        >
                            <Sparkles className={`h-4 w-4 ${suggestingField === 'type' ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Propriétaire</label>
                        <select
                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium"
                            {...control.register('owner')}
                        >
                            <option value="">Sélectionner...</option>
                            {usersList.map(u => (
                                <option key={u.uid} value={u.displayName}>{u.displayName}</option>
                            ))}
                        </select>
                        {errors.owner && <p className="text-red-500 text-xs mt-1">{errors.owner.message}</p>}
                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <Controller
                            name="location"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Localisation"
                                    {...field}
                                    error={errors.location?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fournisseur / Mainteneur</label>
                        <Controller
                            name="supplierId"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.category }))}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    placeholder="Sélectionner un fournisseur..."
                                />
                            )}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600/80 mb-6 flex items-center justify-between">
                    <div className="flex items-center"><AlertTriangle className="h-4 w-4 mr-2" /> Classification DIC</div>
                    <button
                        type="button"
                        onClick={() => handleSuggestField('confidentiality')}
                        className="text-xs normal-case font-medium text-brand-500 hover:text-brand-600 flex items-center bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <Sparkles className="h-3 w-3 mr-1.5" /> Suggérer Classification
                    </button>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['confidentiality', 'integrity', 'availability'].map((field) => (
                        <div key={field} className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5">
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-3 tracking-wider">
                                {field.charAt(0).toUpperCase() + field.slice(1)}
                            </label>
                            <select
                                className="w-full bg-transparent border-none p-0 font-bold text-slate-900 dark:text-white focus:ring-0 cursor-pointer text-sm"
                                {...control.register(field as keyof AssetFormData)}
                            >
                                {Object.values(Criticality).map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center">
                    <ShieldCheck className="h-4 w-4 mr-2" /> Périmètre de Conformité (Scope)
                </h3>
                <div className="flex flex-wrap gap-3">
                    {(['NIS2', 'DORA', 'PCI_DSS', 'HDS', 'ISO27001', 'SOC2'] as const).map((scope) => (
                        <label
                            key={scope}
                            className={`cursor-pointer px-4 py-2 rounded-xl border transition-all ${(watch('scope') || []).includes(scope)
                                ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-bold'
                                : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
                                }`}
                        >
                            <input
                                type="checkbox"
                                className="hidden"
                                value={scope}
                                checked={(watch('scope') || []).includes(scope)}
                                onChange={(e) => {
                                    const current = watch('scope') || [];
                                    if (e.target.checked) {
                                        setValue('scope', [...current, scope], { shouldDirty: true });
                                    } else {
                                        setValue('scope', current.filter((s: string) => s !== scope), { shouldDirty: true });
                                    }
                                }}
                            />
                            {scope.replace('_', ' ')}
                        </label>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Cycle de Vie</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Statut</label>
                        <select
                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium"
                            {...control.register('lifecycleStatus')}
                        >
                            {['Neuf', 'En service', 'En réparation', 'Fin de vie', 'Rebut'].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Date d'achat</label>
                        <input
                            type="date"
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-medium"
                            {...control.register('purchaseDate')}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Fin de garantie</label>
                        <input
                            type="date"
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-medium"
                            {...control.register('warrantyEnd')}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Prix d'achat (€)</label>
                        <input
                            type="number"
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-medium"
                            {...control.register('purchasePrice', { valueAsNumber: true })}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-105 transition-transform shadow-lg shadow-brand-500/20"
                >
                    {isEditing ? 'Mettre à jour' : 'Créer l\'actif'}
                </button>
            </div>
        </form>
    );
};
