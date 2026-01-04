import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Document, UserProfile, WorkflowHistoryItem } from '../types';
import { logAction } from './logger';
import { ErrorLogger } from './errorLogger';

// Complete document workflow states
export enum DocumentStatus {
    DRAFT = 'Brouillon',
    IN_REVIEW = 'En revue',
    APPROVED = 'Approuvé',
    PUBLISHED = 'Publié',
    REJECTED = 'Rejeté',
    ARCHIVED = 'Archivé'
}

// Valid workflow transitions
const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
    [DocumentStatus.DRAFT]: [DocumentStatus.IN_REVIEW, DocumentStatus.ARCHIVED],
    [DocumentStatus.IN_REVIEW]: [DocumentStatus.APPROVED, DocumentStatus.REJECTED, DocumentStatus.DRAFT],
    [DocumentStatus.APPROVED]: [DocumentStatus.PUBLISHED, DocumentStatus.ARCHIVED],
    [DocumentStatus.PUBLISHED]: [DocumentStatus.ARCHIVED],
    [DocumentStatus.REJECTED]: [DocumentStatus.DRAFT, DocumentStatus.ARCHIVED],
    [DocumentStatus.ARCHIVED]: [] // Final state
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
        const current = currentStatus as DocumentStatus;
        const next = newStatus as DocumentStatus;
        return VALID_TRANSITIONS[current]?.includes(next) || false;
    }

    static async submitForReview(document: Document, user: UserProfile, reviewers: string[], comment?: string) {
        try {
            // Validate transition
            if (!this.validateTransition(document.status || DocumentStatus.DRAFT, DocumentStatus.IN_REVIEW)) {
                throw new Error(`Transition invalide de ${document.status} vers ${DocumentStatus.IN_REVIEW}`);
            }

            const sanitizedReviewers = this.sanitizeReviewers(document, reviewers, user.uid);
            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'submit',
                comment: comment || 'Soumis pour revue',
                version: document.version,
                step: 'Review'
            };

            await updateDoc(doc(db, 'documents', document.id), {
                status: DocumentStatus.IN_REVIEW,
                workflowStatus: 'Review',
                reviewers: sanitizedReviewers,
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document submitted for review: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.submitForReview');
            throw error;
        }
    }

    static async approveDocument(document: Document, user: UserProfile, comment?: string) {
        try {
            // Validate transition
            if (!this.validateTransition(document.status || DocumentStatus.IN_REVIEW, DocumentStatus.APPROVED)) {
                throw new Error(`Transition invalide de ${document.status} vers ${DocumentStatus.APPROVED}`);
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'approve',
                comment: comment || 'Approuvé',
                version: document.version,
                step: 'Approval'
            };

            await updateDoc(doc(db, 'documents', document.id), {
                status: DocumentStatus.APPROVED,
                workflowStatus: 'Approved',
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document approved: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.approveDocument');
            throw error;
        }
    }

    static async rejectDocument(document: Document, user: UserProfile, comment: string) {
        if (!comment) throw new Error("Un commentaire est requis pour le rejet.");

        try {
            // Validate transition
            if (!this.validateTransition(document.status || DocumentStatus.IN_REVIEW, DocumentStatus.REJECTED)) {
                throw new Error(`Transition invalide de ${document.status} vers ${DocumentStatus.REJECTED}`);
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'reject',
                comment: comment,
                version: document.version,
                step: 'Review'
            };

            await updateDoc(doc(db, 'documents', document.id), {
                status: DocumentStatus.REJECTED,
                workflowStatus: 'Rejected',
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document rejected: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.rejectDocument');
            throw error;
        }
    }

    static async publishDocument(document: Document, user: UserProfile) {
        try {
            // Validate transition
            if (!this.validateTransition(document.status || DocumentStatus.APPROVED, DocumentStatus.PUBLISHED)) {
                throw new Error(`Transition invalide de ${document.status} vers ${DocumentStatus.PUBLISHED}`);
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'publish',
                comment: 'Publication officielle',
                version: document.version,
                step: 'Publication'
            };

            await updateDoc(doc(db, 'documents', document.id), {
                status: DocumentStatus.PUBLISHED,
                workflowStatus: 'Approved',
                publishedAt: serverTimestamp(),
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document published: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.publishDocument');
            throw error;
        }
    }

    static async archiveDocument(document: Document, user: UserProfile, reason?: string) {
        try {
            // Can archive from any state except already archived
            if (document.status === 'Archivé') {
                throw new Error('Document déjà archivé');
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'archive',
                comment: reason || 'Archivé',
                version: document.version,
                step: 'Archive'
            };

            await updateDoc(doc(db, 'documents', document.id), {
                status: DocumentStatus.ARCHIVED,
                workflowStatus: 'Archived',
                archivedAt: serverTimestamp(),
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document archived: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.archiveDocument');
            throw error;
        }
    }

    static async revertToDraft(document: Document, user: UserProfile, reason?: string) {
        try {
            // Only allow revert from Rejected or In Review
            if (![DocumentStatus.REJECTED, DocumentStatus.IN_REVIEW].includes(document.status as DocumentStatus)) {
                throw new Error(`Impossible de revenir en brouillon depuis ${document.status}`);
            }

            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'revert',
                comment: reason || 'Revenu en brouillon',
                version: document.version,
                step: 'Draft'
            };

            await updateDoc(doc(db, 'documents', document.id), {
                status: DocumentStatus.DRAFT,
                workflowStatus: 'Draft',
                reviewers: [],
                workflowHistory: arrayUnion(historyItem),
                updatedAt: serverTimestamp()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document reverted to draft: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.revertToDraft');
            throw error;
        }
    }
}
