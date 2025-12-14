import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Questionnaire, QuestionnaireResponse } from '../../types';
import { addDoc, collection, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Save, CheckCircle2, Link, Bot, FileText, Loader2 } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { FileUploader } from '../ui/FileUploader';
import { aiService } from '../../services/aiService';
import { sanitizeData } from '../../utils/dataSanitizer';
import { SafeHTML } from '../ui/SafeHTML';

interface QuestionnaireResponseProps {
    questionnaire: Questionnaire;
    onClose: () => void;
    readOnly?: boolean;
}

export const QuestionnaireResponseView: React.FC<QuestionnaireResponseProps> = ({ questionnaire, onClose, readOnly = false }) => {
    const { user, addToast } = useStore();
    const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({});
    const [responseId, setResponseId] = useState<string | null>(null);
    const [status, setStatus] = useState<'In Progress' | 'Submitted'>('In Progress');
    const [saving, setSaving] = useState(false);
    const [evidence, setEvidence] = useState<Record<string, string[]>>({});
    const [openEvidenceQuestionId, setOpenEvidenceQuestionId] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);

    // Load existing response if any
    useEffect(() => {
        const loadResponse = async () => {
            if (!user) return;
            try {
                const q = query(
                    collection(db, 'questionnaire_responses'),
                    where('questionnaireId', '==', questionnaire.id),
                    where('respondentId', '==', user.uid)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data() as QuestionnaireResponse;
                    setAnswers(data.answers);
                    setEvidence(data.evidence || {});
                    setAnalysis(data.aiAnalysis || null);
                    setResponseId(snapshot.docs[0].id);
                    setStatus(data.status);
                }
            } catch (error) {
                ErrorLogger.error(error, 'QuestionnaireResponseView.loadResponse');
            }
        };
        loadResponse();
    }, [questionnaire.id, user]);

    const handleAnswerChange = (questionId: string, value: string | string[] | number) => {
        if (readOnly || status === 'Submitted') return;
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleSave = async (submit = false) => {
        if (!user) return;

        // Validation for submission
        if (submit) {
            const missingRequired = questionnaire.questions.filter(q => q.required && !answers[q.id]);
            if (missingRequired.length > 0) {
                addToast(`Veuillez répondre à toutes les questions obligatoires(${missingRequired.length} restantes)`, "info");
                return;
            }
        }

        setSaving(true);
        try {
            const responseData: Partial<QuestionnaireResponse> = {
                answers,
                status: submit ? 'Submitted' : 'In Progress',

                // answers already included in 75
                evidence,
                aiAnalysis: analysis || undefined,
                updatedAt: new Date().toISOString(),
                submittedAt: submit ? new Date().toISOString() : undefined
            };

            if (responseId) {
                await updateDoc(doc(db, 'questionnaire_responses', responseId), sanitizeData(responseData));
            } else {
                const docRef = await addDoc(collection(db, 'questionnaire_responses'), sanitizeData({
                    ...responseData,
                    questionnaireId: questionnaire.id,
                    organizationId: questionnaire.organizationId,
                    auditId: questionnaire.auditId,
                    respondentId: user.uid,
                    respondentEmail: user.email,
                    startedAt: new Date().toISOString()
                }) as QuestionnaireResponse);
                setResponseId(docRef.id);
            }

            if (submit) {
                setStatus('Submitted');
                addToast("Questionnaire soumis avec succès", "success");
                onClose();
            } else {
                addToast("Brouillon enregistré", "info");
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'QuestionnaireResponseView.handleSave', 'UPDATE_FAILED');
        } finally {
            setSaving(false);
        }
    };

    const handleEvidenceUpload = async (questionId: string, url: string, fileName: string) => {
        if (!user) return;
        try {
            // Create Document
            const docRef = await addDoc(collection(db, 'documents'), sanitizeData({
                title: `Preuve Questionnaire - ${fileName} `,
                type: 'Preuve',
                version: '1.0',
                status: 'Publié',
                url: url,
                organizationId: questionnaire.organizationId,
                owner: user.displayName || user.email,
                ownerId: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                relatedAuditIds: [questionnaire.auditId]
            }));

            setEvidence(prev => ({
                ...prev,
                [questionId]: [...(prev[questionId] || []), docRef.id]
            }));

            addToast("Preuve ajoutée", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'QuestionnaireResponse.evidenceUpload');
        }
    };

    const runAIAnalysis = async () => {
        if (!user) return;
        setAnalyzing(true);
        try {
            // Construct prompt context
            const context = {
                title: questionnaire.title,
                description: questionnaire.description,
                questions: questionnaire.questions.map(q => ({
                    text: q.text,
                    answer: answers[q.id],
                    hasEvidence: (evidence[q.id]?.length || 0) > 0
                }))
            };

            const evaluation = await aiService.evaluateQuestionnaire(context);
            setAnalysis(evaluation);

            addToast("Analyse IA terminée", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'QuestionnaireResponse.aiAnalysis');
        } finally {
            setAnalyzing(false);
        }
    };

    const renderEvidenceSection = (questionId: string) => {
        const fileIds = evidence[questionId] || [];
        const isOpen = openEvidenceQuestionId === questionId;

        return (
            <div className="mt-3">
                <button
                    onClick={() => setOpenEvidenceQuestionId(isOpen ? null : questionId)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center hover:underline"
                >
                    <Link className="h-3 w-3 mr-1" />
                    {isOpen ? 'Masquer les preuves' : `Gérer les preuves(${fileIds.length})`}
                </button>

                {isOpen && (
                    <div className="mt-2 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                        <div className="mb-3 space-y-1">
                            {fileIds.length > 0 ? (
                                fileIds.map((fid, idx) => (
                                    <div key={idx} className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                                        <FileText className="h-3 w-3 mr-2" />
                                        Preuve #{idx + 1} (ID: {fid.substring(0, 8)}...)
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-400 italic">Aucune preuve jointe.</p>
                            )}
                        </div>
                        {(!readOnly && status !== 'Submitted') && (
                            <FileUploader
                                onUploadComplete={(url, name) => handleEvidenceUpload(questionId, url, name)}
                                category="evidence"
                                compact={true}
                                label="Ajouter une preuve"
                            />
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderInput = (question: Questionnaire['questions'][0]) => {
        const value = answers[question.id];

        switch (question.type) {
            case 'text':
                return (
                    <textarea
                        className="w-full px-4 py-3 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-brand-500 outline-none transition-all min-h-[100px]"
                        value={value as string || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Votre réponse..."
                        disabled={readOnly || status === 'Submitted'}
                    />
                );
            case 'yes_no':
                return (
                    <div className="flex gap-4">
                        {['Oui', 'Non'].map((opt) => (
                            <label key={opt} className={`flex - 1 cursor - pointer p - 4 rounded - xl border transition - all ${value === opt ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/10 hover:border-brand-300'} `}>
                                <input
                                    type="radio"
                                    name={question.id}
                                    value={opt}
                                    checked={value === opt}
                                    onChange={() => handleAnswerChange(question.id, opt)}
                                    className="sr-only"
                                    disabled={readOnly || status === 'Submitted'}
                                />
                                <div className="text-center font-bold">{opt}</div>
                            </label>
                        ))}
                    </div>
                );
            case 'choice':
                return (
                    <div className="space-y-2">
                        {question.options?.map((opt) => (
                            <label key={opt} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                                <input
                                    type="radio"
                                    name={question.id}
                                    value={opt}
                                    checked={value === opt}
                                    onChange={() => handleAnswerChange(question.id, opt)}
                                    className="text-brand-600 focus:ring-brand-500"
                                    disabled={readOnly || status === 'Submitted'}
                                />
                                <span className="text-slate-700 dark:text-slate-200">{opt}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'multiple_choice':
                return (
                    <div className="space-y-2">
                        {question.options?.map((opt) => {
                            const currentValues = (value as string[]) || [];
                            const isChecked = currentValues.includes(opt);
                            return (
                                <label key={opt} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                            const newValues = e.target.checked
                                                ? [...currentValues, opt]
                                                : currentValues.filter(v => v !== opt);
                                            handleAnswerChange(question.id, newValues);
                                        }}
                                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        disabled={readOnly || status === 'Submitted'}
                                    />
                                    <span className="text-slate-700 dark:text-slate-200">{opt}</span>
                                </label>
                            );
                        })}
                    </div>
                );
            case 'rating':
                return (
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                                key={rating}
                                onClick={() => handleAnswerChange(question.id, rating)}
                                disabled={readOnly || status === 'Submitted'}
                                className={`w - 10 h - 10 rounded - full font - bold transition - all ${value === rating
                                    ? 'bg-brand-600 text-white scale-110 shadow-lg'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
                                    } `}
                            >
                                {rating}
                            </button>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{questionnaire.title}</h2>
                        {questionnaire.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{questionnaire.description}</p>
                        )}
                    </div>
                    {status === 'Submitted' && (
                        <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Soumis
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {questionnaire.questions.map((q, index) => (
                        <div key={q.id} className="space-y-3">
                            <div className="flex items-start justify-between">
                                <label className="text-base font-bold text-slate-800 dark:text-slate-200">
                                    <span className="text-slate-500 mr-2">{index + 1}.</span>
                                    {q.text}
                                    {q.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                            </div>
                            <div className="pl-6">
                                {renderInput(q)}
                                {renderEvidenceSection(q.id)}
                            </div>
                        </div>
                    ))}

                    {analysis && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-500/30">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 flex items-center">
                                <Bot className="h-5 w-5 mr-2" />
                                Analyse IA & Recommandations
                            </h3>
                            <SafeHTML content={analysis.replace(/\n/g, '<br/>')} className="prose-sm" />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-white/5 rounded-xl transition-colors"
                    >
                        Fermer
                    </button>
                    {!readOnly && status !== 'Submitted' && (
                        <>
                            <button
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                className="px-4 py-2 text-brand-600 font-bold hover:bg-brand-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                            >
                                Enregistrer brouillon
                            </button>
                            <button
                                onClick={runAIAnalysis} // This should probably be enabled even if readOnly? Or mainly for Auditor?
                                // Let's simplify: View AI button if answers exist.
                                disabled={analyzing}
                                className="px-4 py-2 text-indigo-600 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors flex items-center"
                            >
                                {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bot className="w-4 h-4 mr-2" />}
                                {analysis ? 'Relancer IA' : 'Analyser'}
                            </button>
                            <button
                                onClick={() => handleSave(true)}
                                disabled={saving}
                                className="flex items-center px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {saving ? 'Envoi...' : 'Soumettre'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
