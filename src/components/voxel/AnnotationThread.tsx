/**
 * Epic 33: Story 33.4 - Annotation Thread Discussion
 *
 * Full annotation thread view with replies, rich text, and actions.
 * Features:
 * - Display annotation with all replies
 * - Reply form with rich text
 * - Edit/delete own replies
 * - Resolve/close annotation (for issues)
 * - Reply count badge
 * - Collapsible thread view
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { motion, AnimatePresence } from 'framer-motion';
import {
 X,
 MessageSquare,
 Send,
 Edit2,
 Trash2,
 Check,
 CheckCircle,
 XCircle,
 Pin,
 PinOff,
 ChevronDown,
 ChevronUp,
 MoreHorizontal,
 Clock,
 AlertTriangle,
 StickyNote,
 HelpCircle,
 Highlighter,
} from '../ui/Icons';
import type {
 VoxelAnnotation,
 AnnotationReply,
 AnnotationAuthor,
 AnnotationType,
} from '../../types/voxelAnnotation';
import {
 ANNOTATION_TYPE_LABELS,
 ANNOTATION_STATUS_COLORS,
 ANNOTATION_STATUS_LABELS,
} from '../../types/voxelAnnotation';
import { AnnotationService } from '../../services/annotationService';
import { useAuth } from '../../hooks/useAuth';
import { useStore } from '../../store';
import { ConfirmModal } from '../ui/ConfirmModal';

// ============================================================================
// Types
// ============================================================================

interface AnnotationThreadProps {
 /** The annotation to display */
 annotation: VoxelAnnotation;

 /** Whether the thread panel is open */
 isOpen: boolean;

 /** Callback when thread is closed */
 onClose: () => void;

 /** Callback after annotation is updated */
 onAnnotationUpdate?: (annotation: VoxelAnnotation) => void;

 /** Callback after annotation is deleted */
 onAnnotationDelete?: (annotationId: string) => void;

 /** Callback to edit the annotation */
 onEditAnnotation?: (annotation: VoxelAnnotation) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_ICONS: Record<AnnotationType, React.ReactNode> = {
 note: <StickyNote className="w-4 h-4" />,
 question: <HelpCircle className="w-4 h-4" />,
 issue: <AlertTriangle className="w-4 h-4" />,
 highlight: <Highlighter className="w-4 h-4" />,
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Single reply in the thread
 */
const ReplyItem: React.FC<{
 reply: AnnotationReply;
 currentUserId?: string;
 onEdit: (reply: AnnotationReply) => void;
 onDelete: (replyId: string) => void;
}> = ({ reply, currentUserId, onEdit, onDelete }) => {
 const { config } = useLocale();
 const [showActions, setShowActions] = useState(false);
 const isOwner = currentUserId === reply.author.id;
 const createdDate = new Date(reply.createdAt);


  // Extracted callbacks (useCallback)
  const handleMouseEnter = useCallback(() => {
    setShowActions(true)
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowActions(false)
  }, []);

  const handleClose = useCallback(() => {
    setDeleteReplyId(null)
  }, []);

  const handleClick = useCallback(() => {
    onEdit(reply)
  }, []);

  const handleClick2 = useCallback(() => {
    onDelete(reply.id)
  }, []);

  const handleChange = useCallback((e) => {
    setContent(e.target.value)
  }, []);

  const handleClick3 = useCallback(() => {
    setShowActions(!showActions)
  }, []);

  const handleClick4 = useCallback(() => {
    setIsExpanded(!isExpanded)
  }, []);

  const handleDelete = useCallback((id) => {
    setDeleteReplyId(id)
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingReply(undefined)
  }, []);

  const handleConfirm = useCallback(() => {
    deleteReplyId && handleDeleteReply(deleteReplyId)
  }, []);

  const handleClose2 = useCallback(() => {
    setShowDeleteAnnotationConfirm(false)
  }, []);
  const handleClick5 = useCallback(() => {
    setShowActions(false);
  onEditAnnotation?.(annotation);
  }, []);

  const handleClick6 = useCallback(() => {
    setShowActions(false);
  setShowDeleteAnnotationConfirm(true);
  }, []);



 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 className="group px-4 py-3 hover:bg-muted/30 transition-colors"
 onMouseEnter={handleMouseEnter}
 onMouseLeave={handleMouseLeave}
 >
 <div className="flex items-start gap-3">
 {/* Avatar */}
 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-violet-500 flex items-center justify-center flex-shrink-0">
 <span className="text-xs font-bold text-foreground">
 {reply.author.displayName.charAt(0).toUpperCase()}
 </span>
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-sm font-medium text-foreground">
 {reply.author.displayName}
 </span>
 <span className="text-xs text-muted-foreground">
 {createdDate.toLocaleDateString(config.intlLocale)} a {createdDate.toLocaleTimeString(config.intlLocale, { hour: '2-digit', minute: '2-digit' })}
 </span>
 {reply.isEdited && (
 <span className="text-xs text-muted-foreground italic">(modifié)</span>
 )}
 </div>

 <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
 {reply.content}
 </p>

 {/* Mentions highlight */}
 {reply.mentions.length > 0 && (
 <div className="flex items-center gap-1 mt-2">
 {reply.mentions.map((mention, idx) => (
 <span
  key={idx || 'unknown'}
  className="px-1.5 py-0.5 bg-primary/15 text-primary/70 text-xs rounded"
 >
  @{mention}
 </span>
 ))}
 </div>
 )}
 </div>

 {/* Actions */}
 {isOwner && showActions && (
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-70 transition-opacity">
 <button
 onClick={handleClick}
 className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
 title="Modifier"
 >
 <Edit2 className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={handleClick2}
 className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
 title="Supprimer"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>
 )}
 </div>
 </motion.div>
 );
};

