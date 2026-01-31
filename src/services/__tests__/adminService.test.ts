/**
 * AdminService Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../store', () => ({
    useStore: {
        getState: () => ({
            user: {
                uid: 'test-user',
                organizationId: 'org-123',
                role: 'super_admin'
            }
        })
    }
}));

vi.mock('../../firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' } },
    functions: {}
}));

vi.mock('firebase/firestore', () => ({
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn(),
    doc: vi.fn(),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) }))
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { token: 'token' } })))
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn()
    }
}));

import { AdminService } from '../adminService';
import * as firestore from 'firebase/firestore';

describe('AdminService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass all checks', async () => {
        // 1. toggleTenantStatus
        await AdminService.toggleTenantStatus('org-id', true);
        expect(firestore.updateDoc).toHaveBeenCalled();

        // 2. getTenantStats
        const stats = await AdminService.getTenantStats('org-id');
        expect(stats).toBeDefined();

        // 3. impersonateUser
        const result = await AdminService.impersonateUser('target-user-id');
        expect(result.token).toBe('token');

        // 4. updateTenantSubscription
        await AdminService.updateTenantSubscription('org-id', 'professional', {});
        expect(firestore.updateDoc).toHaveBeenCalled();
    });
});
