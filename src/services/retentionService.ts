/**
 * Story 25.4 - Retention Policy Service
 *
 * Service for managing document retention policies.
 * Handles policy CRUD, expiry calculations, and document queries.
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
 serverTimestamp,
} from 'firebase/firestore';
import { addDays, differenceInDays, isBefore } from 'date-fns';
import { db } from '@/firebase';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
 RetentionPolicy,
 RetentionAction,
 RetentionScope,
 DocumentRetentionStatus,
 ClassificationLevel,
} from '@/types/vault';
import type { Document } from '@/types/documents';
import { ErrorLogger } from './errorLogger';

const RETENTION_POLICIES_COLLECTION = 'retentionPolicies';
const DOCUMENTS_COLLECTION = 'documents';

/**
 * Create a new retention policy
 */
export async function createPolicy(
 organizationId: string,
 name: string,
 retentionDays: number,
 action: RetentionAction,
 createdBy: string,
 options?: {
 description?: string;
 documentType?: string;
 scope?: RetentionScope;
 notifyDaysBefore?: number;
 priority?: number;
 exceptions?: {
 classifications?: ClassificationLevel[];
 excludeLegalHold?: boolean;
 };
 }
): Promise<RetentionPolicy> {
 try {
 const policyData: Omit<RetentionPolicy, 'id'> = {
 organizationId,
 name,
 description: options?.description,
 documentType: options?.documentType,
 retentionDays,
 retentionPeriod: retentionDays,
 action,
 notifyDaysBefore: options?.notifyDaysBefore ?? 30,
 scope: options?.scope,
 exceptions: options?.exceptions ?? { excludeLegalHold: true },
 isActive: true,
 priority: options?.priority ?? 0,
 createdBy,
 createdAt: serverTimestamp() as unknown as Timestamp,
 };

 const policyRef = await addDoc(
 collection(db, RETENTION_POLICIES_COLLECTION),
 sanitizeData(policyData)
 );

 return {
 id: policyRef.id,
 ...policyData,
 };
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.createPolicy');
 throw error;
 }
}

/**
 * Update an existing retention policy
 */
export async function updatePolicy(
 policyId: string,
 organizationId: string,
 updatedBy: string,
 updates: {
 name?: string;
 description?: string;
 retentionDays?: number;
 action?: RetentionAction;
 notifyDaysBefore?: number;
 scope?: RetentionScope;
 exceptions?: {
 classifications?: ClassificationLevel[];
 excludeLegalHold?: boolean;
 };
 isActive?: boolean;
 priority?: number;
 }
): Promise<void> {
 try {
 const policyRef = doc(db, RETENTION_POLICIES_COLLECTION, policyId);
 const policySnap = await getDoc(policyRef);

 if (!policySnap.exists()) {
 throw new Error('Retention policy not found');
 }

 // Verify organizationId ownership
 if (policySnap.data()?.organizationId !== organizationId) {
 throw new Error('Not authorized: organization mismatch');
 }

 const updateData: Record<string, unknown> = {
 updatedAt: serverTimestamp(),
 updatedBy,
 };

 if (updates.name !== undefined) updateData.name = updates.name;
 if (updates.description !== undefined) updateData.description = updates.description;
 if (updates.retentionDays !== undefined) {
 updateData.retentionDays = updates.retentionDays;
 updateData.retentionPeriod = updates.retentionDays;
 }
 if (updates.action !== undefined) updateData.action = updates.action;
 if (updates.notifyDaysBefore !== undefined) updateData.notifyDaysBefore = updates.notifyDaysBefore;
 if (updates.scope !== undefined) updateData.scope = updates.scope;
 if (updates.exceptions !== undefined) updateData.exceptions = updates.exceptions;
 if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
 if (updates.priority !== undefined) updateData.priority = updates.priority;

 await updateDoc(policyRef, sanitizeData(updateData));
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.updatePolicy');
 throw error;
 }
}

/**
 * Delete a retention policy
 */
