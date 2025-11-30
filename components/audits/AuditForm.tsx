import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { auditSchema, AuditFormData } from '../../schemas/auditSchema';
import { Audit, Control, Asset, Risk, UserProfile, Project } from '../../types';
import { CustomSelect } from '../ui/CustomSelect';

interface AuditFormProps {
    onSubmit: import('react-hook-form').SubmitHandler<AuditFormData>;
    onCancel: () => void;
    existingAudit?: Audit | null;
    assets: Asset[];
    risks: Risk[];
    controls: Control[];
    projects: Project[];
    usersList: UserProfile[];
    initialData?: Partial<AuditFormData>;
}

export const AuditForm: React.FC<AuditFormProps> = ({
    onSubmit,
    onCancel,
    existingAudit,
    assets,
    risks,


    controls,
    projects,
    usersList,
    initialData
}) => {
    const { register, handleSubmit, reset, control } = useForm<AuditFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(auditSchema) as any,
        defaultValues: {
            name: '',
            type: 'Interne',
            auditor: '',
            dateScheduled: new Date().toISOString().split('T')[0],
            status: 'Planifié',
            scope: '',
            relatedAssetIds: [],
            relatedRiskIds: [],

            relatedControlIds: [],
            relatedProjectIds: []
        }
    });

    useEffect(() => {
        if (existingAudit) {
            reset({
                name: existingAudit.name,
                type: existingAudit.type,
                auditor: existingAudit.auditor,
                dateScheduled: existingAudit.dateScheduled,
                status: existingAudit.status,
                scope: existingAudit.scope || '',
                relatedAssetIds: existingAudit.relatedAssetIds || [],
                relatedRiskIds: existingAudit.relatedRiskIds || [],

                relatedControlIds: existingAudit.relatedControlIds || [],
                relatedProjectIds: existingAudit.relatedProjectIds || []
            });
        } else {
            reset({
                name: initialData?.name || '',
                type: initialData?.type || 'Interne',
                auditor: initialData?.auditor || '',
                dateScheduled: initialData?.dateScheduled || new Date().toISOString().split('T')[0],
                status: initialData?.status || 'Planifié',
                scope: initialData?.scope || '',
                relatedAssetIds: initialData?.relatedAssetIds || [],
                relatedRiskIds: initialData?.relatedRiskIds || [],

                relatedControlIds: initialData?.relatedControlIds || [],
                relatedProjectIds: initialData?.relatedProjectIds || []
            });
        }
    }, [existingAudit, initialData, reset]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6 overflow-y-auto custom-scrollbar h-full">
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom de l'audit</label>
                <input required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    {...register('name')} placeholder="Ex: Audit Interne ISO 27001 - Q1" />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type</label>
                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none"
                        {...register('type')}>
                        {['Interne', 'Externe', 'Certification'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Date Prévue</label>
                    <input type="date" required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                        {...register('dateScheduled')} />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Auditeur</label>
                <Controller
                    name="auditor"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            value={field.value}
                            onChange={field.onChange}
                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                            placeholder="Sélectionner un auditeur..."
                        />
                    )}
                />
            </div>
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description du Périmètre</label>
                <textarea className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium min-h-[100px]"
                    {...register('scope')} placeholder="Décrivez le périmètre de l'audit (ex: Tous les serveurs de production, Processus RH...)" />
            </div>
            <div className="space-y-4">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Périmètre</label>
                <Controller
                    name="relatedAssetIds"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Actifs concernés"
                            value={field.value || []}
                            onChange={field.onChange}
                            options={assets.map(a => ({ value: a.id, label: a.name }))}
                            multiple
                        />
                    )}
                />
                <Controller
                    name="relatedControlIds"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Contrôles à vérifier"
                            value={field.value || []}
                            onChange={field.onChange}
                            options={controls.map(c => ({ value: c.id, label: c.code, subLabel: c.name }))}
                            multiple
                        />
                    )}
                />
                <Controller
                    name="relatedRiskIds"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Risques concernés"
                            value={field.value || []}
                            onChange={field.onChange}
                            options={risks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score}` }))}
                            multiple
                        />
                    )}
                />
                <Controller
                    name="relatedProjectIds"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Projets liés"
                            value={field.value || []}
                            onChange={field.onChange}
                            options={projects.map(p => ({ value: p.id, label: p.name }))}
                            multiple
                        />
                    )}
                />
            </div>
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100 dark:border-white/5">
                <button type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                <button type="submit" className="px-8 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-none">
                    {existingAudit ? 'Enregistrer' : 'Planifier'}
                </button>
            </div>
        </form>
    );
};
