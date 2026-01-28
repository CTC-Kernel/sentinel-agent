/**
 * Schedule Report Modal
 * Story 7.3: Scheduled Recurring Reports
 * Allows users to configure recurring report schedules
 */

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Calendar, Mail, Clock, FileText, Plus, Trash2 } from '../ui/Icons';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
    ReportFrequency,
    ReportTemplateId,
    ScheduledReportFormData,
    frequencyLabels,
    dayOfWeekLabels,
    calculateNextRunDate
} from '../../types/reports';
import { ReportConfig } from './ReportConfigurationModal';

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
    const [name, setName] = useState('');
    const [templateId, setTemplateId] = useState<ReportTemplateId>(defaultTemplateId);
    const [frequency, setFrequency] = useState<ReportFrequency>('monthly');
    const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
    const [dayOfMonth, setDayOfMonth] = useState<number>(1);
    const [recipients, setRecipients] = useState<string[]>(['']);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);

    // Report config options
    const [includeRisks, setIncludeRisks] = useState(true);
    const [includeCompliance, setIncludeCompliance] = useState(true);
    const [includeAudits, setIncludeAudits] = useState(true);
    const [includeProjects, setIncludeProjects] = useState(true);
    const [includeIncidents, setIncludeIncidents] = useState(true);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setName('');
            setTemplateId(defaultTemplateId);
            setFrequency('monthly');
            setDayOfWeek(1);
            setDayOfMonth(1);
            setRecipients(['']);
            setEmailError(null);
            setIncludeRisks(true);
            setIncludeCompliance(true);
            setIncludeAudits(true);
            setIncludeProjects(true);
            setIncludeIncidents(true);
        }
    }, [isOpen, defaultTemplateId]);

    const validateEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleAddRecipient = () => {
        setRecipients([...recipients, '']);
    };

    const handleRemoveRecipient = (index: number) => {
        if (recipients.length > 1) {
            setRecipients(recipients.filter((_, i) => i !== index));
        }
    };

    const handleRecipientChange = (index: number, value: string) => {
        const newRecipients = [...recipients];
        newRecipients[index] = value;
        setRecipients(newRecipients);
        setEmailError(null);
    };

    const handleSubmit = async () => {
        // Validate name
        if (!name.trim()) {
            setEmailError('Veuillez donner un nom à ce rapport planifié');
            return;
        }

        // Validate recipients
        const validRecipients = recipients.filter(r => r.trim());
        if (validRecipients.length === 0) {
            setEmailError('Veuillez ajouter au moins un destinataire');
            return;
        }

        const invalidEmails = validRecipients.filter(r => !validateEmail(r));
        if (invalidEmails.length > 0) {
            setEmailError(`Adresse email invalide: ${invalidEmails[0]}`);
            return;
        }

        const config: ReportConfig = {
            title: name,
            includeRisks,
            includeCompliance,
            includeAudits,
            includeProjects,
            includeIncidents
        };

        const formData: ScheduledReportFormData = {
            name: name.trim(),
            templateId,
            frequency,
            dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
            dayOfMonth: frequency !== 'weekly' ? dayOfMonth : undefined,
            recipients: validRecipients,
            config
        };

        setIsSubmitting(true);
        try {
            await onSchedule(formData);
            onClose();
        } catch {
            setEmailError('Erreur lors de la planification du rapport');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate preview of next run
    const nextRun = calculateNextRunDate(
        frequency,
        frequency === 'weekly' ? dayOfWeek : undefined,
        frequency !== 'weekly' ? dayOfMonth : undefined
    );

    return (
        <Transition show={isOpen} as={React.Fragment}>
            <Dialog onClose={onClose} className="relative z-50">
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-70"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-70"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-70 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-70 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div>
                                        <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white">
                                            Planifier un rapport
                                        </Dialog.Title>
                                        <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
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
                                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                    {/* Report Name */}
                                    <div>
                                        <label htmlFor="scheduled-report-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Nom du rapport planifié
                                        </label>
                                        <input
                                            id="scheduled-report-name"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Ex: Rapport mensuel ISO 27001"
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Template Selection */}
                                    <div>
                                        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            <FileText className="inline h-4 w-4 mr-1" />
                                            Type de rapport
                                        </span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(Object.keys(templateLabels) as ReportTemplateId[]).map((tid) => (
                                                <button
                                                    key={tid}
                                                    onClick={() => setTemplateId(tid)}
                                                    aria-pressed={templateId === tid}
                                                    className={cn(
                                                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                                        templateId === tid
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
                                            {(Object.keys(frequencyLabels) as ReportFrequency[]).map((freq) => (
                                                <button
                                                    key={freq}
                                                    onClick={() => setFrequency(freq)}
                                                    aria-pressed={frequency === freq}
                                                    className={cn(
                                                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                                        frequency === freq
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
                                    {frequency === 'weekly' ? (
                                        <div>
                                            <label htmlFor="weekly-day" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                <Calendar className="inline h-4 w-4 mr-1" />
                                                Jour de la semaine
                                            </label>
                                            <select
                                                id="weekly-day"
                                                value={dayOfWeek}
                                                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-brand-500"
                                            >
                                                {Object.entries(dayOfWeekLabels).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
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
                                                value={dayOfMonth}
                                                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-brand-500"
                                            >
                                                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                                                    <option key={day} value={day}>
                                                        {day === 1 ? '1er' : day}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Next Run Preview */}
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 dark:border-blue-800 rounded-lg">
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            <Clock className="inline h-4 w-4 mr-1" />
                                            Prochaine exécution: <strong>{nextRun.toLocaleDateString('fr-FR', {
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
                                            {recipients.map((email, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <input
                                                        id={`recipient-email-${index}`}
                                                        type="email"
                                                        value={email}
                                                        onChange={(e) => handleRecipientChange(index, e.target.value)}
                                                        placeholder="email@example.com"
                                                        aria-label={`Email du destinataire ${index + 1}`}
                                                        className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent"
                                                    />
                                                    {recipients.length > 1 && (
                                                        <button
                                                            onClick={() => handleRemoveRecipient(index)}
                                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                onClick={handleAddRecipient}
                                                className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Ajouter un destinataire
                                            </button>
                                        </div>
                                    </div>

                                    {/* Report Content Options (for custom reports) */}
                                    {templateId === 'custom' && (
                                        <div>
                                            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Contenu du rapport
                                            </span>
                                            <div className="space-y-2">
                                                {[
                                                    { key: 'risks', label: 'Risques', value: includeRisks, setter: setIncludeRisks },
                                                    { key: 'compliance', label: 'Conformité', value: includeCompliance, setter: setIncludeCompliance },
                                                    { key: 'audits', label: 'Audits', value: includeAudits, setter: setIncludeAudits },
                                                    { key: 'projects', label: 'Projets', value: includeProjects, setter: setIncludeProjects },
                                                    { key: 'incidents', label: 'Incidents', value: includeIncidents, setter: setIncludeIncidents }
                                                ].map(({ key, label, value, setter }) => (
                                                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={value}
                                                            onChange={(e) => setter(e.target.checked)}
                                                            className="rounded text-brand-600 focus-visible:ring-brand-500"
                                                        />
                                                        <span className="text-sm text-slate-600 dark:text-muted-foreground">{label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {emailError && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 dark:border-red-800 rounded-lg">
                                            <p className="text-sm text-red-700 dark:text-red-300">{emailError}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                                    <Button variant="outline" onClick={onClose}>
                                        Annuler
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="bg-brand-600 hover:bg-brand-700 text-white"
                                    >
                                        {isSubmitting ? 'Planification...' : 'Planifier'}
                                    </Button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};
