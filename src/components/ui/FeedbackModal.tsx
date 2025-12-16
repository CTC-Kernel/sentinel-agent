import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Bug, Lightbulb, Star, Send } from 'lucide-react';
import { useStore } from '../../store';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
    const { user, addToast } = useStore();
    const [type, setType] = useState<FeedbackType>('feature');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !mounted) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'feedback'), {
                type,
                title,
                description,
                priority,
                userId: user?.uid || 'anonymous',
                userEmail: user?.email || 'anonymous',
                organizationId: user?.organizationId || 'unknown',
                status: 'new',
                createdAt: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });

            addToast('Merci ! Votre retour a bien été envoyé.', 'success');
            onClose();
            // Reset form
            setTitle('');
            setDescription('');
            setType('feature');
            setPriority('medium');
        } catch (error) {
            ErrorLogger.error(error, 'FeedbackModal.handleSubmit');
            addToast("Une erreur est survenue lors de l'envoi.", 'error');
        } finally {
            setIsSubmitting(false);
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
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-brand-600" />
                        Votre Avis Compte
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        {(['feature', 'bug', 'improvement', 'other'] as FeedbackType[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${type === t
                                    ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-500 text-brand-700 dark:text-brand-400 ring-1 ring-brand-500'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-brand-300 dark:hover:border-brand-700'
                                    }`}
                            >
                                {getTypeIcon(t)}
                                {getTypeLabel(t)}
                            </button>
                        ))}
                    </div>

                    {/* Priority (only for bugs/features) */}
                    {(type === 'bug' || type === 'feature') && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Priorité / Importance
                            </label>
                            <div className="flex gap-4">
                                {(['low', 'medium', 'high'] as const).map((p) => (
                                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="priority"
                                            value={p}
                                            checked={priority === p}
                                            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                                            className="text-brand-600 focus:ring-brand-500"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                                            {p === 'low' ? 'Faible' : p === 'medium' ? 'Moyenne' : 'Haute'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Sujet
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Ajout d'un filtre par date..."
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Description détaillée
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Dites-nous en plus..."
                            rows={5}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none"
                            required
                        />
                    </div>
                </form>

                <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !title.trim() || !description.trim()}
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
