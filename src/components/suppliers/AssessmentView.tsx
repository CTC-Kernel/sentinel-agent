import React, { useState, useEffect, useMemo } from 'react';
import { SupplierQuestionnaireResponse } from '../../types/business';
import { useStore } from '../../store';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Save, Check, ChevronRight } from '../ui/Icons';
import { SupplierService } from '../../services/SupplierService';
import { ErrorLogger } from '../../services/errorLogger';
import { useSuppliersData } from '../../hooks/suppliers/useSuppliersData';

interface Props {
    responseId: string;
    onClose: () => void;
    context?: 'supplier' | 'privacy';
}

export const AssessmentView: React.FC<Props> = ({ responseId, onClose, context = 'supplier' }) => {
    const { user, addToast } = useStore();
    const { templates, assessments, loading: hookLoading } = useSuppliersData(user?.organizationId);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, { value: string | boolean | number | string[], comment?: string, evidenceUrl?: string }>>({});

    // Find the response by ID
    const response = useMemo(() => {
        return assessments.find(a => a.id === responseId) || null;
    }, [assessments, responseId]);

    // Find the template for this response
    const template = useMemo(() => {
        if (!response) return null;
        return templates.find(t => t.id === response.templateId) || null;
    }, [templates, response]);

    // Sync answers from response when it loads
    useEffect(() => {
        if (response) {
            setAnswers(response.answers || {});
        }
    }, [response]);

    const handleSave = async (submit = false) => {
        if (!response || !template) return;

        // Validation before submission
        if (submit) {
            const missingRequired = [];
            for (const section of template.sections) {
                for (const q of section.questions) {
                    // Check if question is required (default to false if undefined, though usually true by default for new questions)
                    if (q.required) {
                        const answer = answers[q.id]?.value;
                        const isValid = answer !== undefined && answer !== null && answer !== '';
                        if (!isValid) {
                            missingRequired.push(q.text);
                        }
                    }
                }
            }

            if (missingRequired.length > 0) {
                addToast(`Veuillez répondre aux questions obligatoires (${missingRequired.length} restantes)`, 'error');
                return;
            }
        }

        try {
            // Calculate Score (Real-time update)
            const simulatedResponse = { ...response, answers };
            const { overallScore, sectionScores } = SupplierService.calculateScore(simulatedResponse, template);

            const updates: Partial<SupplierQuestionnaireResponse> = {
                answers,
                overallScore,
                sectionScores,
                status: submit ? 'Submitted' : 'In Progress',
                updatedAt: new Date().toISOString() // Assuming field exists or we add it
            };

            if (submit) {
                updates.submittedDate = new Date().toISOString();
                // Update Supplier Risk Level ONLY if in supplier context
                if (context === 'supplier') {
                    await SupplierService.updateSupplierRiskFromAssessment(response.supplierId, overallScore);
                }
            }

            await updateDoc(doc(db, 'questionnaire_responses', responseId), updates);

            addToast(submit ? 'Évaluation soumise' : 'Sauvegardé', 'success');
            if (submit) onClose();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AssessmentView.handleSave', 'UPDATE_FAILED');
        }
    };

    if (hookLoading || !template || !response) return <div className="p-8 text-center"><span className="loading loading-spinner"></span> Chargement...</div>;

    const currentSection = template.sections[currentSectionIndex];

    return (
        <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                <div>
                    <h2 className="text-xl font-bold dark:text-white">{template.title}</h2>
                    <p className="text-sm text-slate-500">{response.supplierName} - {response.status}</p>
                </div>
                <div className="flex gap-3">
                    <button aria-label="Sauvegarder les modifications" onClick={() => handleSave(false)} className="flex items-center px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:opacity-80">
                        <Save className="w-4 h-4 mr-2" />
                        Sauvegarder
                    </button>
                    <button aria-label="Soumettre l'évaluation" onClick={() => handleSave(true)} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">
                        <Check className="w-4 h-4 mr-2" />
                        Soumettre
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4 flex flex-col gap-2">
                    {template.sections.map((section, idx) => (
                        <button
                            key={section.id}
                            aria-label={`Aller à la section ${section.title}`}
                            onClick={() => setCurrentSectionIndex(idx)}
                            className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentSectionIndex === idx
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <div className="flex justify-between items-center">
                                <span>{idx + 1}. {section.title}</span>
                                {response.sectionScores && response.sectionScores[section.id] !== undefined && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${response.sectionScores[section.id] >= 80 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                        {response.sectionScores[section.id]}%
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-center text-slate-400">Score Global</p>
                        <div className="text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400 mt-1">
                            {response.overallScore || 0}%
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-3xl mx-auto space-y-8">
                        <div className="mb-6">
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{currentSection.title}</h3>
                            {currentSection.description && <p className="text-slate-500">{currentSection.description}</p>}
                        </div>

                        {currentSection.questions.map((q) => (
                            <div key={q.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                                <div className="mb-4">
                                    <h4 className="font-semibold text-slate-900 dark:text-white text-lg">{q.text}</h4>
                                    {q.helperText && <p className="text-sm text-slate-400 mt-1">{q.helperText}</p>}
                                </div>

                                <div className="space-y-4">
                                    {/* Input Types */}
                                    {q.type === 'yes_no' && (
                                        <div className="flex gap-4">
                                            {['Oui', 'Non', 'N/A'].map(opt => {
                                                const val = opt === 'Oui' ? true : opt === 'Non' ? false : 'N/A';
                                                const currentVal = answers[q.id]?.value;
                                                const isSelected = (val === true && currentVal === true) || (val === false && currentVal === false) || (val === 'N/A' && currentVal === 'N/A');

                                                return (
                                                    <button
                                                        key={opt}
                                                        aria-label={`Sélectionner ${opt}`}
                                                        aria-pressed={isSelected}
                                                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], value: val } }))}
                                                        className={`px-6 py-2 rounded-lg border font-medium transition-all ${isSelected
                                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-600 hover:border-indigo-300'
                                                            }`}
                                                    >
                                                        {opt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {q.type === 'text' && (
                                        <textarea
                                            value={answers[q.id]?.value as string || ''}
                                            onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], value: e.target.value } }))}
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            rows={3}
                                            placeholder="Votre réponse..."
                                        />
                                    )}

                                    {q.type === 'rating' && (
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map(rating => (
                                                <button
                                                    key={rating}
                                                    aria-label={`Noter ${rating} sur 5`}
                                                    aria-pressed={answers[q.id]?.value === rating}
                                                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], value: rating } }))}
                                                    className={`w-10 h-10 rounded-lg font-bold flex items-center justify-center transition-all ${answers[q.id]?.value === rating
                                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    {rating}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Comments / Evidence */}
                                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700">
                                        <input
                                            type="text"
                                            placeholder="Ajouter un commentaire ou lien de preuve..."
                                            value={answers[q.id]?.comment || ''}
                                            onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { ...prev[q.id], comment: e.target.value } }))}
                                            className="w-full text-sm bg-transparent border-none focus:ring-0 px-0 text-slate-500 placeholder-slate-400"
                                            aria-label="Ajouter un commentaire"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-end pt-4">
                            {currentSectionIndex < template.sections.length - 1 ? (
                                <button
                                    aria-label="Passer à la section suivante"
                                    onClick={() => setCurrentSectionIndex(prev => prev + 1)}
                                    className="flex items-center px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-lg"
                                >
                                    Suivant
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </button>
                            ) : (
                                <div className="text-center w-full p-4 bg-green-50 text-green-800 rounded-xl border border-green-200">
                                    Vous avez atteint la dernière section. Pensez à soumettre !
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
