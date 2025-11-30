import React from 'react';
import { useForm, Controller, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierSchema, SupplierFormData } from '../../schemas/supplierSchema';
import { CustomSelect } from '../ui/CustomSelect';
import { Criticality, UserProfile, BusinessProcess, Asset, Risk, Project, Document } from '../../types';
import { ShieldAlert } from '../ui/Icons';

interface SupplierFormProps {
    onSubmit: SubmitHandler<SupplierFormData>;
    onCancel: () => void;
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
    users,
    processes,
    assets,
    risks,
    projects,
    documents
}) => {
    const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<SupplierFormData>({
        resolver: zodResolver(supplierSchema),
        defaultValues: {
            name: '', category: 'SaaS', criticality: Criticality.MEDIUM, status: 'Actif',
            owner: '', ownerId: '',
            assessment: { hasIso27001: false, hasGdprPolicy: false, hasEncryption: false, hasBcp: false, hasIncidentProcess: false },
            isICTProvider: false, supportsCriticalFunction: false, doraCriticality: 'None', serviceType: 'SaaS',
            relatedAssetIds: [], relatedRiskIds: [], relatedProjectIds: [], supportedProcessIds: []
        }
    });

    const selectedOwnerId = useWatch({ control, name: 'ownerId' });

    React.useEffect(() => {
        if (selectedOwnerId) {
            const selectedUser = users.find(u => u.uid === selectedOwnerId);
            setValue('owner', selectedUser?.displayName || '');
        }
    }, [selectedOwnerId, users, setValue]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom de l'entreprise</label>
                <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                    {...register('name')} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Responsable</label>
                <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                    {...register('ownerId')}>
                    <option value="">Sélectionner...</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Processus Supportés</label>
                <Controller
                    name="supportedProcessIds"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            options={processes.map(p => ({ value: p.id, label: p.name, subLabel: `RTO: ${p.rto}` }))}
                            value={field.value || []}
                            onChange={field.onChange}
                            placeholder="Sélectionner les processus supportés..."
                            multiple
                        />
                    )}
                />
            </div>
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actifs Liés</label>
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
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Risques Liés</label>
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
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Projets Liés</label>
                <Controller
                    name="relatedProjectIds"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            options={projects.map(p => ({ value: p.id, label: p.name, subLabel: p.status }))}
                            value={field.value || []}
                            onChange={field.onChange}
                            placeholder="Lier des projets..."
                            multiple
                        />
                    )}
                />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Catégorie</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                        {...register('category')}>
                        {['SaaS', 'Hébergement', 'Matériel', 'Consulting', 'Autre'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Criticité</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                        {...register('criticality')}>
                        {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                        {...register('status')}>
                        <option value="Actif">Actif</option>
                        <option value="En cours">En cours</option>
                        <option value="Terminé">Terminé</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description</label>
                    <textarea className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none"
                        rows={3}
                        {...register('description')} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contact (Nom)</label>
                    <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                        {...register('contactName')} />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email Contact</label>
                    <input type="email" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                        {...register('contactEmail')} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contrat (Document)</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                        {...register('contractDocumentId')}>
                        <option value="">Sélectionner...</option>
                        {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Fin de Contrat</label>
                    <input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                        {...register('contractEnd')} />
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5">
                <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-4 flex items-center">
                    <ShieldAlert className="h-4 w-4 mr-2" /> Conformité DORA
                </h4>
                <div className="grid grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3">
                        <input type="checkbox" className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" {...register('isICTProvider')} />
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prestataire TIC</label>
                    </div>
                    <div className="flex items-center space-x-3">
                        <input type="checkbox" className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" {...register('supportsCriticalFunction')} />
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Supporte Fonction Critique</label>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type de Service</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none" {...register('serviceType')}>
                            {['SaaS', 'Cloud', 'Software', 'Hardware', 'Consulting', 'Network', 'Security'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Criticité DORA</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none" {...register('doraCriticality')}>
                            {['None', 'Important', 'Critical'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-white/5">
                <button type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                <button type="submit" className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform font-bold text-sm shadow-lg">Créer</button>
            </div>
        </form>
    );
};
