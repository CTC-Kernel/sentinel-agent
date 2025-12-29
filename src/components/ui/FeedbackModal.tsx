import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Bug, Lightbulb, Star, Send } from 'lucide-react';
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
    title: z.string().min(3, 'Le titre doit faire au moins 3 caractères').max(200, 'Titre trop long'),
    description: z.string().min(10, 'Description trop courte (min 10 caractères)').max(2000, 'Description trop longue'),
    priority: z.enum(['low', 'medium', 'high'])
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
    const { user, addToast } = useStore();
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

            addToast('Merci ! Votre retour a bien été envoyé.', 'success');
            onClose();
            reset();
        } catch (error) {
            ErrorLogger.error(error, 'FeedbackModal.onSubmit');
            addToast("Une erreur est survenue lors de l'envoi.", 'error');
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in">
            <div className="glass-panel rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl animate-scale-in">
                <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 glass-panel relative z-10">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-brand-500" />
                        Votre Avis Compte
                    </h2>
                    <button aria-label="Fermer la fenêtre" onClick={onClose} className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none" />
                </div>

                <form id="feedback-form" onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto custom-scrollbar space-y-6 relative z-10">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        {(['feature', 'bug', 'improvement', 'other'] as FeedbackType[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                aria-label={`Type de retour : ${getTypeLabel(t)}`}
                                aria-pressed={formValues.type === t}
                                onClick={() => setValue('type', t)}
                                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${formValues.type === t
                                    ? 'bg-brand-50/50 dark:bg-brand-900/20 border-brand-500 text-brand-700 dark:text-brand-400 ring-1 ring-brand-500 shadow-sm shadow-brand-500/10'
                                    : 'glass-panel border-white/20 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/5'
                                    }`}
                            >
                                {getTypeIcon(t)}
                                {getTypeLabel(t)}
                            </button>
                        ))}
                    </div>
                    {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}

                    {/* Priority (only for bugs/features) */}
                    {(formValues.type === 'bug' || formValues.type === 'feature') && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Priorité / Importance
                            </label>
                            <div className="flex gap-4 p-1 glass-panel rounded-xl border border-white/10 w-fit">
                                {(['low', 'medium', 'high'] as const).map((p) => (
                                    <label key={p} className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg transition-all ${formValues.priority === p ? 'bg-brand-500 text-white shadow-md' : 'hover:bg-white/10'}`}>
                                        <input {...register('priority')}
                                            checked={formValues.priority === p}
                                            type="radio"
                                            value={p}
                                            className="hidden"
                                        />
                                        <span className={`text-sm capitalize font-medium ${formValues.priority === p ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                            {p === 'low' ? 'Faible' : p === 'medium' ? 'Moyenne' : 'Haute'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            {errors.priority && <p className="text-xs text-red-500 mt-1">{errors.priority.message}</p>}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Sujet
                        </label>
                        <div className="relative group">
                            <input {...register('title')}
                                type="text"
                                placeholder="Ex: Ajout d'un filtre par date..."
                                className="w-full px-4 py-3 bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-sm group-hover:bg-white/70 dark:group-hover:bg-black/30 placeholder:text-slate-400"
                            />
                        </div>
                        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Description détaillée
                        </label>
                        <div className="relative group">
                            <textarea {...register('description')}
                                placeholder="Dites-nous en plus..."
                                rows={5}
                                className="w-full px-4 py-3 bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none shadow-sm group-hover:bg-white/70 dark:group-hover:bg-black/30 placeholder:text-slate-400"
                            />
                        </div>
                        {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
                    </div>
                </form>

                <div className="p-6 border-t border-white/10 glass-panel relative z-10 flex justify-end gap-3 shrink-0 rounded-b-[2rem]">
                    <div className="absolute inset-0 bg-slate-50/50 dark:bg-black/20 pointer-events-none" />
                    <button
                        type="button"
                        aria-label="Annuler le retour"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors font-medium relative z-10"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        form="feedback-form"
                        aria-label="Envoyer le retour"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Envoi...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Envoyer
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

// Headless UI handles FocusTrap and keyboard navigation
