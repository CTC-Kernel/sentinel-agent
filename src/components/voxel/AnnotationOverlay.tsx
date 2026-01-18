/**
 * Epic 33: Story 33.3 - Annotation Overlay (3D)
 *
 * Renders all visible annotations in the 3D scene.
 * Features:
 * - Filter by visibility, type, author
 * - Toggle show/hide annotations
 * - Batch rendering for performance
 * - Integration with VoxelStore for node positions
 */

import React, { useMemo, useCallback } from 'react';
import type { VoxelAnnotation, AnnotationType, AnnotationVisibility, AnnotationStatus } from '../../types/voxelAnnotation';
import type { VoxelNode } from '../../types/voxel';
import { AnnotationMarker } from './AnnotationMarker';

// ============================================================================
// Types
// ============================================================================

interface AnnotationOverlayProps {
  /** All annotations to potentially display */
  annotations: VoxelAnnotation[];

  /** Map of all nodes (for finding nearest node) */
  nodes: Map<string, VoxelNode>;

  /** Currently selected annotation ID */
  selectedAnnotationId?: string | null;

  /** Current user ID (for unread detection) */
  currentUserId?: string;

  /** Whether annotations are visible */
  visible?: boolean;

  /** Filter by annotation types */
  filterTypes?: AnnotationType[];

  /** Filter by visibility */
  filterVisibility?: AnnotationVisibility[];

  /** Filter by status */
  filterStatus?: AnnotationStatus[];

  /** Filter by author ID */
  filterAuthorId?: string;

  /** Filter by node ID */
  filterNodeId?: string;

  /** Show only unread annotations */
  showUnreadOnly?: boolean;

  /** Show only pinned annotations */
  showPinnedOnly?: boolean;

  /** Callback when an annotation is clicked */
  onAnnotationClick?: (annotation: VoxelAnnotation) => void;

  /** Callback when an annotation is hovered */
  onAnnotationHover?: (annotation: VoxelAnnotation | null) => void;

  /** Scale factor for all markers */
  markerScale?: number;

  /** Maximum number of annotations to render (performance) */
  maxVisible?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the nearest node to an annotation position
 */
const findNearestNode = (
  annotationPosition: { x: number; y: number; z: number },
  nodes: Map<string, VoxelNode>,
  nodeId?: string
): VoxelNode | null => {
  // If annotation is attached to a specific node, return that node
  if (nodeId) {
    return nodes.get(nodeId) || null;
  }

  // Find the nearest node by distance
  let nearestNode: VoxelNode | null = null;
  let minDistance = Infinity;

  nodes.forEach((node) => {
    const dx = node.position.x - annotationPosition.x;
    const dy = node.position.y - annotationPosition.y;
    const dz = node.position.z - annotationPosition.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < minDistance) {
      minDistance = distance;
      nearestNode = node;
    }
  });

  // Only return if within reasonable distance
  return minDistance < 10 ? nearestNode : null;
};

/**
 * Filter annotations based on criteria
 */
const filterAnnotations = (
  annotations: VoxelAnnotation[],
  options: {
    filterTypes?: AnnotationType[];
    filterVisibility?: AnnotationVisibility[];
    filterStatus?: AnnotationStatus[];
    filterAuthorId?: string;
    filterNodeId?: string;
    showUnreadOnly?: boolean;
    showPinnedOnly?: boolean;
    currentUserId?: string;
  }
): VoxelAnnotation[] => {
  return annotations.filter((annotation) => {
    // Filter by type
    if (options.filterTypes && options.filterTypes.length > 0) {
      if (!options.filterTypes.includes(annotation.type)) return false;
    }

    // Filter by visibility
    if (options.filterVisibility && options.filterVisibility.length > 0) {
      if (!options.filterVisibility.includes(annotation.visibility)) return false;
    }

    // Filter by status
    if (options.filterStatus && options.filterStatus.length > 0) {
      if (!options.filterStatus.includes(annotation.status)) return false;
    }

    // Filter by author
    if (options.filterAuthorId) {
      if (annotation.author.id !== options.filterAuthorId) return false;
    }

    // Filter by node
    if (options.filterNodeId) {
      if (annotation.nodeId !== options.filterNodeId) return false;
    }

    // Filter by unread status
    if (options.showUnreadOnly && options.currentUserId) {
      if (annotation.readBy.includes(options.currentUserId)) return false;
    }

    // Filter by pinned status
    if (options.showPinnedOnly) {
      if (!annotation.isPinned) return false;
    }

    return true;
  });
};

/**
 * Sort annotations by priority (pinned first, then by date)
 */
