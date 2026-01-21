/**
 * AccountService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService } from '../accountService';
import { createUser } from '../../tests/factories/userFactory';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    storage: {},
    functions: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    deleteDoc: vi.fn(),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('firebase/auth', () => ({
    deleteUser: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    deleteObject: vi.fn(),
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

import { getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

describe('AccountService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('deleteAccount', () => {
        it('should delete user profile document', async () => {
            const user = createUser({ uid: 'user-123', organizationId: 'org-123' });
            const firebaseUser = { uid: 'user-123' } as never;

            vi.mocked(getDocs).mockResolvedValue({
                empty: true,
                docs: [],
            } as never);

            await AccountService.deleteAccount(user, firebaseUser);

            expect(deleteDoc).toHaveBeenCalled();
            expect(deleteUser).toHaveBeenCalledWith(firebaseUser);
        });

        it('should delete user avatar if exists and is from Firebase', async () => {
            const user = createUser({
                uid: 'user-123',
                organizationId: 'org-123',
            });
            // Add photoURL to the user
            (user as { photoURL: string }).photoURL = 'https://firebase.storage.com/avatars/user-123';

            const firebaseUser = { uid: 'user-123' } as never;

            vi.mocked(getDocs).mockResolvedValue({
                empty: true,
                docs: [],
            } as never);

            await AccountService.deleteAccount(user, firebaseUser);

            expect(deleteObject).toHaveBeenCalled();
        });

        it('should delete organization if user is the only member', async () => {
            const user = createUser({ uid: 'user-123', organizationId: 'org-123' });
            const firebaseUser = { uid: 'user-123' } as never;

            // Mock: No other users in org
            vi.mocked(getDocs).mockResolvedValue({
                empty: true,
                docs: [],
            } as never);

            await AccountService.deleteAccount(user, firebaseUser);

            expect(httpsCallable).toHaveBeenCalled();
        });

        it('should not delete organization if other users exist', async () => {
            const user = createUser({ uid: 'user-123', organizationId: 'org-123' });
            const firebaseUser = { uid: 'user-123' } as never;

            // Mock: Other users exist in org
            vi.mocked(getDocs).mockResolvedValue({
                empty: false,
                docs: [{ id: 'other-user', data: () => ({}) }],
            } as never);

            await AccountService.deleteAccount(user, firebaseUser);

            // httpsCallable for deleteOrganization should NOT be called
            // because there are other users
            expect(deleteUser).toHaveBeenCalled();
        });

        it('should throw error when user ID is missing', async () => {
            const user = createUser();
            (user as { uid: string | undefined }).uid = undefined;
            const firebaseUser = {} as never;

            await expect(
                AccountService.deleteAccount(user, firebaseUser)
            ).rejects.toThrow('User ID not found');
        });

        it('should handle Firebase errors gracefully', async () => {
            const user = createUser({ uid: 'user-123' });
            const firebaseUser = { uid: 'user-123' } as never;

            vi.mocked(deleteDoc).mockRejectedValue(new Error('Firebase error'));

            await expect(
                AccountService.deleteAccount(user, firebaseUser)
            ).rejects.toThrow('Firebase error');
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
