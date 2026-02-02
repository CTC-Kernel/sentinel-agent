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

    const getTypeIcon = (t: FeedbackType) => {
        switch (t) {
            case 'bug': return <Bug className="w-4 h-4" />;
            case 'feature': return <Star className="w-4 h-4" />;
            case 'improvement': return <Lightbulb className="w-4 h-4" />;
            default: return <MessageSquare className="w-4 h-4" />;
        }
    };

    const getTypeLabel = (t: FeedbackType) => {
        switch (t) {
            case 'bug': return 'Signaler un Bug';
            case 'feature': return 'Nouvelle Fonctionnalité';
            case 'improvement': return 'Amélioration';
            default: return 'Autre';
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-voxel-ui flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl shadow-black/20 dark:shadow-black/50 animate-scale-in border border-border/40/80 dark:border-slate-700/50">
                {/* Header - Solid background for clarity */}
                <div className="p-6 border-b border-border/40 dark:border-slate-700/50 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-800/50 rounded-t-3xl">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-3xl bg-blue-100 dark:bg-blue-900/30 dark:bg-blue-900/50 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        Votre Avis Compte
                    </h2>
                    <Button variant="ghost" size="icon" aria-label="Fermer la fenêtre" onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-3xl">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form id="feedback-form" onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto custom-scrollbar space-y-6 bg-white dark:bg-slate-900">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        {(['feature', 'bug', 'improvement', 'other'] as FeedbackType[]).map((t) => (
                            <button
                                key={t || 'unknown'}
                                type="button"
                                aria-label={`Type de retour : ${getTypeLabel(t)}`}
                                aria-pressed={formValues.type === t}
                                onClick={() => setValue('type', t)}
                                className={`flex items-center gap-2 p-3 rounded-3xl border text-sm font-semibold transition-all ${formValues.type === t
                                    ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30 shadow-sm'
                                    : 'bg-slate-50 dark:bg-slate-800 border-border/40 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-border/40 dark:hover:border-slate-600'
                                    }`}
                            >
                                {getTypeIcon(t)}
                                {getTypeLabel(t)}
                            </button>
                        ))}
                    </div>
                    <FormError message={errors.type?.message} />

                    {/* Priority (only for bugs/features) */}
                    {(formValues.type === 'bug' || formValues.type === 'feature') && (
                        <div className="animate-fade-in">
                            <span id="priority-label" className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                                Priorité / Importance
                            </span>
                            <div role="radiogroup" aria-labelledby="priority-label" className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-3xl border border-border/40 dark:border-slate-700 w-fit">
                                {(['low', 'medium', 'high'] as const).map((p) => (
                                    <label key={p || 'unknown'} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg transition-all ${formValues.priority === p ? 'bg-brand-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                                        <input {...register('priority')}
                                            checked={formValues.priority === p}
                                            type="radio"
                                            value={p}
                                            className="hidden"
                                        />
                                        <span className={`text-sm capitalize font-semibold ${formValues.priority === p ? 'text-white' : ''}`}>
                                            {p === 'low' ? 'Faible' : p === 'medium' ? 'Moyenne' : 'Haute'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <FormError message={errors.priority?.message} />
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label htmlFor="feedback-title" className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                            Sujet
                        </label>
                        <input {...register('title')}
                            id="feedback-title"
                            type="text"
                            placeholder="Ex: Ajout d'un filtre par date..."
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-border/40 dark:border-slate-600 rounded-3xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-300 focus:border-brand-500 outline-none transition-all"
                        />
                        <FormError message={errors.title?.message} />
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="feedback-description" className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                            Description détaillée
                        </label>
                        <textarea {...register('description')}
                            id="feedback-description"
                            placeholder="Dites-nous en plus..."
                            rows={5}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-border/40 dark:border-slate-600 rounded-3xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-300 focus:border-brand-500 outline-none transition-all resize-none"
                        />
                        <FormError message={errors.description?.message} />
                    </div>
                </form>

                {/* Footer - Solid background */}
                <div className="p-6 border-t border-border/40 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0 rounded-b-3xl">
                    <Button
                        type="button"
                        variant="ghost"
                        aria-label="Annuler le retour"
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-3xl transition-colors font-semibold"
                    >
                        Annuler
                    </Button>
                    <Button
                        type="submit"
                        form="feedback-form"
                        aria-label="Envoyer le retour"
                        disabled={isSubmitting}
                        isLoading={isSubmitting}
                        className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-3xl shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 transition-all flex items-center gap-2 font-bold"
                    >
                        <Send className="w-4 h-4" />
                        Envoyer
                    </Button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

// Headless UI handles FocusTrap and keyboard navigation
