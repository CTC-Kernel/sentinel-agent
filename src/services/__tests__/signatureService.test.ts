/**
 * Signature Service Tests
 * Comprehensive tests for electronic signature management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignatureService } from '../signatureService';
import type { SignatureRequest, SignerInfo } from '../../types/signature';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    functions: {},
}));

vi.mock('firebase/firestore', () => ({
    Timestamp: {
        now: vi.fn(() => ({
            toMillis: () => Date.now(),
            toDate: () => new Date(),
        })),
        fromDate: vi.fn((date: Date) => ({
            toMillis: () => date.getTime(),
            toDate: () => date,
        })),
    },
    collection: vi.fn(),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-request-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(() => () => {}),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { isValid: true } }))),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

vi.mock('../integrityService', () => ({
    IntegrityService: {
        getIntegrityStatus: vi.fn(() => Promise.resolve({ hash: 'abc123hash' })),
        verifyDocumentIntegrity: vi.fn(() => Promise.resolve({ hash: 'abc123hash' })),
    },
}));

describe('SignatureService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getStatusConfig', () => {
        it('should return correct config for draft status', () => {
            const config = SignatureService.getStatusConfig('draft');
            expect(config.label).toBe('Brouillon');
            expect(config.badgeStatus).toBe('neutral');
        });

        it('should return correct config for pending status', () => {
            const config = SignatureService.getStatusConfig('pending');
            expect(config.label).toBe('En attente');
            expect(config.badgeStatus).toBe('warning');
        });

        it('should return correct config for in_progress status', () => {
            const config = SignatureService.getStatusConfig('in_progress');
            expect(config.label).toBe('En cours');
            expect(config.badgeStatus).toBe('info');
        });

        it('should return correct config for completed status', () => {
            const config = SignatureService.getStatusConfig('completed');
            expect(config.label).toBe('Complété');
            expect(config.badgeStatus).toBe('success');
        });

        it('should return correct config for rejected status', () => {
            const config = SignatureService.getStatusConfig('rejected');
            expect(config.label).toBe('Rejeté');
            expect(config.badgeStatus).toBe('error');
        });

        it('should return correct config for expired status', () => {
            const config = SignatureService.getStatusConfig('expired');
            expect(config.label).toBe('Expiré');
            expect(config.badgeStatus).toBe('error');
        });

        it('should return correct config for cancelled status', () => {
            const config = SignatureService.getStatusConfig('cancelled');
            expect(config.label).toBe('Annulé');
            expect(config.badgeStatus).toBe('neutral');
        });

        it('should return pending config for unknown status', () => {
            const config = SignatureService.getStatusConfig('unknown' as never);
            expect(config.label).toBe('En attente');
        });
    });

    describe('getSignerStatusConfig', () => {
        it('should return correct config for pending signer', () => {
            const config = SignatureService.getSignerStatusConfig('pending');
            expect(config.label).toBe('En attente');
            expect(config.badgeStatus).toBe('warning');
        });

        it('should return correct config for notified signer', () => {
            const config = SignatureService.getSignerStatusConfig('notified');
            expect(config.label).toBe('Notifié');
            expect(config.badgeStatus).toBe('info');
        });

        it('should return correct config for viewed signer', () => {
            const config = SignatureService.getSignerStatusConfig('viewed');
            expect(config.label).toBe('Vu');
            expect(config.badgeStatus).toBe('info');
        });

        it('should return correct config for signed signer', () => {
            const config = SignatureService.getSignerStatusConfig('signed');
            expect(config.label).toBe('Signé');
            expect(config.badgeStatus).toBe('success');
        });

        it('should return correct config for rejected signer', () => {
            const config = SignatureService.getSignerStatusConfig('rejected');
            expect(config.label).toBe('Rejeté');
            expect(config.badgeStatus).toBe('error');
        });

        it('should return correct config for expired signer', () => {
            const config = SignatureService.getSignerStatusConfig('expired');
            expect(config.label).toBe('Expiré');
            expect(config.badgeStatus).toBe('error');
        });
    });

    describe('subscribeToSignatureRequest', () => {
        it('should return unsubscribe function', () => {
            const callback = vi.fn();
            const unsubscribe = SignatureService.subscribeToSignatureRequest('request-1', callback);

            expect(typeof unsubscribe).toBe('function');
        });
    });

    describe('getSignatureRequest', () => {
        it('should return null for non-existent request', async () => {
            const { getDoc } = await import('firebase/firestore');
            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => false,
                data: () => null,
            } as never);

            const result = await SignatureService.getSignatureRequest('non-existent');
            expect(result).toBeNull();
        });

        it('should return request with id for existing request', async () => {
            const mockData = {
                documentId: 'doc-1',
                status: 'pending',
                signers: [],
                createdAt: Timestamp.now(),
            };

            const { getDoc } = await import('firebase/firestore');
            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                id: 'request-123',
                data: () => mockData,
            } as never);

            const result = await SignatureService.getSignatureRequest('request-123');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('request-123');
            expect(result?.documentId).toBe('doc-1');
        });
    });

    describe('getSignatureRequestsForDocument', () => {
        it('should return empty array when no requests exist', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockResolvedValueOnce({
                forEach: vi.fn(),
            } as never);

            const result = await SignatureService.getSignatureRequestsForDocument('doc-1', 'org-1');
            expect(result).toEqual([]);
        });

        it('should return all requests for a document', async () => {
            const mockRequests = [
                { id: 'req-1', documentId: 'doc-1', status: 'completed' },
                { id: 'req-2', documentId: 'doc-1', status: 'pending' },
            ];

            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockResolvedValueOnce({
                forEach: (callback: (doc: { id: string; data: () => object }) => void) => {
                    mockRequests.forEach(req => {
                        callback({ id: req.id, data: () => req });
                    });
                },
            } as never);

            const result = await SignatureService.getSignatureRequestsForDocument('doc-1', 'org-1');

            expect(result.length).toBe(2);
            expect(result[0].id).toBe('req-1');
            expect(result[1].id).toBe('req-2');
        });
    });

    describe('Status transitions', () => {
        it('should have all required statuses defined', () => {
            const statuses = ['draft', 'pending', 'in_progress', 'completed', 'rejected', 'expired', 'cancelled'] as const;

            statuses.forEach(status => {
                const config = SignatureService.getStatusConfig(status);
                expect(config.label).toBeDefined();
                expect(config.badgeStatus).toBeDefined();
                expect(config.description).toBeDefined();
            });
        });

        it('should have correct badge status for workflow states', () => {
            expect(SignatureService.getStatusConfig('draft').badgeStatus).toBe('neutral');
            expect(SignatureService.getStatusConfig('pending').badgeStatus).toBe('warning');
            expect(SignatureService.getStatusConfig('in_progress').badgeStatus).toBe('info');
            expect(SignatureService.getStatusConfig('completed').badgeStatus).toBe('success');
            expect(SignatureService.getStatusConfig('rejected').badgeStatus).toBe('error');
        });
    });

    describe('Signer workflow', () => {
        it('should have all required signer statuses defined', () => {
            const signerStatuses = ['pending', 'notified', 'viewed', 'signed', 'rejected', 'expired'] as const;

            signerStatuses.forEach(status => {
                const config = SignatureService.getSignerStatusConfig(status);
                expect(config.label).toBeDefined();
                expect(config.badgeStatus).toBeDefined();
            });
        });
    });

    describe('Error handling', () => {
        it('should handle getSignatureRequest errors gracefully', async () => {
            const { getDoc } = await import('firebase/firestore');
            vi.mocked(getDoc).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(SignatureService.getSignatureRequest('request-1')).rejects.toThrow();
        });

        it('should handle getSignatureRequestsForDocument errors gracefully', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Query error'));

            await expect(
                SignatureService.getSignatureRequestsForDocument('doc-1', 'org-1')
            ).rejects.toThrow();
        });
    });

    describe('calculateDocumentHash', () => {
        it('should return hash from integrity service', async () => {
            const hash = await SignatureService.calculateDocumentHash('doc-1');
            expect(hash).toBe('abc123hash');
        });
    });
});
