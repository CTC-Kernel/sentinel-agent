import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Save, Check, ChevronRight, ChevronLeft, AlertCircle } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { Button } from '../ui/button';
import { useSupplierDependencies } from '../../hooks/suppliers/useSupplierDependencies';
import { motion, AnimatePresence } from 'framer-motion';
import { SupplierService } from '../../services/SupplierService';

interface Props {
 responseId: string;
 onClose: () => void;
 context?: 'supplier' | 'privacy';
}

interface AssessmentAnswer {
 value: string | number | boolean | string[];
 notes?: string;
 evidence?: string[];
}

export const AssessmentView: React.FC<Props> = ({ responseId, onClose }) => {
 const { addToast, user, t } = useStore();
 const { templates, assessments, loading: hookLoading, updateAssessment } = useSupplierDependencies({
 fetchTemplates: true,
 fetchAssessments: true
 });

 // Derive data
 const response = useMemo(() => assessments.find(a => a.id === responseId), [assessments, responseId]);
 const template = useMemo(() => templates.find(t => t.id === response?.templateId), [templates, response]);

 // Local state for answers
 const [localAnswers, setLocalAnswers] = useState<Record<string, AssessmentAnswer>>({});
 const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
 const [isSaving, setIsSaving] = useState(false);

 // Sync state with loaded response
 useEffect(() => {
 if (response?.answers) {
 setLocalAnswers(response.answers);
 }
 }, [response]);

 if (hookLoading) {
 return (
 <div className="flex items-center justify-center h-full">
 <span className="loading loading-spinner text-primary"></span>
 <span className="ml-2 text-muted-foreground">Chargement de l'évaluation...</span>
 </div>
 );
 }

 if (!template || !response) {
 return (
 <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
 <AlertCircle className="w-12 h-12 mb-4 text-muted-foreground" />
 <p>Évaluation ou modèle introuvable.</p>
 <Button variant="ghost" onClick={onClose} className="mt-4">Retour</Button>
 </div>
 );
 }

 const currentSection = template.sections[currentSectionIndex];

 const handleAnswerChange = (questionId: string, value: AssessmentAnswer['value']) => {
 setLocalAnswers(prev => ({
 ...prev,
 [questionId]: {
 ...prev[questionId],
 value
 }
 }));
 };

 const handleSave = async (submit = false) => {
 if (!response || !template) return;
 setIsSaving(true);
 try {
 // Calculate real-time score
 const currentResponse = { ...response, answers: localAnswers };
 const { overallScore } = SupplierService.calculateScore(currentResponse, template);

 await updateAssessment(response.id, {
 answers: localAnswers,
 status: submit ? 'Submitted' : 'In Progress',
 overallScore: overallScore
 });

 if (submit) {
 // Ensure user context is passed
 if (user) {
  await SupplierService.updateSupplierRiskFromAssessment(response.supplierId, overallScore, {
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  organizationId: user.organizationId
  });
 } else {
  // Fallback if user is somehow missing (should not happen in protected view)
  ErrorLogger.warn('User context missing during assessment submission', 'AssessmentView.handleSave');
  // We might still want to update risk, but logging will fail or be skipped.
  // The service method now REQUIRES user. 
  // I should probably throw or handle this.
  // But given `user` comes from `useStore`, it should be there.
 }

 addToast(t('suppliers.toast.assessmentSubmittedWithScore', { defaultValue: `Évaluation soumise. Score : ${overallScore}/100` }), 'success');
 onClose();
 } else {
 addToast(t('suppliers.toast.draftSaved', { defaultValue: 'Brouillon sauvegardé' }), 'success');
 }
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'AssessmentView.save', 'UPDATE_FAILED');
 } finally {
 setIsSaving(false);
 }
 };

 const calculateProgress = () => {
 const totalQuestions = template.sections.reduce((acc, s) => acc + s.questions.length, 0);
 const questionsIds = template.sections.flatMap(s => s.questions.map(q => q.id));
 const answeredCount = questionsIds.filter(id => {
 const answer = localAnswers[id];
 return answer && (answer.value !== undefined && answer.value !== '');
 }).length;

 if (totalQuestions === 0) return 0;
 return Math.round((answeredCount / totalQuestions) * 100);
 };

 return (
 <div className="flex h-full bg-muted">
 {/* Sidebar Navigation */}
 <aside className="w-64 bg-card border-r border-border/40 flex flex-col hidden lg:flex">
 <div className="p-6 border-b border-border/40">
  <h3 className="font-bold text-foreground dark:text-white truncate" title={template.title}>{template.title}</h3>
  <div className="mt-4">
  <div className="flex justify-between text-xs text-muted-foreground mb-1">
  <span>Progression</span>
  <span>{calculateProgress()}%</span>
  </div>
  <div className="w-full bg-muted rounded-full h-2">
  <div
  className="bg-primary h-2 rounded-full transition-all duration-500"
  style={{ width: `${calculateProgress()}%` }}
  />
  </div>
  </div>
 </div>
 <nav className="flex-1 overflow-y-auto p-4 space-y-1">
  {template.sections.map((section, idx) => (
  <button
  key={section.id || idx}
  onClick={() => setCurrentSectionIndex(idx)}
  className={`w-full text-left px-4 py-3 rounded-3xl text-sm font-medium transition-colors ${currentSectionIndex === idx
  ? 'bg-primary/10 dark:bg-primary text-primary dark:text-primary/50'
  : 'text-muted-foreground hover:bg-muted/50'
  }`}
  >
  <div className="flex items-center">
  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 ${currentSectionIndex === idx ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground '
   }`}>
   {idx + 1}
  </span>
  <span className="truncate">{section.title}</span>
  </div>
  </button>
  ))}
 </nav>
 </aside>

 {/* Main Content */}
 <main className="flex-1 flex flex-col min-w-0">
 {/* Header */}
 <header className="bg-card border-b border-border/40 p-4 flex justify-between items-center shadow-sm z-decorator">
  <div className="flex items-center lg:hidden">
  <span className="font-bold text-foreground truncate max-w-[150px]">{currentSection?.title}</span>
  </div>
  <div className="hidden lg:block text-sm text-muted-foreground">
  {response.supplierName} • <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${response.status === 'Submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{response.status || 'Brouillon'}</span>
  </div>

  <div className="flex gap-3">
  <Button variant="ghost" onClick={() => handleSave(false)} disabled={isSaving}>
  <Save className="w-4 h-4 mr-2" />
  Sauvegarder
  </Button>
  <Button variant="default" onClick={() => handleSave(true)} disabled={isSaving}>
  <Check className="w-4 h-4 mr-2" />
  Soumettre
  </Button>
  </div>
 </header>

 {/* Content Area */}
 <div className="flex-1 overflow-y-auto p-6 lg:p-10">
  <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
  <AnimatePresence mode="popLayout">
  <motion.div
  key={currentSectionIndex || 'unknown'}
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2 }}
  >
  <div className="mb-8">
   <h2 className="text-2xl font-bold text-foreground mb-2">{currentSection?.title}</h2>
   {currentSection?.description && (
   <p className="text-muted-foreground">{currentSection.description}</p>
   )}
  </div>

  <div className="space-y-6">
   {currentSection?.questions.map((question) => (
   <div key={question.id || 'unknown'} className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm relative overflow-hidden">
   <label htmlFor={`assessment-question-${question.id}`} className="block text-base font-semibold text-foreground mb-2">
   {question.text}
   {question.required && <span className="text-destructive ml-1">*</span>}
   </label>
   {question.helperText && (
   <p className="text-sm text-muted-foreground mb-4">{question.helperText}</p>
   )}

   {/* Input Types */}
   {question.type === 'text' ? (
   <textarea
    id={`assessment-question-${question.id}`}
    className="w-full p-3 rounded-3xl border border-border/40 bg-muted focus:ring-2 focus-visible:ring-primary focus:border-transparent outline-none transition-all min-h-[120px]"
    placeholder="Votre réponse..."
    value={(localAnswers[question.id]?.value as string) || ''}
    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
   />
   ) : question.type === 'yes_no' ? (
   <div className="flex gap-4" id={`assessment-question-${question.id}`} role="group" aria-label={question.text}>
    <button
    type="button"
    onClick={() => handleAnswerChange(question.id, 'Yes')}
    className={`px-4 py-2 rounded-lg border flex-1 transition-colors ${localAnswers[question.id]?.value === 'Yes'
    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 font-medium'
    : 'border-border/40 hover:bg-muted text-muted-foreground'
    }`}
    >
    Oui
    </button>
    <button
    type="button"
    onClick={() => handleAnswerChange(question.id, 'No')}
    className={`px-4 py-2 rounded-lg border flex-1 transition-colors ${localAnswers[question.id]?.value === 'No'
    ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-medium'
    : 'border-border/40 hover:bg-muted text-muted-foreground'
    }`}
    >
    Non
    </button>
   </div>
   ) : (
   <input
    id={`assessment-question-${question.id}`}
    type={question.type === 'rating' ? 'number' : 'text'}
    className="w-full p-3 rounded-3xl border border-border/40 bg-muted focus:ring-2 focus-visible:ring-primary focus:border-transparent outline-none transition-all"
    placeholder="Votre réponse..."
    value={(localAnswers[question.id]?.value as string) || ''}
    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
   />
   )}
   </div>
   ))}
   {(!currentSection?.questions || currentSection.questions.length === 0) && (
   <div className="text-center p-8 text-muted-foreground italic bg-card rounded-2xl border border-dashed border-border/40">
   Aucune question dans cette section.
   </div>
   )}
  </div>
  </motion.div>
  </AnimatePresence>
  </div>
 </div>

 {/* Footer Navigation */}
 <div className="bg-card p-4 border-t border-border/40 flex justify-between items-center z-decorator">
  <Button
  variant="ghost"
  onClick={() => setCurrentSectionIndex(prev => Math.max(0, prev - 1))}
  disabled={currentSectionIndex === 0}
  className={currentSectionIndex === 0 ? 'invisible' : ''}
  >
  <ChevronLeft className="w-4 h-4 mr-2" />
  Précédent
  </Button>

  <div className="flex gap-2">
  {/* Optional dots or page indicators can act as pagination */}
  </div>

  {currentSectionIndex < template.sections.length - 1 ? (
  <Button
  variant="premium"
  onClick={() => setCurrentSectionIndex(prev => Math.min(template.sections.length - 1, prev + 1))}
  >
  Suivant
  <ChevronRight className="w-4 h-4 ml-2" />
  </Button>
  ) : (
  <Button
  variant="default"
  onClick={() => handleSave(true)}
  className="bg-green-600 hover:bg-green-700 text-white"
  >
  Terminer et Soumettre
  <Check className="w-4 h-4 ml-2" />
  </Button>
  )}
 </div>
 </main>
 </div>
 );
};