/**
 * Reply input form
 */
const ReplyForm: React.FC<{
 annotationId: string;
 organizationId: string;
 author: AnnotationAuthor;
 editingReply?: AnnotationReply;
 /* validate */ onSubmit: () => void;
 onCancelEdit?: () => void;
}> = ({ annotationId, organizationId, author, editingReply, onSubmit, onCancelEdit }) => {
 const [content, setContent] = useState(editingReply?.content || '');
 const [isSubmitting, setIsSubmitting] = useState(false);

 useEffect(() => {
 setContent(editingReply?.content || '');
 }, [editingReply]);

 const handleSubmit = async () => {
 if (!content.trim()) return;

 setIsSubmitting(true);
 try {
 if (editingReply) {
 await AnnotationService.updateReply(annotationId, editingReply.id, { content });
 } else {
 await AnnotationService.createReply({ ...author, organizationId }, { annotationId, content });
 }
 setContent('');
 onSubmit();
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
 handleSubmit();
 }
 if (e.key === 'Escape' && editingReply) {
 onCancelEdit?.();
 }
 };

 return (
 <div className="p-4 border-t border-border/50 bg-muted/30">
 {editingReply && (
 <div className="flex items-center justify-between mb-2 px-2">
 <span className="text-xs text-amber-400">Modification en cours</span>
 <button
 onClick={onCancelEdit}
 className="text-xs text-muted-foreground hover:text-foreground"
 >
 Annuler
 </button>
 </div>
 )}
 <div className="flex items-end gap-3">
 <div className="flex-1">
 <textarea
 value={content}
 onChange={handleChange}
 onKeyDown={handleKeyDown}
 placeholder="Écrivez une réponse... (Cmd+Enter pour envoyer)"
 rows={2}
 className="w-full px-4 py-3 bg-card/50 border border-border rounded-3xl text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent resize-none text-sm"
 />
 </div>
 <button
 onClick={handleSubmit}
 disabled={!content.trim() || isSubmitting}
 className={`p-3 rounded-3xl transition-all ${content.trim() && !isSubmitting
 ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
 : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
 }`}
 >
 {isSubmitting ? (
 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
 ) : (
 <Send className="w-5 h-5" />
 )}
 </button>
 </div>
 </div>
 );
};

// ============================================================================
// Main Component
// ============================================================================

