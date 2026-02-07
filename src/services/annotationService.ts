/**
 * Epic 33: Story 33.2 & 33.5 - Annotation Service
 *
 * Service for managing Voxel annotations with real-time updates.
 * Handles CRUD operations, replies, mentions, and notifications.
 *
 * Firestore Collections:
 * - voxel_annotations: Main annotation documents
 * - voxel_annotations/{id}/replies: Reply subcollection
 */

import { db } from '../firebase';
import {
 collection,
 doc,
 addDoc,
 getDoc,
 getDocs,
 updateDoc,
 query,
 where,
 orderBy,
 limit,
 onSnapshot,
 serverTimestamp,
 Timestamp,
 writeBatch,
 increment,
 arrayUnion,
 QueryConstraint,
} from 'firebase/firestore';
import { ErrorLogger } from './errorLogger';
import { NotificationService } from './notificationService';
import { sanitizeData } from '../utils/dataSanitizer';
import { getLocaleConfig, type SupportedLocale } from '../config/localeConfig';
import i18n from '../i18n';
import type {
 VoxelAnnotation,
 AnnotationReply,
 AnnotationFilter,
 CreateAnnotationDTO,
 UpdateAnnotationDTO,
 CreateReplyDTO,
 UpdateReplyDTO,
 AnnotationAuthor,
 AnnotationExportOptions,
 AnnotationExportRow,
} from '../types/voxelAnnotation';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_NAME = 'voxel_annotations';
const REPLIES_SUBCOLLECTION = 'replies';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Firestore timestamp to ISO string
 */
const timestampToString = (timestamp: Timestamp | string | undefined): string => {
 if (!timestamp) return new Date().toISOString();
 if (typeof timestamp === 'string') return timestamp;
 if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
 if (typeof timestamp === 'object' && 'seconds' in timestamp) {
 return new Date((timestamp as { seconds: number }).seconds * 1000).toISOString();
 }
 return new Date().toISOString();
};

/**
 * Parse @mentions from text content
 * Supports formats: @username, @[User Name], @userId
 */
export const parseMentions = (content: string): string[] => {
 const mentionPatterns = [
 /@\[([^\]]+)\]/g,   // @[User Name] format
 /@([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*(?:@[a-zA-Z0-9_.-]+)?)/g, // @username or @user.name or @user@domain format
 ];

 const mentions = new Set<string>();

 for (const pattern of mentionPatterns) {
 let match;
 while ((match = pattern.exec(content)) !== null) {
 mentions.add(match[1]);
 }
 }

 return Array.from(mentions);
};

/**
 * Convert annotation document to typed object
 */
const docToAnnotation = (docSnap: { id: string; data: () => Record<string, unknown> }): VoxelAnnotation => {
 const data = docSnap.data();
 return {
 id: docSnap.id,
 organizationId: data.organizationId as string,
 nodeId: data.nodeId as string | undefined,
 position: data.position as VoxelAnnotation['position'],
 content: data.content as string,
 author: data.author as AnnotationAuthor,
 createdAt: timestampToString(data.createdAt as Timestamp | string | undefined),
 updatedAt: timestampToString(data.updatedAt as Timestamp | string | undefined),
 type: data.type as VoxelAnnotation['type'],
 color: data.color as string,
 visibility: data.visibility as VoxelAnnotation['visibility'],
 teamId: data.teamId as string | undefined,
 attachments: (data.attachments as VoxelAnnotation['attachments']) || [],
 replies: (data.replies as AnnotationReply[]) || [],
 replyCount: (data.replyCount as number) || 0,
 status: (data.status as VoxelAnnotation['status']) || 'open',
 readBy: (data.readBy as string[]) || [],
 mentions: (data.mentions as string[]) || [],
 isPinned: (data.isPinned as boolean) || false,
 resolutionNotes: data.resolutionNotes as string | undefined,
 resolvedBy: data.resolvedBy as AnnotationAuthor | undefined,
 resolvedAt: data.resolvedAt ? timestampToString(data.resolvedAt as Timestamp | string | undefined) : undefined,
 };
};

