
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { integrationService } from '../integrationService';
import { db } from '../../firebase';
import { getDocs, addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    functions: {},
    storage: {}
}));

// Mock Firestore functions
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn()
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

describe('IntegrationService', () => {
    const mockOrgId = 'org-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getScannerJobs', () => {
        it('should return empty array if no orgId provided', async () => {
            const jobs = await integrationService.getScannerJobs(undefined);
            expect(jobs).toEqual([]);
        });

        it('should fetch jobs from firestore when orgId is provided', async () => {
            const mockSnapshot = {
                docs: [
                    { id: 'job-1', data: () => ({ scannerId: 'nessus', status: 'scheduled' }) },
                    { id: 'job-2', data: () => ({ scannerId: 'qualys', status: 'completed' }) }
                ]
            };
            (getDocs as any).mockResolvedValue(mockSnapshot);

            const jobs = await integrationService.getScannerJobs(mockOrgId);

            expect(collection).toHaveBeenCalledWith(db, 'organizations', mockOrgId, 'scanner_jobs');
            expect(getDocs).toHaveBeenCalled();
            expect(jobs).toHaveLength(2);
            expect(jobs[0]).toEqual({ id: 'job-1', scannerId: 'nessus', status: 'scheduled' });
        });
    });

    describe('scheduleScannerJob', () => {
        it('should throw error if no orgId provided', async () => {
            await expect(integrationService.scheduleScannerJob({
                scannerId: 'nessus',
                target: '10.0.0.1',
                frequency: 'daily'
            }, undefined)).rejects.toThrow('Organization ID is required');
        });

        it('should add new job to firestore', async () => {
            const mockJobCreate = {
                scannerId: 'nessus' as const,
                target: '10.0.0.1',
                frequency: 'daily' as const
            };
            (addDoc as any).mockResolvedValue({ id: 'new-job-id' });

            const result = await integrationService.scheduleScannerJob(mockJobCreate, mockOrgId);

            expect(collection).toHaveBeenCalledWith(db, 'organizations', mockOrgId, 'scanner_jobs');
            expect(addDoc).toHaveBeenCalled();
            expect(result.id).toBe('new-job-id');
            expect(result.status).toBe('scheduled');
        });
    });

    describe('syncProvider', () => {
        it('should update provider status and lastSync in firestore', async () => {
            (updateDoc as any).mockResolvedValue(undefined);

            await integrationService.syncProvider('aws', mockOrgId);

            expect(doc).toHaveBeenCalledWith(db, 'organizations', mockOrgId, 'integrations', 'aws');
            expect(updateDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
                status: 'active'
            }));
        });

        it('should warn and return if no orgId provided', async () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            await integrationService.syncProvider('aws', undefined);
            expect(spy).toHaveBeenCalledWith("IntegrationService.syncProvider called without organizationId");
            expect(updateDoc).not.toHaveBeenCalled();
        });
    });

    describe('deleteScannerJob', () => {
        it('should delete job from firestore', async () => {
            (deleteDoc as any).mockResolvedValue(undefined);

            await integrationService.deleteScannerJob('job-1', mockOrgId);

            expect(doc).toHaveBeenCalledWith(db, 'organizations', mockOrgId, 'scanner_jobs', 'job-1');
            expect(deleteDoc).toHaveBeenCalled();
        });
    });
});
