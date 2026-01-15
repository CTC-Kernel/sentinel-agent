/**
 * Unit tests for documentSchema.ts
 * Tests validation of document forms
 */

import { describe, it, expect } from 'vitest';
import { documentSchema } from '../documentSchema';

describe('documentSchema', () => {
    const validDocument = {
        title: 'Security Policy',
        type: 'Politique' as const,
        version: '1.0',
        status: 'Brouillon' as const,
        owner: 'Security Team'
    };

    describe('required fields', () => {
        it('accepts valid document data', () => {
            const result = documentSchema.safeParse(validDocument);
            expect(result.success).toBe(true);
        });

        it('rejects missing title', () => {
            const { title, ...data } = validDocument;
            const result = documentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty title', () => {
            const result = documentSchema.safeParse({ ...validDocument, title: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing type', () => {
            const { type, ...data } = validDocument;
            const result = documentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing version', () => {
            const { version, ...data } = validDocument;
            const result = documentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty version', () => {
            const result = documentSchema.safeParse({ ...validDocument, version: '' });
            expect(result.success).toBe(false);
        });

        it('rejects missing status', () => {
            const { status, ...data } = validDocument;
            const result = documentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects missing owner', () => {
            const { owner, ...data } = validDocument;
            const result = documentSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('rejects empty owner', () => {
            const result = documentSchema.safeParse({ ...validDocument, owner: '' });
            expect(result.success).toBe(false);
        });
    });

    describe('field length constraints', () => {
        it('rejects title longer than 200 characters', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                title: 'a'.repeat(201)
            });
            expect(result.success).toBe(false);
        });

        it('accepts title at max length (200)', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                title: 'a'.repeat(200)
            });
            expect(result.success).toBe(true);
        });

        it('rejects description longer than 2000 characters', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                description: 'a'.repeat(2001)
            });
            expect(result.success).toBe(false);
        });
    });

    describe('type validation', () => {
        it.each(['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'] as const)(
            'accepts valid type: %s',
            (type) => {
                const result = documentSchema.safeParse({ ...validDocument, type });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid type', () => {
            const result = documentSchema.safeParse({ ...validDocument, type: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('status validation', () => {
        it.each(['Brouillon', 'En revue', 'Approuvé', 'Rejeté', 'Publié', 'Obsolète', 'Archivé'] as const)(
            'accepts valid status: %s',
            (status) => {
                const result = documentSchema.safeParse({ ...validDocument, status });
                expect(result.success).toBe(true);
            }
        );

        it('rejects invalid status', () => {
            const result = documentSchema.safeParse({ ...validDocument, status: 'Invalid' });
            expect(result.success).toBe(false);
        });
    });

    describe('workflow status validation', () => {
        it.each(['Draft', 'Review', 'Approved', 'Rejected', 'Archived'] as const)(
            'accepts valid workflow status: %s',
            (workflowStatus) => {
                const result = documentSchema.safeParse({ ...validDocument, workflowStatus });
                expect(result.success).toBe(true);
            }
        );

        it('accepts undefined workflow status', () => {
            const result = documentSchema.safeParse(validDocument);
            expect(result.success).toBe(true);
        });

        it('rejects invalid workflow status', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                workflowStatus: 'Invalid'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('storage provider validation', () => {
        it.each(['firebase', 'google_drive', 'onedrive', 'sharepoint'] as const)(
            'accepts valid storage provider: %s',
            (provider) => {
                const result = documentSchema.safeParse({
                    ...validDocument,
                    storageProvider: provider
                });
                expect(result.success).toBe(true);
            }
        );

        it('defaults to firebase', () => {
            const result = documentSchema.safeParse(validDocument);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.storageProvider).toBe('firebase');
            }
        });

        it('rejects invalid storage provider', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                storageProvider: 'dropbox'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('external URL validation', () => {
        it('accepts valid URL', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                externalUrl: 'https://example.com/doc.pdf'
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty external URL', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                externalUrl: ''
            });
            expect(result.success).toBe(true);
        });

        it('rejects invalid URL', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                externalUrl: 'not-a-url'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('signatures validation', () => {
        it('accepts valid signatures array', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                signatures: [
                    {
                        userId: 'user-123',
                        date: '2024-01-15',
                        role: 'Approver',
                        signatureImage: 'base64-signature'
                    },
                    {
                        userId: 'user-456',
                        date: '2024-01-16',
                        role: 'Reviewer'
                    }
                ]
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty signatures array', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                signatures: []
            });
            expect(result.success).toBe(true);
        });

        it('rejects signatures with missing required fields', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                signatures: [{ userId: 'user-123' }]
            });
            expect(result.success).toBe(false);
        });
    });

    describe('related IDs arrays', () => {
        it('accepts related control IDs', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                relatedControlIds: ['ctrl-1', 'ctrl-2']
            });
            expect(result.success).toBe(true);
        });

        it('accepts related asset IDs', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                relatedAssetIds: ['asset-1']
            });
            expect(result.success).toBe(true);
        });

        it('accepts related audit IDs', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                relatedAuditIds: ['audit-1', 'audit-2']
            });
            expect(result.success).toBe(true);
        });

        it('accepts related risk IDs', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                relatedRiskIds: ['risk-1']
            });
            expect(result.success).toBe(true);
        });
    });

    describe('boolean fields', () => {
        it('accepts isSecure boolean', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                isSecure: true
            });
            expect(result.success).toBe(true);
        });

        it('accepts watermarkEnabled boolean', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                watermarkEnabled: true
            });
            expect(result.success).toBe(true);
        });
    });

    describe('optional fields', () => {
        it('accepts all optional fields', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                description: 'Policy description',
                ownerId: 'user-123',
                nextReviewDate: '2025-01-15',
                expirationDate: '2026-01-15',
                readBy: ['user-1', 'user-2'],
                reviewers: ['user-3'],
                approvers: ['user-4'],
                url: '/documents/policy.pdf',
                externalId: 'ext-123',
                folderId: 'folder-456',
                content: '<p>Document content</p>',
                hash: 'sha256hash'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('whitespace trimming', () => {
        it('trims whitespace from title', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                title: '  Document Title  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.title).toBe('Document Title');
            }
        });

        it('trims whitespace from version', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                version: '  1.0  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.version).toBe('1.0');
            }
        });

        it('trims whitespace from owner', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                owner: '  Owner Name  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.owner).toBe('Owner Name');
            }
        });

        it('trims whitespace from description', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                description: '  Description  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.description).toBe('Description');
            }
        });

        it('trims whitespace from external URL', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                externalUrl: '  https://example.com  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.externalUrl).toBe('https://example.com');
            }
        });

        it('trims whitespace from external ID', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                externalId: '  ext-123  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.externalId).toBe('ext-123');
            }
        });

        it('trims whitespace from content', () => {
            const result = documentSchema.safeParse({
                ...validDocument,
                content: '  <p>Content</p>  '
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.content).toBe('<p>Content</p>');
            }
        });
    });
});