export async function deletePolicy(policyId: string, organizationId: string): Promise<void> {
 try {
 const policyRef = doc(db, RETENTION_POLICIES_COLLECTION, policyId);
 const policySnap = await getDoc(policyRef);

 if (!policySnap.exists() || policySnap.data()?.organizationId !== organizationId) {
 throw new Error('Not authorized: policy not found or organization mismatch');
 }

 await deleteDoc(policyRef);
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.deletePolicy');
 throw error;
 }
}

/**
 * Get all retention policies for an organization
 */
export async function getPolicies(
 organizationId: string,
 options?: { activeOnly?: boolean }
): Promise<RetentionPolicy[]> {
 try {
 let q = query(
 collection(db, RETENTION_POLICIES_COLLECTION),
 where('organizationId', '==', organizationId),
 orderBy('priority', 'desc')
 );

 if (options?.activeOnly) {
 q = query(
 collection(db, RETENTION_POLICIES_COLLECTION),
 where('organizationId', '==', organizationId),
 where('isActive', '==', true),
 orderBy('priority', 'desc')
 );
 }

 const snapshot = await getDocs(q);
 const policies: RetentionPolicy[] = [];

 snapshot.forEach((docSnap) => {
 policies.push({
 id: docSnap.id,
 ...docSnap.data(),
 } as RetentionPolicy);
 });

 return policies;
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.getPolicies');
 throw error;
 }
}

/**
 * Get a single retention policy
 */
export async function getPolicy(policyId: string, organizationId: string): Promise<RetentionPolicy | null> {
 try {
 const policyRef = doc(db, RETENTION_POLICIES_COLLECTION, policyId);
 const policySnap = await getDoc(policyRef);

 if (!policySnap.exists()) {
 return null;
 }

 // Verify organizationId ownership
 if (policySnap.data()?.organizationId !== organizationId) {
 throw new Error('Not authorized: organization mismatch');
 }

 return {
 id: policySnap.id,
 ...policySnap.data(),
 } as RetentionPolicy;
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.getPolicy');
 throw error;
 }
}

/**
 * Check if a document matches a policy's scope
 */
function documentMatchesScope(document: Document, scope?: RetentionScope): boolean {
 if (!scope) {
 return true; // No scope means matches all
 }

 // Check classification
 if (scope.classifications && scope.classifications.length > 0) {
 const docClassification = document.classification?.level || 'internal';
 if (!scope.classifications.includes(docClassification)) {
 return false;
 }
 }

 // Check document type
 if (scope.documentTypes && scope.documentTypes.length > 0) {
 if (!scope.documentTypes.includes(document.type)) {
 return false;
 }
 }

 // Check folder
 if (scope.folderIds && scope.folderIds.length > 0) {
 if (!document.folderId || !scope.folderIds.includes(document.folderId)) {
 return false;
 }
 }

 return true;
}

/**
 * Check if a document is excluded by policy exceptions
 */
function isDocumentExcluded(
 document: Document,
 exceptions?: {
 classifications?: ClassificationLevel[];
 excludeLegalHold?: boolean;
 }
): boolean {
 if (!exceptions) {
 return false;
 }

 // Check classification exceptions
 if (exceptions.classifications && exceptions.classifications.length > 0) {
 const docClassification = document.classification?.level || 'internal';
 if (exceptions.classifications.includes(docClassification)) {
 return true;
 }
 }

 // Check legal hold exclusion
 if (exceptions.excludeLegalHold && document.isUnderHold) {
 return true;
 }

 return false;
}

/**
 * Get the applicable retention policy for a document
 * Returns the highest priority matching policy
 */