/**
 * Convert reply document to typed object
 */
const docToReply = (docSnap: { id: string; data: () => Record<string, unknown> }): AnnotationReply => {
 const data = docSnap.data();
 return {
 id: docSnap.id,
 annotationId: data.annotationId as string,
 content: data.content as string,
 author: data.author as AnnotationAuthor,
 createdAt: timestampToString(data.createdAt as Timestamp | string | undefined),
 updatedAt: data.updatedAt ? timestampToString(data.updatedAt as Timestamp | string | undefined) : undefined,
 mentions: (data.mentions as string[]) || [],
 isEdited: (data.isEdited as boolean) || false,
 attachments: data.attachments as AnnotationReply['attachments'],
 reactions: data.reactions as AnnotationReply['reactions'],
 };
};

// ============================================================================
// Annotation Service
// ============================================================================

export class AnnotationService {
 // ==========================================================================
 // CRUD Operations
 // ==========================================================================

 /**
 * Create a new annotation
 */
 static async createAnnotation(
 organizationId: string,
 author: AnnotationAuthor,
 dto: CreateAnnotationDTO
 ): Promise<VoxelAnnotation> {
 try {
 const mentions = parseMentions(dto.content);
 const defaultColor = dto.color || '#3b82f6';

 const annotationData = sanitizeData({
 organizationId,
 nodeId: dto.nodeId || null,
 position: dto.position,
 content: dto.content,
 author,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 type: dto.type,
 color: defaultColor,
 visibility: dto.visibility,
 teamId: dto.teamId || null,
 attachments: dto.attachments || [],
 replies: [],
 replyCount: 0,
 status: dto.type === 'issue' ? 'open' : 'open',
 readBy: [author.id],
 mentions,
 isPinned: false,
 });

 const docRef = await addDoc(collection(db, COLLECTION_NAME), annotationData);

 // Notify mentioned users
 if (mentions.length > 0) {
 await this.notifyMentionedUsers(
 organizationId,
 mentions,
 author,
 docRef.id,
 dto.content,
 'annotation'
 );
 }

 const createdDoc = await getDoc(docRef);
 return docToAnnotation({ id: createdDoc.id, data: () => createdDoc.data() as Record<string, unknown> });
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.createAnnotation');
 throw error;
 }
 }

 /**
 * Get a single annotation by ID
 */
 static async getAnnotation(annotationId: string): Promise<VoxelAnnotation | null> {
 try {
 const docRef = doc(db, COLLECTION_NAME, annotationId);
 const docSnap = await getDoc(docRef);

 if (!docSnap.exists()) return null;

 return docToAnnotation({ id: docSnap.id, data: () => docSnap.data() as Record<string, unknown> });
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.getAnnotation');
 return null;
 }
 }

