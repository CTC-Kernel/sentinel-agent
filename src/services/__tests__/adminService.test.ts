/**
 * AdminService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminService, AuditLog } from '../adminService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    auth: {
        currentUser: {
            uid: 'test-user-id',
            email: 'test@example.com'
        }
    },
    functions: {}
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({})),
    updateDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 5 }) })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-log-id' })),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    getDocs: vi.fn(() => Promise.resolve({
        docs: [
            {
                id: 'log-1',
                data: () => ({
                    timestamp: '2024-01-01T00:00:00Z',
                    actorId: 'user-1',
                    actorEmail: 'actor@test.com',
                    action: 'TEST_ACTION',
                    targetId: 'target-1',
                    metadata: {}
                })
            }
        ]
    }))
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { token: 'test-token' } })))
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn()
    }
}));

describe('AdminService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('logAction', () => {
        it('should log an admin action', async () => {
            const { addDoc } = await import('firebase/firestore');

            await AdminService.logAction('TEST_ACTION', 'target-id', { extra: 'data' });

            expect(addDoc).toHaveBeenCalled();
        });

        it('should handle missing user gracefully', async () => {
            const { auth } = await import('../../firebase');
            const originalCurrentUser = auth.currentUser;
            (auth as { currentUser: unknown }).currentUser = null;

            const { ErrorLogger } = await import('../errorLogger');

            await AdminService.logAction('TEST_ACTION', 'target-id');

            expect(ErrorLogger.warn).toHaveBeenCalledWith(
                'Attempted to log admin action without authenticated user',
                'AdminService.logAction'
            );

            (auth as { currentUser: unknown }).currentUser = originalCurrentUser;
        });

        it('should handle errors without throwing', async () => {
            const { addDoc } = await import('firebase/firestore');
            vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore error'));

            const { ErrorLogger } = await import('../errorLogger');

            // Should not throw
            await AdminService.logAction('TEST_ACTION', 'target-id');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('getAuditLogs', () => {
        it('should return audit logs', async () => {
            const logs = await AdminService.getAuditLogs('org-123');

            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0]).toHaveProperty('id');
            expect(logs[0]).toHaveProperty('action');
        });

        it('should accept limit parameter', async () => {
            const { limit } = await import('firebase/firestore');

            await AdminService.getAuditLogs('org-123', 50);

            expect(limit).toHaveBeenCalledWith(50);
        });

        it('should return empty array on error', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));

            const logs = await AdminService.getAuditLogs('org-123');

            expect(logs).toEqual([]);
        });
    });

    describe('toggleTenantStatus', () => {
        it('should activate a tenant', async () => {
            const { updateDoc } = await import('firebase/firestore');

            await AdminService.toggleTenantStatus('org-id', true);

            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    isActive: true
                })
            );
        });

        it('should suspend a tenant', async () => {
            const { updateDoc } = await import('firebase/firestore');

            await AdminService.toggleTenantStatus('org-id', false);

            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    isActive: false
                })
            );
        });

        it('should throw on error', async () => {
            const { updateDoc } = await import('firebase/firestore');
            vi.mocked(updateDoc).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(AdminService.toggleTenantStatus('org-id', true)).rejects.toThrow();
        });
    });

    describe('getTenantStats', () => {
        it('should return tenant statistics', async () => {
            const stats = await AdminService.getTenantStats('org-id');

            expect(stats).toHaveProperty('userCount');
            expect(stats).toHaveProperty('projectCount');
            expect(stats).toHaveProperty('storageUsedBytes');
            expect(stats).toHaveProperty('lastActive');
        });

        it('should throw on error', async () => {
            const { getCountFromServer } = await import('firebase/firestore');
            vi.mocked(getCountFromServer).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(AdminService.getTenantStats('org-id')).rejects.toThrow();
        });
    });

    describe('impersonateUser', () => {
        it('should return token on successful impersonation', async () => {
            const result = await AdminService.impersonateUser('target-user-id');

            expect(result).toHaveProperty('token');
            expect(result.token).toBe('test-token');
        });

        it('should throw on error', async () => {
            const { httpsCallable } = await import('firebase/functions');
            vi.mocked(httpsCallable).mockReturnValueOnce(
                vi.fn().mockRejectedValueOnce(new Error('Function error')) as unknown as ReturnType<typeof httpsCallable>
            );

            await expect(AdminService.impersonateUser('target-user-id')).rejects.toThrow(
                "Impossible d'impréciser l'utilisateur"
            );
        });
    });

    describe('updateTenantSubscription', () => {
        it('should update subscription plan', async () => {
            const { updateDoc } = await import('firebase/firestore');

            await AdminService.updateTenantSubscription('org-id', 'professional', {});

            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    'subscription.planId': 'professional'
                })
            );
        });

        it('should update custom limits', async () => {
            const { updateDoc } = await import('firebase/firestore');

            await AdminService.updateTenantSubscription('org-id', 'enterprise', {
                maxUsers: 100,
                maxProjects: 50,
                maxStorageGB: 500
            });

            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    'subscription.customLimits.maxUsers': 100,
                    'subscription.customLimits.maxProjects': 50,
                    'subscription.customLimits.maxStorageGB': 500
                })
            );
        });

        it('should throw on error', async () => {
            const { updateDoc } = await import('firebase/firestore');
            vi.mocked(updateDoc).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(
                AdminService.updateTenantSubscription('org-id', 'professional', {})
            ).rejects.toThrow();
        });
    });
});

describe('AuditLog interface', () => {
    it('should have correct structure', () => {
        const log: AuditLog = {
            id: 'log-1',
            timestamp: '2024-01-01T00:00:00Z',
            actorId: 'user-1',
            actorEmail: 'actor@test.com',
            action: 'TEST_ACTION',
            targetId: 'target-1',
            organizationId: 'org-123',
            metadata: { key: 'value' }
        };

        expect(log.id).toBe('log-1');
        expect(log.action).toBe('TEST_ACTION');
        expect(log.metadata).toEqual({ key: 'value' });
    });
});