export async function getApplicablePolicy(
 document: Document,
 organizationId: string
): Promise<RetentionPolicy | null> {
 try {
 const policies = await getPolicies(organizationId, { activeOnly: true });

 // Sort by priority (highest first) and find first matching policy
 const sortedPolicies = policies.sort((a, b) => (b.priority || 0) - (a.priority || 0));

 for (const policy of sortedPolicies) {
 // Check if document matches scope
 if (!documentMatchesScope(document, policy.scope)) {
 continue;
 }

 // Check if document is excluded
 if (isDocumentExcluded(document, policy.exceptions)) {
 continue;
 }

 // Check legacy documentType field
 if (policy.documentType && policy.documentType !== document.type) {
 continue;
 }

 return policy;
 }

 return null;
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.getApplicablePolicy');
 throw error;
 }
}

/**
 * Calculate the expiry date for a document based on its creation date and retention policy
 */
export function calculateExpiryDate(
 documentCreatedAt: string | Date | Timestamp,
 retentionDays: number
): Date {
 let creationDate: Date;

 if (documentCreatedAt instanceof Timestamp) {
 creationDate = documentCreatedAt.toDate();
 } else if (typeof documentCreatedAt === 'string') {
 creationDate = new Date(documentCreatedAt);
 } else {
 creationDate = documentCreatedAt;
 }

 return addDays(creationDate, retentionDays);
}

/**
 * Get documents nearing expiry based on retention policies
 */
export async function getDocumentsNearExpiry(
 organizationId: string,
 daysUntilExpiry: number = 30
): Promise<DocumentRetentionStatus[]> {
 try {
 // Get all documents
 const docsQuery = query(
 collection(db, DOCUMENTS_COLLECTION),
 where('organizationId', '==', organizationId)
 );

 const docsSnapshot = await getDocs(docsQuery);
 const documents: Document[] = [];

 docsSnapshot.forEach((docSnap) => {
 documents.push({
 id: docSnap.id,
 ...docSnap.data(),
 } as Document);
 });

 // Get all active policies
 const policies = await getPolicies(organizationId, { activeOnly: true });

 const nearExpiryDocs: DocumentRetentionStatus[] = [];
 const now = new Date();

 for (const document of documents) {
 // Find applicable policy
 const applicablePolicy = policies.find((policy) => {
 if (!documentMatchesScope(document, policy.scope)) return false;
 if (isDocumentExcluded(document, policy.exceptions)) return false;
 if (policy.documentType && policy.documentType !== document.type) return false;
 return true;
 });

 if (!applicablePolicy) continue;

 // Calculate expiry date
 const expiryDate = calculateExpiryDate(
 document.createdAt,
 applicablePolicy.retentionDays
 );

 const daysRemaining = differenceInDays(expiryDate, now);

 // Check if within threshold
 if (daysRemaining <= daysUntilExpiry && daysRemaining >= 0) {
 nearExpiryDocs.push({
 documentId: document.id,
 policyId: applicablePolicy.id,
 policyName: applicablePolicy.name,
 expiryDate: Timestamp.fromDate(expiryDate),
 daysUntilExpiry: daysRemaining,
 action: applicablePolicy.action,
 isUnderLegalHold: document.isUnderHold || false,
 });
 }
 }

 // Sort by days until expiry (ascending)
 nearExpiryDocs.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

 return nearExpiryDocs;
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.getDocumentsNearExpiry');
 throw error;
 }
}

/**
 * Get documents that have expired (past their retention period)
 */
