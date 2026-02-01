
/**
 * DocumentWorkflowService Tests
 * Refactored to use Clean Mocks pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentReference } from 'firebase/firestore';
import { DocumentWorkflowService } from '../DocumentWorkflowService';
import { Document, UserProfile } from '../../types';
import { logAction } from '../logger';

// Mock dependencies
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    updateDoc: vi.fn(),
    arrayUnion: vi.fn((item) => item),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
    getDoc: vi.fn()
}));

vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('../logger', () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

vi.mock('../../types/documents', () => ({
    isValidDocumentTransition: vi.fn((from, to) => {
        const transitions: Record<string, string[]> = {
            'Brouillon': ['En revue'],
            'En revue': ['Approuvé', 'Rejeté', 'Brouillon'],
            'Approuvé': ['Publié'],
            'Rejeté': ['Brouillon'],
            'Publié': ['Archivé', 'Obsolète'],
        };
        return transitions[from]?.includes(to) || false;
    }),
}));

import { updateDoc, doc } from 'firebase/firestore';

describe('DocumentWorkflowService', () => {
    // Helper to create mock objects
    const createMockDocument = (status = 'Brouillon', id = 'doc-123') => ({
        id,
        title: 'Test Document',
        status,
        version: '1.0',
        owner: 'Owner Name',
        ownerId: 'owner-123',
        organizationId: 'org-123',
    });

    const createMockUser = (uid = 'user-123') => ({
        uid,
        email: 'user@example.com',
        displayName: 'Test User',
        organizationId: 'org-123',
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(updateDoc).mockResolvedValue(undefined);
        vi.mocked(doc).mockReturnValue({ id: 'mock-doc-ref' } as unknown as DocumentReference);
    });

    describe('submitForReview', () => {
        it('should submit document for review', async () => {
            const docData = createMockDocument('Brouillon');
            const user = createMockUser('reviewer-user');
            const reviewers = ['reviewer-1', 'reviewer-2'];

            await DocumentWorkflowService.submitForReview(docData as unknown as Document, user as unknown as UserProfile, reviewers);

            expect(updateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should throw error for invalid transition', async () => {
            const docData = createMockDocument('Publié');
            const user = createMockUser();
            const reviewers = ['reviewer-1'];

            await expect(
                DocumentWorkflowService.submitForReview(docData as unknown as Document, user as unknown as UserProfile, reviewers)
            ).rejects.toThrow('Transition invalide');
        });

        it('should throw error when no valid reviewers', async () => {
            const docData = createMockDocument('Brouillon');
            const user = createMockUser('user-123');
            // All reviewers are invalid (owner or submitter)
            const reviewers = ['user-123', 'owner-123'];

            await expect(
                DocumentWorkflowService.submitForReview(docData as unknown as Document, user as unknown as UserProfile, reviewers)
            ).rejects.toThrow('Sélectionnez au moins un reviewer');
        });

        it('should sanitize reviewers list', async () => {
            const docData = createMockDocument('Brouillon');
            const user = createMockUser('user-456');
            // Mixed valid and invalid reviewers
            const reviewers = ['valid-1', 'user-456', '', null, 'valid-2'] as string[];

            await DocumentWorkflowService.submitForReview(docData as unknown as Document, user as unknown as UserProfile, reviewers);

            expect(updateDoc).toHaveBeenCalled();
        });

        it('should include comment in history', async () => {
            const docData = createMockDocument('Brouillon');
            const user = createMockUser('submitter');
            const reviewers = ['reviewer-1'];
            const comment = 'Please review this document';

            await DocumentWorkflowService.submitForReview(docData as unknown as Document, user as unknown as UserProfile, reviewers, comment);

            expect(updateDoc).toHaveBeenCalled();
        });
    });

    describe('approveDocument', () => {
        it('should approve document', async () => {
            const docData = createMockDocument('En revue');
            const user = createMockUser();

            await DocumentWorkflowService.approveDocument(docData as unknown as Document, user as unknown as UserProfile);

            expect(updateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should throw error for invalid transition', async () => {
            const docData = createMockDocument('Brouillon');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.approveDocument(docData as unknown as Document, user as unknown as UserProfile)
            ).rejects.toThrow('Transition invalide');
        });

        it('should include comment in history when provided', async () => {
            const docData = createMockDocument('En revue');
            const user = createMockUser();
            const comment = 'Looks good, approved';

            await DocumentWorkflowService.approveDocument(docData as unknown as Document, user as unknown as UserProfile, comment);

            expect(updateDoc).toHaveBeenCalled();
        });
    });

    describe('rejectDocument', () => {
        it('should reject document with comment', async () => {
            const docData = createMockDocument('En revue');
            const user = createMockUser();
            const comment = 'Needs revision';

            await DocumentWorkflowService.rejectDocument(docData as unknown as Document, user as unknown as UserProfile, comment);

            expect(updateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should throw error without comment', async () => {
            const docData = createMockDocument('En revue');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.rejectDocument(docData as unknown as Document, user as unknown as UserProfile, '')
            ).rejects.toThrow('Un commentaire est requis');
        });

        it('should throw error for invalid transition', async () => {
            const docData = createMockDocument('Publié');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.rejectDocument(docData as unknown as Document, user as unknown as UserProfile, 'Comment')
            ).rejects.toThrow('Transition invalide');
        });
    });

    describe('publishDocument', () => {
        it('should publish approved document', async () => {
            const docData = createMockDocument('Approuvé');
            const user = createMockUser();

            await DocumentWorkflowService.publishDocument(docData as unknown as Document, user as unknown as UserProfile);

            expect(updateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should throw error for invalid transition', async () => {
            const docData = createMockDocument('Brouillon');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.publishDocument(docData as unknown as Document, user as unknown as UserProfile)
            ).rejects.toThrow('Transition invalide');
        });
    });

    describe('archiveDocument', () => {
        it('should archive published document', async () => {
            const docData = createMockDocument('Publié');
            const user = createMockUser();

            await DocumentWorkflowService.archiveDocument(docData as unknown as Document, user as unknown as UserProfile);

            expect(updateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should archive with reason', async () => {
            const docData = createMockDocument('Publié');
            const user = createMockUser();
            const reason = 'No longer relevant';

            await DocumentWorkflowService.archiveDocument(docData as unknown as Document, user as unknown as UserProfile, reason);

            expect(updateDoc).toHaveBeenCalled();
        });

        it('should throw error if already archived', async () => {
            const docData = createMockDocument('Archivé');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.archiveDocument(docData as unknown as Document, user as unknown as UserProfile)
            ).rejects.toThrow('Document déjà archivé');
        });

        it('should allow archiving from any non-archived state', async () => {
            const docData = createMockDocument('En revue');
            const user = createMockUser();

            // Archive should work from any state except Archivé
            await DocumentWorkflowService.archiveDocument(docData as unknown as Document, user as unknown as UserProfile);

            expect(updateDoc).toHaveBeenCalled();
        });
    });

    describe('revertToDraft', () => {
        it('should revert rejected document to draft', async () => {
            const docData = createMockDocument('Rejeté');
            const user = createMockUser();

            await DocumentWorkflowService.revertToDraft(docData as unknown as Document, user as unknown as UserProfile);

            expect(updateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should revert in-review document to draft', async () => {
            const docData = createMockDocument('En revue');
            const user = createMockUser();

            await DocumentWorkflowService.revertToDraft(docData as unknown as Document, user as unknown as UserProfile);

            expect(updateDoc).toHaveBeenCalled();
        });

        it('should include reason in history', async () => {
            const docData = createMockDocument('Rejeté');
            const user = createMockUser();
            const reason = 'Starting over';

            await DocumentWorkflowService.revertToDraft(docData as unknown as Document, user as unknown as UserProfile, reason);

            expect(updateDoc).toHaveBeenCalled();
        });

        it('should throw error for published document', async () => {
            const docData = createMockDocument('Publié');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.revertToDraft(docData as unknown as Document, user as unknown as UserProfile)
            ).rejects.toThrow('Impossible de revenir en brouillon');
        });

        it('should throw error for approved document', async () => {
            const docData = createMockDocument('Approuvé');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.revertToDraft(docData as unknown as Document, user as unknown as UserProfile)
            ).rejects.toThrow('Impossible de revenir en brouillon');
        });
    });

    describe('error handling', () => {
        it('should log and rethrow errors in submitForReview', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            vi.mocked(updateDoc).mockRejectedValue(new Error('Database error'));

            const docData = createMockDocument('Brouillon');
            const user = createMockUser('submitter');
            const reviewers = ['reviewer-1'];

            await expect(
                DocumentWorkflowService.submitForReview(docData as unknown as Document, user as unknown as UserProfile, reviewers)
            ).rejects.toThrow('Database error');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });

        it('should log and rethrow errors in approveDocument', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            vi.mocked(updateDoc).mockRejectedValue(new Error('Database error'));

            const docData = createMockDocument('En revue');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.approveDocument(docData as unknown as Document, user as unknown as UserProfile)
            ).rejects.toThrow('Database error');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('workflow history', () => {
        it('should create history item with correct structure', async () => {
            const docData = createMockDocument('Brouillon');
            const user = {
                uid: 'user-123',
                displayName: 'John Doe',
                email: 'john@example.com',
                organizationId: 'org-123',
            };
            const reviewers = ['reviewer-1'];

            await DocumentWorkflowService.submitForReview(docData as unknown as Document, user as unknown as UserProfile, reviewers);

            expect(updateDoc).toHaveBeenCalled();
        });

        it('should use email when displayName is not available', async () => {
            const docData = createMockDocument('En revue');
            const user = {
                uid: 'user-123',
                email: 'user@example.com',
                organizationId: 'org-123',
                // No displayName
            };

            await DocumentWorkflowService.approveDocument(docData as unknown as Document, user as unknown as UserProfile);

            expect(updateDoc).toHaveBeenCalled();
        });
    });
});
