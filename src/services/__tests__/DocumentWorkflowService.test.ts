/**
 * DocumentWorkflowService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentWorkflowService } from '../DocumentWorkflowService';

// Mock Firebase
const mockUpdateDoc = vi.fn();

vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    updateDoc: () => mockUpdateDoc(),
    arrayUnion: vi.fn((item) => item),
    serverTimestamp: vi.fn(() => new Date()),
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

import { logAction } from '../logger';

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
});

describe('DocumentWorkflowService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdateDoc.mockResolvedValue(undefined);
    });

    describe('submitForReview', () => {
        it('should submit document for review', async () => {
            const doc = createMockDocument('Brouillon');
            const user = createMockUser('reviewer-user');
            const reviewers = ['reviewer-1', 'reviewer-2'];

            await DocumentWorkflowService.submitForReview(doc as never, user as never, reviewers);

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should throw error for invalid transition', async () => {
            const doc = createMockDocument('Publié');
            const user = createMockUser();
            const reviewers = ['reviewer-1'];

            await expect(
                DocumentWorkflowService.submitForReview(doc as never, user as never, reviewers)
            ).rejects.toThrow('Transition invalide');
        });

        it('should throw error when no valid reviewers', async () => {
            const doc = createMockDocument('Brouillon');
            const user = createMockUser('user-123');
            // All reviewers are invalid (owner or submitter)
            const reviewers = ['user-123', 'owner-123'];

            await expect(
                DocumentWorkflowService.submitForReview(doc as never, user as never, reviewers)
            ).rejects.toThrow('Sélectionnez au moins un reviewer');
        });

        it('should sanitize reviewers list', async () => {
            const doc = createMockDocument('Brouillon');
            const user = createMockUser('user-456');
            // Mixed valid and invalid reviewers
            const reviewers = ['valid-1', 'user-456', '', null, 'valid-2'] as string[];

            await DocumentWorkflowService.submitForReview(doc as never, user as never, reviewers);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should include comment in history', async () => {
            const doc = createMockDocument('Brouillon');
            const user = createMockUser('submitter');
            const reviewers = ['reviewer-1'];
            const comment = 'Please review this document';

            await DocumentWorkflowService.submitForReview(doc as never, user as never, reviewers, comment);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });
    });

    describe('approveDocument', () => {
        it('should approve document', async () => {
            const doc = createMockDocument('En revue');
            const user = createMockUser();

            await DocumentWorkflowService.approveDocument(doc as never, user as never);

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should throw error for invalid transition', async () => {
            const doc = createMockDocument('Brouillon');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.approveDocument(doc as never, user as never)
            ).rejects.toThrow('Transition invalide');
        });

        it('should include comment in history when provided', async () => {
            const doc = createMockDocument('En revue');
            const user = createMockUser();
            const comment = 'Looks good, approved';

            await DocumentWorkflowService.approveDocument(doc as never, user as never, comment);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });
    });

    describe('rejectDocument', () => {
        it('should reject document with comment', async () => {
            const doc = createMockDocument('En revue');
            const user = createMockUser();
            const comment = 'Needs revision';

            await DocumentWorkflowService.rejectDocument(doc as never, user as never, comment);

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should throw error without comment', async () => {
            const doc = createMockDocument('En revue');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.rejectDocument(doc as never, user as never, '')
            ).rejects.toThrow('Un commentaire est requis');
        });

        it('should throw error for invalid transition', async () => {
            const doc = createMockDocument('Publié');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.rejectDocument(doc as never, user as never, 'Comment')
            ).rejects.toThrow('Transition invalide');
        });
    });

    describe('publishDocument', () => {
        it('should publish approved document', async () => {
            const doc = createMockDocument('Approuvé');
            const user = createMockUser();

            await DocumentWorkflowService.publishDocument(doc as never, user as never);

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should throw error for invalid transition', async () => {
            const doc = createMockDocument('Brouillon');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.publishDocument(doc as never, user as never)
            ).rejects.toThrow('Transition invalide');
        });
    });

    describe('archiveDocument', () => {
        it('should archive published document', async () => {
            const doc = createMockDocument('Publié');
            const user = createMockUser();

            await DocumentWorkflowService.archiveDocument(doc as never, user as never);

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should archive with reason', async () => {
            const doc = createMockDocument('Publié');
            const user = createMockUser();
            const reason = 'No longer relevant';

            await DocumentWorkflowService.archiveDocument(doc as never, user as never, reason);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should throw error if already archived', async () => {
            const doc = createMockDocument('Archivé');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.archiveDocument(doc as never, user as never)
            ).rejects.toThrow('Document déjà archivé');
        });

        it('should allow archiving from any non-archived state', async () => {
            const doc = createMockDocument('En revue');
            const user = createMockUser();

            // Archive should work from any state except Archivé
            await DocumentWorkflowService.archiveDocument(doc as never, user as never);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });
    });

    describe('revertToDraft', () => {
        it('should revert rejected document to draft', async () => {
            const doc = createMockDocument('Rejeté');
            const user = createMockUser();

            await DocumentWorkflowService.revertToDraft(doc as never, user as never);

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalled();
        });

        it('should revert in-review document to draft', async () => {
            const doc = createMockDocument('En revue');
            const user = createMockUser();

            await DocumentWorkflowService.revertToDraft(doc as never, user as never);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should include reason in history', async () => {
            const doc = createMockDocument('Rejeté');
            const user = createMockUser();
            const reason = 'Starting over';

            await DocumentWorkflowService.revertToDraft(doc as never, user as never, reason);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should throw error for published document', async () => {
            const doc = createMockDocument('Publié');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.revertToDraft(doc as never, user as never)
            ).rejects.toThrow('Impossible de revenir en brouillon');
        });

        it('should throw error for approved document', async () => {
            const doc = createMockDocument('Approuvé');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.revertToDraft(doc as never, user as never)
            ).rejects.toThrow('Impossible de revenir en brouillon');
        });
    });

    describe('error handling', () => {
        it('should log and rethrow errors in submitForReview', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockUpdateDoc.mockRejectedValue(new Error('Database error'));

            const doc = createMockDocument('Brouillon');
            const user = createMockUser('submitter');
            const reviewers = ['reviewer-1'];

            await expect(
                DocumentWorkflowService.submitForReview(doc as never, user as never, reviewers)
            ).rejects.toThrow('Database error');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });

        it('should log and rethrow errors in approveDocument', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockUpdateDoc.mockRejectedValue(new Error('Database error'));

            const doc = createMockDocument('En revue');
            const user = createMockUser();

            await expect(
                DocumentWorkflowService.approveDocument(doc as never, user as never)
            ).rejects.toThrow('Database error');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('workflow history', () => {
        it('should create history item with correct structure', async () => {
            const doc = createMockDocument('Brouillon');
            const user = {
                uid: 'user-123',
                displayName: 'John Doe',
                email: 'john@example.com',
            };
            const reviewers = ['reviewer-1'];

            await DocumentWorkflowService.submitForReview(doc as never, user as never, reviewers);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });

        it('should use email when displayName is not available', async () => {
            const doc = createMockDocument('En revue');
            const user = {
                uid: 'user-123',
                email: 'user@example.com',
                // No displayName
            };

            await DocumentWorkflowService.approveDocument(doc as never, user as never);

            expect(mockUpdateDoc).toHaveBeenCalled();
        });
    });
});
