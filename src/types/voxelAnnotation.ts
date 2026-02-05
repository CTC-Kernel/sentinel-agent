/**
 * Epic 33: Story 33.1 - Annotation Data Model
 *
 * Type definitions for the Voxel Annotation & Collaboration system.
 * Supports 3D spatial annotations, threaded discussions, and mentions.
 *
 * Firestore Structure:
 * - Collection: voxel_annotations
 * - Subcollection: voxel_annotations/{annotationId}/replies
 */

// ============================================================================
// Core Annotation Types
// ============================================================================

/**
 * Annotation type categories
 */
export type AnnotationType = 'note' | 'question' | 'issue' | 'highlight';

/**
 * Visibility scope for annotations
 */
export type AnnotationVisibility = 'public' | 'private' | 'team';

/**
 * Status of an annotation (for issues)
 */
export type AnnotationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/**
 * 3D position in the Voxel scene
 */
export interface Position3D {
 x: number;
 y: number;
 z: number;
}

/**
 * Author information for annotations and replies
 */
export interface AnnotationAuthor {
 id: string;
 displayName: string;
 email?: string;
 avatarUrl?: string;
}

/**
 * Attachment file reference
 */
export interface AnnotationAttachment {
 id: string;
 fileName: string;
 fileUrl: string;
 fileType: string;
 fileSize: number;
 uploadedAt: string;
 uploadedBy: string;
}

// ============================================================================
// Main Annotation Interface
// ============================================================================

/**
 * Voxel Annotation - A 3D spatial annotation in the Voxel scene
 */
export interface VoxelAnnotation {
 /** Unique identifier */
 id: string;

 /** Organization ID for multi-tenant isolation */
 organizationId: string;

 /** The node this annotation is attached to (optional - can be free-floating) */
 nodeId?: string;

 /** 3D position in the scene */
 position: Position3D;

 /** Annotation content (supports markdown/HTML) */
 content: string;

 /** Author of the annotation */
 author: AnnotationAuthor;

 /** Creation timestamp */
 createdAt: string;

 /** Last update timestamp */
 updatedAt: string;

 /** Type of annotation */
 type: AnnotationType;

 /** Display color (hex) */
 color: string;

 /** Visibility scope */
 visibility: AnnotationVisibility;

 /** Team ID if visibility is 'team' */
 teamId?: string;

 /** File attachments */
 attachments: AnnotationAttachment[];

 /** Inline replies (for quick access, first 3 replies) */
 replies: AnnotationReply[];

 /** Total reply count */
 replyCount: number;

 /** Status (primarily for issues) */
 status: AnnotationStatus;

 /** User IDs who have read this annotation */
 readBy: string[];

 /** Mentioned user IDs in the content */
 mentions: string[];

 /** Whether this annotation is pinned */
 isPinned: boolean;

 /** Resolution notes (for closed issues) */
 resolutionNotes?: string;

 /** User who resolved the annotation */
 resolvedBy?: AnnotationAuthor;

 /** Resolution timestamp */
 resolvedAt?: string;
}

// ============================================================================
// Reply Interface
// ============================================================================

/**
 * Reply to an annotation
 */
export interface AnnotationReply {
 /** Unique identifier */
 id: string;

 /** Parent annotation ID */
 annotationId: string;

 /** Reply content (supports markdown/HTML) */
 content: string;

 /** Author of the reply */
 author: AnnotationAuthor;

 /** Creation timestamp */
 createdAt: string;

 /** Last update timestamp */
 updatedAt?: string;

 /** Mentioned user IDs in the content */
 mentions: string[];

 /** Whether this reply has been edited */
 isEdited: boolean;

 /** Attachments */
 attachments?: AnnotationAttachment[];

 /** Reactions (emoji -> user IDs) */
 reactions?: Record<string, string[]>;
}

// ============================================================================
// Filter & Query Types
// ============================================================================

/**
 * Filter options for querying annotations
 */
export interface AnnotationFilter {
 /** Filter by node ID */
 nodeId?: string;

 /** Filter by type(s) */
 types?: AnnotationType[];

 /** Filter by author ID */
 authorId?: string;

 /** Filter by visibility */
 visibility?: AnnotationVisibility;

 /** Filter by status */
 status?: AnnotationStatus[];

 /** Filter by date range */
 dateRange?: {
 start: string;
 end: string;
 };

 /** Search query for content */
 searchQuery?: string;

 /** Include only unread */
 unreadOnly?: boolean;

