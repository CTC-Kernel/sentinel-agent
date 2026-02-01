import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Document, UserProfile, WorkflowHistoryItem } from '../types';
import { DocumentStatus, isValidDocumentTransition } from '../types/documents';
import { logAction } from './logger';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';

/**
 * Document status constants for workflow operations
 * Uses the unified DocumentStatus type from types/documents.ts
 */
const Status = {
    DRAFT: 'Brouillon' as DocumentStatus,
    IN_REVIEW: 'En revue' as DocumentStatus,
    APPROVED: 'Approuvé' as DocumentStatus,
    PUBLISHED: 'Publié' as DocumentStatus,
    REJECTED: 'Rejeté' as DocumentStatus,
    ARCHIVED: 'Archivé' as DocumentStatus,
    OBSOLETE: 'Obsolète' as DocumentStatus
};

export class DocumentWorkflowService {

    private static sanitizeReviewers(document: Document, reviewers: string[], submittingUserId: string): string[] {
        const banned = new Set([submittingUserId, document.ownerId, document.owner]);
        const clean = Array.from(new Set((reviewers || []).filter(r => !!r && !banned.has(r))));
        if (clean.length === 0) {
            throw new Error("Sélectionnez au moins un reviewer valide différent du propriétaire.");
        }
        return clean;
    }

    private static validateTransition(currentStatus: string, newStatus: string): boolean {
        return isValidDocumentTransition(
            currentStatus as DocumentStatus,
            newStatus as DocumentStatus
        );
    }

    /**
     * Guard: signed documents are immutable - no further workflow transitions allowed.
     * Signature integrity requires that the document content and status remain unchanged after signing.
     */
    private static assertNotSigned(document: Document): void {
        if (document.signatureStatus === 'signed') {
            throw new Error("Ce document est signé et verrouillé. Aucune modification n'est autorisée.");
        }
    }

    static async submitForReview(document: Document, user: UserProfile, reviewers: string[], comment?: string) {
        try {
            if (document.organizationId !== user.organizationId) {
                throw new Error('Access denied: organization mismatch');
            }
            this.assertNotSigned(document);
            // Validate transition
            if (!this.validateTransition(document.status || Status.DRAFT, Status.IN_REVIEW)) {
                throw new Error(`Transition invalide de ${document.status} vers ${Status.IN_REVIEW}`);
            }

            const sanitizedReviewers = this.sanitizeReviewers(document, reviewers, user.uid);
            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'soumettre',
                comment: comment || 'Soumis pour revue',
                version: document.version,
                step: 'En revue'
            };

            await updateDoc(doc(db, 'documents', document.id), sanitizeData({
                status: Status.IN_REVIEW,
                workflowStatus: 'Review',
                reviewers: sanitizedReviewers,
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            }));

            await logAction(user, 'WORKFLOW', 'Document', `Document submitted for review: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.submitForReview');
            throw error;
        }
    }

    static async approveDocument(document: Document, user: UserProfile, comment?: string) {
        try {
            if (document.organizationId !== user.organizationId) {
                throw new Error('Access denied: organization mismatch');
            }
            this.assertNotSigned(document);
            // Validate transition
            if (!this.validateTransition(document.status || Status.IN_REVIEW, Status.APPROVED)) {
                throw new Error(`Transition invalide de ${document.status} vers ${Status.APPROVED}`);
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'approuver',
                comment: comment || 'Approuvé',
                version: document.version,
                step: 'Approbation'
            };

            await updateDoc(doc(db, 'documents', document.id), sanitizeData({
                status: Status.APPROVED,
                workflowStatus: 'Approved',
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            }));

            await logAction(user, 'WORKFLOW', 'Document', `Document approved: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.approveDocument');
            throw error;
        }
    }

    static async rejectDocument(document: Document, user: UserProfile, comment: string) {
        if (!comment) throw new Error("Un commentaire est requis pour le rejet.");

        try {
            if (document.organizationId !== user.organizationId) {
                throw new Error('Access denied: organization mismatch');
            }
            this.assertNotSigned(document);
            // Validate transition
            if (!this.validateTransition(document.status || Status.IN_REVIEW, Status.REJECTED)) {
                throw new Error(`Transition invalide de ${document.status} vers ${Status.REJECTED}`);
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'rejeter',
                comment: comment,
                version: document.version,
                step: 'En revue'
            };

            await updateDoc(doc(db, 'documents', document.id), sanitizeData({
                status: Status.REJECTED,
                workflowStatus: 'Rejected',
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            }));

            await logAction(user, 'WORKFLOW', 'Document', `Document rejected: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.rejectDocument');
            throw error;
        }
    }

    static async publishDocument(document: Document, user: UserProfile) {
        try {
            if (document.organizationId !== user.organizationId) {
                throw new Error('Access denied: organization mismatch');
            }
            this.assertNotSigned(document);
            // Validate transition
            if (!this.validateTransition(document.status || Status.APPROVED, Status.PUBLISHED)) {
                throw new Error(`Transition invalide de ${document.status} vers ${Status.PUBLISHED}`);
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'publier',
                comment: 'Publication officielle',
                version: document.version,
                step: 'Publication'
            };

            await updateDoc(doc(db, 'documents', document.id), sanitizeData({
                status: Status.PUBLISHED,
                workflowStatus: 'Approved',
                publishedAt: serverTimestamp(),
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            }));

            await logAction(user, 'WORKFLOW', 'Document', `Document published: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.publishDocument');
            throw error;
        }
    }

    static async archiveDocument(document: Document, user: UserProfile, reason?: string) {
        try {
            if (document.organizationId !== user.organizationId) {
                throw new Error('Access denied: organization mismatch');
            }
            this.assertNotSigned(document);
            // Can archive from any state except already archived
            if (document.status === 'Archivé') {
                throw new Error('Document déjà archivé');
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'archiver',
                comment: reason || 'Archivé',
                version: document.version,
                step: 'Archive'
            };

            await updateDoc(doc(db, 'documents', document.id), sanitizeData({
                status: Status.ARCHIVED,
                workflowStatus: 'Archived',
                archivedAt: serverTimestamp(),
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            }));

            await logAction(user, 'WORKFLOW', 'Document', `Document archived: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.archiveDocument');
            throw error;
        }
    }

    static async revertToDraft(document: Document, user: UserProfile, reason?: string) {
        try {
            if (document.organizationId !== user.organizationId) {
                throw new Error('Access denied: organization mismatch');
            }
            this.assertNotSigned(document);
            // Only allow revert from Rejected or In Review
            if (![Status.REJECTED, Status.IN_REVIEW].includes(document.status as DocumentStatus)) {
                throw new Error(`Impossible de revenir en brouillon depuis ${document.status}`);
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'annuler',
                comment: reason || 'Revenu en brouillon',
                version: document.version,
                step: 'Brouillon'
            };

            await updateDoc(doc(db, 'documents', document.id), sanitizeData({
                status: Status.DRAFT,
                workflowStatus: 'Draft',
                reviewers: [],
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            }));

            await logAction(user, 'WORKFLOW', 'Document', `Document reverted to draft: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.revertToDraft');
            throw error;
        }
    }
}
