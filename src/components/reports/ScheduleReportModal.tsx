/**
 * Schedule Report Modal
 * Story 7.3: Scheduled Recurring Reports
 * Allows users to configure recurring report schedules
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { X, Calendar, Mail, Clock, FileText, Plus, Trash2 } from '../ui/Icons';
import { Button } from '../ui/button';
import { useForm, useWatch, useFieldArray, FieldArrayPath } from 'react-hook-form';
import { cn } from '../../lib/utils';
import { useLocale } from '@/hooks/useLocale';
import {
    ReportFrequency,
    ReportTemplateId,
    ScheduledReportFormData,
    frequencyLabels,
    dayOfWeekLabels,
    calculateNextRunDate
} from '../../types/reports';

interface ScheduleReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (data: ScheduledReportFormData) => Promise<void>;
    defaultTemplateId?: ReportTemplateId;
}

const templateLabels: Record<ReportTemplateId, string> = {
    iso27001: 'Pack ISO 27001',
    gdpr: 'Pack RGPD',
    custom: 'Rapport Exécutif'
};

export const ScheduleReportModal: React.FC<ScheduleReportModalProps> = ({
    isOpen,
    onClose,
    onSchedule,
    defaultTemplateId = 'custom'
}) => {
    const { t } = useTranslation();
    const { config } = useLocale();
    const { register, handleSubmit, control, setValue, reset, formState: { isSubmitting, isDirty } } = useForm<ScheduledReportFormData>({
        defaultValues: {
            name: '',
            templateId: defaultTemplateId,
            frequency: 'monthly',
            dayOfWeek: 1,
            dayOfMonth: 1,
            recipients: [''],
            config: {
                title: '',
                includeRisks: true,
                includeCompliance: true,
                includeAudits: true,
                includeProjects: true,
                includeIncidents: true
            }
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "recipients" as FieldArrayPath<ScheduledReportFormData>
    });

    const watchedFrequency = useWatch({ control, name: 'frequency' });
    const watchedDayOfWeek = useWatch({ control, name: 'dayOfWeek' });
    const watchedDayOfMonth = useWatch({ control, name: 'dayOfMonth' });
    const watchedTemplateId = useWatch({ control, name: 'templateId' });

    const [formError, setFormError] = useState<string | null>(null);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            reset({
                name: '',
                templateId: defaultTemplateId,
                frequency: 'monthly',
                dayOfWeek: 1,
                dayOfMonth: 1,
                recipients: [''],
                config: {
                    title: '',
                    includeRisks: true,
                    includeCompliance: true,
                    includeAudits: true,
                    includeProjects: true,
                    includeIncidents: true
                }
            });
            // Reset form error when modal opens
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormError(null);
        }
    }, [isOpen, defaultTemplateId, reset]);

    const validateEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const onSubmit = async (data: ScheduledReportFormData) => {
        // Validate name
        if (!data.name.trim()) {
            setFormError('Veuillez donner un nom à ce rapport planifié');
            return;
        }

        // Validate recipients
        const validRecipients = data.recipients.filter(r => r.trim());
        if (validRecipients.length === 0) {
            setFormError('Veuillez ajouter au moins un destinataire');
            return;
        }

        const invalidEmails = validRecipients.filter(r => !validateEmail(r));
        if (invalidEmails.length > 0) {
            setFormError(`Adresse email invalide : ${invalidEmails[0]}`);
            return;
        }

        // Update config title to match name
        const formData: ScheduledReportFormData = {
            ...data,
            name: data.name.trim(),
            recipients: validRecipients,
            dayOfWeek: data.frequency === 'weekly' ? data.dayOfWeek : undefined,
            dayOfMonth: data.frequency !== 'weekly' ? data.dayOfMonth : undefined,
            config: {
                ...data.config,
                title: data.name.trim()
            }
        };

        try {
            await onSchedule(formData);
            onClose();
        } catch {
            setFormError(t('reports.scheduleError', { defaultValue: 'Erreur lors de la planification du rapport' }));
        }
    };

    // Calculate preview of next run
    const nextRun = calculateNextRunDate(
        watchedFrequency,
        watchedFrequency === 'weekly' ? watchedDayOfWeek : undefined,
        watchedFrequency !== 'weekly' ? watchedDayOfMonth : undefined
    );

    const templateIds: ReportTemplateId[] = ['iso27001', 'gdpr', 'custom'];
    const frequencies: ReportFrequency[] = ['weekly', 'monthly', 'quarterly'];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
            maxWidth="max-w-lg"
            hasUnsavedChanges={isDirty}
        >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/40 dark:border-slate-800 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Planifier un rapport
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Recevez ce rapport automatiquement par email
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <X className="h-5 w-5 text-slate-500" />
                </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Report Name */}
                <div>
                    <label htmlFor="scheduled-report-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Nom du rapport planifié
                    </label>
                    <input
                        id="scheduled-report-name"
                        type="text"
                        {...register('name')}
                        placeholder="Ex: Rapport mensuel ISO 27001"
                        className="w-full px-4 py-2 border border-border/40 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-primary focus:border-transparent"
                    />
                </div>

                {/* Template Selection */}
                <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <FileText className="inline h-4 w-4 mr-1" />
                        Type de rapport
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                        {templateIds.map((tid) => (
                            <button
                                key={tid || 'unknown'}
                                type="button"
                                onClick={() => setValue('templateId', tid, { shouldDirty: true })}
                                aria-pressed={watchedTemplateId === tid}
                                className={cn(
                                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                    watchedTemplateId === tid
                                        ? "bg-brand-500 text-white ring-2 ring-brand-500"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                )}
                            >
                                {templateLabels[tid]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Frequency Selection */}
                <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <Clock className="inline h-4 w-4 mr-1" />
                        Fréquence
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                        {frequencies.map((freq) => (
                            <button
                                key={freq || 'unknown'}
                                type="button"
                                onClick={() => setValue('frequency', freq, { shouldDirty: true })}
                                aria-pressed={watchedFrequency === freq}
                                className={cn(
                                    "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                    watchedFrequency === freq
                                        ? "bg-brand-500 text-white ring-2 ring-brand-500"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                )}
                            >
                                {frequencyLabels[freq]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Day Selection */}
                {watchedFrequency === 'weekly' ? (
                    <div>
                        <label htmlFor="weekly-day" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            <Calendar className="inline h-4 w-4 mr-1" />
                            Jour de la semaine
                        </label>
                        <select
                            id="weekly-day"
                            value={watchedDayOfWeek}
                            onChange={(e) => setValue('dayOfWeek', Number(e.target.value), { shouldDirty: true })}
                            className="w-full px-4 py-2 border border-border/40 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-primary"
                        >
                            {Object.entries(dayOfWeekLabels).map(([value, label]) => (
                                <option key={value || 'unknown'} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div>
                        <label htmlFor="monthly-day" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            <Calendar className="inline h-4 w-4 mr-1" />
                            Jour du mois
                        </label>
                        <select
                            id="monthly-day"
                            value={watchedDayOfMonth}
                            onChange={(e) => setValue('dayOfMonth', Number(e.target.value), { shouldDirty: true })}
                            className="w-full px-4 py-2 border border-border/40 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-primary"
                        >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                                <option key={day || 'unknown'} value={day}>
                                    {day === 1 ? '1er' : day}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Next Run Preview */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        <Clock className="inline h-4 w-4 mr-1" />
                        Prochaine exécution: <strong>{nextRun.toLocaleDateString(config.intlLocale, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</strong>
                    </p>
                </div>

                {/* Recipients */}
                <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <Mail className="inline h-4 w-4 mr-1" />
                        Destinataires
                    </span>
                    <div className="space-y-2">
                        {fields.map((field, index) => (
                            <div key={field.id || 'unknown'} className="flex gap-2">
                                <input
                                    type="email"
                                    {...register(`recipients.${index}`)}
                                    placeholder="email@example.com"
                                    aria-label={`Email du destinataire ${index + 1}`}
                                    className="flex-1 px-4 py-2 border border-border/40 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-primary focus:border-transparent"
                                />
                                {fields.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => append('')}
                            className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
                        >
                            <Plus className="h-4 w-4" />
                            {t('reports.addRecipient', { defaultValue: 'Ajouter un destinataire' })}
                        </button>
                    </div>
                </div>

                {/* Report Content Options (for custom reports) */}
                {watchedTemplateId === 'custom' && (
                    <div>
                        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Contenu du rapport
                        </span>
                        <div className="space-y-2">
                            {[
                                { key: 'config.includeRisks', label: 'Risques' },
                                { key: 'config.includeCompliance', label: 'Conformité' },
                                { key: 'config.includeAudits', label: 'Audits' },
                                { key: 'config.includeProjects', label: 'Projets' },
                                { key: 'config.includeIncidents', label: 'Incidents' }
                            ].map(({ key, label }) => (
                                <label key={key || 'unknown'} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        {...register(key as keyof ScheduledReportFormData)}
                                        className="rounded text-brand-600 focus-visible:ring-primary"
                                    />
                                    <span className="text-sm text-muted-foreground">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {formError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/40 dark:border-slate-800 flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                    Annuler
                </Button>
                <Button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                    className="bg-brand-600 hover:bg-brand-700 text-white"
                >
                    {isSubmitting ? 'Planification...' : 'Planifier'}
                </Button>
            </div>
        </Modal>
    );
};
