/**
 * AccountService Tests
 * Story 14-1: Test Coverage 50%
 * Updated for GDPR-compliant Cloud Function based deletion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService } from '../accountService';
import { createUser } from '../../tests/factories/userFactory';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    functions: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('firebase/auth', () => ({
    User: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} })),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

import { setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

describe('AccountService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('deleteAccount', () => {
        it('should call the deleteUserAccount cloud function', async () => {
            const user = createUser({ uid: 'user-123', organizationId: 'org-123' });
            const firebaseUser = { uid: 'user-123' } as never;

            const mockFn = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockFn as unknown as ReturnType<typeof httpsCallable>);

            await AccountService.deleteAccount(user, firebaseUser);

            expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'deleteUserAccount');
            expect(mockFn).toHaveBeenCalledWith({});
        });

        it('should handle failed-precondition error for org owners', async () => {
            const user = createUser({ uid: 'user-123', organizationId: 'org-123' });
            const firebaseUser = { uid: 'user-123' } as never;

            const mockFn = vi.fn().mockRejectedValue({
                code: 'functions/failed-precondition',
                message: 'Transférez la propriété avant de supprimer votre compte.'
            });
            vi.mocked(httpsCallable).mockReturnValue(mockFn as unknown as ReturnType<typeof httpsCallable>);

            await expect(
                AccountService.deleteAccount(user, firebaseUser)
            ).rejects.toThrow('Transférez la propriété');
        });

        it('should handle cloud function errors gracefully', async () => {
            const user = createUser({ uid: 'user-123' });
            const firebaseUser = { uid: 'user-123' } as never;

            const mockFn = vi.fn().mockRejectedValue(new Error('Cloud function error'));
            vi.mocked(httpsCallable).mockReturnValue(mockFn as unknown as ReturnType<typeof httpsCallable>);

            await expect(
                AccountService.deleteAccount(user, firebaseUser)
            ).rejects.toThrow('Cloud function error');
        });
    });

    describe('deleteOrganization', () => {
        it('should call cloud function to delete organization', async () => {
            const mockFn = vi.fn().mockResolvedValue({ data: {} });
            vi.mocked(httpsCallable).mockReturnValue(mockFn as unknown as ReturnType<typeof httpsCallable>);

            await AccountService.deleteOrganization('org-123');

            expect(httpsCallable).toHaveBeenCalled();
            expect(mockFn).toHaveBeenCalledWith({ organizationId: 'org-123' });
        });

        it('should throw error when organization ID is missing', async () => {
            await expect(
                AccountService.deleteOrganization('')
            ).rejects.toThrow('Organization ID is required');
        });

        it('should handle cloud function errors', async () => {
            const mockFn = vi.fn().mockRejectedValue(new Error('Cloud function error'));
            vi.mocked(httpsCallable).mockReturnValue(mockFn as unknown as ReturnType<typeof httpsCallable>);

            await expect(
                AccountService.deleteOrganization('org-123')
            ).rejects.toThrow('Cloud function error');
        });
    });

    describe('updateProfile', () => {
        it('should update user profile with provided data', async () => {
            vi.mocked(setDoc).mockResolvedValue(undefined);

            await AccountService.updateProfile('user-123', {
                displayName: 'New Name',
                department: 'Engineering',
            });

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    displayName: 'New Name',
                    department: 'Engineering',
                    updatedAt: 'mock-timestamp',
                }),
                { merge: true }
            );
        });

        it('should handle update errors', async () => {
            vi.mocked(setDoc).mockRejectedValue(new Error('Update failed'));

            await expect(
                AccountService.updateProfile('user-123', { displayName: 'Test' })
            ).rejects.toThrow('Update failed');
        });
    });
});
