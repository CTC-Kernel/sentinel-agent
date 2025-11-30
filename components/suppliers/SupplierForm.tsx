import React, { useEffect } from 'react';
import { useForm, Controller, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierSchema, SupplierFormData } from '../../schemas/supplierSchema';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Criticality, UserProfile, BusinessProcess, Asset, Risk, Project, Document } from '../../types';
import { ShieldAlert, Building2, Wand2, Link as LinkIcon, FileText } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

interface SupplierFormProps {
    onSubmit: SubmitHandler<SupplierFormData>;
    onCancel: () => void;
    initialData?: SupplierFormData;
    isEditing?: boolean;
    users: UserProfile[];
    processes: BusinessProcess[];
    assets: Asset[];
    risks: Risk[];
    projects: Project[];
    documents: Document[];
}

export const SupplierForm: React.FC<SupplierFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    isEditing = false,
    users,
    processes,
    assets,
    risks,
    documents
}) => {
    const { addToast } = useStore();
    const { register, handleSubmit, control, setValue, formState: { errors }, getValues } = useForm<SupplierFormData>({
        resolver: zodResolver(supplierSchema),
        defaultValues: initialData || {
            name: '', category: 'SaaS', criticality: Criticality.MEDIUM, status: 'Actif',
            owner: '', ownerId: '',
            assessment: { hasIso27001: false, hasGdprPolicy: false, hasEncryption: false, hasBcp: false, hasIncidentProcess: false },
            isICTProvider: false, supportsCriticalFunction: false, doraCriticality: 'None', serviceType: 'SaaS',
            relatedAssetIds: [], relatedRiskIds: [], relatedProjectIds: [], supportedProcessIds: []
        }
    });

    const selectedOwnerId = useWatch({ control, name: 'ownerId' });

    useEffect(() => {
        if (selectedOwnerId) {
            const selectedUser = users.find(u => u.uid === selectedOwnerId);
            if (selectedUser) {
                setValue('owner', selectedUser.displayName);
            }
        }
    }, [selectedOwnerId, users, setValue]);

    const handleAISuggestion = async (field: keyof SupplierFormData) => {
        const name = getValues('name');
        if (!name) {
            addToast("Veuillez d'abord saisir un nom de fournisseur", "info");
            return;
        }

        try {
            addToast("Génération de suggestions IA...", "info");
            const prompt = `Suggère une valeur pour le champ ${field} d'un fournisseur nommé ${name}. Réponds uniquement par la valeur.`;
            const suggestion = await aiService.generateText(prompt);

            if (suggestion) {
                // Simple mapping for demo purposes - in prod use structured output
                if (field === 'category') setValue('category', 'SaaS');
                if (field === 'criticality') setValue('criticality', Criticality.MEDIUM);
                if (field === 'description') setValue('description', suggestion);
                addToast("Suggestion appliquée", "success");
            }
        } catch (error) {
            ErrorLogger.error(error, 'SupplierForm.handleAISuggestion');
            addToast("Erreur lors de la génération", "error");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* General Info Card */}
            <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                    <Building2 className="w-5 h-5 mr-2 text-indigo-500" />
                    Informations Générales
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-1 md:col-span-2 relative">
                        <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Nom de l'entreprise"
                                    {...field}
                                    value={field.value || ''}
                                    error={errors.name?.message}
                                />
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => handleAISuggestion('name')}
                            className="absolute right-3 top-3.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                            title="Suggérer un nom complet"
                        >
                            <Wand2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Catégorie</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium"
                            {...register('category')}>
                            {['SaaS', 'Hébergement', 'Matériel', 'Consulting', 'Autre'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Criticité</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium"
                            {...register('criticality')}>
                            {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Statut</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium"
                            {...register('status')}>
                            <option value="Actif">Actif</option>
                            <option value="En cours">En cours</option>
                            <option value="Terminé">Terminé</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Responsable Interne</label>
                        <Controller
                            name="ownerId"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    options={users.map(u => ({ value: u.uid, label: u.displayName, subLabel: u.role }))}
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    placeholder="Sélectionner un responsable..."
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-1 md:col-span-2 relative">
                        <Controller
                            name="description"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Description"
                                    {...field}
                                    value={field.value || ''}
                                    textarea
                                />
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => handleAISuggestion('description')}
                            className="absolute right-3 top-3.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                            title="Suggérer une description"
                        >
                            <Wand2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* DORA Compliance Card */}
            <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm bg-indigo-50/30 dark:bg-indigo-900/10">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                    <ShieldAlert className="w-5 h-5 mr-2 text-indigo-600" />
                    Conformité DORA
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3 p-4 bg-white/50 dark:bg-black/20 rounded-2xl border border-white/50 dark:border-white/5">
                        <input type="checkbox" className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" {...register('isICTProvider')} />
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Prestataire TIC Critique</label>
                    </div>
                    <div className="flex items-center space-x-3 p-4 bg-white/50 dark:bg-black/20 rounded-2xl border border-white/50 dark:border-white/5">
                        <input type="checkbox" className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" {...register('supportsCriticalFunction')} />
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Supporte Fonction Critique</label>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Type de Service</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium"
                            {...register('serviceType')}>
                            {['SaaS', 'Cloud', 'Software', 'Hardware', 'Consulting', 'Network', 'Security'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Criticité DORA</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium"
                            {...register('doraCriticality')}>
                            {['None', 'Important', 'Critical'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Relations Card */}
            <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                    <LinkIcon className="w-5 h-5 mr-2 text-indigo-500" />
                    Relations & Dépendances
                </h3>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Processus Supportés</label>
                        <Controller
                            name="supportedProcessIds"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    options={processes.map(p => ({ value: p.id, label: p.name, subLabel: `RTO: ${p.rto}` }))}
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    placeholder="Sélectionner les processus..."
                                    multiple
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Actifs Liés</label>
                            <Controller
                                name="relatedAssetIds"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        options={assets.map(a => ({ value: a.id, label: a.name, subLabel: a.type }))}
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        placeholder="Lier des actifs..."
                                        multiple
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Risques Liés</label>
                            <Controller
                                name="relatedRiskIds"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        options={risks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score}` }))}
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        placeholder="Lier des risques..."
                                        multiple
                                    />
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Contract & Contact Card */}
            <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                    Contrat & Contact
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Controller
                        name="contactName"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput label="Nom du Contact" {...field} value={field.value || ''} />
                        )}
                    />
                    <Controller
                        name="contactEmail"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput label="Email du Contact" {...field} value={field.value || ''} type="email" />
                        )}
                    />

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Contrat (Document)</label>
                        <Controller
                            name="contractDocumentId"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    options={documents.map(d => ({ value: d.id, label: d.title, subLabel: d.version }))}
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    placeholder="Lier un contrat..."
                                />
                            )}
                        />
                    </div>

                    <Controller
                        name="contractEnd"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput label="Fin de Contrat" {...field} value={field.value || ''} type="date" />
                        )}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                    Annuler
                </button>
                <button type="submit" className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform font-bold text-sm shadow-lg">
                    {isEditing ? 'Mettre à jour' : 'Créer le Fournisseur'}
                </button>
            </div>
        </form>
    );
};
