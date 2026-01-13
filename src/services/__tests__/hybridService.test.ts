/**
 * HybridService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firebase before importing
vi.mock('../../firebase', () => ({
    auth: {
        currentUser: {
            getIdToken: vi.fn(() => Promise.resolve('mock-token')),
            getIdTokenResult: vi.fn(() => Promise.resolve({
                claims: { organizationId: 'org-1' }
            }))
        }
    },
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({})),
    setDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() => Promise.resolve({
        exists: () => true,
        data: () => ({ test: 'data' })
    })),
    deleteDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getDocs: vi.fn(() => Promise.resolve({
        docs: [
            { data: () => ({ id: '1' }), ref: {} },
            { data: () => ({ id: '2' }), ref: {} }
        ],
        size: 2
    }))
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn()
    }
}));

vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data)
}));

// Import after mocks
import { hybridService } from '../hybridService';

describe('HybridService', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn();
        global.fetch = mockFetch;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('storeSecureData', () => {
        it('should store data in Firestore', async () => {
            const { setDoc } = await import('firebase/firestore');

            const result = await hybridService.storeSecureData('testType', {
                field: 'value',
                organizationId: 'org-1'
            });

            expect(setDoc).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should return error when organizationId is missing and user has none', async () => {
            const { auth } = await import('../../firebase');
            const originalUser = auth.currentUser;
            (auth as { currentUser: unknown }).currentUser = {
                getIdToken: vi.fn(() => Promise.resolve('token')),
                getIdTokenResult: vi.fn(() => Promise.resolve({ claims: {} }))
            };

            const result = await hybridService.storeSecureData('testType', { field: 'value' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('organizationId');

            (auth as { currentUser: unknown }).currentUser = originalUser;
        });

        it('should use provided id from payload', async () => {
            const { setDoc, doc } = await import('firebase/firestore');

            await hybridService.storeSecureData('testType', {
                id: 'custom-id',
                field: 'value',
                organizationId: 'org-1'
            });

            expect(doc).toHaveBeenCalledWith(expect.anything(), 'secure_storage', 'testType_custom-id');
            expect(setDoc).toHaveBeenCalled();
        });

        it('should handle setDoc errors', async () => {
            const { setDoc } = await import('firebase/firestore');
            vi.mocked(setDoc).mockRejectedValueOnce(new Error('Firestore error'));
            const { ErrorLogger } = await import('../errorLogger');

            const result = await hybridService.storeSecureData('testType', {
                field: 'value',
                organizationId: 'org-1'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to store secure data');
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('getSecureData', () => {
        it('should retrieve data from Firestore', async () => {
            const result = await hybridService.getSecureData('testType', 'doc-id');

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should return error for non-existent document', async () => {
            const { getDoc } = await import('firebase/firestore');
            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => false,
                data: () => null
            } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never);

            const result = await hybridService.getSecureData('testType', 'non-existent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Data not found');
        });

        it('should handle getDoc errors', async () => {
            const { getDoc } = await import('firebase/firestore');
            vi.mocked(getDoc).mockRejectedValueOnce(new Error('Firestore error'));
            const { ErrorLogger } = await import('../errorLogger');

            const result = await hybridService.getSecureData('testType', 'doc-id');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to retrieve secure data');
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('deleteSecureData', () => {
        it('should delete data from Firestore', async () => {
            const { deleteDoc } = await import('firebase/firestore');

            const result = await hybridService.deleteSecureData('testType', 'doc-id');

            expect(deleteDoc).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should handle deleteDoc errors', async () => {
            const { deleteDoc } = await import('firebase/firestore');
            vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('Delete error'));
            const { ErrorLogger } = await import('../errorLogger');

            const result = await hybridService.deleteSecureData('testType', 'doc-id');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to delete secure data');
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('logCriticalEvent', () => {
        it('should send POST request to audit endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: () => Promise.resolve({ success: true })
            });

            const event = { action: 'test', userId: 'user-1' };
            await hybridService.logCriticalEvent(event);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/v1/audit/log'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(event)
                })
            );
        });

        it('should include authorization header', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: () => Promise.resolve({ success: true })
            });

            await hybridService.logCriticalEvent({ test: 'event' });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-token'
                    })
                })
            );
        });
    });

    describe('logConsent', () => {
        it('should log consent with document type', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: () => Promise.resolve({ success: true })
            });

            await hybridService.logConsent('privacy_policy', true);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/v1/consent/log'),
                expect.objectContaining({
                    method: 'POST'
                })
            );
        });
    });

    describe('wipeOrganizationSecureData', () => {
        it('should delete all organization data', async () => {
            const { deleteDoc } = await import('firebase/firestore');

            const result = await hybridService.wipeOrganizationSecureData();

            expect(result.success).toBe(true);
            expect(result.message).toContain('2 records deleted');
            expect(deleteDoc).toHaveBeenCalledTimes(2);
        });

        it('should handle errors', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Query error'));
            const { ErrorLogger } = await import('../errorLogger');

            const result = await hybridService.wipeOrganizationSecureData();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to wipe data');
            expect(ErrorLogger.error).toHaveBeenCalled();
        });

        it('should fail when no user is logged in', async () => {
            const { auth } = await import('../../firebase');
            const originalUser = auth.currentUser;
            (auth as { currentUser: unknown }).currentUser = null;

            const result = await hybridService.wipeOrganizationSecureData();

            expect(result.success).toBe(false);

            (auth as { currentUser: unknown }).currentUser = originalUser;
        });
    });

    describe('exportOrganizationSecureData', () => {
        it('should export all organization data', async () => {
            const result = await hybridService.exportOrganizationSecureData();

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('export');
        });

        it('should handle errors', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Query error'));
            const { ErrorLogger } = await import('../errorLogger');

            const result = await hybridService.exportOrganizationSecureData();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to export data');
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('getRisksFromBackend', () => {
        it('should fetch risks from backend', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: () => Promise.resolve([{ id: 'risk-1', name: 'Test Risk' }])
            });

            const result = await hybridService.getRisksFromBackend();

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/v2/risks/'),
                expect.anything()
            );
            expect(result.success).toBe(true);
        });

        it('should handle HTTP errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal Server Error')
            });

            const result = await hybridService.getRisksFromBackend();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Internal Server Error');
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await hybridService.getRisksFromBackend();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error');
        });

        it('should return unauthorized when no token', async () => {
            const { auth } = await import('../../firebase');
            const originalUser = auth.currentUser;
            (auth as { currentUser: unknown }).currentUser = null;

            const result = await hybridService.getRisksFromBackend();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Unauthorized');

            (auth as { currentUser: unknown }).currentUser = originalUser;
        });
    });

    describe('request error handling', () => {
        it('should handle non-JSON responses', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'content-type': 'text/plain' }),
                text: () => Promise.resolve('OK')
            });

            const result = await hybridService.getRisksFromBackend();

            expect(result.success).toBe(true);
        });
    });
});
