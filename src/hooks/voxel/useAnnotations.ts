/**
 * Epic 33: Story 33.2/33.6 - useAnnotations Hook
 *
 * React hook for managing Voxel annotations with real-time updates.
 * Provides:
 * - Real-time annotation subscription
 * - CRUD operations
 * - Filtering and search
 * - Export functionality
 * - Annotation mode management
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  VoxelAnnotation,
  AnnotationReply,
  AnnotationFilter,
  CreateAnnotationDTO,
  UpdateAnnotationDTO,
  AnnotationAuthor,
  Position3D,
  AnnotationType,
  AnnotationExportOptions,
  AnnotationCreatorState,
} from '../../types/voxelAnnotation';
import { AnnotationService } from '../../services/annotationService';
import { useAuth } from '../useAuth';

// ============================================================================
// Types
// ============================================================================

export interface UseAnnotationsOptions {
  /** Organization ID */
  organizationId: string;

  /** Initial filters */
  initialFilters?: AnnotationFilter;

  /** Whether to auto-subscribe to real-time updates */
  autoSubscribe?: boolean;

  /** Limit number of annotations */
  limit?: number;

  /** Callback when annotation is selected */
  onAnnotationSelect?: (annotation: VoxelAnnotation | null) => void;
}

export interface UseAnnotationsReturn {
  // Data
  annotations: VoxelAnnotation[];
  selectedAnnotation: VoxelAnnotation | null;
  hoveredAnnotation: VoxelAnnotation | null;
  replies: AnnotationReply[];

  // Loading states
  isLoading: boolean;
  isLoadingReplies: boolean;
  isSaving: boolean;

  // Error state
  error: string | null;

  // Filters
  filters: AnnotationFilter;
  setFilters: (filters: AnnotationFilter) => void;
  updateFilter: <K extends keyof AnnotationFilter>(key: K, value: AnnotationFilter[K]) => void;
  resetFilters: () => void;

  // Selection
  selectAnnotation: (annotation: VoxelAnnotation | null) => void;
  setHoveredAnnotation: (annotation: VoxelAnnotation | null) => void;

  // Annotation mode
  annotationMode: AnnotationCreatorState;
  startAnnotationMode: (position?: Position3D, nodeId?: string) => void;
  cancelAnnotationMode: () => void;
  setEditingAnnotation: (annotation: VoxelAnnotation | null) => void;

  // CRUD operations
  createAnnotation: (dto: CreateAnnotationDTO) => Promise<VoxelAnnotation | null>;
  updateAnnotation: (id: string, dto: UpdateAnnotationDTO) => Promise<VoxelAnnotation | null>;
  deleteAnnotation: (id: string) => Promise<boolean>;

  // Reply operations
  loadReplies: (annotationId: string) => Promise<void>;
  createReply: (annotationId: string, content: string) => Promise<AnnotationReply | null>;
  updateReply: (annotationId: string, replyId: string, content: string) => Promise<AnnotationReply | null>;
  deleteReply: (annotationId: string, replyId: string) => Promise<boolean>;

  // Actions
  togglePin: (annotationId: string) => Promise<boolean>;
  resolveIssue: (annotationId: string, notes?: string) => Promise<VoxelAnnotation | null>;
  markAsRead: (annotationId: string) => Promise<void>;
  refresh: () => Promise<void>;

  // Export
  exportAnnotations: (options: AnnotationExportOptions) => Promise<string | VoxelAnnotation[] | unknown[]>;
  downloadExport: (options: AnnotationExportOptions, filename?: string) => Promise<void>;

  // Stats
  stats: {
    total: number;
    byType: Record<AnnotationType, number>;
    unread: number;
    issues: { open: number; resolved: number };
  };

