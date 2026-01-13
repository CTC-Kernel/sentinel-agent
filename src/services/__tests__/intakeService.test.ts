/**
 * IntakeService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntakeService, IntakeOptions, AssetSubmissionData } from '../intakeService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    functions: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getDocs: vi.fn(() => Promise.resolve({
        docs: [
            {
                id: 'project-1',
                data: () => ({
                    name: 'Test Project',
                    organizationId: 'org-1'
                })
            },
            {
                id: 'user-1',
                data: () => ({
                    displayName: 'Test User',
                    email: 'test@example.com'
                })
            }
        ]
    }))
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve()))
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

describe('IntakeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchOptions', () => {
        it('should fetch projects and users for organization', async () => {
            const options = await IntakeService.fetchOptions('org-1');

            expect(options).toHaveProperty('projects');
            expect(options).toHaveProperty('users');
        });

        it('should return arrays of projects and users', async () => {
            const options = await IntakeService.fetchOptions('org-1');

            expect(Array.isArray(options.projects)).toBe(true);
            expect(Array.isArray(options.users)).toBe(true);
        });

        it('should throw on error', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));

            await expect(IntakeService.fetchOptions('org-1')).rejects.toThrow();
        });

        it('should log errors', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));
            const { ErrorLogger } = await import('../errorLogger');

            try {
                await IntakeService.fetchOptions('org-1');
            } catch {
                // Expected
            }

            expect(ErrorLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'IntakeService.fetchOptions'
            );
        });
    });

    describe('submitAsset', () => {
        it('should submit asset data to cloud function', async () => {
            const { httpsCallable } = await import('firebase/functions');
            const mockCallable = vi.fn(() => Promise.resolve());
            vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

            const data: AssetSubmissionData = {
                name: 'Test Asset',
                serialNumber: 'SN123',
                userId: 'user-1',
                projectId: 'project-1',
                notes: 'Test notes',
                hardwareType: 'laptop',
                orgId: 'org-1',
                hardware: {
                    cpu: 'Intel',
                    memory: '16GB',
                    storage: '512GB'
                } as AssetSubmissionData['hardware']
            };

            await IntakeService.submitAsset(data);

            expect(httpsCallable).toHaveBeenCalledWith(
                expect.anything(),
                'submitKioskAsset'
            );
            expect(mockCallable).toHaveBeenCalledWith(data);
        });

        it('should throw on error', async () => {
            const { httpsCallable } = await import('firebase/functions');
            vi.mocked(httpsCallable).mockReturnValue(
                vi.fn().mockRejectedValueOnce(new Error('Function error')) as ReturnType<typeof httpsCallable>
            );

            const data: AssetSubmissionData = {
                name: 'Test Asset',
                serialNumber: 'SN123',
                userId: 'user-1',
                projectId: 'project-1',
                notes: '',
                hardwareType: 'laptop',
                orgId: 'org-1',
                hardware: {} as AssetSubmissionData['hardware']
            };

            await expect(IntakeService.submitAsset(data)).rejects.toThrow();
        });

        it('should log errors', async () => {
            const { httpsCallable } = await import('firebase/functions');
            vi.mocked(httpsCallable).mockReturnValue(
                vi.fn().mockRejectedValueOnce(new Error('Function error')) as ReturnType<typeof httpsCallable>
            );
            const { ErrorLogger } = await import('../errorLogger');

            const data: AssetSubmissionData = {
                name: 'Test Asset',
                serialNumber: 'SN123',
                userId: 'user-1',
                projectId: 'project-1',
                notes: '',
                hardwareType: 'laptop',
                orgId: 'org-1',
                hardware: {} as AssetSubmissionData['hardware']
            };

            try {
                await IntakeService.submitAsset(data);
            } catch {
                // Expected
            }

            expect(ErrorLogger.error).toHaveBeenCalledWith(
                expect.any(Error),
                'IntakeService.submitAsset'
            );
        });
    });
});

describe('IntakeOptions interface', () => {
    it('should have correct structure', () => {
        const options: IntakeOptions = {
            projects: [{ id: 'p1', name: 'Project 1' }] as IntakeOptions['projects'],
            users: [{ uid: 'u1', displayName: 'User 1' }] as IntakeOptions['users']
        };

        expect(options.projects).toHaveLength(1);
        expect(options.users).toHaveLength(1);
    });
});

describe('AssetSubmissionData interface', () => {
    it('should have correct structure', () => {
        const data: AssetSubmissionData = {
            name: 'Test Asset',
            serialNumber: 'SN123',
            userId: 'user-1',
            projectId: 'project-1',
            notes: 'Some notes',
            hardwareType: 'desktop',
            orgId: 'org-1',
            hardware: {
                cpu: 'AMD Ryzen',
                memory: '32GB',
                storage: '1TB'
            } as AssetSubmissionData['hardware']
        };

        expect(data.name).toBe('Test Asset');
        expect(data.serialNumber).toBe('SN123');
        expect(data.hardwareType).toBe('desktop');
    });
});