export async function getExpiredDocuments(
 organizationId: string
): Promise<DocumentRetentionStatus[]> {
 try {
 const docsQuery = query(
 collection(db, DOCUMENTS_COLLECTION),
 where('organizationId', '==', organizationId)
 );

 const docsSnapshot = await getDocs(docsQuery);
 const documents: Document[] = [];

 docsSnapshot.forEach((docSnap) => {
 documents.push({
 id: docSnap.id,
 ...docSnap.data(),
 } as Document);
 });

 const policies = await getPolicies(organizationId, { activeOnly: true });
 const expiredDocs: DocumentRetentionStatus[] = [];
 const now = new Date();

 for (const document of documents) {
 const applicablePolicy = policies.find((policy) => {
 if (!documentMatchesScope(document, policy.scope)) return false;
 if (isDocumentExcluded(document, policy.exceptions)) return false;
 if (policy.documentType && policy.documentType !== document.type) return false;
 return true;
 });

 if (!applicablePolicy) continue;

 const expiryDate = calculateExpiryDate(
 document.createdAt,
 applicablePolicy.retentionDays
 );

 if (isBefore(expiryDate, now)) {
 const daysOverdue = differenceInDays(now, expiryDate);
 expiredDocs.push({
 documentId: document.id,
 policyId: applicablePolicy.id,
 policyName: applicablePolicy.name,
 expiryDate: Timestamp.fromDate(expiryDate),
 daysUntilExpiry: -daysOverdue, // Negative = overdue
 action: applicablePolicy.action,
 isUnderLegalHold: document.isUnderHold || false,
 });
 }
 }

 // Sort by most overdue first
 expiredDocs.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

 return expiredDocs;
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.getExpiredDocuments');
 throw error;
 }
}

/**
 * Get document age distribution statistics
 */
export async function getDocumentAgeDistribution(
 organizationId: string
): Promise<{
 under30Days: number;
 under90Days: number;
 under1Year: number;
 under3Years: number;
 over3Years: number;
 total: number;
}> {
 try {
 const docsQuery = query(
 collection(db, DOCUMENTS_COLLECTION),
 where('organizationId', '==', organizationId)
 );

 const docsSnapshot = await getDocs(docsQuery);
 const now = new Date();
 let under30Days = 0;
 let under90Days = 0;
 let under1Year = 0;
 let under3Years = 0;
 let over3Years = 0;

 docsSnapshot.forEach((docSnap) => {
 const data = docSnap.data();
 const createdAt = data.createdAt
 ? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt.toDate())
 : now;
 const ageInDays = differenceInDays(now, createdAt);

 if (ageInDays < 30) under30Days++;
 else if (ageInDays < 90) under90Days++;
 else if (ageInDays < 365) under1Year++;
 else if (ageInDays < 365 * 3) under3Years++;
 else over3Years++;
 });

 return {
 under30Days,
 under90Days,
 under1Year,
 under3Years,
 over3Years,
 total: docsSnapshot.size,
 };
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.getDocumentAgeDistribution');
 throw error;
 }
}

/**
 * Get retention policy statistics
 */
export async function getRetentionStats(organizationId: string): Promise<{
 totalPolicies: number;
 activePolicies: number;
 documentsWithPolicy: number;
 documentsExpiringSoon: number;
 documentsExpired: number;
 documentsUnderLegalHold: number;
}> {
 try {
 const [policies, nearExpiry, expired] = await Promise.all([
 getPolicies(organizationId),
 getDocumentsNearExpiry(organizationId, 30),
 getExpiredDocuments(organizationId),
 ]);

 // Count documents under legal hold from both lists
 const underHoldCount = [...nearExpiry, ...expired].filter(
 (d) => d.isUnderLegalHold
 ).length;

 // Count unique documents that have policies
 const docsWithPolicy = new Set([
 ...nearExpiry.map((d) => d.documentId),
 ...expired.map((d) => d.documentId),
 ]);

 return {
 totalPolicies: policies.length,
 activePolicies: policies.filter((p) => p.isActive !== false).length,
 documentsWithPolicy: docsWithPolicy.size,
 documentsExpiringSoon: nearExpiry.length,
 documentsExpired: expired.filter((d) => !d.isUnderLegalHold).length,
 documentsUnderLegalHold: underHoldCount,
 };
 } catch (error) {
 ErrorLogger.error(error, 'RetentionService.getRetentionStats');
 throw error;
 }
}

// Export as namespace for convenience
export const RetentionService = {
 createPolicy,
 updatePolicy,
 deletePolicy,
 getPolicies,
 getPolicy,
 getApplicablePolicy,
 calculateExpiryDate,
 getDocumentsNearExpiry,
 getExpiredDocuments,
 getDocumentAgeDistribution,
 getRetentionStats,
};

export default RetentionService;
