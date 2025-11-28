import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { auditSchema, AuditFormData } from '../../schemas/auditSchema';
import { Audit, Control, Asset, Risk, UserProfile } from '../../types';
import { CustomSelect } from '../ui/CustomSelect';

interface AuditFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: AuditFormData) => Promise<void | unknown>;
    existingAudit?: Audit | null;
    assets: Asset[];
    risks: Risk[];
    controls: Control[];
    usersList: UserProfile[];
    initialData?: Partial<AuditFormData>;
}

export const AuditFormModal: React.FC<AuditFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    existingAudit,
    assets,
    risks,
    controls,
    usersList,
    initialData
}) => {
    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<AuditFormData>({
        resolver: zodResolver(auditSchema) as any,
        defaultValues: {
            name: '',
            type: 'Interne',
            auditor: '',
            dateScheduled: new Date().toISOString().split('T')[0],
            status: 'Planifié',
            relatedAssetIds: [],
            relatedRiskIds: [],
            relatedControlIds: []
        }
    });

    useEffect(() => {
        if (isOpen) {
            if (existingAudit) {
                reset({
                    name: existingAudit.name,
                    type: existingAudit.type,
                    auditor: existingAudit.auditor,
                    dateScheduled: existingAudit.dateScheduled,
                    status: existingAudit.status,
                    relatedAssetIds: existingAudit.relatedAssetIds || [],
                    relatedRiskIds: existingAudit.relatedRiskIds || [],
                    relatedControlIds: existingAudit.relatedControlIds || []
                });
            } else {
                reset({
                    name: initialData?.name || '',
                    type: initialData?.type || 'Interne',
                    auditor: initialData?.auditor || '',
                    dateScheduled: initialData?.dateScheduled || new Date().toISOString().split('T')[0],
                    status: initialData?.status || 'Planifié',
                    relatedAssetIds: initialData?.relatedAssetIds || [],
                    relatedRiskIds: initialData?.relatedRiskIds || [],
                    relatedControlIds: initialData?.relatedControlIds || []
                });
            }
        }
    }, [isOpen, existingAudit, initialData, reset]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-indigo-50/30 dark:bg-indigo-900/10">
                    <h2 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 tracking-tight">
                        {existingAudit ? 'Modifier l\'Audit' : 'Planifier un Audit'}
                    </h2>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
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
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actifs (Périmètre)</label>
                            <div className="h-32 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-white/10 rounded-2xl p-3 bg-gray-50/50 dark:bg-black/20">
                                <Controller
                                    name="relatedAssetIds"
                                    control={control}
                                    render={({ field }) => (
                                        <>
                                            {assets.map(a => (
                                                <label key={a.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.value?.includes(a.id)}
                                                        onChange={() => {
                                                            const current = field.value || [];
                                                            const updated = current.includes(a.id) ? current.filter(id => id !== a.id) : [...current, a.id];
                                                            field.onChange(updated);
                                                        }}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                                    />
                                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{a.name}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Risques (Périmètre)</label>
                            <div className="h-32 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-white/10 rounded-2xl p-3 bg-gray-50/50 dark:bg-black/20">
                                <Controller
                                    name="relatedRiskIds"
                                    control={control}
                                    render={({ field }) => (
                                        <>
                                            {risks.map(r => (
                                                <label key={r.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.value?.includes(r.id)}
                                                        onChange={() => {
                                                            const current = field.value || [];
                                                            const updated = current.includes(r.id) ? current.filter(id => id !== r.id) : [...current, r.id];
                                                            field.onChange(updated);
                                                        }}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                                    />
                                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{r.threat}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contrôles (Périmètre)</label>
                        <Controller
                            name="relatedControlIds"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    options={controls.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    placeholder="Sélectionner les contrôles à auditer..."
                                    multiple
                                />
                            )}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Auditeur</label>
                        <select
                            className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none"
                            {...register('auditor')}
                        >
                            <option value="">Sélectionner...</option>
                            {usersList.map(u => (
                                <option key={u.uid} value={u.displayName}>{u.displayName}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-indigo-500/30">
                            {existingAudit ? 'Enregistrer' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
