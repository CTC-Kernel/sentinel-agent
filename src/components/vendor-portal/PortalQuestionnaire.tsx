/**
 * Portal Questionnaire Component
 * Main questionnaire view for vendor portal
 * Story 37-2: Vendor Self-Service Portal
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
 VendorPortalAccess,
 QuestionAnswer,
 QuestionnaireProgress,
 SaveStatus,
 calculateQuestionnaireProgress,
 canEditPortalAccess,
} from '../../types/vendorPortal';
import { EnhancedAssessmentResponse } from '../../types/vendorAssessment';
import { QuestionnaireTemplate, SupplierQuestionnaireQuestion } from '../../types/business';
import { usePortalAutoSave } from '../../hooks/usePortalAutoSave';
import { PortalSubmit } from './PortalSubmit';
import { Button } from '../ui/button';
import {
 Building2,
 ChevronLeft,
 ChevronRight,
 CheckCircle,
 AlertCircle,
 Loader2,
 FileText,
 HelpCircle,
} from '../ui/Icons';

interface PortalQuestionnaireProps {
 access: VendorPortalAccess;
 assessment: EnhancedAssessmentResponse;
 template: QuestionnaireTemplate;
 onSubmitSuccess: () => void;
}

const SaveStatusIndicator: React.FC<{ saveStatus: SaveStatus; t: (key: string, fallback: string) => string }> = ({ saveStatus, t }) => {
 switch (saveStatus) {
 case 'saving':
 return (
 <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 {t('vendorPortal.saving', 'Enregistrement...')}
 </span>
 );
 case 'saved':
 return (
 <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
 <CheckCircle className="w-3.5 h-3.5" />
 {t('vendorPortal.saved', 'Enregistré')}
 </span>
 );
 case 'error':
 return (
 <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
 <AlertCircle className="w-3.5 h-3.5" />
 {t('vendorPortal.saveError', 'Erreur de sauvegarde')}
 </span>
 );
 default:
 return null;
 }
};

export const PortalQuestionnaire: React.FC<PortalQuestionnaireProps> = ({
 access,
 assessment,
 template,
 onSubmitSuccess,
}) => {
 const { t } = useTranslation();
 const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
 const [showSubmitModal, setShowSubmitModal] = useState(false);

 const isReadOnly = !canEditPortalAccess(access);

 // Convert assessment answers to QuestionAnswer format
 const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>(() => {
 const initial: Record<string, QuestionAnswer> = {};
 if (assessment.answers) {
 Object.entries(assessment.answers).forEach(([questionId, answer]) => {
 initial[questionId] = {
 questionId,
 value: answer.value as string | number | boolean | string[],
 comment: answer.comment,
 evidenceUrl: answer.evidenceUrl,
 answeredAt: new Date().toISOString(),
 };
 });
 }
 return initial;
 });

 // Auto-save hook
 const { saveStatus, saveAnswer, lastSavedAt } = usePortalAutoSave(access.id, isReadOnly);

 // Calculate progress
 const progress = useMemo<QuestionnaireProgress>(() => {
 const sectionsForProgress = template.sections.map(s => ({
 id: s.id,
 questions: s.questions.map(q => ({ id: q.id, required: q.required })),
 }));
 return calculateQuestionnaireProgress(assessment.id!, sectionsForProgress, answers, lastSavedAt);
 }, [template.sections, answers, assessment.id, lastSavedAt]);

 const currentSection = template.sections[currentSectionIndex];

 // Handle answer change
 const handleAnswerChange = useCallback(
 (questionId: string, value: string | number | boolean | string[], comment?: string) => {
 if (isReadOnly) return;

 const answer: QuestionAnswer = {
 questionId,
 value,
 comment,
 answeredAt: new Date().toISOString(),
 };

 setAnswers((prev) => ({ ...prev, [questionId]: answer }));
 saveAnswer(questionId, answer);
 },
 [isReadOnly, saveAnswer]
 );

 // Navigation
 const goToNextSection = () => {
 if (currentSectionIndex < template.sections.length - 1) {
 setCurrentSectionIndex(currentSectionIndex + 1);
 window.scrollTo({ top: 0, behavior: 'smooth' });
 }
 };

 const goToPreviousSection = () => {
 if (currentSectionIndex > 0) {
 setCurrentSectionIndex(currentSectionIndex - 1);
 window.scrollTo({ top: 0, behavior: 'smooth' });
 }
 };

 const goToSection = (index: number) => {
 setCurrentSectionIndex(index);
 window.scrollTo({ top: 0, behavior: 'smooth' });
 };

 return (
 <div className="flex flex-col lg:flex-row gap-6">
 {/* Sidebar - Section Navigation */}
 <div className="lg:w-72 shrink-0">
 <div className="sticky top-24 bg-card rounded-3xl border border-border/40 overflow-hidden">
 {/* Header */}
 <div className="p-4 border-b border-border/40">
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
 <Building2 className="w-4 h-4" />
 {access.organizationName}
 </div>
 <h2 className="font-bold text-foreground">{template.title}</h2>
 </div>

 {/* Progress Bar */}
 <div className="p-4 border-b border-border/40">
 <div className="flex items-center justify-between text-sm mb-2">
 <span className="text-muted-foreground">
 {t('vendorPortal.progress', 'Progression')}
 </span>
 <span className="font-medium text-foreground">
 {progress.completionPercentage}%
 </span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-primary transition-all duration-300"
 style={{ width: `${progress.completionPercentage}%` }}
 />
 </div>
 <p className="text-xs text-muted-foreground mt-2">
 {progress.answeredQuestions}/{progress.totalQuestions} {t('vendorPortal.questionsAnswered', 'questions répondues')}
 </p>
 </div>

 {/* Section List */}
 <div className="p-2">
 {template.sections.map((section, index) => {
 const sectionProgress = progress.sectionProgress[index];
 const isActive = index === currentSectionIndex;
 const isComplete = sectionProgress?.isComplete;

 return (
 <button
  key={section.id || 'unknown'}
  onClick={() => goToSection(index)}
  className={`w-full text-left p-3 rounded-lg transition-colors ${
  isActive
  ? 'bg-primary/10 text-primary dark:text-white font-medium'
  : 'hover:bg-muted/50'
  }`}
 >
  <div className="flex items-start gap-3">
  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
  isComplete
  ? 'bg-green-100 text-green-600 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400'
  : 'bg-muted text-muted-foreground'
  }`}>
  {isComplete ? (
  <CheckCircle className="w-3.5 h-3.5" />
  ) : (
  <span className="text-xs font-medium">{index + 1}</span>
  )}
  </div>
  <div className="flex-1 min-w-0">
  <p className={`text-sm font-medium truncate ${
  isActive ? 'text-primary dark:text-primary/50' : 'text-foreground'
  }`}>
  {section.title}
  </p>
  <p className="text-xs text-muted-foreground mt-0.5">
  {sectionProgress?.answeredQuestions || 0}/{sectionProgress?.totalQuestions || section.questions.length} {t('vendorPortal.answered', 'répondues')}
  </p>
  </div>
  </div>
 </button>
 );
 })}
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="flex-1 min-w-0">
 {/* Section Header */}
 <div className="bg-card rounded-3xl border border-border/40 p-6 mb-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/15 dark:bg-primary flex items-center justify-center">
 <FileText className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">
  {t('vendorPortal.section', 'Section')} {currentSectionIndex + 1}/{template.sections.length}
 </p>
 <h1 className="text-xl font-bold text-foreground">
  {currentSection.title}
 </h1>
 </div>
 </div>
 <SaveStatusIndicator saveStatus={saveStatus} t={t} />
 </div>
 {currentSection.description && (
 <p className="text-muted-foreground">{currentSection.description}</p>
 )}
 {isReadOnly && (
 <div className="mt-4 flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
 <AlertCircle className="w-4 h-4" />
 <span className="text-sm">
 {t('vendorPortal.readOnlyMode', 'Ce questionnaire a été soumis et est désormais en lecture seule.')}
 </span>
 </div>
 )}
 </div>

 {/* Questions */}
 <div className="space-y-6">
 {currentSection.questions.map((question, qIndex) => (
 <QuestionCard
 key={question.id || 'unknown'}
 question={question}
 index={qIndex}
 answer={answers[question.id]}
 onChange={handleAnswerChange}
 isReadOnly={isReadOnly}
 />
 ))}
 </div>

 {/* Navigation */}
 <div className="mt-8 flex items-center justify-between">
 <Button
 variant="ghost"
 onClick={goToPreviousSection}
 disabled={currentSectionIndex === 0}
 >
 <ChevronLeft className="w-4 h-4 mr-2" />
 {t('vendorPortal.previous', 'Précédent')}
 </Button>

 {currentSectionIndex < template.sections.length - 1 ? (
 <Button onClick={goToNextSection}>
 {t('vendorPortal.next', 'Suivant')}
 <ChevronRight className="w-4 h-4 ml-2" />
 </Button>
 ) : (
 <Button
 onClick={() => setShowSubmitModal(true)}
 disabled={!progress.canSubmit || isReadOnly}
 className="bg-green-600 hover:bg-green-700 text-white"
 >
 <CheckCircle className="w-4 h-4 mr-2" />
 {t('vendorPortal.submit', 'Soumettre le questionnaire')}
 </Button>
 )}
 </div>

 {/* Submit Modal */}
 {showSubmitModal && (
 <PortalSubmit
 accessId={access.id}
 progress={progress}
 onClose={() => setShowSubmitModal(false)}
 onSuccess={onSubmitSuccess}
 />
 )}
 </div>
 </div>
 );
};

// Question Card Component
interface QuestionCardProps {
 question: SupplierQuestionnaireQuestion;
 index: number;
 answer?: QuestionAnswer;
 onChange: (questionId: string, value: string | number | boolean | string[], comment?: string) => void;
 isReadOnly: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
 question,
 index,
 answer,
 onChange,
 isReadOnly,
}) => {
 const { t } = useTranslation();
 const [showComment, setShowComment] = useState(!!answer?.comment);

 const handleValueChange = (value: string | number | boolean | string[]) => {
 onChange(question.id, value, answer?.comment);
 };

 const handleCommentChange = (comment: string) => {
 onChange(question.id, answer?.value || '', comment);
 };

 return (
 <div className="bg-card rounded-3xl border border-border/40 p-6">
 <div className="flex items-start gap-4">
 <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
 <span className="text-sm font-medium text-muted-foreground">
 {index + 1}
 </span>
 </div>
 <div className="flex-1">
 <div className="flex items-start justify-between gap-4 mb-4">
 <p className="text-foreground font-medium">
 {question.text}
 {question.required && <span className="text-destructive ml-1">*</span>}
 </p>
 {question.helperText && (
 <button
 title={question.helperText}
 className="text-muted-foreground hover:text-muted-foreground"
 >
 <HelpCircle className="w-4 h-4" />
 </button>
 )}
 </div>

 {/* Answer Input */}
 {question.type === 'yes_no' && (
 <div className="flex gap-3">
 {[
 { value: true, label: t('common.yes', 'Oui') },
 { value: false, label: t('common.no', 'Non') },
 ].map((option) => (
 <button
  key={String(option.value) || 'unknown'}
  onClick={() => !isReadOnly && handleValueChange(option.value)}
  disabled={isReadOnly}
  className={`px-6 py-2.5 rounded-lg border-2 transition-all font-medium ${
  answer?.value === option.value
  ? 'border-primary bg-primary/10 text-primary dark:bg-primary dark:text-primary/50'
  : 'border-border/40 text-muted-foreground hover:border-border/40'
  } ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
 >
  {option.label}
 </button>
 ))}
 </div>
 )}

 {question.type === 'rating' && (
 <div className="flex gap-2">
 {[1, 2, 3, 4, 5].map((rating) => (
 <button
  key={rating || 'unknown'}
  onClick={() => !isReadOnly && handleValueChange(rating)}
  disabled={isReadOnly}
  className={`w-12 h-12 rounded-lg border-2 transition-all font-medium ${
  answer?.value === rating
  ? 'border-primary bg-primary/10 text-primary dark:bg-primary dark:text-primary/50'
  : 'border-border/40 text-muted-foreground hover:border-border/40'
  } ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
 >
  {rating}
 </button>
 ))}
 </div>
 )}

 {question.type === 'multiple_choice' && question.options && (
 <div className="space-y-2">
 {question.options.map((option) => (
 <button
  key={option || 'unknown'}
  onClick={() => !isReadOnly && handleValueChange(option)}
  disabled={isReadOnly}
  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
  answer?.value === option
  ? 'border-primary bg-primary/10 text-primary dark:bg-primary dark:text-primary/50'
  : 'border-border/40 text-muted-foreground hover:border-border/40'
  } ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
 >
  {option}
 </button>
 ))}
 </div>
 )}

 {question.type === 'text' && (
 <textarea
 value={(answer?.value as string) || ''}
 onChange={(e) => handleValueChange(e.target.value)}
 disabled={isReadOnly}
 placeholder={t('vendorPortal.enterAnswer', 'Entrez votre réponse...')}
 rows={4}
 className="w-full px-4 py-3 rounded-3xl border border-border/40 bg-card text-foreground resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-border"
 />
 )}

 {/* Comment Toggle */}
 <div className="mt-4">
 {!showComment ? (
 <button
 onClick={() => setShowComment(true)}
 className="text-sm text-primary hover:text-primary dark:text-primary/70"
 >
 + {t('vendorPortal.addComment', 'Ajouter un commentaire ou une preuve')}
 </button>
 ) : (
 <div>
 <label className="block text-sm text-muted-foreground mb-2">
  {t('vendorPortal.additionalComments', 'Commentaires additionnels ou URL de preuve')}
 </label>
 <textarea
  value={answer?.comment || ''}
  onChange={(e) => handleCommentChange(e.target.value)}
  disabled={isReadOnly}
  placeholder={t('vendorPortal.commentPlaceholder', 'Ajoutez du contexte supplémentaire ou un lien vers une preuve...')}
  rows={2}
  className="w-full px-4 py-3 rounded-3xl border border-border/40 bg-card text-foreground resize-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-border"
 />
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default PortalQuestionnaire;
