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
  const [showActions, setShowActions] = useState(false);
  const isOwner = currentUserId === reply.author.id;
  const createdDate = new Date(reply.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group px-4 py-3 hover:bg-slate-800/30 transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-white">
            {reply.author.displayName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">
              {reply.author.displayName}
            </span>
            <span className="text-xs text-slate-500">
              {createdDate.toLocaleDateString('fr-FR')} a {createdDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {reply.isEdited && (
              <span className="text-xs text-slate-500 italic">(modifié)</span>
            )}
          </div>

          <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
            {reply.content}
          </p>

          {/* Mentions highlight */}
          {reply.mentions.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {reply.mentions.map((mention, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded"
                >
                  @{mention}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {isOwner && showActions && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(reply)}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
              title="Modifier"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(reply.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
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
  author: AnnotationAuthor;
  editingReply?: AnnotationReply;
  onSubmit: () => void;
  onCancelEdit?: () => void;
}> = ({ annotationId, author, editingReply, onSubmit, onCancelEdit }) => {
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
        await AnnotationService.createReply(author, { annotationId, content });
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
    <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
      {editingReply && (
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs text-amber-400">Modification en cours</span>
          <button
            onClick={onCancelEdit}
            className="text-xs text-slate-400 hover:text-white"
          >
            Annuler
          </button>
        </div>
      )}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez une réponse... (Cmd+Enter pour envoyer)"
            rows={2}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          className={`p-3 rounded-xl transition-all ${content.trim() && !isSubmitting
              ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25'
              : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
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

  // State
  const [replies, setReplies] = useState<AnnotationReply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingReply, setEditingReply] = useState<AnnotationReply | undefined>();
  const [showActions, setShowActions] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

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
      AnnotationService.markAsRead(annotation.id, user.uid);
    }
  }, [isOpen, annotation.id, annotation.readBy, user?.uid]);

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
    if (!window.confirm('Supprimer cette réponse ?')) return;

    await AnnotationService.deleteReply(annotation.id, replyId);
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
  }, [annotation.id]);

  // Handle toggle pin
  const handleTogglePin = useCallback(async () => {
    const newPinned = await AnnotationService.togglePin(annotation.id);
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
    if (!window.confirm('Supprimer cette annotation et toutes ses réponses ?')) return;

    const success = await AnnotationService.deleteAnnotation(annotation.id);
    if (success) {
      onAnnotationDelete?.(annotation.id);
      onClose();
    }
  }, [annotation.id, onAnnotationDelete, onClose]);

  if (!isOpen) return null;

  const createdDate = new Date(annotation.createdAt);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        className="fixed right-4 top-20 bottom-4 w-[400px] z-50 flex flex-col glass-panel rounded-3xl shadow-apple-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${annotation.color}20` }}
            >
              <span style={{ color: annotation.color }}>
                {TYPE_ICONS[annotation.type]}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
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
                onClick={() => setShowActions(!showActions)}
                className="p-2 rounded-xl hover:bg-slate-700/50 text-slate-400 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showActions && (
                <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-slate-800 rounded-xl shadow-xl border border-slate-700/50 z-10">
                  <button
                    onClick={handleTogglePin}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50"
                  >
                    {annotation.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    {annotation.isPinned ? 'Désépingler' : 'Épingler'}
                  </button>

                  {isOwner && (
                    <>
                      <button
                        onClick={() => {
                          setShowActions(false);
                          onEditAnnotation?.(annotation);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50"
                      >
                        <Edit2 className="w-4 h-4" />
                        Modifier
                      </button>

                      <button
                        onClick={() => {
                          setShowActions(false);
                          handleDeleteAnnotation();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-700/50 text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Annotation content */}
          <div className="p-5 border-b border-slate-700/50">
            {/* Author info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {annotation.author.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-white">
                  {annotation.author.displayName}
                </span>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>
                    {createdDate.toLocaleDateString('fr-FR')} a {createdDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {annotation.isPinned && (
                <Pin className="w-4 h-4 text-amber-400 ml-auto" />
              )}
            </div>

            {/* Content */}
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {annotation.content}
            </p>

            {/* Mentions */}
            {annotation.mentions.length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {annotation.mentions.map((mention, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-lg"
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
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/30 transition-colors"
                  >
                    {isResolving ? (
                      <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Résoudre
                  </button>
                )}

                {canReopen && (
                  <button
                    onClick={handleReopen}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl text-sm font-medium hover:bg-amber-500/30 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Rouvrir
                  </button>
                )}
              </div>
            )}

            {/* Resolution info */}
            {annotation.resolvedBy && annotation.resolvedAt && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <Check className="w-4 h-4" />
                  <span>
                    Résolu par {annotation.resolvedBy.displayName} le{' '}
                    {new Date(annotation.resolvedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {annotation.resolutionNotes && (
                  <p className="text-xs text-slate-400 mt-2">
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
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <MessageSquare className="w-4 h-4" />
                <span>{annotation.replyCount} réponse(s)</span>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
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
                      <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                    </div>
                  ) : replies.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Aucune réponse pour le moment
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700/30">
                      {replies.map((reply) => (
                        <ReplyItem
                          key={reply.id}
                          reply={reply}
                          currentUserId={user?.uid}
                          onEdit={handleEditReply}
                          onDelete={handleDeleteReply}
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
            author={author}
            editingReply={editingReply}
            onSubmit={handleReplySubmit}
            onCancelEdit={() => setEditingReply(undefined)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AnnotationThread;