 /**
 * Get annotations with filters
 */
 static async getAnnotations(
 organizationId: string,
 filters: AnnotationFilter = {}
 ): Promise<VoxelAnnotation[]> {
 try {
 const constraints: QueryConstraint[] = [
 where('organizationId', '==', organizationId),
 ];

 if (filters.nodeId) {
 constraints.push(where('nodeId', '==', filters.nodeId));
 }

 if (filters.types && filters.types.length > 0) {
 constraints.push(where('type', 'in', filters.types));
 }

 if (filters.authorId) {
 constraints.push(where('author.id', '==', filters.authorId));
 }

 if (filters.visibility) {
 constraints.push(where('visibility', '==', filters.visibility));
 }

 if (filters.status && filters.status.length > 0) {
 constraints.push(where('status', 'in', filters.status));
 }

 if (filters.pinnedOnly) {
 constraints.push(where('isPinned', '==', true));
 }

 if (filters.mentionsUserId) {
 constraints.push(where('mentions', 'array-contains', filters.mentionsUserId));
 }

 // Order by
 const orderField = filters.orderBy || 'createdAt';
 const orderDir = filters.orderDirection || 'desc';
 constraints.push(orderBy(orderField, orderDir));

 // Limit
 if (filters.limit) {
 constraints.push(limit(filters.limit));
 }

 const q = query(collection(db, COLLECTION_NAME), ...constraints);
 const querySnapshot = await getDocs(q);

 let annotations = querySnapshot.docs.map((docSnap) =>
 docToAnnotation({ id: docSnap.id, data: () => docSnap.data() as Record<string, unknown> })
 );

 // Client-side filtering for complex queries
 if (filters.searchQuery) {
 const searchLower = filters.searchQuery.toLowerCase();
 annotations = annotations.filter(
 (a) =>
 a.content.toLowerCase().includes(searchLower) ||
 a.author.displayName.toLowerCase().includes(searchLower)
 );
 }

 if (filters.dateRange) {
 const startDate = new Date(filters.dateRange.start);
 const endDate = new Date(filters.dateRange.end);
 annotations = annotations.filter((a) => {
 const created = new Date(a.createdAt);
 return created >= startDate && created <= endDate;
 });
 }

 return annotations;
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.getAnnotations');
 return [];
 }
 }

