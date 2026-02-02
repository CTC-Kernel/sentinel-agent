
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PremiumCard } from '../ui/PremiumCard';
import { Button } from '../ui/button';
import { cn } from '../../utils/cn';
import { ISO_DOMAINS } from '../../data/complianceData';
import { useStore } from '../../store';
import {
    Target,
    X,
    Save,
    Calendar,
    AlertTriangle,
    CheckCircle,
    ArrowRight,
} from '../ui/Icons';

const ASSESSMENT_METHODS = [
    { value: 'documentation', label: 'compliance.assessment.methods.documentation' },
    { value: 'interview', label: 'compliance.assessment.methods.interview' },
    { value: 'testing', label: 'compliance.assessment.methods.testing' },
    { value: 'observation', label: 'compliance.assessment.methods.observation' },
    { value: 'audit', label: 'compliance.assessment.methods.audit' },
];

export interface AssessmentFormModalProps {
    control: { code: string; name: string } | null;
    controls: { code: string; name: string }[];
    onClose: () => void;
    onSubmit: (data: {
        controlId: string;
        controlCode: string;
        effectivenessScore: number;
        assessmentMethod: string;
        evidence?: string[];
        notes?: string;
        nextAssessmentDate?: string;
    }) => Promise<void>;
}

export const AssessmentFormModal: React.FC<AssessmentFormModalProps> = ({
    control,
    controls,
    onClose,
    onSubmit
}) => {
    const { t } = useStore();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        controlCode: control?.code || '',
        effectivenessScore: 50,
        assessmentMethod: 'documentation',
        notes: '',
        nextAssessmentDate: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [submittedScore, setSubmittedScore] = useState<number | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isFormDirty, setIsFormDirty] = useState(false);

    // Track form modifications
    const handleFieldChange = useCallback(<K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsFormDirty(true);
    }, []);

    // Safe close with dirty check
    const handleSafeClose = useCallback(() => {
        if (isFormDirty && submittedScore === null) {
            const confirmed = window.confirm(t('compliance.assessment.unsavedWarning', { defaultValue: 'Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?' }));
            if (!confirmed) return;
        }
        onClose();
    }, [isFormDirty, submittedScore, onClose, t]);

    // Accessibility: Handle keyboard escape to close modal
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleSafeClose();
        }
    }, [handleSafeClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errors: Record<string, string> = {};
        if (!formData.controlCode) {
            errors.controlCode = t('compliance.assessment.controlRequired') || 'Veuillez sélectionner un contrôle';
        }
        if (!formData.assessmentMethod) {
            errors.assessmentMethod = t('compliance.assessment.methodRequired') || 'Veuillez sélectionner une méthode';
        }
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            // Focus on first errored field
            const firstErrorField = Object.keys(errors)[0];
            const el = document.getElementById(firstErrorField === 'controlCode' ? 'control-code' : 'assessment-method');
            el?.focus();
            return;
        }
        setValidationErrors({});

        setIsSaving(true);
        try {
            await onSubmit({
                controlId: formData.controlCode,
                controlCode: formData.controlCode,
                effectivenessScore: formData.effectivenessScore,
                assessmentMethod: formData.assessmentMethod,
                notes: formData.notes || undefined,
                nextAssessmentDate: formData.nextAssessmentDate || undefined
            });
            setSubmittedScore(formData.effectivenessScore);
        } finally {
            setIsSaving(false);
        }
    };

    // Find next control in the list for "assess next" flow
    const getNextControl = useCallback(() => {
        if (!formData.controlCode || controls.length === 0) return null;
        const currentIndex = controls.findIndex(c => c.code === formData.controlCode);
        if (currentIndex === -1 || currentIndex >= controls.length - 1) return null;
        return controls[currentIndex + 1];
    }, [formData.controlCode, controls]);

    const handleAssessNext = useCallback(() => {
        const next = getNextControl();
        if (next) {
            setFormData(prev => ({ ...prev, controlCode: next.code, effectivenessScore: 50, notes: '', nextAssessmentDate: '' }));
            setSubmittedScore(null);
        }
    }, [getNextControl]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)]"
            onClick={handleSafeClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assessment-modal-title"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg"
            >
                <PremiumCard glass className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-3xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                            </div>
                            <div>
                                <h3 id="assessment-modal-title" className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    {t('compliance.assessment.title')}
                                </h3>
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('compliance.assessment.framework', { defaultValue: 'ISO 27002' })}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleSafeClose}
                            aria-label={t('common.cancel')}
                            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-400" aria-hidden="true" />
                        </button>
                    </div>

                    {submittedScore !== null ? (
                        <div className="space-y-5">
                            {submittedScore < 60 ? (
                                /* Non-compliant / partially compliant follow-up */
                                <div className="p-5 rounded-3xl border border-warning-border bg-warning-bg/30 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-2xl bg-warning-bg">
                                            <AlertTriangle className="w-5 h-5 text-warning-text" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                                {t('compliance.assessment.nonCompliantTitle', { defaultValue: 'Non-conformité détectée' })}
                                            </h4>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                {t('compliance.assessment.nonCompliantMessage', { defaultValue: "Voulez-vous créer un plan d'action pour corriger cette non-conformité ?" })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            onClick={() => { navigate('/action-plans?from=assessment&control=' + encodeURIComponent(formData.controlCode)); onClose(); }}
                                            className="rounded-2xl bg-brand-600 shadow-lg shadow-brand-500/20 flex-1"
                                        >
                                            <ArrowRight className="w-4 h-4 mr-2" />
                                            {t('compliance.assessment.createActionPlan', { defaultValue: "Créer un plan d'action" })}
                                        </Button>
                                        <Button variant="ghost" onClick={onClose} className="rounded-2xl">
                                            {t('common.close', { defaultValue: 'Fermer' })}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                /* Compliant success follow-up */
                                <div className="p-5 rounded-3xl border border-green-200 dark:border-green-900/40 bg-green-50/30 dark:bg-green-900/10 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-2xl bg-success-bg">
                                            <CheckCircle className="w-5 h-5 text-success-text" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                                {t('compliance.assessment.compliantTitle', { defaultValue: 'Évaluation enregistrée' })}
                                            </h4>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                {t('compliance.assessment.compliantMessage', { defaultValue: 'Le contrôle est conforme. Évaluation sauvegardée avec succès.' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {getNextControl() ? (
                                            <div className="flex gap-3">
                                                <Button onClick={handleAssessNext} className="rounded-2xl bg-brand-600 shadow-lg shadow-brand-500/20 flex-1">
                                                    <ArrowRight className="w-4 h-4 mr-2" />
                                                    {t('compliance.assessment.assessNext', { defaultValue: 'Évaluer le contrôle suivant' })}
                                                </Button>
                                                <Button variant="ghost" onClick={onClose} className="rounded-2xl">
                                                    {t('common.close', { defaultValue: 'Fermer' })}
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                                                    {t('compliance.assessment.allCompleted', { defaultValue: 'Tous les contrôles ont été évalués. Consultez le tableau de bord pour un résumé.' })}
                                                </p>
                                                <div className="flex gap-3">
                                                    <Button onClick={() => { navigate('/compliance'); onClose(); }} className="rounded-2xl bg-brand-600 shadow-lg shadow-brand-500/20 flex-1">
                                                        <ArrowRight className="w-4 h-4 mr-2" />
                                                        {t('compliance.assessment.viewDashboard', { defaultValue: 'Voir le tableau de bord' })}
                                                    </Button>
                                                    <Button variant="ghost" onClick={onClose} className="rounded-2xl">
                                                        {t('common.close', { defaultValue: 'Fermer' })}
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Control Selection */}
                        <div>
                            <label htmlFor="control-code" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                {t('compliance.assessment.control')} *
                            </label>
                            <select
                                id="control-code"
                                value={formData.controlCode}
                                onChange={(e) => { handleFieldChange('controlCode', e.target.value); setValidationErrors(prev => ({ ...prev, controlCode: '' })); }}
                                className={`w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${validationErrors.controlCode ? 'border-red-500 ring-1 ring-red-500' : 'border-border/40 dark:border-slate-700'} ${controls.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                required
                                disabled={controls.length === 0}
                                aria-invalid={!!validationErrors.controlCode}
                                aria-describedby={validationErrors.controlCode ? 'control-code-error' : undefined}
                            >
                                <option value="">{t('common.selectTemplate')}</option>
                                {ISO_DOMAINS.map(domain => (
                                    <optgroup key={domain.id || 'unknown'} label={`${domain.id} - ${domain.title}`}>
                                        {controls.filter(c => c.code.startsWith(domain.id)).map(c => (
                                            <option key={c.code || 'unknown'} value={c.code}>{c.code} - {c.name}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            {validationErrors.controlCode && (
                                <p id="control-code-error" className="mt-1 text-xs text-red-500 font-medium">{validationErrors.controlCode}</p>
                            )}
                        </div>

                        {/* Effectiveness Score */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                {t('compliance.assessment.score')}: <span className={cn(
                                    "font-black text-sm",
                                    formData.effectivenessScore >= 60 ? 'text-success-text' :
                                        formData.effectivenessScore >= 40 ? 'text-warning-text' : 'text-error-text'
                                )}>{formData.effectivenessScore}%</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={formData.effectivenessScore}
                                onChange={(e) => handleFieldChange('effectivenessScore', parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>0%</span>
                                <span>20%</span>
                                <span>40%</span>
                                <span>60%</span>
                                <span>80%</span>
                                <span>100%</span>
                            </div>
                        </div>

                        {/* Assessment Method */}
                        <div>
                            <label htmlFor="assessment-method" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                {t('compliance.assessment.method')}
                            </label>
                            <select
                                id="assessment-method"
                                value={formData.assessmentMethod}
                                onChange={(e) => { handleFieldChange('assessmentMethod', e.target.value); setValidationErrors(prev => ({ ...prev, assessmentMethod: '' })); }}
                                className={`w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${validationErrors.assessmentMethod ? 'border-red-500 ring-1 ring-red-500' : 'border-border/40 dark:border-slate-700'}`}
                                aria-invalid={!!validationErrors.assessmentMethod}
                                aria-describedby={validationErrors.assessmentMethod ? 'assessment-method-error' : undefined}
                            >
                                {ASSESSMENT_METHODS.map(m => (
                                    <option key={m.value || 'unknown'} value={m.value}>{t(m.label)}</option>
                                ))}
                            </select>
                            {validationErrors.assessmentMethod && (
                                <p id="assessment-method-error" className="mt-1 text-xs text-red-500 font-medium">{validationErrors.assessmentMethod}</p>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <label htmlFor="notes" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                {t('compliance.assessment.notes')}
                            </label>
                            <textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => handleFieldChange('notes', e.target.value)}
                                rows={3}
                                className="w-full px-4 py-3 rounded-2xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                                placeholder={t('compliance.assessment.notesPlaceholder')}
                            />
                        </div>

                        {/* Next Assessment Date */}
                        <div>
                            <label htmlFor="next-assessment" className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                {t('compliance.assessment.nextDate')}
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    id="next-assessment"
                                    type="date"
                                    value={formData.nextAssessmentDate}
                                    onChange={(e) => handleFieldChange('nextAssessmentDate', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-border/40 dark:border-slate-700/50">
                            <Button type="button" variant="ghost" onClick={handleSafeClose} className="rounded-2xl">
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSaving || !formData.controlCode} className="rounded-2xl bg-brand-600 shadow-lg shadow-brand-500/20">
                                <Save className="w-4 h-4 mr-2" />
                                {isSaving ? t('compliance.assessment.saving') : t('compliance.assessment.save')}
                            </Button>
                        </div>
                    </form>
                    )}
                </PremiumCard>
            </motion.div>
        </motion.div>
    );
};
