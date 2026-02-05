import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Questionnaire, QuestionnaireResponse } from '../../types';
import { Save, CheckCircle2, Link, Bot, FileText, Loader2 } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { FileUploader } from '../ui/FileUploader';
import { aiService } from '../../services/aiService';
import { sanitizeData } from '../../utils/dataSanitizer';
import { SafeHTML } from '../ui/SafeHTML';
import { useAuditsActions } from '../../hooks/audits/useAuditsActions';
import { serverTimestamp } from 'firebase/firestore';

interface QuestionnaireResponseProps {
 questionnaire: Questionnaire;
 onClose: () => void;
 readOnly?: boolean;
}

export const QuestionnaireResponseView: React.FC<QuestionnaireResponseProps> = ({ questionnaire, onClose, readOnly = false }) => {
 const { user, addToast, t } = useStore();
 const { responses, addResponse, updateResponse, addDocument } = useAuditsActions();
 const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({});
 const [responseId, setResponseId] = useState<string | null>(null);
 const [status, setStatus] = useState<'In Progress' | 'Submitted'>('In Progress');
 const [saving, setSaving] = useState(false);
 const [evidence, setEvidence] = useState<Record<string, string[]>>({});
 const [openEvidenceQuestionId, setOpenEvidenceQuestionId] = useState<string | null>(null);
 const [analyzing, setAnalyzing] = useState(false);
 const [analysis, setAnalysis] = useState<string | null>(null);

 // Find existing response if any
 const existingResponse = useMemo(() => {
 if (!user) return null;
 return responses.find(r => r.questionnaireId === questionnaire.id && r.respondentId === user.uid);
 }, [responses, questionnaire.id, user]);

 // Sync state with existing response
 useEffect(() => {
 if (existingResponse) {
 setAnswers(existingResponse.answers);
 setEvidence(existingResponse.evidence || {});
 setAnalysis(existingResponse.aiAnalysis || null);
 setResponseId(existingResponse.id);
 setStatus(existingResponse.status);
 }
 }, [existingResponse]);

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
 addToast(t('audits.toast.answerRequiredQuestions', { defaultValue: `Veuillez répondre à toutes les questions obligatoires (${missingRequired.length} restantes)`, count: missingRequired.length }), "info");
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
 submittedAt: submit ? serverTimestamp() as unknown as string : undefined
 };

 if (responseId) {
 await updateResponse(responseId, sanitizeData(responseData));
 } else {
 const newResponseId = await addResponse(sanitizeData({
  ...responseData,
  questionnaireId: questionnaire.id,
  organizationId: questionnaire.organizationId,
  auditId: questionnaire.auditId,
  respondentId: user.uid,
  respondentEmail: user.email,
  startedAt: serverTimestamp() as unknown as string
 }) as QuestionnaireResponse);
 setResponseId(newResponseId || null);
 }

 if (submit) {
 setStatus('Submitted');
 addToast(t('audits.toast.questionnaireSubmitted', { defaultValue: "Questionnaire soumis avec succès" }), "success");
 onClose();
 } else {
 addToast(t('audits.toast.draftSaved', { defaultValue: "Brouillon enregistré" }), "info");
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
 const docId = await addDocument(sanitizeData({
 title: `Preuve Questionnaire - ${fileName} `,
 type: 'Preuve',
 version: '1.0',
 status: 'Publié',
 url: url,
 organizationId: questionnaire.organizationId,
 owner: user.displayName || user.email,
 ownerId: user.uid,
 relatedAuditIds: [questionnaire.auditId]
 }));

 if (docId) {
 setEvidence(prev => ({
  ...prev,
  [questionId]: [...(prev[questionId] || []), docId]
 }));
 }

 addToast(t('audits.toast.evidenceAdded', { defaultValue: "Preuve ajoutée" }), "success");
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

 addToast(t('audits.toast.aiAnalysisComplete', { defaultValue: "Analyse IA terminée" }), "success");
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
  aria-label={isOpen ? "Masquer les preuves" : "Afficher et gérer les preuves"}
  onClick={() => setOpenEvidenceQuestionId(isOpen ? null : questionId)}
  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center hover:underline"
 >
  <Link className="h-3 w-3 mr-1" />
  {isOpen ? 'Masquer les preuves' : `Gérer les preuves(${fileIds.length})`}
 </button>

 {isOpen && (
  <div className="mt-2 p-3 bg-muted/50 dark:bg-white/5 rounded-3xl border border-dashed border-border/40">
  <div className="mb-3 space-y-1">
  {fileIds.length > 0 ? (
  fileIds.map((fid, idx) => (
   <div key={fid || 'unknown'} className="flex items-center text-xs text-muted-foreground">
   <FileText className="h-3 w-3 mr-2" />
   Preuve #{idx + 1} (ID: {fid.substring(0, 8)}...)
   </div>
  ))
  ) : (
  <p className="text-xs text-muted-foreground italic">Aucune preuve jointe.</p>
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
  className="w-full px-4 py-3 rounded-3xl border-border/40 bg-white dark:bg-black/20 focus:ring-2 focus-visible:ring-primary outline-none transition-all min-h-[100px]"
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
  <label key={opt || 'unknown'} className={`flex - 1 cursor - pointer p - 4 rounded - xl border transition - all ${value === opt ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border/40 hover:border-primary/40'} `}>
  <input value={opt} checked={value === opt} onChange={() => handleAnswerChange(question.id, opt)}
   type="radio"
   name={question.id}
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
  <label key={opt || 'unknown'} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 dark:hover:bg-white/5 cursor-pointer">
  <input value={opt} checked={value === opt} onChange={() => handleAnswerChange(question.id, opt)}
   type="radio"
   name={question.id}
   className="text-primary focus-visible:ring-primary"
   disabled={readOnly || status === 'Submitted'}
  />
  <span className="text-foreground">{opt}</span>
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
  <label key={opt || 'unknown'} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 dark:hover:bg-white/5 cursor-pointer">
   <input checked={isChecked} onChange={(e) => {
   const newValues = e.target.checked
   ? [...currentValues, opt]
   : currentValues.filter(v => v !== opt);
   handleAnswerChange(question.id, newValues);
   }}
   type="checkbox"
   className="rounded border-border/40 text-primary focus-visible:ring-primary"
   disabled={readOnly || status === 'Submitted'}
   />
   <span className="text-foreground">{opt}</span>
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
  key={rating || 'unknown'}
  aria-label={`Note ${rating} sur 5`}
  onClick={() => handleAnswerChange(question.id, rating)}
  disabled={readOnly || status === 'Submitted'}
  className={`w - 10 h - 10 rounded - full font - bold transition - all ${value === rating
   ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
   : 'bg-muted text-muted-foreground hover:bg-muted'
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
 <div className="fixed inset-0 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] z-modal flex items-center justify-center p-4">
 <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
 {/* Header */}
 <div className="p-6 border-b border-border/40 flex justify-between items-center bg-muted/50">
  <div>
  <h2 className="text-xl font-bold text-foreground">{questionnaire.title}</h2>
  {questionnaire.description && (
  <p className="text-sm text-muted-foreground mt-1">{questionnaire.description}</p>
  )}
  </div>
  {status === 'Submitted' && (
  <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 rounded-full text-xs font-bold flex items-center">
  <CheckCircle2 className="w-4 h-4 mr-1" />
  Soumis
  </div>
  )}
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6 space-y-6 sm:space-y-8">
  {questionnaire.questions.map((q, index) => (
  <div key={q.id || 'unknown'} className="space-y-3">
  <div className="flex items-start justify-between">
  <label className="text-base font-bold text-foreground">
   <span className="text-muted-foreground mr-2">{index + 1}.</span>
   {q.text}
   {q.required && <span className="text-destructive ml-1">*</span>}
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
 <div className="p-6 border-t border-border/40 bg-muted/50 flex justify-end gap-3">
  <button
  aria-label="Fermer la vue questionnaire"
  onClick={onClose}
  className="px-4 py-2 text-muted-foreground font-bold hover:bg-muted dark:hover:bg-white/5 rounded-3xl transition-colors"
  >
  Fermer
  </button>
  {!readOnly && status !== 'Submitted' && (
  <>
  <button
  aria-label="Enregistrer le brouillon"
  onClick={() => handleSave(false)}
  disabled={saving}
  className="px-4 py-2 text-primary font-bold hover:bg-primary/10 dark:hover:bg-white/5 rounded-3xl transition-colors"
  >
  Enregistrer brouillon
  </button>
  <button
  aria-label="Lancer l'analyse IA"
  onClick={runAIAnalysis} // This should probably be enabled even if readOnly? Or mainly for Auditor?
  // Let's simplify: View AI button if answers exist.
  disabled={analyzing}
  className="px-4 py-2 text-indigo-600 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-3xl transition-colors flex items-center"
  >
  {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bot className="w-4 h-4 mr-2" />}
  {analysis ? 'Relancer IA' : 'Analyser'}
  </button>
  <button
  aria-label="Soumettre le questionnaire"
  onClick={() => handleSave(true)}
  disabled={saving}
  className="flex items-center px-6 py-2 bg-primary text-primary-foreground rounded-3xl font-bold hover:bg-primary/90 transition-colors disabled:bg-muted disabled:text-muted-foreground"
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
