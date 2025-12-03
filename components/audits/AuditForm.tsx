import React, { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { AddToCalendar } from '../ui/AddToCalendar';
import { zodResolver } from '@hookform/resolvers/zod';
import { auditSchema, AuditFormData } from '../../schemas/auditSchema';
import { Audit, Control, Asset, Risk, UserProfile, Project } from '../../types';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { Button } from '../ui/button';
import { AUDIT_TYPES } from '../../data/auditConstants';

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
    isLoading?: boolean;
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
    initialData,
    isLoading = false
}) => {
    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<AuditFormData>({
        resolver: zodResolver(auditSchema),
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
    const watchedName = useWatch({ control, name: 'name' });
    const watchedType = useWatch({ control, name: 'type' });
    const watchedScope = useWatch({ control, name: 'scope' });
    const watchedDateScheduled = useWatch({ control, name: 'dateScheduled' });

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
            <div className="space-y-6">
                <FloatingLabelInput
                    label="Nom de l'audit"
                    {...register('name')}
                    placeholder="Ex: Audit Interne ISO 27001 - Q1"
                    error={errors.name?.message}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Controller
                        name="type"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Type"
                                value={field.value}
                                onChange={field.onChange}
                                options={AUDIT_TYPES.map(t => ({ value: t, label: t }))}
                            />
                        )}
                    />

                    <div className="relative">
                        <FloatingLabelInput
                            label="Date Prévue"
                            type="date"
                            {...register('dateScheduled')}
                            error={errors.dateScheduled?.message}
                        />
                        {watchedDateScheduled && watchedName && (
                            <div className="absolute right-2 top-2 z-10">
                                <AddToCalendar
                                    event={{
                                        title: watchedName,
                                        description: `Audit ${watchedType} - ${watchedScope}`,
                                        start: new Date(watchedDateScheduled),
                                        end: new Date(watchedDateScheduled),
                                        location: 'Sentinel GRC'
                                    }}
                                    className="scale-75 origin-right"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <Controller
                    name="auditor"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Auditeur"
                            value={field.value || ''}
                            onChange={field.onChange}
                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                            placeholder="Sélectionner un auditeur..."
                        />
                    )}
                />

                <FloatingLabelTextarea
                    label="Description du Périmètre"
                    {...register('scope')}
                    placeholder="Décrivez le périmètre de l'audit (ex: Tous les serveurs de production, Processus RH...)"
                    rows={4}
                    error={errors.scope?.message}
                />

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
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100 dark:border-white/5">
                <Button
                    type="button"
                    onClick={onCancel}
                    variant="ghost"
                    disabled={isLoading}
                    className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                    Annuler
                </Button>
                <Button
                    type="submit"
                    isLoading={isLoading}
                    className="px-8 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-none"
                >
                    {existingAudit ? 'Enregistrer' : 'Planifier'}
                </Button>
            </div>
        </form>
    );
};