export const AnnotationThread: React.FC<AnnotationThreadProps> = ({
 annotation,
 isOpen,
 onClose,
 onAnnotationUpdate,
 onAnnotationDelete,
 onEditAnnotation,
}) => {
 const { user } = useAuth();
 const { t } = useStore();
 const { config } = useLocale();

 // State
 const [replies, setReplies] = useState<AnnotationReply[]>([]);
 const [isLoadingReplies, setIsLoadingReplies] = useState(false);
 const [isExpanded, setIsExpanded] = useState(true);
 const [editingReply, setEditingReply] = useState<AnnotationReply | undefined>();
 const [showActions, setShowActions] = useState(false);
 const [isResolving, setIsResolving] = useState(false);
 const [deleteReplyId, setDeleteReplyId] = useState<string | null>(null);
 const [showDeleteAnnotationConfirm, setShowDeleteAnnotationConfirm] = useState(false);

 // Current user as author
 const author = useMemo<AnnotationAuthor | null>(() => {
 if (!user) return null;
 return {
 id: user.uid,
 displayName: user.displayName || user.email || 'Anonymous',
 email: user.email || undefined,
 avatarUrl: user.photoURL || undefined,
 };
 }, [user]);

 const isOwner = user?.uid === annotation.author.id;
 const isIssue = annotation.type === 'issue';
 const canResolve = isIssue && (annotation.status === 'open' || annotation.status === 'in_progress');
 const canReopen = isIssue && (annotation.status === 'resolved' || annotation.status === 'closed');

 // Load replies
 useEffect(() => {
 if (!isOpen) return;

 const loadReplies = async () => {
 setIsLoadingReplies(true);
 try {
 const fetchedReplies = await AnnotationService.getReplies(annotation.id);
 setReplies(fetchedReplies);
 } finally {
 setIsLoadingReplies(false);
 }
 };

 loadReplies();

 // Subscribe to real-time updates
 const unsubscribe = AnnotationService.subscribeToReplies(annotation.id, setReplies);

 return () => unsubscribe();
 }, [annotation.id, isOpen]);

 // Mark as read
 useEffect(() => {
 if (isOpen && user?.uid && !annotation.readBy.includes(user.uid)) {
 AnnotationService.markAsRead(annotation.id, user.uid, annotation.organizationId);
 }
 }, [isOpen, annotation.id, annotation.readBy, annotation.organizationId, user?.uid]);

 // Handle reply submission
 const handleReplySubmit = useCallback(() => {
 setEditingReply(undefined);
 }, []);

 // Handle edit reply
 const handleEditReply = useCallback((reply: AnnotationReply) => {
 setEditingReply(reply);
 }, []);

 // Handle delete reply
 const handleDeleteReply = useCallback(async (replyId: string) => {
 await AnnotationService.deleteReply(annotation.id, replyId, annotation.organizationId);
 setReplies((prev) => prev.filter((r) => r.id !== replyId));
 setDeleteReplyId(null);
 }, [annotation.id, annotation.organizationId]);

 // Handle toggle pin
 const handleTogglePin = useCallback(async () => {
 const newPinned = await AnnotationService.togglePin(annotation.id, annotation.organizationId);
 if (newPinned !== null) {
 onAnnotationUpdate?.({
 ...annotation,
 isPinned: newPinned,
 });
 }
 }, [annotation, onAnnotationUpdate]);

 // Handle resolve/close
 const handleResolve = useCallback(async () => {
 if (!author) return;

 setIsResolving(true);
 try {
 const updated = await AnnotationService.resolveIssue(annotation.id, author);
 if (updated) {
 onAnnotationUpdate?.(updated);
 }
 } finally {
 setIsResolving(false);
 }
 }, [annotation.id, author, onAnnotationUpdate]);

 // Handle reopen
 const handleReopen = useCallback(async () => {
 const updated = await AnnotationService.updateAnnotation(annotation.id, { status: 'open' });
 if (updated) {
 onAnnotationUpdate?.(updated);
 }
 }, [annotation.id, onAnnotationUpdate]);

 // Handle delete annotation
 const handleDeleteAnnotation = useCallback(async () => {
 const success = await AnnotationService.deleteAnnotation(annotation.id);
 if (success) {
 onAnnotationDelete?.(annotation.id);
 onClose();
 }
 setShowDeleteAnnotationConfirm(false);
 }, [annotation.id, onAnnotationDelete, onClose]);

 if (!isOpen) return null;

 const createdDate = new Date(annotation.createdAt);

 return (
 <AnimatePresence>
 <motion.div
 initial={{ opacity: 0, x: 50 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 50 }}
 className="fixed right-4 top-20 bottom-4 w-[400px] z-sidebar flex flex-col glass-premium rounded-3xl shadow-apple-xl overflow-hidden border border-border/40"
 >
 {/* Header */}
 <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-muted/80 to-card/80 border-b border-border/50">
 <div className="flex items-center gap-3">
 <div
 className="p-2 rounded-3xl"
 style={{ backgroundColor: `${annotation.color}20` }}
 >
 <span style={{ color: annotation.color }}>
 {TYPE_ICONS[annotation.type]}
 </span>
 </div>
 <div>
 <h3 className="text-sm font-semibold text-foreground">
 {ANNOTATION_TYPE_LABELS[annotation.type]}
 </h3>
 {isIssue && (
 <span
  className="text-xs px-2 py-0.5 rounded-full"
  style={{
  backgroundColor: `${ANNOTATION_STATUS_COLORS[annotation.status]}20`,
  color: ANNOTATION_STATUS_COLORS[annotation.status],
  }}
 >
  {ANNOTATION_STATUS_LABELS[annotation.status]}
 </span>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2">
 {/* More actions */}
 <div className="relative">
 <button
 onClick={handleClick3}
 className="p-2 rounded-3xl hover:bg-muted/50 text-muted-foreground transition-colors"
 >
 <MoreHorizontal className="w-4 h-4" />
 </button>

 {showActions && (
 <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-muted rounded-3xl shadow-xl border border-border/50 z-decorator">
  <button
  onClick={handleTogglePin}
  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50"
  >
  {annotation.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
  {annotation.isPinned ? t('voxel.annotations.unpin', { defaultValue: 'Désépingler' }) : t('voxel.annotations.pin', { defaultValue: 'Épingler' })}
  </button>

  {isOwner && (
  <>
  <button
  onClick={handleClick5}
  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50"
  >
  <Edit2 className="w-4 h-4" />
  {t('common.edit', { defaultValue: 'Modifier' })}
  </button>

  <button
  onClick={handleClick6}
  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
  >
  <Trash2 className="w-4 h-4" />
  {t('common.delete', { defaultValue: 'Supprimer' })}
  </button>
  </>
  )}
 </div>
 )}
 </div>

 <button
 onClick={onClose}
 className="p-2 rounded-3xl hover:bg-muted/50 text-muted-foreground transition-colors"
 aria-label="Fermer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Main content area */}
 <div className="flex-1 overflow-y-auto">
 {/* Annotation content */}
 <div className="p-5 border-b border-border/50">
 {/* Author info */}
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-violet-500 flex items-center justify-center">
 <span className="text-sm font-bold text-foreground">
  {annotation.author.displayName.charAt(0).toUpperCase()}
 </span>
 </div>
 <div>
 <span className="text-sm font-medium text-foreground">
  {annotation.author.displayName}
 </span>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Clock className="w-3 h-3" />
  <span>
  {createdDate.toLocaleDateString(config.intlLocale)} a {createdDate.toLocaleTimeString(config.intlLocale, { hour: '2-digit', minute: '2-digit' })}
  </span>
 </div>
 </div>

 {annotation.isPinned && (
 <Pin className="w-4 h-4 text-amber-400 ml-auto" />
 )}
 </div>

 {/* Content */}
 <p className="text-sm text-muted-foreground/60 whitespace-pre-wrap leading-relaxed">
 {annotation.content}
 </p>

 {/* Mentions */}
 {annotation.mentions.length > 0 && (
 <div className="flex items-center gap-2 mt-3 flex-wrap">
 {annotation.mentions.map((mention, idx) => (
  <span
  key={idx || 'unknown'}
  className="px-2 py-1 bg-primary/15 text-primary/70 text-xs rounded-lg"
  >
  @{mention}
  </span>
 ))}
 </div>
 )}

 {/* Issue actions */}
 {isIssue && (
 <div className="flex gap-2 mt-4">
 {canResolve && (
  <button
  onClick={handleResolve}
  disabled={isResolving}
  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-3xl text-sm font-medium hover:bg-green-500/30 transition-colors"
  >
  {isResolving ? (
  <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
  ) : (
  <CheckCircle className="w-4 h-4" />
  )}
  {t('voxel.annotations.resolve', { defaultValue: 'Résoudre' })}
  </button>
 )}

 {canReopen && (
  <button
  onClick={handleReopen}
  className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-3xl text-sm font-medium hover:bg-amber-500/30 transition-colors"
  >
  <XCircle className="w-4 h-4" />
  {t('voxel.annotations.reopen', { defaultValue: 'Rouvrir' })}
  </button>
 )}
 </div>
 )}

 {/* Resolution info */}
 {annotation.resolvedBy && annotation.resolvedAt && (
 <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-500/30 rounded-3xl">
 <div className="flex items-center gap-2 text-green-400 text-sm">
  <Check className="w-4 h-4" />
  <span>
  Résolu par {annotation.resolvedBy.displayName} le{' '}
  {new Date(annotation.resolvedAt).toLocaleDateString(config.intlLocale)}
  </span>
 </div>
 {annotation.resolutionNotes && (
  <p className="text-xs text-muted-foreground mt-2">
  {annotation.resolutionNotes}
  </p>
 )}
 </div>
 )}
 </div>

 {/* Replies section */}
 <div>
 {/* Replies header */}
 <button
 onClick={handleClick4}
 className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
 >
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <MessageSquare className="w-4 h-4" />
 <span>{annotation.replyCount} {t('voxel.annotations.replies', { defaultValue: 'réponse(s)' })}</span>
 </div>
 {isExpanded ? (
 <ChevronUp className="w-4 h-4 text-muted-foreground" />
 ) : (
 <ChevronDown className="w-4 h-4 text-muted-foreground" />
 )}
 </button>

 {/* Replies list */}
 <AnimatePresence>
 {isExpanded && (
 <motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
 >
  {isLoadingReplies ? (
  <div className="flex items-center justify-center py-8">
  <div className="w-6 h-6 border-2 border-primary/30 border-t-brand-400 rounded-full animate-spin" />
  </div>
  ) : replies.length === 0 ? (
  <div className="py-8 text-center text-sm text-muted-foreground">
  {t('voxel.annotations.noReplies', { defaultValue: 'Aucune réponse pour le moment' })}
  </div>
  ) : (
  <div className="divide-y divide-border/30">
  {replies.map((reply) => (
  <ReplyItem
  key={reply.id || 'unknown'}
  reply={reply}
  currentUserId={user?.uid}
  onEdit={handleEditReply}
  onDelete={handleDelete}
  />
  ))}
  </div>
  )}
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>

 {/* Reply form */}
 {author && (
 <ReplyForm
 annotationId={annotation.id}
 organizationId={annotation.organizationId}
 author={author}
 editingReply={editingReply}
 onSubmit={handleReplySubmit}
 onCancelEdit={handleCancelEdit}
 />
 )}

 {/* Delete Reply Confirmation */}
 <ConfirmModal
 isOpen={deleteReplyId !== null}
 onClose={handleClose}
 onConfirm={handleConfirm}
 title={t('voxel.annotations.deleteReplyTitle', { defaultValue: 'Supprimer la réponse' })}
 message={t('voxel.annotations.deleteReplyMessage', { defaultValue: 'Êtes-vous sûr de vouloir supprimer cette réponse ?' })}
 type="danger"
 confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 />

 {/* Delete Annotation Confirmation */}
 <ConfirmModal
 isOpen={showDeleteAnnotationConfirm}
 onClose={handleClose2}
 onConfirm={handleDeleteAnnotation}
 title={t('voxel.annotations.deleteAnnotationTitle', { defaultValue: "Supprimer l'annotation" })}
 message={t('voxel.annotations.deleteAnnotationMessage', { defaultValue: 'Êtes-vous sûr de vouloir supprimer cette annotation et toutes ses réponses ?' })}
 type="danger"
 confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 />
 </motion.div>
 </AnimatePresence>
 );
};

export default AnnotationThread;
