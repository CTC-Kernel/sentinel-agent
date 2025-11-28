import React, { useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { incidentSchema, IncidentFormData } from '../../schemas/incidentSchema';
import { Criticality, UserProfile, BusinessProcess, Asset, Risk } from '../../types';
import { ShieldAlert } from '../ui/Icons';
import { AIAssistButton } from '../ai/AIAssistButton';
import { useStore } from '../../store';

const PLAYBOOKS: Record<string, string[]> = {
    'Ransomware': ['Déconnecter la machine', 'Ne PAS éteindre', 'Photo de la rançon', 'Vérifier backups', 'Identifier malware', 'Isoler partages', 'Déclarer CNIL', 'Restaurer'],
    'Phishing': ['Changer mot de passe', 'Activer MFA', 'Scanner règles email', 'Purger email', 'Vérifier logs', 'Rappel utilisateurs'],
    'Vol Matériel': ['Effacement à distance', 'Révoquer certificats', 'Changer MDP locaux', 'Plainte police', 'Assurance'],
    'Indisponibilité': ['Vérifier élec/ondulateur', 'Ping/Traceroute', 'Basculer lien secours', 'Contacter FAI', 'Activer PCA > 4h'],
    'Fuite de Données': ['Identifier source', 'Colmater brèche', 'Lister données', 'Qualifier sensibilité', 'Notifier personnes', 'Notifier CNIL'],
    'Autre': ['Documenter faits', 'Qualifier impact', 'Prévenir RSSI', 'Sauvegarder logs', 'Sécuriser preuves']
};

interface IncidentFormProps {
    onSubmit: SubmitHandler<IncidentFormData>;
    onCancel: () => void;
    initialData?: Partial<IncidentFormData>;
    users: UserProfile[];
    processes: BusinessProcess[];
    assets: Asset[];
    risks: Risk[];
}

export const IncidentForm: React.FC<IncidentFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    users,
    processes,
    assets,
    risks
}) => {
    const { addToast } = useStore();
    const { register, handleSubmit, setValue, watch, getValues, formState: { errors } } = useForm<IncidentFormData>({
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

    const affectedAssetId = watch('affectedAssetId');

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
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre de l'incident</label>
                <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
                    {...register('title')} placeholder="Ex: Attaque Ransomware sur Serveur RH" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div>
                {/* NIS 2 Section */}
                <div className="bg-red-50/50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30 space-y-4">
                    <div className="flex items-center space-x-3">
                        <input type="checkbox" className="h-5 w-5 rounded text-red-600 focus:ring-red-500 border-gray-300" {...register('isSignificant')} />
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                            <ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
                            Incident Significatif (NIS 2)
                        </label>
                    </div>

                    {watch('isSignificant') && (
                        <div className="animate-fade-in pl-8">
                            <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-red-100 dark:border-red-900/30 mb-4">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">Délais de Notification</h4>
                                <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                                    <li className="flex justify-between"><span>Pré-notification (Early Warning)</span> <span className="font-bold">24h</span></li>
                                    <li className="flex justify-between"><span>Notification Initiale</span> <span className="font-bold">72h</span></li>
                                    <li className="flex justify-between"><span>Rapport Final</span> <span className="font-bold">1 mois</span></li>
                                </ul>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut Notification</label>
                                <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                    {...register('notificationStatus')}>
                                    <option value="Not Required">Non Requis</option>
                                    <option value="Pending">En attente</option>
                                    <option value="Reported">Signalé</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center mb-2 mt-4">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Description détaillée</label>
                    <AIAssistButton
                        context={{
                            title: watch('title'),
                            category: watch('category'),
                            severity: watch('severity'),
                            affectedAsset: assets.find(a => a.id === watch('affectedAssetId'))?.name
                        }}
                        fieldName="description"
                        onSuggest={(val: string) => setValue('description', val)}
                        prompt="Rédige une description détaillée et professionnelle pour cet incident de sécurité. Inclus les éléments factuels probables basés sur le titre et la catégorie."
                    />
                </div>
                <textarea rows={4} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium resize-none"
                    {...register('description')} placeholder="Décrivez les faits, l'heure de découverte, les symptômes..." />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Catégorie (Playbook)</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                        {...register('category')}>
                        {Object.keys(PLAYBOOKS).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Sévérité</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                        {...register('severity')}>
                        {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                        {...register('status')}>
                        {['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actif Impacté</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                        {...register('affectedAssetId')}>
                        <option value="">Aucun / Inconnu</option>
                        {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Processus Impacté</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                        {...register('affectedProcessId')}>
                        <option value="">Aucun / Inconnu</option>
                        {processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Lier à un Risque Identifié</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                        {...register('relatedRiskId')}>
                        <option value="">Non lié</option>
                        {risks.map(r => <option key={r.id} value={r.id}>{r.threat} (Score: {r.score})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Déclaré par</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                        {...register('reporter')}>
                        <option value="">Sélectionner...</option>
                        {users.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Coût estimé (€)</label>
                    <input type="number" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
                        {...register('financialImpact', { valueAsNumber: true })} placeholder="0.00" />
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                <button type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                <button type="submit" className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm shadow-lg shadow-red-500/20 hover:scale-105 transition-all">Enregistrer</button>
            </div>
        </form>
    );
};
