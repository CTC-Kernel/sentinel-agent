import React, { useState, useEffect } from 'react';
import { SupplierQuestionnaireResponse, QuestionnaireTemplate } from '../../types/business';
import { useStore } from '../../store';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Save, Check, ChevronRight } from '../ui/Icons';
import { SupplierService } from '../../services/SupplierService';

interface Props {
    responseId: string;
    onClose: () => void;
    context?: 'supplier' | 'privacy';
}

export const AssessmentView: React.FC<Props> = ({ responseId, onClose, context = 'supplier' }) => {
    const { addToast } = useStore();
    const [response, setResponse] = useState<SupplierQuestionnaireResponse | null>(null);
    const [template, setTemplate] = useState<QuestionnaireTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, { value: string | boolean | number | string[], comment?: string, evidenceUrl?: string }>>({});

    useEffect(() => {
        const loadData = async () => {
            try {
                const resSnap = await getDoc(doc(db, 'questionnaire_responses', responseId));
                if (!resSnap.exists()) return;
                const resData = { id: resSnap.id, ...resSnap.data() } as SupplierQuestionnaireResponse;
                setResponse(resData);
                setAnswers(resData.answers || {});

                const tplSnap = await getDoc(doc(db, 'questionnaire_templates', resData.templateId));
                if (tplSnap.exists()) {
                    setTemplate({ id: tplSnap.id, ...tplSnap.data() } as QuestionnaireTemplate);
                }
            } catch (error) {
                console.error(error);
                addToast('Erreur de chargement', 'error');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [responseId, addToast]);

    const handleSave = async (submit = false) => {
        if (!response || !template) return;

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

            // Update local state to reflect changes immediately in UI
            setResponse(prev => prev ? ({ ...prev, ...updates } as SupplierQuestionnaireResponse) : null);

            addToast(submit ? 'Évaluation soumise' : 'Sauvegardé', 'success');
            if (submit) onClose();
        } catch (error) {
            console.error(error);
            addToast('Erreur sauvegarde', 'error');
        }
    };

    if (loading || !template || !response) return <div className="p-8 text-center"><span className="loading loading-spinner"></span> Chargement...</div>;

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
                    <button onClick={() => handleSave(false)} className="flex items-center px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:opacity-80">
                        <Save className="w-4 h-4 mr-2" />
                        Sauvegarder
                    </button>
                    <button onClick={() => handleSave(true)} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">
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
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-end pt-4">
                            {currentSectionIndex < template.sections.length - 1 ? (
                                <button
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
