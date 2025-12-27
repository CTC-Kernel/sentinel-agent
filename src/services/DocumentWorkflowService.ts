import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Document, UserProfile, WorkflowHistoryItem } from '../types';
import { logAction } from './logger';
import { ErrorLogger } from './errorLogger';

export class DocumentWorkflowService {

    private static sanitizeReviewers(document: Document, reviewers: string[], submittingUserId: string): string[] {
        const banned = new Set([submittingUserId, document.ownerId, document.owner]);
        const clean = Array.from(new Set((reviewers || []).filter(r => !!r && !banned.has(r))));
        if (clean.length === 0) {
            throw new Error("Sélectionnez au moins un reviewer valide différent du propriétaire.");
        }
        return clean;
    }

    static async submitForReview(document: Document, user: UserProfile, reviewers: string[], comment?: string) {
        try {
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
                status: 'En revue',
                workflowStatus: 'Review',
                reviewers: sanitizedReviewers,
                workflowHistory: arrayUnion(historyItem),
                updatedAt: new Date().toISOString()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document submitted for review: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.submitForReview');
            throw error;
        }
    }

    static async approveDocument(document: Document, user: UserProfile, comment?: string) {
        try {
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

            // If it was the last reviewer needed, move to Approved/Publiable
            // For simplicity in this version, any approver moves it to Approved.
            // Enterprise v2 could have "All must approve" logic.

            await updateDoc(doc(db, 'documents', document.id), {
                status: 'Approuvé',
                workflowStatus: 'Approved',
                workflowHistory: arrayUnion(historyItem),
                updatedAt: new Date().toISOString()
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
            const historyItem: WorkflowHistoryItem = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                userId: user.uid,
                userName: user.displayName || user.email || 'Unknown',
                action: 'reject',
                comment: comment,
                version: document.version,
                step: 'Review' // Back to draft/review
            };

            await updateDoc(doc(db, 'documents', document.id), {
                status: 'Rejeté',
                workflowStatus: 'Rejected',
                workflowHistory: arrayUnion(historyItem),
                updatedAt: new Date().toISOString()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document rejected: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.rejectDocument');
            throw error;
        }
    }

    static async publishDocument(document: Document, user: UserProfile) {
        try {
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
                status: 'Publié',
                workflowStatus: 'Approved', // Remains approved in workflow terms
                workflowHistory: arrayUnion(historyItem),
                updatedAt: new Date().toISOString()
            });

            await logAction(user, 'WORKFLOW', 'Document', `Document published: ${document.title} `);
        } catch (error) {
            ErrorLogger.error(error, 'DocumentWorkflowService.publishDocument');
            throw error;
        }
    }
}
