
import React, { useEffect, useState } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Comment } from '../../types';
import { Send, MessageSquare } from './Icons';

interface CommentsProps {
  collectionName: string;
  documentId: string;
}

export const Comments: React.FC<CommentsProps> = ({ collectionName, documentId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const { user } = useStore();

  useEffect(() => {
    if (!documentId) return;
    const q = query(collection(db, collectionName, documentId, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    return () => unsubscribe();
  }, [collectionName, documentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      await addDoc(collection(db, collectionName, documentId, 'comments'), {
        userId: user.uid,
        userName: user.displayName || user.email,
        content: newComment.trim(),
        createdAt: new Date().toISOString()
      });
      setNewComment('');
    } catch (error) { console.error(error); }
  };

  return (
    <div className="flex flex-col h-full">
      {comments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-60 py-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-3">
             <MessageSquare className="h-6 w-6 text-gray-300" />
          </div>
          <p className="text-xs font-medium">Aucun commentaire. Lancez la discussion !</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar">
          {comments.map((comment) => {
            const isMe = comment.userId === user?.uid;
            return (
              <div key={comment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-scale-in`}>
                {!isMe && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-[9px] font-bold mr-2 mt-auto shadow-sm">
                        {comment.userName.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative group ${
                  isMe 
                    ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                  <span className={`text-[9px] font-medium block mt-1 text-right ${isMe ? 'text-brand-100' : 'text-gray-400'}`}>
                      {new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2 items-end pt-2">
        <div className="flex-1 relative">
            <input
            type="text"
            placeholder="Écrire un message..."
            className="w-full bg-gray-100 dark:bg-slate-800/50 border-none rounded-2xl pl-4 pr-10 py-3 text-sm focus:ring-2 focus:ring-brand-500/50 dark:text-white transition-all outline-none placeholder-gray-400"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            />
        </div>
        <button 
          type="submit"
          disabled={!newComment.trim()}
          className="p-3 bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-50 disabled:scale-95 transition-all shadow-lg shadow-brand-500/20 hover:scale-105 active:scale-95 flex items-center justify-center"
        >
          <Send className="h-4 w-4 ml-0.5" strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
};
