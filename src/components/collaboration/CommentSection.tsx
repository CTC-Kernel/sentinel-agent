import React, { useState, useMemo } from 'react';
import { orderBy } from 'firebase/firestore';
import { useStore } from '../../store';
import { Comment } from '../../types';
import { Send, MessageSquare, Reply } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../utils/cn';

interface CommentSectionProps {
    collectionName: string;
    documentId: string;
    className?: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ collectionName, documentId, className }) => {
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const { user } = useStore();

    // Use hook for comments subcollection
    const { data: comments, add } = useFirestoreCollection<Comment>(
        `${collectionName}/${documentId}/comments`,
        [orderBy('createdAt', 'asc')],
        {
            realtime: true,
            enabled: !!documentId
        }
    );

    const organizedComments = useMemo(() => {
        const rootComments = comments.filter(c => !c.parentId);
        const replies = comments.filter(c => c.parentId);

        return rootComments.map(root => ({
            ...root,
            replies: replies.filter(r => r.parentId === root.id)
        }));
    }, [comments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;

        // Detect mentions (simple regex for @Name)
        const mentionRegex = /@(\w+)/g;
        const mentions: string[] = [];
        let match;
        while ((match = mentionRegex.exec(newComment)) !== null) {
            // In a real app, we would map the name to a user ID. 
            // For now, we just capture the string or look up if we had a user list.
            // We'll store the text match for now.
            mentions.push(match[1]);
        }

        try {
            await add({
                userId: user.uid,
                userName: user.displayName || user.email,
                organizationId: user.organizationId,
                content: newComment.trim(),
                createdAt: new Date().toISOString(),
                parentId: replyTo || undefined,
                mentions
            });
            setNewComment('');
            setReplyTo(null);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'CommentSection.handleSubmit', 'CREATE_FAILED');
        }
    };

    const renderComment = (comment: Comment, isReply = false) => {
        // const isMe = comment.userId === user?.uid; // Unused for now but good for styling in future
        // const hasReplies = (comment as any).replies && (comment as any).replies.length > 0; // Unused logic

        return (
            <div key={comment.id} className={cn("flex gap-3", isReply ? "ml-8 mt-2" : "mt-4")}>
                <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                        {comment.userName.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                {comment.userName}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr })}
                            </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {comment.content.split(' ').map((word, i) => {
                                if (word.startsWith('@')) {
                                    return <span key={i} className="text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-500/10 px-1 rounded">{word} </span>
                                }
                                return word + ' ';
                            })}
                        </p>
                    </div>
                    {!isReply && (
                        <button
                            onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                            className="mt-1 text-xs text-slate-500 hover:text-brand-600 font-medium flex items-center gap-1 transition-colors px-2"
                        >
                            <Reply className="h-3 w-3" />
                            Répondre
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[60vh] space-y-1 p-2 custom-scrollbar">
                {organizedComments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                        <MessageSquare className="h-8 w-8 mb-2" />
                        <p className="text-sm">Aucun commentaire</p>
                    </div>
                ) : (
                    organizedComments.map((root) => (
                        <div key={root.id}>
                            {renderComment(root)}
                            {(root as Comment & { replies?: Comment[] }).replies?.map((reply: Comment) => renderComment(reply, true))}
                        </div>
                    ))
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                {replyTo && (
                    <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-lg mb-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-400">
                            Réponse à un commentaire
                        </span>
                        <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-red-500">
                            Fermer
                        </button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={replyTo ? "Votre réponse..." : "Ajouter un commentaire..."}
                        className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                    />
                    <button
                        type="submit"
                        disabled={!newComment.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    );
};