  // Current user author
  currentAuthor: AnnotationAuthor | null;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FILTERS: AnnotationFilter = {
  types: undefined,
  status: undefined,
  visibility: undefined,
  pinnedOnly: false,
  unreadOnly: false,
  orderBy: 'createdAt',
  orderDirection: 'desc',
};

const INITIAL_CREATOR_STATE: AnnotationCreatorState = {
  mode: 'view',
  position: null,
  editingAnnotation: null,
  replyingTo: null,
  isVisible: false,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAnnotations(options: UseAnnotationsOptions): UseAnnotationsReturn {
  const { organizationId, initialFilters, autoSubscribe = true, limit = 100, onAnnotationSelect } = options;
  const { user } = useAuth();

  // State
  const [annotations, setAnnotations] = useState<VoxelAnnotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<VoxelAnnotation | null>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<VoxelAnnotation | null>(null);
  const [replies, setReplies] = useState<AnnotationReply[]>([]);
  const [filters, setFilters] = useState<AnnotationFilter>({ ...DEFAULT_FILTERS, ...initialFilters });
  const [annotationMode, setAnnotationMode] = useState<AnnotationCreatorState>(INITIAL_CREATOR_STATE);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const repliesUnsubscribeRef = useRef<(() => void) | null>(null);

  // Current user as author
  const currentAuthor = useMemo<AnnotationAuthor | null>(() => {
    if (!user) return null;
    return {
      id: user.uid,
      displayName: user.displayName || user.email || 'Anonymous',
      email: user.email || undefined,
      avatarUrl: user.photoURL || undefined,
    };
  }, [user]);

  // Subscribe to annotations
  useEffect(() => {
    if (!organizationId || !autoSubscribe) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = AnnotationService.subscribeToAnnotations(
      organizationId,
      (newAnnotations) => {
        setAnnotations(newAnnotations);
        setIsLoading(false);

        // Update selected annotation if it was updated
        if (selectedAnnotation) {
          const updated = newAnnotations.find((a) => a.id === selectedAnnotation.id);
          if (updated) {
            setSelectedAnnotation(updated);
          }
        }
      },
      { ...filters, limit }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [organizationId, autoSubscribe, filters, limit, selectedAnnotation]);

  // Filter updates
  const updateFilter = useCallback(<K extends keyof AnnotationFilter>(key: K, value: AnnotationFilter[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Selection
  const selectAnnotation = useCallback(
    (annotation: VoxelAnnotation | null) => {
      setSelectedAnnotation(annotation);
      onAnnotationSelect?.(annotation);

      // Mark as read when selected
      if (annotation && user?.uid && !annotation.readBy.includes(user.uid)) {
        AnnotationService.markAsRead(annotation.id, user.uid, organizationId);
      }
    },
    [onAnnotationSelect, user?.uid]
  );

  // Annotation mode management
  const startAnnotationMode = useCallback((position?: Position3D, _nodeId?: string) => {
    setAnnotationMode({
      mode: 'create',
      position: position || null,
      editingAnnotation: null,
      replyingTo: null,
      isVisible: true,
    });
  }, []);

  const cancelAnnotationMode = useCallback(() => {
    setAnnotationMode(INITIAL_CREATOR_STATE);
  }, []);

  const setEditingAnnotation = useCallback((annotation: VoxelAnnotation | null) => {
    if (annotation) {
      setAnnotationMode({
        mode: 'edit',
        position: annotation.position,
        editingAnnotation: annotation,
        replyingTo: null,
        isVisible: true,
      });
    } else {
      cancelAnnotationMode();
    }
  }, [cancelAnnotationMode]);

  // CRUD operations
  const createAnnotation = useCallback(
    async (dto: CreateAnnotationDTO): Promise<VoxelAnnotation | null> => {
      if (!currentAuthor) {
        setError('You must be logged in to create annotations');
        return null;
      }

      setIsSaving(true);
      setError(null);

      try {
        const annotation = await AnnotationService.createAnnotation(organizationId, currentAuthor, dto);
        cancelAnnotationMode();
        return annotation;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create annotation');
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [organizationId, currentAuthor, cancelAnnotationMode]
  );

  const updateAnnotation = useCallback(
    async (id: string, dto: UpdateAnnotationDTO): Promise<VoxelAnnotation | null> => {
      setIsSaving(true);
      setError(null);

      try {
        const annotation = await AnnotationService.updateAnnotation(id, dto, currentAuthor || undefined);
        if (annotation && selectedAnnotation?.id === id) {
          setSelectedAnnotation(annotation);
        }
        cancelAnnotationMode();
        return annotation;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update annotation');
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [currentAuthor, selectedAnnotation, cancelAnnotationMode]
  );

  const deleteAnnotation = useCallback(
    async (id: string): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const success = await AnnotationService.deleteAnnotation(id);
        if (success && selectedAnnotation?.id === id) {
          setSelectedAnnotation(null);
        }
        return success;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete annotation');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [selectedAnnotation]
  );

  // Reply operations
  const loadReplies = useCallback(async (annotationId: string): Promise<void> => {
    // Clean up previous subscription
    if (repliesUnsubscribeRef.current) {
      repliesUnsubscribeRef.current();
    }

    setIsLoadingReplies(true);

    try {
      const fetchedReplies = await AnnotationService.getReplies(annotationId);
      setReplies(fetchedReplies);

      // Subscribe to real-time updates
      repliesUnsubscribeRef.current = AnnotationService.subscribeToReplies(annotationId, setReplies);
    } finally {
      setIsLoadingReplies(false);
    }
  }, []);

  const createReply = useCallback(
    async (annotationId: string, content: string): Promise<AnnotationReply | null> => {
      if (!currentAuthor) {
        setError('You must be logged in to reply');
        return null;
      }

      setIsSaving(true);

      try {
        return await AnnotationService.createReply({ ...currentAuthor, organizationId }, { annotationId, content });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create reply');
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [currentAuthor]
  );

  const updateReply = useCallback(
    async (annotationId: string, replyId: string, content: string): Promise<AnnotationReply | null> => {
      setIsSaving(true);

      try {
        return await AnnotationService.updateReply(annotationId, replyId, { content });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update reply');
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const deleteReply = useCallback(async (annotationId: string, replyId: string): Promise<boolean> => {
    setIsSaving(true);

    try {
      return await AnnotationService.deleteReply(annotationId, replyId, organizationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete reply');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [organizationId]);

  // Actions
  const togglePin = useCallback(async (annotationId: string): Promise<boolean> => {
    try {
      return await AnnotationService.togglePin(annotationId, organizationId);
    } catch {
      return false;
    }
  }, [organizationId]);

  const resolveIssue = useCallback(
    async (annotationId: string, notes?: string): Promise<VoxelAnnotation | null> => {
      if (!currentAuthor) return null;

      try {
        return await AnnotationService.resolveIssue(annotationId, currentAuthor, notes);
      } catch {
        return null;
      }
    },
    [currentAuthor]
  );

  const markAsRead = useCallback(
    async (annotationId: string): Promise<void> => {
      if (!user?.uid) return;
      await AnnotationService.markAsRead(annotationId, user.uid, organizationId);
    },
    [user?.uid, organizationId]
  );

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const fetched = await AnnotationService.getAnnotations(organizationId, { ...filters, limit });
      setAnnotations(fetched);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, filters, limit]);

  // Export operations
  const exportAnnotations = useCallback(
    async (exportOptions: AnnotationExportOptions): Promise<string | VoxelAnnotation[] | unknown[]> => {
      return AnnotationService.exportAnnotations(organizationId, exportOptions);
    },
    [organizationId]
  );

  const downloadExport = useCallback(
    async (exportOptions: AnnotationExportOptions, filename?: string): Promise<void> => {
      const data = await exportAnnotations(exportOptions);
      const finalFilename = filename || `annotations-export-${new Date().toISOString().split('T')[0]}`;

      let blob: Blob;
      let extension: string;

      if (typeof data === 'string') {
        if (exportOptions.format === 'csv') {
          blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
          extension = 'csv';
        } else {
          // HTML for PDF
          blob = new Blob([data], { type: 'text/html;charset=utf-8;' });
          extension = 'html';
        }
      } else {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        extension = 'json';
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${finalFilename}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [exportAnnotations]
  );

  // Compute stats
  const stats = useMemo(() => {
    const total = annotations.length;
    const byType: Record<AnnotationType, number> = {
      note: 0,
      question: 0,
      issue: 0,
      highlight: 0,
    };
    let unread = 0;
    let openIssues = 0;
    let resolvedIssues = 0;

    annotations.forEach((a) => {
      byType[a.type]++;

      if (user?.uid && !a.readBy.includes(user.uid)) {
        unread++;
      }

      if (a.type === 'issue') {
        if (a.status === 'open' || a.status === 'in_progress') {
          openIssues++;
        } else {
          resolvedIssues++;
        }
      }
    });

    return {
      total,
      byType,
      unread,
      issues: { open: openIssues, resolved: resolvedIssues },
    };
  }, [annotations, user?.uid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (repliesUnsubscribeRef.current) {
        repliesUnsubscribeRef.current();
      }
    };
  }, []);

  return {
    annotations,
    selectedAnnotation,
    hoveredAnnotation,
    replies,
    isLoading,
    isLoadingReplies,
    isSaving,
    error,
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    selectAnnotation,
    setHoveredAnnotation,
    annotationMode,
    startAnnotationMode,
    cancelAnnotationMode,
    setEditingAnnotation,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    loadReplies,
    createReply,
    updateReply,
    deleteReply,
    togglePin,
    resolveIssue,
    markAsRead,
    refresh,
    exportAnnotations,
    downloadExport,
    stats,
    currentAuthor,
  };
}

export default useAnnotations;
