
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/button';
import { cn } from '../../utils/cn';
import { ISO_DOMAINS } from '../../data/complianceData';
import {
    Target,
    X,
    Save,
    Calendar,
} from '../ui/Icons';

const ASSESSMENT_METHODS = [
    { value: 'documentation', label: 'Revue documentaire' },
    { value: 'interview', label: 'Entretien' },
    { value: 'testing', label: 'Test technique' },
    { value: 'observation', label: 'Observation' },
    { value: 'audit', label: 'Audit interne' },
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
    const [formData, setFormData] = useState({
        controlCode: control?.code || '',
        effectivenessScore: 50,
        assessmentMethod: 'documentation',
        notes: '',
        nextAssessmentDate: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    // Accessibility: Handle keyboard escape to close modal
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.controlCode) return;

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
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
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
                <GlassCard className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                            </div>
                            <div>
                                <h3 id="assessment-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Évaluation d'efficacité
                                </h3>
                                <p className="text-sm text-slate-500">ISO 27002</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Fermer le formulaire d'évaluation"
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" aria-hidden="true" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Control Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Contrôle *
                            </label>
                            <select
                                value={formData.controlCode}
                                onChange={(e) => setFormData(prev => ({ ...prev, controlCode: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                required
                            >
                                <option value="">Sélectionner un contrôle...</option>
                                {ISO_DOMAINS.map(domain => (
                                    <optgroup key={domain.id} label={`${domain.id} - ${domain.title}`}>
                                        {controls.filter(c => c.code.startsWith(domain.id)).map(c => (
                                            <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        {/* Effectiveness Score */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Score d'efficacité: <span className={cn(
                                    "font-bold",
                                    formData.effectivenessScore >= 60 ? 'text-emerald-600' :
                                        formData.effectivenessScore >= 40 ? 'text-amber-600' : 'text-red-600'
                                )}>{formData.effectivenessScore}%</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={formData.effectivenessScore}
                                onChange={(e) => setFormData(prev => ({ ...prev, effectivenessScore: parseInt(e.target.value) }))}
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
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Méthode d'évaluation
                            </label>
                            <select
                                value={formData.assessmentMethod}
                                onChange={(e) => setFormData(prev => ({ ...prev, assessmentMethod: e.target.value }))}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                                {ASSESSMENT_METHODS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Notes / Observations
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                                placeholder="Observations et constats de l'évaluation..."
                            />
                        </div>

                        {/* Next Assessment Date */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Prochaine évaluation
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="date"
                                    value={formData.nextAssessmentDate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, nextAssessmentDate: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isSaving || !formData.controlCode}>
                                <Save className="w-4 h-4 mr-2" />
                                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                            </Button>
                        </div>
                    </form>
                </GlassCard>
            </motion.div>
        </motion.div>
    );
};
