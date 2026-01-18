/**
 * RetentionService Tests
 *
 * Tests for retention policy management, expiry calculations, and document queries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetentionService } from '../retentionService';
import { Timestamp } from 'firebase/firestore';
import { subDays } from 'date-fns';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

// Mock Firestore
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'new-policy-id' });
const mockDoc = vi.fn((_, __, id) => ({ id: id || 'mock-id' }));
const mockCollection = vi.fn(() => ({}));
const mockQuery = vi.fn(() => ({}));
const mockWhere = vi.fn(() => ({}));
const mockOrderBy = vi.fn(() => ({}));

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual('firebase/firestore');

    class MockTimestamp {
        seconds: number;
        nanoseconds: number;
        constructor(seconds: number, nanoseconds: number) {
            this.seconds = seconds;
            this.nanoseconds = nanoseconds;
        }
        toDate() { return new Date(this.seconds * 1000); }
        static now() { return new MockTimestamp(Date.now() / 1000, 0); }
        static fromDate(date: Date) { return new MockTimestamp(date.getTime() / 1000, 0); }
    }

    return {
        ...actual,
        doc: (...args: any[]) => (mockDoc as any)(...args),
        getDoc: (...args: any[]) => (mockGetDoc as any)(...args),
        setDoc: (...args: any[]) => (mockSetDoc as any)(...args),
        addDoc: (...args: any[]) => (mockAddDoc as any)(...args),
        updateDoc: (...args: any[]) => (mockUpdateDoc as any)(...args),
        deleteDoc: (...args: any[]) => (mockDeleteDoc as any)(...args),
        getDocs: (...args: any[]) => (mockGetDocs as any)(...args),
        collection: (...args: any[]) => (mockCollection as any)(...args),
        query: (...args: any[]) => (mockQuery as any)(...args),
        where: (...args: any[]) => (mockWhere as any)(...args),
        orderBy: (...args: any[]) => (mockOrderBy as any)(...args),
        Timestamp: MockTimestamp,
    };
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

describe('RetentionService', () => {
    const organizationId = 'org-test';
    const userId = 'user-test';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('createPolicy', () => {
        it('should create a new retention policy', async () => {
            const result = await RetentionService.createPolicy(
                organizationId,
                'Test Policy',
                365,
                'notify',
                userId
            );

            expect(mockAddDoc).toHaveBeenCalled();
            expect(result).toMatchObject({
                id: 'new-policy-id',
                organizationId,
                name: 'Test Policy',
                retentionDays: 365,
                action: 'notify',
                isActive: true,
                createdBy: userId,
            });
        });
    });

    describe('getPolicies', () => {
        it('should list policies for an organization', async () => {
            const mockPolicies = [
                { id: 'policy-1', name: 'P1', organizationId },
                { id: 'policy-2', name: 'P2', organizationId },
            ];

            mockGetDocs.mockResolvedValueOnce({
                forEach: (cb: (doc: { id: string; data: () => typeof mockPolicies[0] }) => void) => {
                    mockPolicies.forEach((p) => cb({ id: p.id, data: () => p }));
                },
                size: 2,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                map: (cb: any) => mockPolicies.map((p) => cb({ id: p.id, data: () => p })),
            });

            const result = await RetentionService.getPolicies(organizationId);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('policy-1');
            expect(mockWhere).toHaveBeenCalledWith('organizationId', '==', organizationId);
        });
    });

    describe('calculateExpiryDate', () => {
        it('should calculate expiry date correctly', () => {
            const createdAt = new Date('2023-01-01');
            const retentionDays = 30;
            const expectedDate = new Date('2023-01-31');

            const result = RetentionService.calculateExpiryDate(createdAt, retentionDays);
            expect(result).toEqual(expectedDate);
        });

        it('should handle Timestamp input', () => {
            const createdAt = new Date('2023-01-01');
            // Use the MockTimestamp class via the exported/mocked Timestamp object
            const timestamp = Timestamp.fromDate(createdAt);
            const retentionDays = 10;
            const expectedDate = new Date('2023-01-11');

            const result = RetentionService.calculateExpiryDate(timestamp, retentionDays);
            expect(result).toEqual(expectedDate);
        });
    });

    describe('getDocumentsNearExpiry', () => {
        it('should identify documents nearing expiry', async () => {
            const now = new Date();
            const docs = [
                {
                    id: 'doc-1',
                    createdAt: Timestamp.fromDate(subDays(now, 340)), // 340 days old
                    type: 'Contract',
                    organizationId
                },
            ];

            const policies = [
                {
                    id: 'policy-1',
                    name: 'Contracts Policy',
                    retentionDays: 365, // Expire in 25 days
                    scope: { documentTypes: ['Contract'] },
                    action: 'notify',
                    priority: 1
                }
            ];

            // Mock getDocs sequence: 1. Documents, 2. Policies
            mockGetDocs
                .mockResolvedValueOnce({ // First call: getDocs(documents)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    forEach: (cb: any) => docs.forEach(d => cb({ id: d.id, data: () => d }))
                })
                .mockResolvedValueOnce({ // Second call: getPolicies -> getDocs
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    forEach: (cb: any) => policies.forEach(p => cb({ id: p.id, data: () => p })),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    map: (cb: any) => policies.map(p => cb({ id: p.id, data: () => p })),
                    size: policies.length
                });


            const result = await RetentionService.getDocumentsNearExpiry(organizationId, 30);

            expect(result).toHaveLength(1);
            expect(result[0].documentId).toBe('doc-1');
            expect(result[0].daysUntilExpiry).toBeCloseTo(25, -1); // Approx 25 days
        });
    });
});
