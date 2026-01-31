import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ProcessingActivity, UserProfile } from '../../../types';
import { ProcessingActivityFormData } from '../../../schemas/privacySchema';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
import { User, Calendar, Tag } from '../../ui/Icons';
import { useStore } from '../../../store';

export interface PrivacyDetailsProps {
    activity: ProcessingActivity;
    isEditing: boolean;
    form: UseFormReturn<ProcessingActivityFormData>;
    usersList: UserProfile[];
}

export const PrivacyDetails: React.FC<PrivacyDetailsProps> = ({
    activity,
    isEditing,
    form,
    usersList
}) => {
    const { t } = useStore();
    const { register, setValue, watch, formState: { errors } } = form;
    const watchedManagerId = watch('managerId');

    if (isEditing) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                        <FloatingLabelInput
                            label={t('privacy.details.activityName', { defaultValue: "Nom de l'activité" }) + ' *'}
                            {...register('name')}
                            error={errors.name?.message}
                            placeholder="Ex: Gestion de la paie"
                            icon={Tag}
                        />
                    </div>
                    <div>
                        {/* Wrapper for CustomSelect to handle label/layout if needed, though CustomSelect might handle it */}
                        <CustomSelect
                            label={t('privacy.details.manager', { defaultValue: 'Responsable du traitement' }) + ' *'}
                            value={watchedManagerId || ''}
                            onChange={(val) => {
                                const value = Array.isArray(val) ? val[0] : val;
                                const selectedUser = usersList.find(u => u.uid === value);
                                setValue('managerId', value, { shouldDirty: true });
                                setValue('manager', selectedUser?.displayName || '', { shouldDirty: true });
                            }}
                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                            placeholder={t('privacy.details.selectManager', { defaultValue: 'Sélectionner un responsable' })}
                            error={errors.managerId?.message}
                        />
                    </div>
                </div>

                <FloatingLabelInput
                    label={t('privacy.details.purpose', { defaultValue: 'Finalité du traitement' }) + ' *'}
                    {...register('purpose')}
                    error={errors.purpose?.message}
                    placeholder={t('privacy.details.purposePlaceholder', { defaultValue: 'Pourquoi collectez-vous ces données ?' })}
                    textarea
                    rows={4}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="prose prose-slate dark:prose-invert max-w-none">
                <h3 className="text-sm font-bold bg-slate-100 dark:bg-slate-800 p-2 rounded-lg inline-block text-slate-700 dark:text-slate-300 mb-4">
                    {t('privacy.details.descriptionAndPurpose', { defaultValue: 'Description & Finalité' })}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-border/40 dark:border-white/5">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase mb-2 block">{t('privacy.details.purpose', { defaultValue: 'Finalité' })}</div>
                        <p className="text-slate-700 dark:text-muted-foreground">
                            {activity.purpose || t('common.notSpecified', { defaultValue: 'Non spécifié' })}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-300 mb-3 uppercase">{t('privacy.details.responsibility', { defaultValue: 'Responsabilité' })}</h4>
                    <div className="bg-white dark:bg-white/5 p-4 rounded-3xl border border-border/40 dark:border-border/40 space-y-3">
                        <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-brand-500" />
                            <div>
                                <p className="text-xs text-slate-500">{t('privacy.fields.manager', { defaultValue: 'Responsable' })}</p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {usersList.find(u => u.uid === activity.managerId)?.displayName || activity.manager || t('common.unassigned', { defaultValue: 'Non assigné' })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-300 mb-3 uppercase">{t('privacy.details.metadata', { defaultValue: 'Métadonnées' })}</h4>
                    <div className="bg-white dark:bg-white/5 p-4 rounded-3xl border border-border/40 dark:border-border/40 space-y-3">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">{t('privacy.details.createdAt', { defaultValue: 'Créé le' })}</p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {activity.createdAt ? new Date(activity.createdAt as string).toLocaleDateString() : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
