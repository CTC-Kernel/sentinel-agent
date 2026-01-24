import React, { useState, useMemo, useCallback, useRef } from 'react';
import { orderBy, serverTimestamp, where } from 'firebase/firestore';
import { useStore } from '../../store';
import { Comment } from '../../types';
import {
    Send, MessageSquare, Reply, Search, Filter, Download,
    Bell, Users, ChevronDown, ChevronUp, X
} from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../utils/cn';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/lib/toast';

interface DiscussionPanelProps {
    collectionName: string;
    documentId: string;
    title?: string;
    className?: string;
    showHeader?: boolean;
    compact?: boolean;
    enableNotifications?: boolean;
    enableExport?: boolean;
    enableSearch?: boolean;
    enableFilters?: boolean;
    maxHeight?: string;
}

type SortOption = 'newest' | 'oldest' | 'mostReplies' | 'mostMentions';
type FilterOption = 'all' | 'mentions' | 'myComments' | 'unread';

export const DiscussionPanel: React.FC<DiscussionPanelProps> = ({
    collectionName,
    documentId,
    title = 'Discussion',
    className,
    showHeader = true,
    compact = false,
    enableNotifications = true,
    enableExport = true,
    enableSearch = true,
    enableFilters = true,
    maxHeight = '60vh'
}) => {
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
    const [highlightedComment, setHighlightedComment] = useState<string | null>(null);

    const { user, t } = useStore();
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Enhanced comment query with filters - handled inline in useFirestoreCollection call

    const { data: comments, add: addRaw, loading } = useFirestoreCollection<Comment>(
        `${collectionName}/${documentId}/comments`,
        filterBy === 'myComments' && user
            ? [where('userId', '==', user.uid), orderBy('createdAt', 'asc')]
            : [orderBy('createdAt', 'asc')],
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

    // Enhanced comment organization with search and filtering
    const processedComments = useMemo(() => {
        let filteredComments = comments;

        // Search filtering
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredComments = filteredComments.filter(c =>
                c.content.toLowerCase().includes(query) ||
                c.userName.toLowerCase().includes(query) ||
                c.mentions?.some(m => m.toLowerCase().includes(query))
            );
        }

        // Mention filtering
        if (filterBy === 'mentions' && user) {
            filteredComments = filteredComments.filter(c =>
                c.mentions?.some(m => m.toLowerCase() === user.displayName?.toLowerCase() || m.toLowerCase() === user.email?.split('@')[0])
            );
        }

        // Organize into threads
        const rootComments = filteredComments.filter(c => !c.parentId);
        const replies = filteredComments.filter(c => c.parentId);

        return rootComments.map(root => ({
            ...root,
            replies: replies.filter(r => r.parentId === root.id)
        }));
    }, [comments, searchQuery, filterBy, user]);

    // Sorting logic
    const sortedComments = useMemo(() => {
        const sorted = [...processedComments];

        switch (sortBy) {
            case 'oldest':
                return sorted.reverse();
            case 'mostReplies':
                return sorted.sort((a, b) => (b.replies?.length || 0) - (a.replies?.length || 0));
            case 'mostMentions':
                return sorted.sort((a, b) => (b.mentions?.length || 0) - (a.mentions?.length || 0));
            case 'newest':
            default:
                return sorted;
        }
    }, [processedComments, sortBy]);

    // Statistics
    const stats = useMemo(() => {
        const totalComments = comments.length;
        const totalReplies = comments.filter(c => c.parentId).length;
        const uniqueUsers = new Set(comments.map(c => c.userId)).size;
        const myComments = user ? comments.filter(c => c.userId === user.uid).length : 0;

        return {
            totalComments,
            totalReplies,
            uniqueUsers,
            myComments,
            unreadCount: comments.filter(c =>
                !c.readBy?.includes(user?.uid || '') &&
                c.userId !== user?.uid
            ).length
        };
    }, [comments, user]);

    const commentSchema = z.object({
        content: z.string().min(1, 'Le commentaire ne peut pas être vide').max(1000)
    });

    type CommentFormData = z.infer<typeof commentSchema>;

    const { register, handleSubmit, reset, formState: { isValid, isSubmitting, errors } } = useForm<CommentFormData>({
        resolver: zodResolver(commentSchema),
        defaultValues: { content: '' }
    });

    const onSubmit: SubmitHandler<CommentFormData> = async (data) => {
        if (!user) return;

        // Enhanced mention detection
        const mentionRegex = /@(\w+)/g;
        const mentions: string[] = [];
        let match;
        while ((match = mentionRegex.exec(data.content)) !== null) {
            mentions.push(match[1]);
        }

        try {
            const newComment = await add({
                userId: user.uid,
                userName: user.displayName || user.email || 'Utilisateur',
                content: data.content.trim(),
                mentions,
                ...(user.organizationId ? { organizationId: user.organizationId } : {}),
                ...(replyTo ? { parentId: replyTo } : {}),
                // read: false // TODO: Implement read tracking
            });

            // Send notification if enabled
            if (notificationsEnabled && mentions.length > 0) {
                // Use toast notification for now - notificationService needs to be implemented
                mentions.forEach(mention => {
                    toast.info(`@${mention} a été mentionné dans la discussion`);
                });
            }

            reset();
            setReplyTo(null);

            // Highlight new comment
            if (typeof newComment === 'string') {
                setHighlightedComment(newComment);
                setTimeout(() => setHighlightedComment(null), 3000);
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'DiscussionPanel.handleSubmit', 'CREATE_FAILED');
        }
    };

    const handleExport = useCallback(() => {
        const exportData = {
            title,
            documentId,
            collectionName,
            exportedAt: new Date().toISOString(),
            stats,
            comments: comments.map(c => ({
                author: c.userName,
                content: c.content,
                createdAt: c.createdAt,
                mentions: c.mentions,
                replies: c.parentId ? 'reply' : 'root'
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `discussion-${documentId}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [title, documentId, collectionName, stats, comments]);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (e.target.value) {
            searchInputRef.current?.focus();
        }
    }, []);

    const toggleCommentExpansion = useCallback((commentId: string) => {
        setExpandedComments(prev => {
            const newSet = new Set(prev);
            if (newSet.has(commentId)) {
                newSet.delete(commentId);
            } else {
                newSet.add(commentId);
            }
            return newSet;
        });
    }, []);

    const renderComment = (comment: Comment, isReply = false, level = 0) => {
        const isHighlighted = comment.id === highlightedComment;
        const isExpanded = expandedComments.has(comment.id);
        const hasReplies = Boolean((comment as Comment & { replies?: Comment[] }).replies?.length);
        const isMe = comment.userId === user?.uid;

        return (
            <div
                key={comment.id}
                className={cn(
                    "flex gap-3 transition-all duration-300",
                    isReply && `ml-${Math.min(level * 8, 24)}`,
                    isHighlighted && "ring-2 ring-brand-500/50 bg-brand-50/50 dark:bg-brand-500/10 rounded-xl p-1",
                    compact && isReply && "ml-4"
                )}
            >
                <div className="flex-shrink-0">
                    <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                        isMe ? "bg-brand-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    )}>
                        {comment.userName.charAt(0).toUpperCase()}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className={cn(
                        "rounded-xl px-4 py-3 border transition-all hover:shadow-sm",
                        isHighlighted ? "bg-brand-100 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30" : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50"
                    )}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {comment.userName}
                                </span>
                                {isMe && (
                                    <span className="text-[10px] bg-brand-500 text-white px-2 py-0.5 rounded-full font-medium">
                                        Vous
                                    </span>
                                )}
                                {comment.mentions && comment.mentions.length > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                        <Users className="h-3 w-3" />
                                        {comment.mentions.length}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 dark:text-muted-foreground">
                                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr })}
                                </span>
                                {hasReplies && (
                                    <button
                                        onClick={() => toggleCommentExpansion(comment.id)}
                                        className="text-xs text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                    >
                                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                        {(comment as Comment & { replies?: Comment[] }).replies?.length || 0}
                                    </button>
                                )}
                            </div>
                        </div>

                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {comment.content.split(' ').map((word, i) => {
                                if (word.startsWith('@')) {
                                    return <span key={`${i}-${word}`} className="text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-500/10 px-1 rounded">{word} </span>;
                                }
                                return word + ' ';
                            })}
                        </p>
                    </div>

                    {!isReply && (
                        <div className="flex items-center gap-3 mt-2 px-2">
                            <button
                                type="button"
                                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                                className={cn(
                                    "text-xs font-medium flex items-center gap-1 transition-all px-2 py-1 rounded",
                                    replyTo === comment.id
                                        ? "bg-brand-500 text-white"
                                        : "text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <Reply className="h-3 w-3" />
                                Répondre
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {showHeader && (
                <div className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{stats.totalComments} commentaires</span>
                                <span>•</span>
                                <span>{stats.uniqueUsers} participants</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {enableNotifications && (
                                <button
                                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        notificationsEnabled
                                            ? "bg-brand-500 text-white"
                                            : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
                                    )}
                                    title={notificationsEnabled ? "Désactiver les notifications" : "Activer les notifications"}
                                >
                                    {notificationsEnabled ? <Bell className="h-4 w-4" /> : <Bell className="h-4 w-4 opacity-50" />}
                                </button>
                            )}

                            {enableExport && (
                                <button
                                    onClick={handleExport}
                                    className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
                                    title="Exporter la discussion"
                                >
                                    <Download className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search and Filters */}
                    {(enableSearch || enableFilters) && (
                        <div className="flex flex-col gap-2">
                            {enableSearch && (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        ref={searchInputRef}
                                        value={searchQuery}
                                        onChange={handleSearch}
                                        type="text"
                                        placeholder="Rechercher dans les commentaires..."
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus-visible:ring-brand-500/20 focus:border-brand-500 transition-all text-sm"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {enableFilters && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowFilters(!showFilters)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                                showFilters || filterBy !== 'all'
                                                    ? "bg-brand-500 text-white"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
                                            )}
                                        >
                                            <Filter className="h-3 w-3" />
                                            Filtres
                                            {filterBy !== 'all' && (
                                                <span className="bg-brand-600 dark:bg-brand-400 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                    1
                                                </span>
                                            )}
                                        </button>

                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                                            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:ring-2 focus-visible:ring-brand-500/20 focus:border-brand-500"
                                        >
                                            <option value="newest">Plus récents</option>
                                            <option value="oldest">Plus anciens</option>
                                            <option value="mostReplies">Plus de réponses</option>
                                            <option value="mostMentions">Plus de mentions</option>
                                        </select>
                                    </div>

                                    {searchQuery && (
                                        <div className="text-xs text-slate-500">
                                            {sortedComments.length} résultat{sortedComments.length > 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                            )}

                            {showFilters && (
                                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    {(['all', 'mentions', 'myComments', 'unread'] as FilterOption[]).map(filter => (
                                        <button
                                            key={filter}
                                            onClick={() => setFilterBy(filter)}
                                            className={cn(
                                                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                                filterBy === filter
                                                    ? "bg-brand-600 text-white"
                                                    : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                                            )}
                                        >
                                            {filter === 'all' && 'Tous'}
                                            {filter === 'mentions' && 'Mentions'}
                                            {filter === 'myComments' && 'Mes commentaires'}
                                            {filter === 'unread' && 'Non lus'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Comments List */}
            <div
                className={cn(
                    "flex-1 overflow-y-auto space-y-1 p-2 custom-scrollbar",
                    loading && "opacity-50"
                )}
                style={{ maxHeight }}
            >
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <div className="animate-spin h-6 w-6 mb-2">⌛</div>
                        <p className="text-sm">Chargement...</p>
                    </div>
                ) : sortedComments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                        <MessageSquare className="h-12 w-12 mb-3" />
                        <p className="text-sm font-medium">
                            {searchQuery ? t('common.emptyState.noResults') : t('common.emptyState.noComments')}
                        </p>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="mt-2 text-xs text-brand-600 hover:text-brand-700"
                            >
                                Effacer la recherche
                            </button>
                        )}
                    </div>
                ) : (
                    sortedComments.map((root) => (
                        <div key={root.id}>
                            {renderComment(root)}
                            {expandedComments.has(root.id) && (root as Comment & { replies?: Comment[] }).replies?.map((reply: Comment) =>
                                renderComment(reply, true, 1)
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Reply Form */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                {replyTo && (
                    <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg mb-3 border border-amber-200 dark:border-amber-500/30">
                        <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                            <Reply className="h-4 w-4" />
                            <span>Réponse à un commentaire</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplyTo(null)}
                            className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="relative">
                    <div className="flex gap-2">
                        <input
                            {...register('content')}
                            aria-label={replyTo ? "Votre réponse" : "Ajouter un commentaire"}
                            type="text"
                            placeholder={replyTo ? "Votre réponse..." : "Ajouter un commentaire... @mentionner quelqu'un"}
                            className={cn(
                                "flex-1 pl-4 pr-12 py-3 bg-white dark:bg-slate-900 border rounded-xl focus:ring-2 focus-visible:ring-brand-500/20 focus:border-brand-500 transition-all text-sm resize-none",
                                errors.content
                                    ? "border-red-500 focus:border-red-500"
                                    : "border-slate-200 dark:border-slate-700"
                            )}
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !isValid}
                            className={cn(
                                "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all",
                                isSubmitting || !isValid
                                    ? "bg-slate-200 dark:bg-slate-700 text-muted-foreground cursor-not-allowed"
                                    : "bg-brand-600 text-white hover:bg-brand-700"
                            )}
                        >
                            {isSubmitting ? <span className="animate-spin">⌛</span> : <Send className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.content && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.content.message}</p>
                    )}
                </form>
            </div>
        </div>
    );
};
