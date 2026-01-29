import React from 'react';
import { useTranslation } from 'react-i18next';
import { TreatmentAction } from '../../types';
import { useZodForm } from '../../hooks/useZodForm';
import { treatmentActionSchema, TreatmentActionFormData } from '../../schemas/treatmentActionSchema';
import { Calendar, User, X, Check } from '../ui/Icons';
import { Button } from '../ui/button';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';

interface TreatmentActionFormProps {
    action?: TreatmentAction; // If provided, editing mode
    users: { uid: string; displayName: string }[];
    onSave: (action: Omit<TreatmentAction, 'id' | 'createdAt'> & { id?: string }) => void;
    onCancel: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}

export const TreatmentActionForm: React.FC<TreatmentActionFormProps> = ({
    action,
    users,
    onSave,
    onCancel,
    onDirtyChange
}) => {
    const { t } = useTranslation();
    const { register, handleSubmit, watch, reset, formState: { errors, isDirty } } = useZodForm<typeof treatmentActionSchema>({
        schema: treatmentActionSchema,
        mode: 'onChange',
        defaultValues: {
            title: action?.title || '',
            description: action?.description || '',
            ownerId: action?.ownerId || '',
            deadline: action?.deadline || '',
            status: action?.status || 'À faire'
        }
    });

    // Notify parent about dirty state
    React.useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    // Persistence Hook
    const { clearDraft } = useFormPersistence<TreatmentActionFormData>('sentinel_treatment_draft_new', {
        watch,
        reset
    }, {
        enabled: !action
    });

    const onSubmit = (data: TreatmentActionFormData) => {
        onSave({
            id: action?.id,
            ...data,
            updatedAt: new Date().toISOString(),
            completedAt: data.status === 'Terminé' ? new Date().toISOString() : action?.completedAt
        });
        clearDraft();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-border/40 dark:border-slate-700">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {action ? t('risks.treatment.edit_action') : t('risks.treatment.new_action')}
                </h4>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    aria-label={t('risks.treatment.cancel')}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
                <label htmlFor="action-title" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {t('risks.treatment.title_label')} <span className="text-red-500">*</span>
                </label>
                <input
                    id="action-title"
                    type="text"
                    {...register('title')}
                    placeholder={t('risks.treatment.placeholder_title')}
                    className={`w-full rounded-3xl border ${errors.title ? 'border-red-500' : 'border-border/40 dark:border-border/40'} bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none placeholder:text-muted-foreground`}
                />

                {errors.title && (
                    <p className="text-xs text-red-500">{errors.title.message}</p>
                )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
                <label htmlFor="action-description" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {t('risks.treatment.description_label')}
                </label>
                <textarea
                    id="action-description"
                    {...register('description')}
                    rows={2}
                    placeholder={t('risks.treatment.placeholder_description')}
                    className="w-full rounded-3xl border border-border/40 dark:border-border/40 bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none placeholder:text-muted-foreground resize-none"
                />

                {errors.description && (
                    <p className="text-xs text-red-500">{errors.description.message}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Owner */}
                <div className="space-y-1.5">
                    <label htmlFor="action-owner" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {t('risks.treatment.owner_label')}
                    </label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            id="action-owner"
                            {...register('ownerId')}
                            className="w-full pl-9 pr-4 rounded-3xl border border-border/40 dark:border-border/40 bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none appearance-none"
                        >
                            <option value="">{t('risks.treatment.not_assigned')}</option>
                            {users.map(u => (
                                <option key={u.uid} value={u.uid}>{u.displayName}</option>
                            ))}
                        </select>
                    </div>
                </div>


                {/* Deadline */}
                <div className="space-y-1.5">
                    <label htmlFor="action-deadline" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {t('risks.treatment.deadline_label')}
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            id="action-deadline"
                            type="date"
                            {...register('deadline')}
                            className="w-full pl-9 pr-4 rounded-3xl border border-border/40 dark:border-border/40 bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none"
                        />
                    </div>
                </div>


                {/* Status */}
                <div className="space-y-1.5">
                    <label htmlFor="action-status" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {t('risks.treatment.status_label')}
                    </label>
                    <select
                        id="action-status"
                        {...register('status')}
                        className="w-full rounded-3xl border border-border/40 dark:border-border/40 bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 outline-none appearance-none"
                    >
                        <option value="À faire">À faire</option>
                        <option value="En cours">En cours</option>
                        <option value="Terminé">Terminé</option>
                    </select>
                </div>

            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                >
                    {t('risks.treatment.cancel')}
                </Button>
                <Button
                    type="submit"
                    variant="default"
                    size="sm"
                    className="gap-1"
                >
                    <Check className="h-4 w-4" />
                    {action ? t('risks.treatment.save') : t('risks.treatment.add_action')}
                </Button>
            </div>
        </form>
    );
};
