/**
 * DocumentVersioning Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import {
    getNextVersion,
    canApprove,
    canPublish,
    needsReview,
    hasUserSigned,
    getSignatureRate,
    DocumentWorkflow,
    DocumentSignature
} from '../documentVersioning';

describe('getNextVersion', () => {
    it('should increment major version', () => {
        expect(getNextVersion('1.0.0', 'major')).toBe('2.0.0');
        expect(getNextVersion('2.5.3', 'major')).toBe('3.0.0');
    });

    it('should increment minor version', () => {
        expect(getNextVersion('1.0.0', 'minor')).toBe('1.1.0');
        expect(getNextVersion('2.5.3', 'minor')).toBe('2.6.0');
    });

    it('should increment patch version', () => {
        expect(getNextVersion('1.0.0', 'patch')).toBe('1.0.1');
        expect(getNextVersion('2.5.3', 'patch')).toBe('2.5.4');
    });

    it('should handle single digit versions', () => {
        expect(getNextVersion('0.0.0', 'major')).toBe('1.0.0');
        expect(getNextVersion('0.0.0', 'minor')).toBe('0.1.0');
        expect(getNextVersion('0.0.0', 'patch')).toBe('0.0.1');
    });
});

describe('canApprove', () => {
    const baseWorkflow: DocumentWorkflow = {
        documentId: 'doc-123',
        currentStatus: 'review',
        currentVersion: '1.0.0',
        workflow: {},
        reviewers: [],
        approvers: []
    };

    it('should allow admin to approve document in review status', () => {
        expect(canApprove('admin', baseWorkflow)).toBe(true);
    });

    it('should not allow non-admin to approve', () => {
        expect(canApprove('user', baseWorkflow)).toBe(false);
        expect(canApprove('editor', baseWorkflow)).toBe(false);
    });

    it('should not allow approval if document is not in review status', () => {
        const draftWorkflow = { ...baseWorkflow, currentStatus: 'draft' as const };
        expect(canApprove('admin', draftWorkflow)).toBe(false);

        const approvedWorkflow = { ...baseWorkflow, currentStatus: 'approved' as const };
        expect(canApprove('admin', approvedWorkflow)).toBe(false);
    });
});

describe('canPublish', () => {
    const baseWorkflow: DocumentWorkflow = {
        documentId: 'doc-123',
        currentStatus: 'approved',
        currentVersion: '1.0.0',
        workflow: {},
        reviewers: [],
        approvers: []
    };

    it('should allow admin to publish approved document', () => {
        expect(canPublish('admin', baseWorkflow)).toBe(true);
    });

    it('should not allow non-admin to publish', () => {
        expect(canPublish('user', baseWorkflow)).toBe(false);
        expect(canPublish('editor', baseWorkflow)).toBe(false);
    });

    it('should not allow publishing if document is not approved', () => {
        const draftWorkflow = { ...baseWorkflow, currentStatus: 'draft' as const };
        expect(canPublish('admin', draftWorkflow)).toBe(false);

        const reviewWorkflow = { ...baseWorkflow, currentStatus: 'review' as const };
        expect(canPublish('admin', reviewWorkflow)).toBe(false);
    });
});

describe('needsReview', () => {
    it('should return false when no review date', () => {
        expect(needsReview(undefined)).toBe(false);
    });

    it('should return true when review date is in the past', () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
        expect(needsReview(pastDate)).toBe(true);
    });

    it('should return false when review date is in the future', () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
        expect(needsReview(futureDate)).toBe(false);
    });
});

describe('hasUserSigned', () => {
    const signatures: DocumentSignature[] = [
        {
            id: 'sig-1',
            documentId: 'doc-123',
            documentVersion: '1.0.0',
            userId: 'user-1',
            userName: 'User One',
            userEmail: 'user1@example.com',
            signedAt: new Date().toISOString(),
            acknowledged: true
        },
        {
            id: 'sig-2',
            documentId: 'doc-123',
            documentVersion: '1.0.0',
            userId: 'user-2',
            userName: 'User Two',
            userEmail: 'user2@example.com',
            signedAt: new Date().toISOString(),
            acknowledged: false
        }
    ];

    it('should return true for user who has signed and acknowledged', () => {
        expect(hasUserSigned(signatures, 'user-1')).toBe(true);
    });

    it('should return false for user who signed but not acknowledged', () => {
        expect(hasUserSigned(signatures, 'user-2')).toBe(false);
    });

    it('should return false for user who has not signed', () => {
        expect(hasUserSigned(signatures, 'user-3')).toBe(false);
    });

    it('should return false for empty signatures array', () => {
        expect(hasUserSigned([], 'user-1')).toBe(false);
    });
});

describe('getSignatureRate', () => {
    const signatures: DocumentSignature[] = [
        {
            id: 'sig-1',
            documentId: 'doc-123',
            documentVersion: '1.0.0',
            userId: 'user-1',
            userName: 'User One',
            userEmail: 'user1@example.com',
            signedAt: new Date().toISOString(),
            acknowledged: true
        },
        {
            id: 'sig-2',
            documentId: 'doc-123',
            documentVersion: '1.0.0',
            userId: 'user-2',
            userName: 'User Two',
            userEmail: 'user2@example.com',
            signedAt: new Date().toISOString(),
            acknowledged: false
        },
        {
            id: 'sig-3',
            documentId: 'doc-123',
            documentVersion: '1.0.0',
            userId: 'user-3',
            userName: 'User Three',
            userEmail: 'user3@example.com',
            signedAt: new Date().toISOString(),
            acknowledged: true
        }
    ];

    it('should calculate correct signature rate', () => {
        // 2 acknowledged out of 4 total users = 50%
        expect(getSignatureRate(signatures, 4)).toBe(50);
    });

    it('should return 0 when no users', () => {
        expect(getSignatureRate(signatures, 0)).toBe(0);
    });

    it('should return 100 when all users signed', () => {
        expect(getSignatureRate(signatures, 2)).toBe(100);
    });

    it('should handle empty signatures', () => {
        expect(getSignatureRate([], 5)).toBe(0);
    });
});
