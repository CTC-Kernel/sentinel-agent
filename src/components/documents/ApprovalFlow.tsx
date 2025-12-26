import React, { useState } from 'react';
import { Document, UserProfile } from '../../types';
import { useDocumentWorkflow } from '../../hooks/useDocumentWorkflow';
import { useStore } from '../../store';
import { CheckCircle2, XCircle, Send, ShieldCheck } from '../ui/Icons';
import { motion } from 'framer-motion';

interface ApprovalFlowProps {
    document: Document;
    users: UserProfile[]; // For selecting reviewers
    onPublish?: () => void;
}

export const ApprovalFlow: React.FC<ApprovalFlowProps> = ({ document, users, onPublish }) => {
    const { user } = useStore();
    const { submitForReview, approveDocument, rejectDocument, publishDocument, loading } = useDocumentWorkflow();

    // Local state for actions
    const [comment, setComment] = useState('');
    const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
    const [actionView, setActionView] = useState<'none' | 'submit' | 'reject'>('none');

    // Timeline sorting
    const history = [...(document.workflowHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const isOwner = user?.uid === document.ownerId || user?.displayName === document.owner; // Fallback to name if ID missing
    const isReviewer = document.reviewers?.includes(user?.uid || '');
    const isDraft = document.status === 'Brouillon';
    const isInReview = document.status === 'En revue';
    const isApproved = document.status === 'Approuvé';

    const handleSubmit = async () => {
        // In a real app, validation of selectedReviewers
        await submitForReview(document, selectedReviewers, comment);
        setActionView('none');
        setComment('');
    };

    const handleReject = async () => {
        if (!comment) return;
        await rejectDocument(document, comment);
        setActionView('none');
        setComment('');
    };

    return (
        <div className="space-y-6">
            {/* Header / Actions Area */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand-500" />
                    Flux de Validation
                </h3>

                {/* ACTION BUTTONS */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {/* SUBMIT (Owner + Draft) */}
                    {isOwner && isDraft && (
                        <button
                            aria-label="Soumettre le document pour revue"
                            onClick={() => setActionView(actionView === 'submit' ? 'none' : 'submit')}
                            className="flex items-center px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition"
                        >
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            Soumettre pour revue
                        </button>
                    )}

                    {/* REVIEW (Reviewer + In Review) */}
                    {isReviewer && isInReview && (
                        <>
                            <button
                                aria-label="Approuver le document"
                                onClick={() => approveDocument(document)}
                                disabled={loading}
                                className="flex items-center px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                Approuver
                            </button>
                            <button
                                aria-label="Rejeter le document"
                                onClick={() => setActionView(actionView === 'reject' ? 'none' : 'reject')}
                                className="flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition"
                            >
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                Rejeter
                            </button>
                        </>
                    )}

                    {/* PUBLISH (Owner + Approved) */}
                    {isOwner && isApproved && (
                        <button
                            aria-label="Publier officiellement le document"
                            onClick={() => onPublish ? onPublish() : publishDocument(document)}
                            disabled={loading}
                            className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                        >
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            Publier Officiellement
                        </button>
                    )}
                </div>

                {/* INTERACTIVE FORMS */}
                {actionView === 'submit' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Sélectionner les réviseurs</label>
                            <select
                                aria-label="Sélectionner les réviseurs"
                                multiple
                                className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2 min-h-[80px]"
                                onChange={(e) => setSelectedReviewers(Array.from(e.target.selectedOptions, option => option.value))}
                            >
                                {users.filter(u => u.uid !== user?.uid).map(u => (
                                    <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-500 mt-1">Maintenez Ctrl/Cmd pour sélectionner plusieurs.</p>
                        </div>
                        <input
                            aria-label="Message pour les réviseurs"
                            type="text"
                            placeholder="Message pour les réviseurs..."
                            className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button aria-label="Annuler la soumission" onClick={() => setActionView('none')} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Annuler</button>
                            <button aria-label="Confirmer la soumission" onClick={handleSubmit} disabled={loading || selectedReviewers.length === 0} className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50">Confirmer</button>
                        </div>
                    </motion.div>
                )}

                {actionView === 'reject' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-red-200 dark:border-red-900/30">
                        <textarea
                            aria-label="Raison du rejet"
                            placeholder="Raison du rejet (obligatoire)..."
                            className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button aria-label="Annuler le rejet" onClick={() => setActionView('none')} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Annuler</button>
                            <button aria-label="Confirmer le rejet" onClick={handleReject} disabled={loading || !comment} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50">Confirmer le Rejet</button>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* TIMELINE */}
            <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                {history.length === 0 && (
                    <div className="text-sm text-slate-500 italic pl-2">Aucun historique de workflow.</div>
                )}
                {history.map((item) => (
                    <div key={item.id} className="relative">
                        <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${item.action === 'approve' || item.action === 'publish' ? 'bg-emerald-500' :
                            item.action === 'reject' ? 'bg-red-500' : 'bg-brand-500'
                            }`}></div>

                        <div className="flex items-start justify-between">
                            <div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.action === 'approve' ? 'bg-emerald-100 text-emerald-700' :
                                    item.action === 'publish' ? 'bg-blue-100 text-blue-700' :
                                        item.action === 'reject' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-700'
                                    }`}>
                                    {item.action.toUpperCase()}
                                </span>
                                <div className="mt-1 text-sm text-slate-900 dark:text-white font-medium">
                                    {item.userName}
                                </div>
                                {item.comment && (
                                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg italic">
                                        "{item.comment}"
                                    </div>
                                )}
                            </div>
                            <div className="text-xs text-slate-400 flex flex-col items-end">
                                <span>{new Date(item.date).toLocaleDateString()}</span>
                                <span>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
