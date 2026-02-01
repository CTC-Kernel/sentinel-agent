/**
 * PrivacyService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacyService } from '../PrivacyService';
import { UserProfile, ProcessingActivity } from '../../types';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(() => Promise.resolve({
        exists: () => true,
        data: () => ({ organizationId: 'org-1' })
    })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-activity-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    setDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(() => Promise.resolve({
        docs: [
            {
                id: 'activity-1',
                data: () => ({
                    name: 'Test Activity',
                    organizationId: 'org-1',
                    legalBasis: 'consent',
                    dataCategoriesCollected: ['personal']
                })
            }
        ],
        empty: false
    })),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        commit: vi.fn(() => Promise.resolve()),
        update: vi.fn(),
        delete: vi.fn()
    })),
    limit: vi.fn(() => ({})),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true }))
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        handleErrorWithToast: vi.fn()
    }
}));

vi.mock('../logger', () => ({
    logAction: vi.fn(() => Promise.resolve())
}));

vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data)
}));

vi.mock('../SupplierService', () => ({
    SupplierService: {
        createAssessment: vi.fn(() => Promise.resolve('response-id'))
    }
}));

vi.mock('../../data/dpiatemplate', () => ({
    DPIA_TEMPLATE: {
        id: 'dpia-template-1',
        name: 'DPIA Template'
    }
}));

describe('PrivacyService', () => {
    const mockUser: UserProfile = {
        uid: 'user-1',
        email: 'test@example.com',
        organizationId: 'org-1',
        role: 'admin',
        displayName: 'Test User'
    } as UserProfile;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchActivities', () => {
        it('should fetch activities for organization', async () => {
            const activities = await PrivacyService.fetchActivities('org-1');

            expect(Array.isArray(activities)).toBe(true);
            expect(activities.length).toBeGreaterThan(0);
            expect(activities[0].id).toBe('activity-1');
        });

        it('should return empty array on error', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));

            const activities = await PrivacyService.fetchActivities('org-1');

            expect(activities).toEqual([]);
        });

        it('should log errors', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));
            const { ErrorLogger } = await import('../errorLogger');

            await PrivacyService.fetchActivities('org-1');

            expect(ErrorLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'PrivacyService.fetchActivities'
            );
        });
    });

    describe('createActivity', () => {
        it('should create new activity', async () => {
            const { addDoc } = await import('firebase/firestore');

            const activity: Omit<ProcessingActivity, 'id'> = {
                name: 'New Activity',
                organizationId: 'org-1',
                legalBasis: 'consent'
            } as unknown as Omit<ProcessingActivity, 'id'>;

            const id = await PrivacyService.createActivity(activity, mockUser);

            expect(id).toBe('new-activity-id');
            expect(addDoc).toHaveBeenCalled();
        });

        it('should log action after creation', async () => {
            const { logAction } = await import('../logger');

            const activity: Omit<ProcessingActivity, 'id'> = {
                name: 'Logged Activity',
                organizationId: 'org-1'
            } as unknown as Omit<ProcessingActivity, 'id'>;

            await PrivacyService.createActivity(activity, mockUser);

            expect(logAction).toHaveBeenCalledWith(
                mockUser,
                'CREATE',
                'Privacy',
                expect.stringContaining('Logged Activity'),
                undefined,
                'new-activity-id'
            );
        });

        it('should throw on error', async () => {
            const { addDoc } = await import('firebase/firestore');
            vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore error'));

            const activity: Omit<ProcessingActivity, 'id'> = {
                name: 'Error Activity',
                organizationId: 'org-1'
            } as unknown as Omit<ProcessingActivity, 'id'>;

            await expect(PrivacyService.createActivity(activity, mockUser)).rejects.toThrow();
        });
    });

    describe('updateActivity', () => {
        it('should update existing activity', async () => {
            const { updateDoc } = await import('firebase/firestore');

            await PrivacyService.updateActivity('activity-1', { name: 'Updated Name' }, mockUser);

            expect(updateDoc).toHaveBeenCalled();
        });

        it('should log action after update', async () => {
            const { logAction } = await import('../logger');

            await PrivacyService.updateActivity('activity-1', { name: 'Updated Activity' }, mockUser);

            expect(logAction).toHaveBeenCalledWith(
                mockUser,
                'UPDATE',
                'Privacy',
                expect.stringContaining('Updated Activity'),
                undefined,
                'activity-1'
            );
        });

        it('should throw on error', async () => {
            const { updateDoc } = await import('firebase/firestore');
            vi.mocked(updateDoc).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(
                PrivacyService.updateActivity('activity-1', { name: 'Error' }, mockUser)
            ).rejects.toThrow();
        });
    });

    describe('deleteActivity', () => {
        it('should delete activity', async () => {
            const { deleteDoc } = await import('firebase/firestore');

            await PrivacyService.deleteActivity('activity-1', 'Test Activity', mockUser);

            expect(deleteDoc).toHaveBeenCalled();
        });

        it('should log action after deletion', async () => {
            const { logAction } = await import('../logger');

            await PrivacyService.deleteActivity('activity-1', 'Deleted Activity', mockUser);

            expect(logAction).toHaveBeenCalledWith(
                mockUser,
                'DELETE',
                'Privacy',
                expect.stringContaining('Deleted Activity'),
                undefined,
                'activity-1'
            );
        });

        it('should throw on error', async () => {
            const { deleteDoc } = await import('firebase/firestore');
            vi.mocked(deleteDoc).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(
                PrivacyService.deleteActivity('activity-1', 'Test', mockUser)
            ).rejects.toThrow();
        });
    });

    describe('importActivities', () => {
        it('should import multiple activities', async () => {
            const { writeBatch } = await import('firebase/firestore');
            const mockBatch = {
                set: vi.fn(),
                commit: vi.fn(() => Promise.resolve()),
                update: vi.fn(),
                delete: vi.fn()
            };
            vi.mocked(writeBatch).mockReturnValue(mockBatch as ReturnType<typeof writeBatch>);

            const activities: Omit<ProcessingActivity, 'id'>[] = [
                { name: 'Activity 1', organizationId: 'org-1' } as unknown as Omit<ProcessingActivity, 'id'>,
                { name: 'Activity 2', organizationId: 'org-1' } as unknown as Omit<ProcessingActivity, 'id'>
            ];

            const count = await PrivacyService.importActivities(activities, mockUser);

            expect(count).toBe(2);
            expect(mockBatch.set).toHaveBeenCalledTimes(2);
            expect(mockBatch.commit).toHaveBeenCalled();
        });

        it('should return 0 for empty array', async () => {
            const count = await PrivacyService.importActivities([], mockUser);

            expect(count).toBe(0);
        });
    });

    describe('fetchActivityHistory', () => {
        it('should fetch activity history logs', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    {
                        id: 'log-1',
                        data: () => ({
                            resource: 'Privacy',
                            resourceId: 'activity-1',
                            timestamp: '2024-01-01T00:00:00Z'
                        })
                    }
                ]
            } as ReturnType<typeof getDocs> extends Promise<infer T> ? T : never);

            const logs = await PrivacyService.fetchActivityHistory('org-1', 'activity-1');

            expect(Array.isArray(logs)).toBe(true);
        });

        it('should return empty array on error', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));

            const logs = await PrivacyService.fetchActivityHistory('org-1', 'activity-1');

            expect(logs).toEqual([]);
        });
    });

    describe('startDPIA', () => {
        it('should start DPIA assessment', async () => {
            const { setDoc, updateDoc } = await import('firebase/firestore');
            const { SupplierService } = await import('../SupplierService');

            const activity: ProcessingActivity = {
                id: 'activity-1',
                name: 'Test Activity',
                organizationId: 'org-1'
            } as ProcessingActivity;

            const responseId = await PrivacyService.startDPIA(activity, mockUser);

            expect(responseId).toBe('response-id');
            expect(setDoc).toHaveBeenCalled();
            expect(SupplierService.createAssessment).toHaveBeenCalled();
            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ hasDPIA: true })
            );
        });

        it('should throw if organizationId is missing', async () => {
            const userWithoutOrg = { ...mockUser, organizationId: undefined } as unknown as UserProfile;
            const activity: ProcessingActivity = {
                id: 'activity-1',
                name: 'Test'
            } as ProcessingActivity;

            await expect(
                PrivacyService.startDPIA(activity, userWithoutOrg)
            ).rejects.toThrow('Organization ID missing');
        });
    });

    describe('findDPIAResponseId', () => {
        it('should find DPIA response ID', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [
                    {
                        id: 'response-1',
                        data: () => ({ sentDate: '2024-01-15T00:00:00Z' })
                    },
                    {
                        id: 'response-2',
                        data: () => ({ sentDate: '2024-01-01T00:00:00Z' })
                    }
                ],
                empty: false
            } as ReturnType<typeof getDocs> extends Promise<infer T> ? T : never);

            const responseId = await PrivacyService.findDPIAResponseId('activity-1');

            // Should return most recent response
            expect(responseId).toBe('response-1');
        });

        it('should return null if no response found', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: [],
                empty: true,
                metadata: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                query: {} as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                size: 0,
                forEach: vi.fn(),
                docChanges: vi.fn(),
                toJSON: vi.fn(),
            } as ReturnType<typeof getDocs> extends Promise<infer T> ? T : never);

            const responseId = await PrivacyService.findDPIAResponseId('activity-1');

            expect(responseId).toBeNull();
        });
    });
});
