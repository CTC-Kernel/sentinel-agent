
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { db } from '../../firebase';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useStore } from '../../store';
import { Comment } from '../../types';

interface ThreatDiscussionProps {
    threatId: string;
    threatTitle: string;
    isOpen: boolean;
    onClose: () => void;
}

export const ThreatDiscussion: React.FC<ThreatDiscussionProps> = ({ threatId, threatTitle, isOpen, onClose }) => {
    const { user } = useStore();
    const [comments, setComments] = useStateLike<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch comments in real-time
    useEffect(() => {
        if (!threatId || !isOpen) return;

        const q = query(
            collection(db, 'threats', threatId, 'comments'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];
            setComments(msgs);
            // Scroll to bottom on new message
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        return () => unsubscribe();
    }, [threatId, isOpen]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newComment.trim() || !user) return;

        try {
            await addDoc(collection(db, 'threats', threatId, 'comments'), {
                organizationId: user.organizationId,
                userId: user.uid,
                userName: user.displayName || 'Anonymous',
                content: newComment.trim(),
                createdAt: new Date().toISOString(), // Use serverTimestamp in real app, keeping string for type consistency
                userRole: user.role
            });
            setNewComment('');
        } catch (error) {
            console.error("Error sending comment:", error);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />

                    {/* Side Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Discussion</h3>
                                <p className="text-xs text-slate-500 truncate max-w-[280px]">{threatTitle}</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50">
                            {comments.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm">
                                    <p>Aucun commentaire pour le moment.</p>
                                    <p>Lancez la discussion !</p>
                                </div>
                            ) : (
                                comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className={`flex flex-col ${comment.userId === user?.uid ? 'items-end' : 'items-start'}`}
                                    >
                                        <div className={`
                                            max-w-[85%] rounded-2xl px-4 py-3 shadow-sm
                                            ${comment.userId === user?.uid
                                                ? 'bg-brand-600 text-white rounded-tr-none'
                                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-none'}
                                        `}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-bold ${comment.userId === user?.uid ? 'text-brand-100' : 'text-slate-900 dark:text-white'}`}>
                                                    {comment.userName}
                                                </span>
                                                <span className={`text-[10px] ${comment.userId === user?.uid ? 'text-brand-200' : 'text-slate-400'}`}>
                                                    {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className={`text-sm ${comment.userId === user?.uid ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {comment.content}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                            <form
                                onSubmit={handleSend}
                                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-2 border border-transparent focus-within:border-brand-500 transition-colors"
                            >
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Participez à la discussion..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 text-slate-900 dark:text-white placeholder:text-slate-400"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={!newComment.trim()}
                                    className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Typed helper since generic useState was used in prompt
function useStateLike<T>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    return useState(initial);
}
