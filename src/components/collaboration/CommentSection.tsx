import React, { useState, useMemo, useCallback } from 'react';
import { orderBy, serverTimestamp } from 'firebase/firestore';
import { useStore } from '../../store';
import { Comment } from '../../types';
import { Send, MessageSquare, Reply } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { formatDistanceToNow } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { cn } from '../../utils/cn';
import { useZodForm } from '../../hooks/useZodForm';
import { SubmitHandler } from 'react-hook-form';
import { z } from 'zod';

interface CommentSectionProps {
 collectionName: string;
 documentId: string;
 className?: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ collectionName, documentId, className }) => {
 const [replyTo, setReplyTo] = useState<string | null>(null);
 const { user } = useStore();
 const { dateFnsLocale } = useLocale();

 // Use hook for comments subcollection
 const { data: comments, add: addRaw } = useFirestoreCollection<Comment>(
 `${collectionName}/${documentId}/comments`,
 [orderBy('createdAt', 'asc')],
 {
 realtime: true,
 enabled: !!documentId && !!user?.organizationId
 }
 );

 const add = useCallback(async (data: Partial<Comment>) => {
 return addRaw({
 ...data,
 createdAt: serverTimestamp()
 });
 }, [addRaw]);

 const organizedComments = useMemo(() => {
 const rootComments = comments.filter(c => !c.parentId);
 const replies = comments.filter(c => c.parentId);

 return rootComments.map(root => ({
 ...root,
 replies: replies.filter(r => r.parentId === root.id)
 }));
 }, [comments]);

 const commentSchema = z.object({
 content: z.string().trim().min(1, 'Comment cannot be empty').max(1000)
 });

 type CommentFormData = z.infer<typeof commentSchema>;

 const { register, handleSubmit, reset, formState: { isValid, isSubmitting, errors } } = useZodForm({
 schema: commentSchema,
 defaultValues: { content: '' },
 mode: 'onChange'
 });

 const onSubmit: SubmitHandler<CommentFormData> = async (data) => {
 if (!user) return;

 // Detect mentions (simple regex for @Name)
 const mentionRegex = /@(\w+)/g;
 const mentions: string[] = [];
 let match;
 while ((match = mentionRegex.exec(data.content)) !== null) {
 mentions.push(match[1]);
 }

 try {
 await add({
 userId: user.uid,
 userName: user.displayName || user.email || 'Utilisateur',
 content: data.content.trim(),
 ...(user.organizationId ? { organizationId: user.organizationId } : {}),
 ...(replyTo ? { parentId: replyTo } : {}),
 mentions
 });
 reset();
 setReplyTo(null);
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'CommentSection.handleSubmit', 'CREATE_FAILED');
 }
 };

 const renderComment = (comment: Comment, isReply = false) => {
 // const isMe = comment.userId === user?.uid; // Unused for now but good for styling in future

 return (
 <div key={comment.id || 'unknown'} className={cn("flex gap-3", isReply ? "ml-8 mt-2" : "mt-4")}>
 <div className="flex-shrink-0">
  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
  {comment.userName.charAt(0).toUpperCase()}
  </div>
 </div>
 <div className="flex-1 min-w-0">
  <div className="bg-muted/50 rounded-3xl px-4 py-3 border border-border/40/50">
  <div className="flex items-center justify-between mb-1">
  <span className="text-sm font-semibold text-foreground">
  {comment.userName}
  </span>
  <span className="text-xs text-muted-foreground">
  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: dateFnsLocale })}
  </span>
  </div>
  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
  {comment.content.split(' ').map((word, i) => {
  if (word.startsWith('@')) {
   return <span key={`${i || 'unknown'}-${word}`} className="text-primary font-medium bg-primary/10 px-1 rounded">{word} </span>
  }
  return word + ' ';
  })}
  </p>
  </div>
  {!isReply && (
  <button
  type="button"
  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
  className="mt-1 text-xs text-muted-foreground hover:text-primary font-medium flex items-center gap-1 transition-colors px-2"
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
  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
  <MessageSquare className="h-8 w-8 mb-2" />
  <p className="text-sm">Aucun commentaire</p>
  </div>
 ) : (
  organizedComments.map((root) => (
  <div key={root.id || 'unknown'}>
  {renderComment(root)}
  {(root as Comment & { replies?: Comment[] }).replies?.map((reply: Comment) => renderComment(reply, true))}
  </div>
  ))
 )}
 </div>

 <div className="mt-4 pt-4 border-t border-border/40">
 {replyTo && (
  <div className="flex items-center justify-between bg-muted p-2 rounded-lg mb-2 text-xs">
  <span className="text-muted-foreground">
  Réponse à un commentaire
  </span>
  <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-red-500">
  Fermer
  </button>
  </div>
 )}
 <form onSubmit={handleSubmit(onSubmit)} className="relative">
  <input
  {...register('content')}
  aria-label={replyTo ? "Votre réponse" : "Ajouter un commentaire"}
  type="text"
  placeholder={replyTo ? "Votre réponse..." : "Ajouter un commentaire..."}
  className={cn("w-full pl-4 pr-12 py-3 bg-card border border-border/40 rounded-3xl focus:ring-2 focus-visible:ring-primary focus:border-primary transition-all text-sm", errors.content && "border-red-500 focus:border-red-500")}
  />
  <button
  type="submit"
  disabled={isSubmitting || !isValid}
  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-primary/90 transition-colors"
  >
  {isSubmitting ? <span className="animate-spin">⌛</span> : <Send className="h-4 w-4" />}
  </button>
 </form>
 </div>
 </div>
 );
};
