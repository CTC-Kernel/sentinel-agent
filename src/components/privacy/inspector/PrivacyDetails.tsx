import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ProcessingActivity, UserProfile } from '../../../types';
import { ProcessingActivityFormData } from '../../../schemas/privacySchema';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
import { User, Calendar, Tag } from 'lucide-react';

interface PrivacyDetailsProps {
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
    const { register, setValue, watch, formState: { errors } } = form;
    const watchedManagerId = watch('managerId');

    if (isEditing) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FloatingLabelInput
                        label="Nom de l'activité"
                        {...register('name')}
                        error={errors.name?.message}
                        placeholder="Ex: Gestion de la paie"
                        icon={Tag}
                    />
                    <div>
                        {/* Wrapper for CustomSelect to handle label/layout if needed, though CustomSelect might handle it */}
                        <CustomSelect
                            label="Responsable du traitement"
                            value={watchedManagerId || ''}
                            onChange={(val) => {
                                const value = Array.isArray(val) ? val[0] : val;
                                const selectedUser = usersList.find(u => u.uid === value);
                                setValue('managerId', value, { shouldDirty: true });
                                setValue('manager', selectedUser?.displayName || '', { shouldDirty: true });
                            }}
                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                            placeholder="Sélectionner un responsable"
                            error={errors.managerId?.message}
                        />
                    </div>
                </div>

                <FloatingLabelInput
                    label="Finalité du traitement"
                    {...register('purpose')}
                    error={errors.purpose?.message}
                    placeholder="Pourquoi collectez-vous ces données ?"
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
                    Description & Finalité
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Finalité</label>
                        <p className="text-slate-700 dark:text-slate-300">
                            {activity.purpose || "Non spécifié"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase">Responsabilité</h4>
                    <div className="bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
                        <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-brand-500" />
                            <div>
                                <p className="text-xs text-slate-500">Responsable</p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {usersList.find(u => u.uid === activity.managerId)?.displayName || activity.manager || 'Non assigné'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase">Métadonnées</h4>
                    <div className="bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Créé le</p>
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
