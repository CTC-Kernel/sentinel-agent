import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { DORA_QUESTIONNAIRE_SECTIONS } from '../../../constants/doraQuestionnaire';
import { SupplierQuestionnaireResponse } from '../../../types';
import { Check, AlertTriangle, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from '@/lib/toast';
import { ErrorLogger } from '../../../services/errorLogger';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    supplierId: string;
    supplierName: string;
    onSave: (assessment: Partial<SupplierQuestionnaireResponse>) => Promise<void>;
}

export const SupplierAssessmentModal: React.FC<Props> = ({
    isOpen,
    onClose,
    supplierId,
    supplierName,
    onSave
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, { value: boolean, comment?: string }>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const sections = DORA_QUESTIONNAIRE_SECTIONS;
    const currentSection = sections[currentStep];

    const calculateScore = () => {
        let totalScore = 0;
        let totalWeight = 0;

        sections.forEach(section => {
            let sectionScore = 0;
            let sectionWeight = 0;

            section.questions.forEach(q => {
                sectionWeight += q.weight;
                if (answers[q.id]?.value === true) {
                    sectionScore += q.weight;
                }
            });

            if (sectionWeight > 0) {
                // Weighted contribution of this section to the total score
                const sectionProgress = sectionScore / sectionWeight;
                totalScore += sectionProgress * section.weight;
                totalWeight += section.weight;
            }
        });

        // Normalize to 100
        return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
    };

    const handleAnswer = (questionId: string, value: boolean) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: { ...prev[questionId], value }
        }));
    };

    const handleNext = () => {
        if (currentStep < sections.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const score = calculateScore();
            const response: Partial<SupplierQuestionnaireResponse> = {
                supplierId,
                supplierName,
                templateId: 'dora-default',
                status: 'Submitted',
                answers: Object.entries(answers).reduce((acc, [key, val]) => ({
                    ...acc,
                    [key]: { value: val.value, comment: val.comment }
                }), {}),
                overallScore: score,
                riskLevel: score >= 80 ? 'Low' : score >= 50 ? 'Medium' : 'High',
                sentDate: new Date().toISOString(),
                submittedDate: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await onSave(response);
            onClose();
            toast.success('Évaluation enregistrée avec succès');
        } catch (error) {
            ErrorLogger.error(error, 'SupplierAssessmentModal.handleSubmit');
            toast.error("Erreur lors de l'enregistrement");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-brand-600" />
                            Évaluation DORA : {supplierName}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Section {currentStep + 1}/{sections.length} : {currentSection.title}
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-bold text-brand-600">{calculateScore()}%</span>
                        <p className="text-xs text-slate-400">Score actuel</p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full">
                    <div
                        className="h-full bg-brand-600 transition-all duration-300 ease-out"
                        style={{ width: `${((currentStep + 1) / sections.length) * 100}%` }}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6">
                        <p className="text-sm text-blue-700 dark:text-blue-300 flex gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            Répondez honnêtement aux questions ci-dessous pour évaluer le niveau de conformité du fournisseur.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {currentSection.questions.map((q) => (
                            <div key={q.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-800 transition-colors">
                                <div className="flex justify-between gap-4 mb-3">
                                    <div>
                                        <h3 className="font-medium text-slate-900 dark:text-white text-sm md:text-base">{q.text}</h3>
                                        {q.helperText && <p className="text-xs text-slate-500 mt-1">{q.helperText}</p>}
                                    </div>
                                    {q.weight > 5 && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 shrink-0 h-fit uppercase tracking-wider">
                                            Critique
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAnswer(q.id, true)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
                                            ${answers[q.id]?.value === true
                                                ? 'bg-green-600 text-white shadow-md shadow-green-500/20 ring-2 ring-green-600 ring-offset-2 dark:ring-offset-slate-900'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >
                                        <Check className="w-4 h-4" />
                                        Oui
                                    </button>
                                    <button
                                        onClick={() => handleAnswer(q.id, false)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
                                            ${answers[q.id]?.value === false
                                                ? 'bg-red-600 text-white shadow-md shadow-red-500/20 ring-2 ring-red-600 ring-offset-2 dark:ring-offset-slate-900'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >
                                        Non
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <Button
                        variant="ghost"
                        onClick={currentStep === 0 ? onClose : handleBack}
                        disabled={isSubmitting}
                    >
                        {currentStep === 0 ? 'Annuler' : (
                            <>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Précédent
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleNext}
                        disabled={isSubmitting}
                        className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20"
                    >
                        {currentStep === sections.length - 1 ? (
                            isSubmitting ? 'Enregistrement...' : 'Terminer l\'évaluation'
                        ) : (
                            <>
                                Suivant
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
