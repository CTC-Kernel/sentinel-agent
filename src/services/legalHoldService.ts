/**
 * Story 25.1 - Legal Hold Service
 *
 * Service for managing legal holds on documents.
 * Legal holds prevent documents from being deleted or modified
 * during litigation or regulatory investigations.
 */

import {
 collection,
 doc,
 addDoc,
 updateDoc,
 deleteDoc,
 getDoc,
 getDocs,
 query,
 where,
 orderBy,
 Timestamp,
 writeBatch,
 arrayUnion,
 arrayRemove,
 serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { LegalHold, LegalHoldStatus } from '@/types/vault';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';

const LEGAL_HOLDS_COLLECTION = 'legalHolds';
const DOCUMENTS_COLLECTION = 'documents';

/**
 * Create a new legal hold
 */
export async function createLegalHold(
 organizationId: string,
 name: string,
 reason: string,
 createdBy: string,
 documentIds: string[] = [],
 options?: {
 description?: string;
 matterNumber?: string;
 custodians?: string[];
 expiresAt?: Date;
 notes?: string;
 }
): Promise<LegalHold> {
 try {
 const now = serverTimestamp();

 const holdData: Omit<LegalHold, 'id'> = {
 organizationId,
 name,
 reason,
 description: options?.description,
 createdBy,
 createdAt: now as unknown as Timestamp,
 documentIds,
 affectedDocumentIds: documentIds,
 status: 'active',
 matterNumber: options?.matterNumber,
 custodians: options?.custodians,
 expiresAt: options?.expiresAt ? Timestamp.fromDate(options.expiresAt) : undefined,
 notes: options?.notes,
 };

 // Create the legal hold
 const holdRef = await addDoc(
 collection(db, LEGAL_HOLDS_COLLECTION),
 sanitizeData(holdData)
 );

 // Update all affected documents to mark them as under legal hold
 if (documentIds.length > 0) {
 const batch = writeBatch(db);

 for (const docId of documentIds) {
 const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
 batch.update(docRef, sanitizeData({
 legalHoldIds: arrayUnion(holdRef.id),
 isUnderHold: true,
 updatedAt: now,
 }));
 }

 await batch.commit();
 }

 return {
 id: holdRef.id,
 ...holdData,
 };
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.createLegalHold');
 throw error;
 }
}

/**
 * Release a legal hold
 */
export async function releaseLegalHold(
 holdId: string,
 releasedBy: string,
 releaseReason?: string
): Promise<void> {
 try {
 const holdRef = doc(db, LEGAL_HOLDS_COLLECTION, holdId);
 const holdSnap = await getDoc(holdRef);

 if (!holdSnap.exists()) {
 throw new Error('Legal hold not found');
 }

 const holdData = holdSnap.data() as LegalHold;

 if (holdData.status === 'released') {
 throw new Error('Legal hold is already released');
 }

 const now = serverTimestamp();

 // Update the legal hold
 await updateDoc(holdRef, sanitizeData({
 status: 'released' as LegalHoldStatus,
 releasedBy,
 releasedAt: now,
 releaseReason,
 updatedAt: now,
 updatedBy: releasedBy,
 }));

 // Remove hold from affected documents
 if (holdData.documentIds && holdData.documentIds.length > 0) {
 const batch = writeBatch(db);

 for (const docId of holdData.documentIds) {
 const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
 const docSnap = await getDoc(docRef);

 if (docSnap.exists()) {
 const docData = docSnap.data();
 const remainingHolds = (docData.legalHoldIds || []).filter(
 (id: string) => id !== holdId
 );

 batch.update(docRef, sanitizeData({
 legalHoldIds: arrayRemove(holdId),
 isUnderHold: remainingHolds.length > 0,
 updatedAt: now,
 }));
 }
 }

 await batch.commit();
 }
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.releaseLegalHold');
 throw error;
 }
}

/**
 * Get all legal holds for an organization
 */
export async function getLegalHolds(
 organizationId: string,
 options?: {
 status?: LegalHoldStatus;
 includeReleased?: boolean;
 }
): Promise<LegalHold[]> {
 try {
 let q = query(
 collection(db, LEGAL_HOLDS_COLLECTION),
 where('organizationId', '==', organizationId),
 orderBy('createdAt', 'desc')
 );

 if (options?.status) {
 q = query(
 collection(db, LEGAL_HOLDS_COLLECTION),
 where('organizationId', '==', organizationId),
 where('status', '==', options.status),
 orderBy('createdAt', 'desc')
 );
 }

 const snapshot = await getDocs(q);
 const holds: LegalHold[] = [];

 snapshot.forEach((docSnap) => {
 const data = docSnap.data();
 // Filter out released holds if not requested
 if (!options?.includeReleased && data.status === 'released') {
 return;
 }
 holds.push({
 id: docSnap.id,
 ...data,
 } as LegalHold);
 });

 return holds;
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.getLegalHolds');
 throw error;
 }
}

/**
 * Get a single legal hold by ID
 */
export async function getLegalHold(holdId: string): Promise<LegalHold | null> {
 try {
 const holdRef = doc(db, LEGAL_HOLDS_COLLECTION, holdId);
 const holdSnap = await getDoc(holdRef);

 if (!holdSnap.exists()) {
 return null;
 }

 return {
 id: holdSnap.id,
 ...holdSnap.data(),
 } as LegalHold;
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.getLegalHold');
 throw error;
 }
}

/**
 * Add a document to an existing legal hold
 */
export async function addDocumentToHold(
 holdId: string,
 documentId: string,
 updatedBy: string
): Promise<void> {
 try {
 const holdRef = doc(db, LEGAL_HOLDS_COLLECTION, holdId);
 const holdSnap = await getDoc(holdRef);

 if (!holdSnap.exists()) {
 throw new Error('Legal hold not found');
 }

 const holdData = holdSnap.data() as LegalHold;

 if (holdData.status === 'released') {
 throw new Error('Cannot add documents to a released legal hold');
 }

 if (holdData.documentIds.includes(documentId)) {
 return; // Document already in hold
 }

 const now = serverTimestamp();
 const batch = writeBatch(db);

 // Update the legal hold
 batch.update(holdRef, sanitizeData({
 documentIds: arrayUnion(documentId),
 affectedDocumentIds: arrayUnion(documentId),
 updatedAt: now,
 updatedBy,
 }));

 // Update the document
 const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
 batch.update(docRef, sanitizeData({
 legalHoldIds: arrayUnion(holdId),
 isUnderHold: true,
 updatedAt: now,
 }));

 await batch.commit();
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.addDocumentToHold');
 throw error;
 }
}

/**
 * Remove a document from a legal hold
 */
export async function removeDocumentFromHold(
 holdId: string,
 documentId: string,
 updatedBy: string
): Promise<void> {
 try {
 const holdRef = doc(db, LEGAL_HOLDS_COLLECTION, holdId);
 const holdSnap = await getDoc(holdRef);

 if (!holdSnap.exists()) {
 throw new Error('Legal hold not found');
 }

 const holdData = holdSnap.data() as LegalHold;

 if (holdData.status === 'released') {
 throw new Error('Cannot modify a released legal hold');
 }

 if (!holdData.documentIds.includes(documentId)) {
 return; // Document not in hold
 }

 const now = serverTimestamp();
 const batch = writeBatch(db);

 // Update the legal hold
 batch.update(holdRef, sanitizeData({
 documentIds: arrayRemove(documentId),
 affectedDocumentIds: arrayRemove(documentId),
 updatedAt: now,
 updatedBy,
 }));

 // Update the document - check if it has other holds
 const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
 const docSnap = await getDoc(docRef);

 if (docSnap.exists()) {
 const docData = docSnap.data();
 const remainingHolds = (docData.legalHoldIds || []).filter(
 (id: string) => id !== holdId
 );

 batch.update(docRef, sanitizeData({
 legalHoldIds: arrayRemove(holdId),
 isUnderHold: remainingHolds.length > 0,
 updatedAt: now,
 }));
 }

 await batch.commit();
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.removeDocumentFromHold');
 throw error;
 }
}

/**
 * Check if a document is under any legal hold
 */
export async function isDocumentUnderHold(documentId: string): Promise<boolean> {
 try {
 const docRef = doc(db, DOCUMENTS_COLLECTION, documentId);
 const docSnap = await getDoc(docRef);

 if (!docSnap.exists()) {
 return false;
 }

 const docData = docSnap.data();
 return docData.isUnderHold === true || (docData.legalHoldIds?.length || 0) > 0;
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.isDocumentUnderHold');
 throw error;
 }
}

/**
 * Get all legal holds affecting a specific document
 */
export async function getHoldsForDocument(
 documentId: string,
 organizationId: string
): Promise<LegalHold[]> {
 try {
 const q = query(
 collection(db, LEGAL_HOLDS_COLLECTION),
 where('organizationId', '==', organizationId),
 where('documentIds', 'array-contains', documentId),
 where('status', '==', 'active')
 );

 const snapshot = await getDocs(q);
 const holds: LegalHold[] = [];

 snapshot.forEach((docSnap) => {
 holds.push({
 id: docSnap.id,
 ...docSnap.data(),
 } as LegalHold);
 });

 return holds;
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.getHoldsForDocument');
 throw error;
 }
}

/**
 * Update legal hold metadata (not documents)
 */
export async function updateLegalHold(
 holdId: string,
 updatedBy: string,
 updates: {
 name?: string;
 reason?: string;
 description?: string;
 matterNumber?: string;
 custodians?: string[];
 notes?: string;
 expiresAt?: Date | null;
 }
): Promise<void> {
 try {
 const holdRef = doc(db, LEGAL_HOLDS_COLLECTION, holdId);
 const holdSnap = await getDoc(holdRef);

 if (!holdSnap.exists()) {
 throw new Error('Legal hold not found');
 }

 const holdData = holdSnap.data() as LegalHold;

 if (holdData.status === 'released') {
 throw new Error('Cannot update a released legal hold');
 }

 const updateData: Record<string, unknown> = {
 updatedAt: serverTimestamp(),
 updatedBy,
 };

 if (updates.name !== undefined) updateData.name = updates.name;
 if (updates.reason !== undefined) updateData.reason = updates.reason;
 if (updates.description !== undefined) updateData.description = updates.description;
 if (updates.matterNumber !== undefined) updateData.matterNumber = updates.matterNumber;
 if (updates.custodians !== undefined) updateData.custodians = updates.custodians;
 if (updates.notes !== undefined) updateData.notes = updates.notes;
 if (updates.expiresAt !== undefined) {
 updateData.expiresAt = updates.expiresAt ? Timestamp.fromDate(updates.expiresAt) : null;
 }

 await updateDoc(holdRef, sanitizeData(updateData));
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.updateLegalHold');
 throw error;
 }
}

/**
 * Delete a legal hold (only if released or empty)
 */
export async function deleteLegalHold(holdId: string): Promise<void> {
 try {
 const holdRef = doc(db, LEGAL_HOLDS_COLLECTION, holdId);
 const holdSnap = await getDoc(holdRef);

 if (!holdSnap.exists()) {
 throw new Error('Legal hold not found');
 }

 const holdData = holdSnap.data() as LegalHold;

 if (holdData.status === 'active' && holdData.documentIds.length > 0) {
 throw new Error('Cannot delete an active legal hold with documents. Release it first.');
 }

 await deleteDoc(holdRef);
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.deleteLegalHold');
 throw error;
 }
}

/**
 * Get count of documents under legal hold for an organization
 */
export async function getLegalHoldStats(organizationId: string): Promise<{
 activeHolds: number;
 releasedHolds: number;
 documentsUnderHold: number;
}> {
 try {
 const holdsQuery = query(
 collection(db, LEGAL_HOLDS_COLLECTION),
 where('organizationId', '==', organizationId)
 );

 const snapshot = await getDocs(holdsQuery);

 let activeHolds = 0;
 let releasedHolds = 0;
 const documentIdsUnderHold = new Set<string>();

 snapshot.forEach((docSnap) => {
 const data = docSnap.data();
 if (data.status === 'active') {
 activeHolds++;
 data.documentIds?.forEach((id: string) => documentIdsUnderHold.add(id));
 } else {
 releasedHolds++;
 }
 });

 return {
 activeHolds,
 releasedHolds,
 documentsUnderHold: documentIdsUnderHold.size,
 };
 } catch (error) {
 ErrorLogger.error(error, 'LegalHoldService.getLegalHoldStats');
 throw error;
 }
}

// Export as a namespace for convenience
export const LegalHoldService = {
 createLegalHold,
 releaseLegalHold,
 getLegalHolds,
 getLegalHold,
 addDocumentToHold,
 removeDocumentFromHold,
 isDocumentUnderHold,
 getHoldsForDocument,
 updateLegalHold,
 deleteLegalHold,
 getLegalHoldStats,
};

export default LegalHoldService;