const sortAnnotations = (annotations: VoxelAnnotation[]): VoxelAnnotation[] => {
  return [...annotations].sort((a, b) => {
    // Pinned annotations first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Issues before other types
    if (a.type === 'issue' && b.type !== 'issue') return -1;
    if (a.type !== 'issue' && b.type === 'issue') return 1;

    // Open issues before resolved
    if (a.type === 'issue' && b.type === 'issue') {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
    }

    // Then by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

// ============================================================================
// Main Component
// ============================================================================

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = React.memo(({
  annotations,
  nodes,
  selectedAnnotationId,
  currentUserId,
  visible = true,
  filterTypes,
  filterVisibility,
  filterStatus,
  filterAuthorId,
  filterNodeId,
  showUnreadOnly = false,
  showPinnedOnly = false,
  onAnnotationClick,
  onAnnotationHover,
  markerScale = 1,
  maxVisible = 100,
}) => {
  // Filter and sort annotations
  const visibleAnnotations = useMemo(() => {
    if (!visible) return [];

    const filtered = filterAnnotations(annotations, {
      filterTypes,
      filterVisibility,
      filterStatus,
      filterAuthorId,
      filterNodeId,
      showUnreadOnly,
      showPinnedOnly,
      currentUserId,
    });

    const sorted = sortAnnotations(filtered);

    // Limit for performance
    return sorted.slice(0, maxVisible);
  }, [
    annotations,
    visible,
    filterTypes,
    filterVisibility,
    filterStatus,
    filterAuthorId,
    filterNodeId,
    showUnreadOnly,
    showPinnedOnly,
    currentUserId,
    maxVisible,
  ]);

  // Memoize nearest node lookup
  const getNearestNodePosition = useCallback(
    (annotation: VoxelAnnotation) => {
      const nearestNode = findNearestNode(annotation.position, nodes, annotation.nodeId);
      return nearestNode?.position || undefined;
    },
    [nodes]
  );

  // Handle click
  const handleClick = useCallback(
    (annotation: VoxelAnnotation) => {
      onAnnotationClick?.(annotation);
    },
    [onAnnotationClick]
  );

  // Handle hover
  const handleHover = useCallback(
    (annotation: VoxelAnnotation | null) => {
      onAnnotationHover?.(annotation);
    },
    [onAnnotationHover]
  );

  if (!visible || visibleAnnotations.length === 0) {
    return null;
  }

  return (
    <group name="annotation-overlay">
      {visibleAnnotations.map((annotation) => (
        <AnnotationMarker
          key={annotation.id}
          annotation={annotation}
          isSelected={selectedAnnotationId === annotation.id}
          currentUserId={currentUserId}
          nearestNodePosition={getNearestNodePosition(annotation)}
          onClick={handleClick}
          onHover={handleHover}
          scale={markerScale}
        />
      ))}
    </group>
  );
});

AnnotationOverlay.displayName = 'AnnotationOverlay';

// ============================================================================
// Filter Panel Component (2D UI)
// ============================================================================

interface AnnotationFilterPanelProps {
  /** Whether annotations are visible */
  annotationsVisible: boolean;

  /** Toggle annotations visibility */
  onToggleVisibility: () => void;

  /** Currently active type filters */
  activeTypes: AnnotationType[];

  /** Toggle a type filter */
  onToggleType: (type: AnnotationType) => void;

  /** Show only unread */
  showUnreadOnly: boolean;

  /** Toggle unread filter */
  onToggleUnreadOnly: () => void;

  /** Show only pinned */
  showPinnedOnly: boolean;

  /** Toggle pinned filter */
  onTogglePinnedOnly: () => void;

  /** Total annotation count */
  totalCount: number;

  /** Visible annotation count */
  visibleCount: number;
}

export const AnnotationFilterPanel: React.FC<AnnotationFilterPanelProps> = ({
  annotationsVisible,
  onToggleVisibility,
  activeTypes,
  onToggleType,
  showUnreadOnly,
  onToggleUnreadOnly,
  showPinnedOnly,
  onTogglePinnedOnly,
  totalCount,
  visibleCount,
}) => {
  const allTypes: AnnotationType[] = ['note', 'question', 'issue', 'highlight'];

  return (
    <div className="glass-panel rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Annotations</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {visibleCount} / {totalCount}
          </span>
          <button
            onClick={onToggleVisibility}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              annotationsVisible ? 'bg-blue-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                annotationsVisible ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {annotationsVisible && (
        <>
          {/* Type filters */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Types</span>
            <div className="flex flex-wrap gap-2">
              {allTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => onToggleType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTypes.includes(type)
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                      : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Quick filters */}
          <div className="flex gap-2">
            <button
              onClick={onToggleUnreadOnly}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                showUnreadOnly
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
              }`}
            >
              Non lues
            </button>
            <button
              onClick={onTogglePinnedOnly}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                showPinnedOnly
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
              }`}
            >
              Epinglees
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AnnotationOverlay;