 /**
 * Update an annotation
 */
 static async updateAnnotation(
 annotationId: string,
 dto: UpdateAnnotationDTO,
 updatedBy?: AnnotationAuthor
 ): Promise<VoxelAnnotation | null> {
 try {
 const docRef = doc(db, COLLECTION_NAME, annotationId);
 const existingDoc = await getDoc(docRef);

 if (!existingDoc.exists()) return null;

 const existingData = existingDoc.data();
 const updateData: Record<string, unknown> = {
 updatedAt: serverTimestamp(),
 };

 if (dto.content !== undefined) {
 updateData.content = dto.content;
 updateData.mentions = parseMentions(dto.content);
 }

 if (dto.type !== undefined) updateData.type = dto.type;
 if (dto.color !== undefined) updateData.color = dto.color;
 if (dto.visibility !== undefined) updateData.visibility = dto.visibility;
 if (dto.teamId !== undefined) updateData.teamId = dto.teamId;
 if (dto.position !== undefined) updateData.position = dto.position;
 if (dto.isPinned !== undefined) updateData.isPinned = dto.isPinned;

 // Status change handling
 if (dto.status !== undefined) {
 updateData.status = dto.status;

 if ((dto.status === 'resolved' || dto.status === 'closed') && updatedBy) {
 updateData.resolvedBy = updatedBy;
 updateData.resolvedAt = serverTimestamp();
 if (dto.resolutionNotes) {
 updateData.resolutionNotes = dto.resolutionNotes;
 }
 }
 }

 await updateDoc(docRef, sanitizeData(updateData));

 // Notify new mentions if content changed
 if (dto.content !== undefined) {
 const newMentions = parseMentions(dto.content);
 const oldMentions = (existingData.mentions as string[]) || [];
 const addedMentions = newMentions.filter((m) => !oldMentions.includes(m));

 if (addedMentions.length > 0 && updatedBy) {
 await this.notifyMentionedUsers(
 existingData.organizationId as string,
 addedMentions,
 updatedBy,
 annotationId,
 dto.content,
 'annotation'
 );
 }
 }

 try {
 const updatedDoc = await getDoc(docRef);
 return docToAnnotation({ id: updatedDoc.id, data: () => updatedDoc.data() as Record<string, unknown> });
 } catch (error) {
  ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la récupération de l\'annotation mise à jour');
  return null;
 }
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.updateAnnotation');
 return null;
 }
 }

 /**
 * Delete an annotation and its replies
 */
 static async deleteAnnotation(annotationId: string): Promise<boolean> {
 try {
 const batch = writeBatch(db);

 // Delete all replies first
 const repliesRef = collection(db, COLLECTION_NAME, annotationId, REPLIES_SUBCOLLECTION);
 const repliesSnap = await getDocs(repliesRef);
 repliesSnap.docs.forEach((replyDoc) => {
 batch.delete(replyDoc.ref);
 });

 // Delete the annotation
 batch.delete(doc(db, COLLECTION_NAME, annotationId));

 await batch.commit();
 return true;
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.deleteAnnotation');
 return false;
 }
 }

 // ==========================================================================
 // Reply Operations
 // ==========================================================================

 /**
 * Create a reply to an annotation
 */
 static async createReply(
 author: AnnotationAuthor & { organizationId?: string },
 dto: CreateReplyDTO
 ): Promise<AnnotationReply | null> {
 try {
 const annotationRef = doc(db, COLLECTION_NAME, dto.annotationId);
 const annotationSnap = await getDoc(annotationRef);

 if (!annotationSnap.exists()) return null;

 const annotationData = annotationSnap.data();

 // IDOR check: verify the author belongs to the same organization as the annotation
 if (author.organizationId && annotationData.organizationId !== author.organizationId) {
 throw new Error('Access denied');
 }
 const mentions = parseMentions(dto.content);

 const replyData = sanitizeData({
 annotationId: dto.annotationId,
 content: dto.content,
 author,
 createdAt: serverTimestamp(),
 mentions,
 isEdited: false,
 attachments: dto.attachments || [],
 });

 // Add reply to subcollection
 const repliesRef = collection(db, COLLECTION_NAME, dto.annotationId, REPLIES_SUBCOLLECTION);
 const replyDocRef = await addDoc(repliesRef, replyData);

 // Update annotation reply count and inline replies
 const currentReplies = (annotationData.replies as AnnotationReply[]) || [];
 const newReply: AnnotationReply = {
 id: replyDocRef.id,
 annotationId: dto.annotationId,
 content: dto.content,
 author,
 createdAt: serverTimestamp(),
 mentions,
 isEdited: false,
 attachments: dto.attachments as AnnotationReply['attachments'],
 };

 // Keep only last 3 replies inline
 const inlineReplies = [...currentReplies, newReply].slice(-3);

 await updateDoc(annotationRef, sanitizeData({
 replyCount: increment(1),
 replies: inlineReplies,
 updatedAt: serverTimestamp(),
 }));

 // Notify mentioned users
 if (mentions.length > 0) {
 await this.notifyMentionedUsers(
 annotationData.organizationId as string,
 mentions,
 author,
 dto.annotationId,
 dto.content,
 'reply'
 );
 }

 // Notify annotation author if different from reply author
 const annotationAuthor = annotationData.author as AnnotationAuthor;
 if (annotationAuthor.id !== author.id) {
 await NotificationService.create(
 { uid: annotationAuthor.id, organizationId: annotationData.organizationId as string },
 'info',
 'Nouvelle réponse',
 `${author.displayName} a répondu à votre annotation`,
 `/voxel?annotation=${dto.annotationId}`,
 7,
 'system'
 );
 }

 return newReply;
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.createReply');
 return null;
 }
 }

 /**
 * Get all replies for an annotation
 */
 static async getReplies(annotationId: string): Promise<AnnotationReply[]> {
 try {
 const repliesRef = collection(db, COLLECTION_NAME, annotationId, REPLIES_SUBCOLLECTION);
 const q = query(repliesRef, orderBy('createdAt', 'asc'));
 const querySnapshot = await getDocs(q);

 return querySnapshot.docs.map((docSnap) =>
 docToReply({ id: docSnap.id, data: () => docSnap.data() as Record<string, unknown> })
 );
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.getReplies');
 return [];
 }
 }

 /**
 * Update a reply
 */
 static async updateReply(
 annotationId: string,
 replyId: string,
 dto: UpdateReplyDTO
 ): Promise<AnnotationReply | null> {
 try {
 const replyRef = doc(db, COLLECTION_NAME, annotationId, REPLIES_SUBCOLLECTION, replyId);
 const replySnap = await getDoc(replyRef);

 if (!replySnap.exists()) return null;

 const updateData = {
 content: dto.content,
 mentions: parseMentions(dto.content),
 updatedAt: serverTimestamp(),
 isEdited: true,
 };

 await updateDoc(replyRef, sanitizeData(updateData));

 const updatedDoc = await getDoc(replyRef);
 return docToReply({ id: updatedDoc.id, data: () => updatedDoc.data() as Record<string, unknown> });
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.updateReply');
 return null;
 }
 }

 /**
 * Delete a reply
 */
 static async deleteReply(annotationId: string, replyId: string, organizationId: string): Promise<boolean> {
 try {
 const annotationRef = doc(db, COLLECTION_NAME, annotationId);
 const annotationSnap = await getDoc(annotationRef);

 if (!annotationSnap.exists()) return false;

 const annotationData = annotationSnap.data();
 if (annotationData.organizationId !== organizationId) {
 throw new Error('Access denied');
 }

 const replyRef = doc(db, COLLECTION_NAME, annotationId, REPLIES_SUBCOLLECTION, replyId);

 // Atomic batch: delete reply + decrement count + update timestamp
 const batch = writeBatch(db);
 batch.delete(replyRef);
 batch.update(annotationRef, {
 replyCount: increment(-1),
 updatedAt: serverTimestamp(),
 });
 await batch.commit();

 // Refresh inline replies (must be done after batch since we need to read remaining replies)
 const remainingReplies = await this.getReplies(annotationId);
 const inlineReplies = remainingReplies.slice(-3);

 await updateDoc(annotationRef, {
 replies: inlineReplies,
 });

 return true;
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.deleteReply');
 return false;
 }
 }

 // ==========================================================================
 // Real-time Subscriptions
 // ==========================================================================

 /**
 * Subscribe to annotations for an organization
 */
 static subscribeToAnnotations(
 organizationId: string,
 callback: (annotations: VoxelAnnotation[]) => void,
 filters: AnnotationFilter = {}
 ): () => void {
 try {
 const constraints: QueryConstraint[] = [
 where('organizationId', '==', organizationId),
 orderBy('createdAt', 'desc'),
 ];

 if (filters.nodeId) {
 constraints.push(where('nodeId', '==', filters.nodeId));
 }

 if (filters.limit) {
 constraints.push(limit(filters.limit));
 }

 const q = query(collection(db, COLLECTION_NAME), ...constraints);

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const annotations = snapshot.docs.map((docSnap) =>
 docToAnnotation({ id: docSnap.id, data: () => docSnap.data() as Record<string, unknown> })
 );
 callback(annotations);
 },
 (error) => {
 ErrorLogger.error(error, 'AnnotationService.subscribeToAnnotations');
 }
 );
 return unsubscribe;
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.subscribeToAnnotations');
 return () => {};
 }
 }

 /**
 * Subscribe to replies for an annotation
 */
 static subscribeToReplies(
 annotationId: string,
 callback: (replies: AnnotationReply[]) => void
 ): () => void {
 try {
 const repliesRef = collection(db, COLLECTION_NAME, annotationId, REPLIES_SUBCOLLECTION);
 const q = query(repliesRef, orderBy('createdAt', 'asc'));

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const replies = snapshot.docs.map((docSnap) =>
 docToReply({ id: docSnap.id, data: () => docSnap.data() as Record<string, unknown> })
 );
 callback(replies);
 },
 (error) => {
 ErrorLogger.error(error, 'AnnotationService.subscribeToReplies');
 }
 );
 return unsubscribe;
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.subscribeToReplies');
 return () => {};
 }
 }

 // ==========================================================================
 // Mention Notifications
 // ==========================================================================

 /**
 * Notify users who were mentioned
 */
 static async notifyMentionedUsers(
 organizationId: string,
 mentions: string[],
 mentionedBy: AnnotationAuthor,
 annotationId: string,
 content: string,
 context: 'annotation' | 'reply'
 ): Promise<void> {
 try {
 const contextLabel = context === 'annotation' ? 'une annotation' : 'une réponse';
 const preview = content.length > 100 ? content.substring(0, 97) + '...' : content;

 for (const userId of mentions) {
 // Skip self-mentions
 if (userId === mentionedBy.id) continue;

 await NotificationService.create(
 { uid: userId, organizationId },
 'mention',
 `Vous avez été mentionné`,
 `${mentionedBy.displayName} vous a mentionné dans ${contextLabel}: "${preview}"`,
 `/voxel?annotation=${annotationId}`,
 14, // Expires in 14 days
 'system'
 );
 }
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.notifyMentionedUsers');
 }
 }

 // ==========================================================================
 // Utility Operations
 // ==========================================================================

 /**
 * Mark annotation as read by user
 */
 static async markAsRead(annotationId: string, userId: string, _organizationId: string): Promise<void> {
 try {
 const docRef = doc(db, COLLECTION_NAME, annotationId);

 // Use arrayUnion for atomic update to avoid race conditions
 // The organizationId security check is enforced by Firestore security rules
 await updateDoc(docRef, {
 readBy: arrayUnion(userId),
 });
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.markAsRead');
 }
 }

 /**
 * Pin/unpin an annotation
 */
 static async togglePin(annotationId: string, organizationId: string): Promise<boolean> {
 try {
 const docRef = doc(db, COLLECTION_NAME, annotationId);
 const docSnap = await getDoc(docRef);

 if (!docSnap.exists()) return false;

 const annotationData = docSnap.data();
 if (annotationData.organizationId !== organizationId) {
 throw new Error('Access denied');
 }

 const currentlyPinned = annotationData.isPinned || false;
 await updateDoc(docRef, sanitizeData({
 isPinned: !currentlyPinned,
 updatedAt: serverTimestamp(),
 }));

 return !currentlyPinned;
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.togglePin');
 return false;
 }
 }

 /**
 * Resolve an issue annotation
 */
 static async resolveIssue(
 annotationId: string,
 resolvedBy: AnnotationAuthor,
 resolutionNotes?: string
 ): Promise<VoxelAnnotation | null> {
 return this.updateAnnotation(
 annotationId,
 {
 status: 'resolved',
 resolutionNotes,
 },
 resolvedBy
 );
 }

 /**
 * Close an annotation
 */
 static async closeAnnotation(
 annotationId: string,
 closedBy: AnnotationAuthor
 ): Promise<VoxelAnnotation | null> {
 return this.updateAnnotation(
 annotationId,
 { status: 'closed' },
 closedBy
 );
 }

 // ==========================================================================
 // Export Operations (Story 33.6)
 // ==========================================================================

 /**
 * Export annotations in specified format
 */
 static async exportAnnotations(
 organizationId: string,
 options: AnnotationExportOptions
 ): Promise<string | AnnotationExportRow[] | VoxelAnnotation[]> {
 try {
 const annotations = await this.getAnnotations(organizationId, {
 ...options.filters,
 dateRange: options.dateRange,
 });

 switch (options.format) {
 case 'csv':
 return this.generateCSV(annotations);
 case 'json':
 if (options.includeReplies) {
 // Fetch full replies for each annotation
 const annotationsWithReplies = await Promise.all(
 annotations.map(async (annotation) => {
 const replies = await this.getReplies(annotation.id);
 return { ...annotation, replies };
 })
 );
 return annotationsWithReplies;
 }
 return annotations;
 case 'pdf':
 return this.generateAnnotationReport(annotations);
 default:
 return annotations;
 }
 } catch (error) {
 ErrorLogger.error(error, 'AnnotationService.exportAnnotations');
 throw error;
 }
 }

 /**
 * Generate CSV from annotations
 */
 private static generateCSV(annotations: VoxelAnnotation[]): string {
 const headers = [
 'ID',
 'Node ID',
 'Position X',
 'Position Y',
 'Position Z',
 'Content',
 'Author Name',
 'Author Email',
 'Created At',
 'Updated At',
 'Type',
 'Visibility',
 'Status',
 'Reply Count',
 'Mention Count',
 'Attachment Count',
 ];

 const rows = annotations.map((a) => [
 a.id,
 a.nodeId || '',
 a.position.x.toString(),
 a.position.y.toString(),
 a.position.z.toString(),
 `"${a.content.replace(/"/g, '""')}"`,
 a.author.displayName,
 a.author.email || '',
 a.createdAt,
 a.updatedAt,
 a.type,
 a.visibility,
 a.status,
 a.replyCount.toString(),
 a.mentions.length.toString(),
 a.attachments.length.toString(),
 ]);

 return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
 }

 /**
 * Generate PDF report (returns HTML for PDF generation)
 */
 private static generateAnnotationReport(annotations: VoxelAnnotation[]): string {
 const typeStats = annotations.reduce(
 (acc, a) => {
 acc[a.type] = (acc[a.type] || 0) + 1;
 return acc;
 },
 {} as Record<string, number>
 );

 const statusStats = annotations.reduce(
 (acc, a) => {
 acc[a.status] = (acc[a.status] || 0) + 1;
 return acc;
 },
 {} as Record<string, number>
 );

 const html = `
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <title>Rapport des Annotations Voxel</title>
 <style>
 body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; padding: 40px; }
 h1 { color: #1e293b; }
 h2 { color: #475569; margin-top: 30px; }
 .stats { display: flex; gap: 20px; margin: 20px 0; }
 .stat { background: #f1f5f9; padding: 15px 25px; border-radius: 12px; }
 .stat-value { font-size: 24px; font-weight: 600; color: #0f172a; }
 .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
 table { width: 100%; border-collapse: collapse; margin-top: 20px; }
 th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
 th { background: #f8fafc; font-weight: 600; color: #475569; }
 .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 12px; }
 .badge-note { background: #dbeafe; color: #1e40af; }
 .badge-question { background: #ede9fe; color: #5b21b6; }
 .badge-issue { background: #fee2e2; color: #b91c1c; }
 .badge-highlight { background: #fef3c7; color: #92400e; }
 </style>
 </head>
 <body>
 <h1>Rapport des Annotations Voxel</h1>
 <p>Genere le ${new Date().toLocaleDateString(getLocaleConfig(i18n.language as SupportedLocale).intlLocale)}</p>

 <h2>Statistiques</h2>
 <div class="stats">
 <div class="stat">
 <div class="stat-value">${annotations.length}</div>
 <div class="stat-label">Total Annotations</div>
 </div>
 <div class="stat">
 <div class="stat-value">${typeStats.issue || 0}</div>
 <div class="stat-label">Problèmes</div>
 </div>
 <div class="stat">
 <div class="stat-value">${statusStats.open || 0}</div>
 <div class="stat-label">Ouverts</div>
 </div>
 <div class="stat">
 <div class="stat-value">${statusStats.resolved || 0}</div>
 <div class="stat-label">Résolus</div>
 </div>
 </div>

 <h2>Liste des Annotations</h2>
 <table>
 <thead>
 <tr>
 <th>Type</th>
 <th>Contenu</th>
 <th>Auteur</th>
 <th>Statut</th>
 <th>Date</th>
 </tr>
 </thead>
 <tbody>
 ${annotations
 .map(
 (a) => `
 <tr>
 <td><span class="badge badge-${a.type}">${a.type}</span></td>
 <td>${a.content.substring(0, 100)}${a.content.length > 100 ? '...' : ''}</td>
 <td>${a.author.displayName}</td>
 <td>${a.status}</td>
 <td>${new Date(a.createdAt).toLocaleDateString(getLocaleConfig(i18n.language as SupportedLocale).intlLocale)}</td>
 </tr>
 `
 )
 .join('')}
 </tbody>
 </table>
 </body>
 </html>
 `;

 return html;
 }
}

export default AnnotationService;
