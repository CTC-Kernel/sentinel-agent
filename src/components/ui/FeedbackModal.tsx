import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Bug, Lightbulb, Star, Send } from './Icons';
import { Button } from './button';
import { FormError } from './FormError';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFeedbackActions } from '../../hooks/feedback/useFeedbackActions';

interface FeedbackModalProps {
 isOpen: boolean;
 onClose: () => void;
}

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other';

const feedbackSchema = z.object({
 type: z.enum(['bug', 'feature', 'improvement', 'other']),
 title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title is too long'),
 description: z.string().min(10, 'Description is too short (min 10 characters)').max(2000, 'Description is too long'),
 priority: z.enum(['low', 'medium', 'high'])
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
 const { user, addToast, t } = useStore();
 const { addFeedback } = useFeedbackActions();
 const [mounted, setMounted] = useState(false);

 const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FeedbackFormData>({
 resolver: zodResolver(feedbackSchema),
 defaultValues: {
 type: 'feature',
 title: '',
 description: '',
 priority: 'medium'
 }
 });

 const [type, priority] = useWatch({
 control,
 name: ['type', 'priority']
 });
 const formValues = { type, priority };

 useEffect(() => {
 setTimeout(() => setMounted(true), 0);

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

 return () => setMounted(false);
 }, []);

 if (!isOpen || !mounted) return null;

 const onSubmit = async (data: FeedbackFormData) => {
 try {
 await addFeedback({
 ...data,
 userId: user?.uid || 'anonymous',
 userEmail: user?.email || 'anonymous',
 organizationId: user?.organizationId || 'unknown',
 status: 'new',
 userAgent: navigator.userAgent,
 url: window.location.href // Intentional: reading current URL for feedback context
 });

 addToast(t('feedback.toast.sent', { defaultValue: 'Merci ! Votre retour a bien été envoyé.' }), 'success');
 onClose();
 reset();
 } catch (error) {
 ErrorLogger.error(error, 'FeedbackModal.onSubmit');
 addToast(t('feedback.toast.sendError', { defaultValue: "Une erreur est survenue lors de l'envoi." }), 'error');
 }
 };

 const getTypeIcon = (feedbackType: FeedbackType) => {
 switch (feedbackType) {
 case 'bug': return <Bug className="w-4 h-4" />;
 case 'feature': return <Star className="w-4 h-4" />;
 case 'improvement': return <Lightbulb className="w-4 h-4" />;
 default: return <MessageSquare className="w-4 h-4" />;
 }
 };

 const getTypeLabel = (feedbackType: FeedbackType) => {
 switch (feedbackType) {
 case 'bug': return t('ui.feedback.types.bug', { defaultValue: 'Signaler un Bug' });
 case 'feature': return t('ui.feedback.types.feature', { defaultValue: 'Nouvelle Fonctionnalité' });
 case 'improvement': return t('ui.feedback.types.improvement', { defaultValue: 'Amélioration' });
 default: return t('ui.feedback.types.other', { defaultValue: 'Autre' });
 }
 };

 const modalContent = (
 <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] animate-fade-in" role="dialog" aria-modal="true">
 <div className="bg-card rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl shadow-black/20 dark:shadow-black/50 animate-scale-in border border-border/50">
 {/* Header */}
 <div className="p-6 border-b border-border/40 flex items-center justify-between shrink-0 bg-muted/50 rounded-t-2xl">
  <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
  <MessageSquare className="w-5 h-5 text-primary" />
  </div>
  {t('ui.feedback.title', { defaultValue: 'Votre Avis Compte' })}
  </h2>
  <Button variant="ghost" size="icon" aria-label={t('ui.feedback.closeWindow', { defaultValue: 'Fermer la fenêtre' })} onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-xl">
  <X className="w-5 h-5" />
  </Button>
 </div>

 <form id="feedback-form" onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto custom-scrollbar space-y-6 bg-card">
  {/* Type Selection */}
  <div className="grid grid-cols-2 gap-3">
  {(['feature', 'bug', 'improvement', 'other'] as FeedbackType[]).map((feedbackType) => (
  <button
  key={feedbackType || 'unknown'}
  type="button"
  aria-label={`${t('ui.feedback.typeLabel', { defaultValue: 'Type de retour' })} : ${getTypeLabel(feedbackType)}`}
  aria-pressed={formValues.type === feedbackType}
  onClick={() => setValue('type', feedbackType)}
  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${formValues.type === feedbackType
   ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/30 shadow-sm'
   : 'bg-muted/50 border-border/40 text-muted-foreground hover:bg-muted hover:border-border'
   }`}
  >
  {getTypeIcon(feedbackType)}
  {getTypeLabel(feedbackType)}
  </button>
  ))}
  </div>
  <FormError message={errors.type?.message} />

  {/* Priority (only for bugs/features) */}
  {(formValues.type === 'bug' || formValues.type === 'feature') && (
  <div className="animate-fade-in">
  <span id="priority-label" className="block text-sm font-semibold text-foreground mb-2">
  {t('ui.feedback.priority', { defaultValue: 'Priorité / Importance' })}
  </span>
  <div role="radiogroup" aria-labelledby="priority-label" className="flex gap-1 p-1 bg-muted rounded-xl border border-border/40 w-fit">
  {(['low', 'medium', 'high'] as const).map((p) => (
   <label key={p || 'unknown'} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg transition-all ${formValues.priority === p ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted'}`}>
   <input {...register('priority')}
   checked={formValues.priority === p}
   type="radio"
   value={p}
   className="hidden"
   />
   <span className={`text-sm capitalize font-semibold ${formValues.priority === p ? 'text-primary-foreground' : ''}`}>
   {p === 'low' ? t('ui.feedback.priorityLow', { defaultValue: 'Faible' }) : p === 'medium' ? t('ui.feedback.priorityMedium', { defaultValue: 'Moyenne' }) : t('ui.feedback.priorityHigh', { defaultValue: 'Haute' })}
   </span>
   </label>
  ))}
  </div>
  <FormError message={errors.priority?.message} />
  </div>
  )}

  {/* Title */}
  <div>
  <label htmlFor="feedback-title" className="block text-sm font-semibold text-foreground mb-2">
  {t('ui.feedback.subject', { defaultValue: 'Sujet' })}
  </label>
  <input {...register('title')}
  id="feedback-title"
  type="text"
  placeholder={t('ui.feedback.subjectPlaceholder', { defaultValue: "Ex: Ajout d'un filtre par date..." })}
  className="w-full px-4 py-3 bg-background border border-border/40 rounded-xl text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary outline-none transition-all"
  />
  <FormError message={errors.title?.message} />
  </div>

  {/* Description */}
  <div>
  <label htmlFor="feedback-description" className="block text-sm font-semibold text-foreground mb-2">
  {t('ui.feedback.description', { defaultValue: 'Description détaillée' })}
  </label>
  <textarea {...register('description')}
  id="feedback-description"
  placeholder={t('ui.feedback.descriptionPlaceholder', { defaultValue: 'Dites-nous en plus...' })}
  rows={5}
  className="w-full px-4 py-3 bg-background border border-border/40 rounded-xl text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary outline-none transition-all resize-none"
  />
  <FormError message={errors.description?.message} />
  </div>
 </form>

 {/* Footer */}
 <div className="p-6 border-t border-border/40 bg-muted/50 flex justify-end gap-3 shrink-0 rounded-b-2xl">
  <Button
  type="button"
  variant="ghost"
  aria-label={t('ui.feedback.cancelFeedback', { defaultValue: 'Annuler le retour' })}
  onClick={onClose}
  >
  {t('ui.feedback.cancel', { defaultValue: 'Annuler' })}
  </Button>
  <Button
  type="submit"
  form="feedback-form"
  aria-label={t('ui.feedback.sendFeedback', { defaultValue: 'Envoyer le retour' })}
  disabled={isSubmitting}
  isLoading={isSubmitting}
  className="gap-2"
  >
  <Send className="w-4 h-4" />
  {t('ui.feedback.send', { defaultValue: 'Envoyer' })}
  </Button>
 </div>
 </div>
 </div>
 );

 return createPortal(modalContent, document.body);
};

// Headless UI handles FocusTrap and keyboard navigation
