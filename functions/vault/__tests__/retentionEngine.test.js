/**
 * Retention Engine Cloud Function Tests
 * Story 25.5: Retention Policy Engine
 *
 * Tests utility functions for document retention management
 */

// Mock firebase-admin before importing
jest.mock('firebase-admin', () => ({
    apps: [],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
        collection: jest.fn(),
        FieldValue: {
            serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
        },
    })),
}));

const {
    _internal: {
        calculateExpiryDate,
        documentMatchesScope,
        isDocumentExcluded,
        isUnderLegalHold,
        findApplicablePolicy,
        BATCH_SIZE,
    },
} = require('../retentionEngine');

describe('Retention Engine Functions', () => {
    describe('Constants', () => {
        it('should have correct BATCH_SIZE', () => {
            expect(BATCH_SIZE).toBe(100);
        });
    });

    describe('calculateExpiryDate', () => {
        it('should calculate expiry date from ISO string', () => {
            const createdAt = '2024-01-15T10:00:00.000Z';
            const retentionDays = 30;

            const result = calculateExpiryDate(createdAt, retentionDays);

            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2024-02-14T10:00:00.000Z');
        });

        it('should calculate expiry date with Firestore toDate method', () => {
            const mockDate = new Date('2024-03-01T00:00:00.000Z');
            const createdAt = { toDate: () => mockDate };
            const retentionDays = 90;

            const result = calculateExpiryDate(createdAt, retentionDays);

            expect(result).toBeInstanceOf(Date);
            // March 1 + 90 days = May 30
            expect(result.getMonth()).toBe(4); // May (0-indexed)
        });

        it('should handle 365 days retention (1 year)', () => {
            const createdAt = '2024-01-01T00:00:00.000Z';
            const retentionDays = 365;

            const result = calculateExpiryDate(createdAt, retentionDays);

            expect(result.getFullYear()).toBe(2024);
            expect(result.getMonth()).toBe(11); // December
            expect(result.getDate()).toBe(31);
        });

        it('should handle 7 years retention (regulatory requirement)', () => {
            const createdAt = '2024-01-01T00:00:00.000Z';
            const retentionDays = 7 * 365;

            const result = calculateExpiryDate(createdAt, retentionDays);

            expect(result.getFullYear()).toBe(2030);
        });

        it('should default to current date if createdAt is invalid', () => {
            const createdAt = null;
            const retentionDays = 30;

            const result = calculateExpiryDate(createdAt, retentionDays);

            expect(result).toBeInstanceOf(Date);
            // Should be approximately 30 days from now
            const expectedMin = new Date();
            expectedMin.setDate(expectedMin.getDate() + 29);
            expect(result.getTime()).toBeGreaterThan(expectedMin.getTime());
        });

        it('should handle zero retention days', () => {
            const createdAt = '2024-06-15T12:00:00.000Z';
            const retentionDays = 0;

            const result = calculateExpiryDate(createdAt, retentionDays);

            expect(result.toISOString()).toBe('2024-06-15T12:00:00.000Z');
        });
    });

    describe('documentMatchesScope', () => {
        it('should return true when no scope defined', () => {
            const document = { type: 'contract', classification: { level: 'confidential' } };

            expect(documentMatchesScope(document, null)).toBe(true);
            expect(documentMatchesScope(document, undefined)).toBe(true);
        });

        it('should match document classification', () => {
            const document = { classification: { level: 'confidential' } };
            const scope = { classifications: ['confidential', 'secret'] };

            expect(documentMatchesScope(document, scope)).toBe(true);
        });

        it('should reject non-matching classification', () => {
            const document = { classification: { level: 'public' } };
            const scope = { classifications: ['confidential', 'secret'] };

            expect(documentMatchesScope(document, scope)).toBe(false);
        });

        it('should default to internal classification', () => {
            const document = {}; // No classification
            const scope = { classifications: ['internal'] };

            expect(documentMatchesScope(document, scope)).toBe(true);
        });

        it('should match document type', () => {
            const document = { type: 'contract' };
            const scope = { documentTypes: ['contract', 'policy'] };

            expect(documentMatchesScope(document, scope)).toBe(true);
        });

        it('should reject non-matching document type', () => {
            const document = { type: 'invoice' };
            const scope = { documentTypes: ['contract', 'policy'] };

            expect(documentMatchesScope(document, scope)).toBe(false);
        });

        it('should match folder ID', () => {
            const document = { folderId: 'folder-123' };
            const scope = { folderIds: ['folder-123', 'folder-456'] };

            expect(documentMatchesScope(document, scope)).toBe(true);
        });

        it('should reject document without folder when folders specified', () => {
            const document = { type: 'contract' };
            const scope = { folderIds: ['folder-123'] };

            expect(documentMatchesScope(document, scope)).toBe(false);
        });

        it('should match all criteria together', () => {
            const document = {
                type: 'contract',
                classification: { level: 'confidential' },
                folderId: 'legal-docs',
            };
            const scope = {
                classifications: ['confidential'],
                documentTypes: ['contract'],
                folderIds: ['legal-docs'],
            };

            expect(documentMatchesScope(document, scope)).toBe(true);
        });

        it('should reject if any criterion fails', () => {
            const document = {
                type: 'contract',
                classification: { level: 'public' }, // Wrong classification
                folderId: 'legal-docs',
            };
            const scope = {
                classifications: ['confidential'],
                documentTypes: ['contract'],
                folderIds: ['legal-docs'],
            };

            expect(documentMatchesScope(document, scope)).toBe(false);
        });
    });

    describe('isDocumentExcluded', () => {
        it('should return false when no exceptions defined', () => {
            const document = { classification: { level: 'secret' } };

            expect(isDocumentExcluded(document, null)).toBe(false);
            expect(isDocumentExcluded(document, undefined)).toBe(false);
        });

        it('should exclude document by classification', () => {
            const document = { classification: { level: 'secret' } };
            const exceptions = { classifications: ['secret', 'top-secret'] };

            expect(isDocumentExcluded(document, exceptions)).toBe(true);
        });

        it('should not exclude non-matching classification', () => {
            const document = { classification: { level: 'internal' } };
            const exceptions = { classifications: ['secret'] };

            expect(isDocumentExcluded(document, exceptions)).toBe(false);
        });

        it('should exclude document under legal hold when configured', () => {
            const document = { isUnderHold: true };
            const exceptions = { excludeLegalHold: true };

            expect(isDocumentExcluded(document, exceptions)).toBe(true);
        });

        it('should not exclude legal hold when not configured', () => {
            const document = { isUnderHold: true };
            const exceptions = { excludeLegalHold: false };

            expect(isDocumentExcluded(document, exceptions)).toBe(false);
        });

        it('should default to internal classification for check', () => {
            const document = {};
            const exceptions = { classifications: ['internal'] };

            expect(isDocumentExcluded(document, exceptions)).toBe(true);
        });
    });

    describe('isUnderLegalHold', () => {
        it('should return true when isUnderHold flag is true', () => {
            const document = { isUnderHold: true };

            expect(isUnderLegalHold(document)).toBe(true);
        });

        it('should return true when legalHoldIds array has items', () => {
            const document = { legalHoldIds: ['hold-1', 'hold-2'] };

            expect(isUnderLegalHold(document)).toBe(true);
        });

        it('should return false when no holds', () => {
            const document = { isUnderHold: false, legalHoldIds: [] };

            expect(isUnderLegalHold(document)).toBe(false);
        });

        it('should return false for document without hold properties', () => {
            const document = { title: 'Regular Document' };

            expect(isUnderLegalHold(document)).toBe(false);
        });

        it('should return false when legalHoldIds is empty', () => {
            const document = { legalHoldIds: [] };

            expect(isUnderLegalHold(document)).toBe(false);
        });

        it('should return true with either flag or array', () => {
            expect(isUnderLegalHold({ isUnderHold: true, legalHoldIds: [] })).toBe(true);
            expect(isUnderLegalHold({ isUnderHold: false, legalHoldIds: ['hold-1'] })).toBe(true);
        });
    });

    describe('findApplicablePolicy', () => {
        const basePolicies = [
            {
                id: 'policy-1',
                name: 'Default Policy',
                priority: 1,
                isActive: true,
                retentionDays: 365,
                action: 'archive',
            },
            {
                id: 'policy-2',
                name: 'Confidential Policy',
                priority: 10,
                isActive: true,
                retentionDays: 2555, // 7 years
                action: 'archive',
                scope: { classifications: ['confidential', 'secret'] },
            },
            {
                id: 'policy-3',
                name: 'Inactive Policy',
                priority: 100,
                isActive: false,
                retentionDays: 30,
                action: 'delete',
            },
        ];

        it('should return highest priority matching policy', () => {
            const document = { classification: { level: 'confidential' } };

            const result = findApplicablePolicy(document, basePolicies);

            expect(result.id).toBe('policy-2');
            expect(result.retentionDays).toBe(2555);
        });

        it('should skip inactive policies', () => {
            const policies = [
                { id: 'inactive', priority: 100, isActive: false, retentionDays: 10 },
                { id: 'active', priority: 1, isActive: true, retentionDays: 365 },
            ];
            const document = { type: 'any' };

            const result = findApplicablePolicy(document, policies);

            expect(result.id).toBe('active');
        });

        it('should fall back to default policy', () => {
            const document = { classification: { level: 'public' } };

            const result = findApplicablePolicy(document, basePolicies);

            expect(result.id).toBe('policy-1');
        });

        it('should return null when no policies match', () => {
            const policies = [
                {
                    id: 'restricted',
                    priority: 1,
                    isActive: true,
                    scope: { classifications: ['secret'] },
                },
            ];
            const document = { classification: { level: 'public' } };

            const result = findApplicablePolicy(document, policies);

            expect(result).toBeNull();
        });

        it('should respect priority ordering', () => {
            const policies = [
                { id: 'low', priority: 1, isActive: true, retentionDays: 30 },
                { id: 'high', priority: 100, isActive: true, retentionDays: 365 },
                { id: 'medium', priority: 50, isActive: true, retentionDays: 90 },
            ];
            const document = { type: 'any' };

            const result = findApplicablePolicy(document, policies);

            expect(result.id).toBe('high');
            expect(result.retentionDays).toBe(365);
        });

        it('should handle policies with exceptions', () => {
            const policies = [
                {
                    id: 'with-exception',
                    priority: 10,
                    isActive: true,
                    exceptions: { excludeLegalHold: true },
                },
                {
                    id: 'default',
                    priority: 1,
                    isActive: true,
                },
            ];
            const document = { isUnderHold: true };

            const result = findApplicablePolicy(document, policies);

            expect(result.id).toBe('default'); // First policy excluded this doc
        });
    });
});