 /** Include only with mentions of user */
 mentionsUserId?: string;

 /** Include only pinned */
 pinnedOnly?: boolean;

 /** Limit results */
 limit?: number;

 /** Order by field */
 orderBy?: 'createdAt' | 'updatedAt' | 'replyCount';

 /** Order direction */
 orderDirection?: 'asc' | 'desc';
}

// ============================================================================
// Create/Update DTOs
// ============================================================================

/**
 * Data for creating a new annotation
 */
export interface CreateAnnotationDTO {
 nodeId?: string;
 position: Position3D;
 content: string;
 type: AnnotationType;
 color?: string;
 visibility: AnnotationVisibility;
 teamId?: string;
 attachments?: Omit<AnnotationAttachment, 'id' | 'uploadedAt' | 'uploadedBy'>[];
}

/**
 * Data for updating an existing annotation
 */
export interface UpdateAnnotationDTO {
 content?: string;
 type?: AnnotationType;
 color?: string;
 visibility?: AnnotationVisibility;
 teamId?: string;
 position?: Position3D;
 status?: AnnotationStatus;
 isPinned?: boolean;
 resolutionNotes?: string;
}

/**
 * Data for creating a reply
 */
export interface CreateReplyDTO {
 annotationId: string;
 content: string;
 attachments?: Omit<AnnotationAttachment, 'id' | 'uploadedAt' | 'uploadedBy'>[];
}

/**
 * Data for updating a reply
 */
export interface UpdateReplyDTO {
 content: string;
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Export format options
 */
export type AnnotationExportFormat = 'csv' | 'json' | 'pdf';

/**
 * Export options
 */
export interface AnnotationExportOptions {
 format: AnnotationExportFormat;
 filters?: AnnotationFilter;
 includeReplies?: boolean;
 includeAttachments?: boolean;
 dateRange?: {
 start: string;
 end: string;
 };
}

/**
 * Flattened annotation for CSV export
 */
export interface AnnotationExportRow {
 id: string;
 nodeId: string;
 positionX: number;
 positionY: number;
 positionZ: number;
 content: string;
 authorName: string;
 authorEmail: string;
 createdAt: string;
 updatedAt: string;
 type: AnnotationType;
 visibility: AnnotationVisibility;
 status: AnnotationStatus;
 replyCount: number;
 mentionCount: number;
 attachmentCount: number;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Annotation mode for the creator UI
 */
export type AnnotationMode = 'view' | 'create' | 'edit' | 'reply';

/**
 * Annotation creator state
 */
export interface AnnotationCreatorState {
 mode: AnnotationMode;
 position: Position3D | null;
 editingAnnotation: VoxelAnnotation | null;
 replyingTo: VoxelAnnotation | null;
 isVisible: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default colors for annotation types
 */
export const ANNOTATION_TYPE_COLORS: Record<AnnotationType, string> = {
 note: '#3b82f6', // Blue
 question: '#8b5cf6', // Purple
 issue: '#ef4444', // Red
 highlight: '#f59e0b', // Amber
};

/**
 * Status colors
 */
export const ANNOTATION_STATUS_COLORS: Record<AnnotationStatus, string> = {
 open: '#ef4444', // Red
 in_progress: '#f59e0b', // Amber
 resolved: '#22c55e', // Green
 closed: '#6b7280', // Gray
};

/**
 * Type icons (Lucide icon names)
 */
export const ANNOTATION_TYPE_ICONS: Record<AnnotationType, string> = {
 note: 'sticky-note',
 question: 'help-circle',
 issue: 'alert-triangle',
 highlight: 'highlighter',
};

/**
 * Visibility icons
 */
export const ANNOTATION_VISIBILITY_ICONS: Record<AnnotationVisibility, string> = {
 public: 'globe',
 private: 'lock',
 team: 'users',
};

/**
 * French labels for annotation types
 */
export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
 note: 'Note',
 question: 'Question',
 issue: 'Probleme',
 highlight: 'Surlignage',
};

/**
 * French labels for visibility
 */
export const ANNOTATION_VISIBILITY_LABELS: Record<AnnotationVisibility, string> = {
 public: 'Public',
 private: 'Privé',
 team: 'Équipe',
};

/**
 * French labels for status
 */
export const ANNOTATION_STATUS_LABELS: Record<AnnotationStatus, string> = {
 open: 'Ouvert',
 in_progress: 'En cours',
 resolved: 'Résolu',
 closed: 'Fermé',
};
