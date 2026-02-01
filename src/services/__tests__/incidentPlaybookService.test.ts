/**
 * IncidentPlaybookService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncidentPlaybookService, IncidentPlaybook } from '../incidentPlaybookService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock Firestore
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'mock-collection'),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    getDocs: () => mockGetDocs(),
    getDoc: () => mockGetDoc(),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    query: vi.fn(),
    where: vi.fn(),
    Timestamp: {
        now: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 }))
    },
    serverTimestamp: vi.fn(() => new Date().toISOString()),
    arrayUnion: vi.fn((...args) => args),
    writeBatch: vi.fn(() => ({ set: mockBatchSet, update: mockBatchUpdate, delete: mockBatchDelete, commit: mockBatchCommit })),
}));

// Mock Logger
vi.mock('../logger', () => ({
    logAction: vi.fn(() => Promise.resolve())
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
    }
}));

// Mock dataSanitizer
vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data)
}));

// Mock playbook templates
vi.mock('../../data/playbookTemplates', () => ({
    PLAYBOOK_TEMPLATES: []
}));

const mockPlaybook: IncidentPlaybook = {
    id: 'playbook-123',
    category: 'Ransomware',
    title: 'Data Breach Response',
    description: 'Standard procedure for handling data breaches',
    severity: 'High',
    estimatedDuration: '2-4 hours',
    requiredResources: ['Security Team', 'Legal'],
    steps: [
        {
            id: 'step-1',
            order: 1,
            title: 'Identify Breach',
            description: 'Determine the scope of the breach',
            type: 'detection',
            estimatedTime: '30 minutes',
            requiredRole: 'security-analyst'
        }
    ],
    communicationTemplate: {
        internal: 'Internal template',
        management: 'Management template'
    },
    checklist: [
        {
            id: 'check-1',
            title: 'Verify breach',
            description: 'Confirm the breach occurred',
            required: true,
            category: 'detection'
        }
    ],
    postIncidentActions: [
        {
            id: 'action-1',
            title: 'Post-mortem meeting',
            description: 'Conduct team review',
            priority: 'High',
            dueDate: '+7 days'
        }
    ],
    escalationCriteria: [
        {
            id: 'esc-1',
            condition: 'PII exposed',
            action: 'Notify Legal',
            threshold: 1,
            timeframe: 'immediately'
        }
    ]
};

describe('IncidentPlaybookService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBatchCommit.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createPlaybook', () => {
        it('should create a new playbook', async () => {
            const { id, ...playbookData } = mockPlaybook;
            void id; // Mark as used
            const result = await IncidentPlaybookService.createPlaybook(playbookData, 'org-123');

            expect(mockBatchSet).toHaveBeenCalled();
            expect(mockBatchCommit).toHaveBeenCalled();
            expect(result).toBe('mock-doc-id');
        });

        it('should log the creation action', async () => {
            const { logAction } = await import('../logger');

            const playbookData = { ...mockPlaybook };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...data } = playbookData;
            await IncidentPlaybookService.createPlaybook(data, 'org-123');

            expect(logAction).toHaveBeenCalledWith(
                expect.objectContaining({ organizationId: 'org-123' }),
                'CREATE',
                'IncidentPlaybook',
                expect.stringContaining('Playbook créé')
            );
        });

        it('should throw and log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockBatchCommit.mockRejectedValueOnce(new Error('Create failed'));

            const playbookData = { ...mockPlaybook };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...data } = playbookData;
            await expect(
                IncidentPlaybookService.createPlaybook(data, 'org-123')
            ).rejects.toThrow('Create failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('getPlaybooks', () => {
        it('should return playbooks for an organization', async () => {
            mockGetDocs.mockResolvedValue({
                docs: [
                    { id: 'pb-1', data: () => ({ title: 'Playbook 1' }) },
                    { id: 'pb-2', data: () => ({ title: 'Playbook 2' }) }
                ]
            });

            const result = await IncidentPlaybookService.getPlaybooks('org-123');

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('pb-1');
        });

        it('should filter by category when provided', async () => {
            mockGetDocs.mockResolvedValue({
                docs: [
                    { id: 'pb-1', data: () => ({ title: 'Data Breach', category: 'Fuite de Données' }) }
                ]
            });

            const result = await IncidentPlaybookService.getPlaybooks('org-123', 'Fuite de Données');

            expect(result).toHaveLength(1);
        });

        it('should return empty array on error', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockGetDocs.mockRejectedValue(new Error('Query failed'));

            const result = await IncidentPlaybookService.getPlaybooks('org-123');

            expect(result).toEqual([]);
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('getPlaybook', () => {
        it('should return a single playbook by id', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                id: 'playbook-123',
                data: () => ({ title: 'Test Playbook' })
            });

            const result = await IncidentPlaybookService.getPlaybook('playbook-123');

            expect(result).toMatchObject({ id: 'playbook-123', title: 'Test Playbook' });
        });

        it('should return null if playbook does not exist', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => false
            });

            const result = await IncidentPlaybookService.getPlaybook('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockGetDoc.mockRejectedValue(new Error('Get failed'));

            const result = await IncidentPlaybookService.getPlaybook('playbook-123');

            expect(result).toBeNull();
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('updatePlaybook', () => {
        it('should update a playbook', async () => {
            mockUpdateDoc.mockResolvedValue(undefined);

            await IncidentPlaybookService.updatePlaybook('playbook-123', { title: 'Updated Title' });

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ title: 'Updated Title' })
            );
        });

        it('should log the update action', async () => {
            const { logAction } = await import('../logger');
            mockUpdateDoc.mockResolvedValue(undefined);

            await IncidentPlaybookService.updatePlaybook('playbook-123', { title: 'Updated' });

            expect(logAction).toHaveBeenCalledWith(
                expect.anything(),
                'UPDATE',
                'IncidentPlaybook',
                expect.stringContaining('Playbook mis à jour')
            );
        });

        it('should throw and log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

            await expect(
                IncidentPlaybookService.updatePlaybook('playbook-123', { title: 'Updated' })
            ).rejects.toThrow('Update failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('deletePlaybook', () => {
        it('should delete a playbook', async () => {
            mockDeleteDoc.mockResolvedValue(undefined);

            await IncidentPlaybookService.deletePlaybook('playbook-123');

            expect(mockDeleteDoc).toHaveBeenCalled();
        });

        it('should log the delete action', async () => {
            const { logAction } = await import('../logger');
            mockDeleteDoc.mockResolvedValue(undefined);

            await IncidentPlaybookService.deletePlaybook('playbook-123');

            expect(logAction).toHaveBeenCalledWith(
                expect.anything(),
                'DELETE',
                'IncidentPlaybook',
                expect.stringContaining('Playbook supprimé')
            );
        });

        it('should throw and log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockDeleteDoc.mockRejectedValue(new Error('Delete failed'));

            await expect(
                IncidentPlaybookService.deletePlaybook('playbook-123')
            ).rejects.toThrow('Delete failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('initiateResponse', () => {
        beforeEach(() => {
            // Setup mock for getPlaybook
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                id: 'playbook-123',
                data: () => mockPlaybook
            });
        });

        it('should create a new incident response', async () => {
            const result = await IncidentPlaybookService.initiateResponse(
                'incident-456',
                'playbook-123',
                ['user-1', 'user-2'],
                'org-123'
            );

            expect(mockBatchSet).toHaveBeenCalled();
            expect(mockBatchCommit).toHaveBeenCalled();
            expect(result).toBe('mock-doc-id');
        });

        it('should update incident status', async () => {
            await IncidentPlaybookService.initiateResponse(
                'incident-456',
                'playbook-123',
                ['user-1'],
                'org-123'
            );

            expect(mockBatchUpdate).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ status: 'Analyse' })
            );
        });

        it('should throw if playbook not found', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false });

            await expect(
                IncidentPlaybookService.initiateResponse('incident-456', 'nonexistent', ['user-1'], 'org-123')
            ).rejects.toThrow('Playbook introuvable');
        });

        it('should throw and log error on failure', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockBatchCommit.mockRejectedValueOnce(new Error('Create failed'));

            await expect(
                IncidentPlaybookService.initiateResponse('incident-456', 'playbook-123', ['user-1'], 'org-123')
            ).rejects.toThrow('Create failed');

            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('getResponse', () => {
        it('should return response for an incident', async () => {
            mockGetDocs.mockResolvedValue({
                empty: false,
                docs: [
                    {
                        id: 'response-123',
                        data: () => ({
                            incidentId: 'incident-456',
                            status: 'in_progress'
                        })
                    }
                ]
            });

            const result = await IncidentPlaybookService.getResponse('incident-456', 'org-123');

            expect(result).toMatchObject({ id: 'response-123', incidentId: 'incident-456' });
        });

        it('should return null if no response found', async () => {
            mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

            const result = await IncidentPlaybookService.getResponse('incident-456', 'org-123');

            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            const { ErrorLogger } = await import('../errorLogger');
            mockGetDocs.mockRejectedValue(new Error('Query failed'));

            const result = await IncidentPlaybookService.getResponse('incident-456', 'org-123');

            expect(result).toBeNull();
            expect(ErrorLogger.error).toHaveBeenCalled();
        });
    });

    describe('updateStepProgress', () => {
        beforeEach(() => {
            // Mock getResponseByDocId behavior via getDocs
            mockGetDocs.mockResolvedValue({
                empty: false,
                docs: [
                    {
                        id: 'response-123',
                        data: () => ({
                            incidentId: 'incident-456',
                            organizationId: 'org-123',
                            status: 'in_progress',
                            currentStepIndex: 0,
                            completedSteps: [],
                            evidence: {},
                            notes: [],
                            timeline: []
                        })
                    }
                ]
            });
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                id: 'response-123',
                data: () => ({
                    incidentId: 'incident-456',
                    organizationId: 'org-123',
                    status: 'in_progress',
                    currentStepIndex: 0,
                    completedSteps: [],
                    evidence: {},
                    notes: [],
                    timeline: []
                })
            });
        });

        it('should update step completion status', async () => {
            await IncidentPlaybookService.updateStepProgress(
                'response-123',
                'step-1',
                true
            );

            expect(mockBatchUpdate).toHaveBeenCalled();
            expect(mockBatchCommit).toHaveBeenCalled();
        });

        it('should add evidence when provided', async () => {
            await IncidentPlaybookService.updateStepProgress(
                'response-123',
                'step-1',
                true,
                { screenshot: 'url-to-screenshot' }
            );

            expect(mockBatchUpdate).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    evidence: expect.objectContaining({ screenshot: 'url-to-screenshot' })
                })
            );
        });

        it('should add note when provided', async () => {
            await IncidentPlaybookService.updateStepProgress(
                'response-123',
                'step-1',
                true,
                undefined,
                'Completed successfully',
                'user-123',
                'John Doe'
            );

            // notes is set via arrayUnion which is mocked to return its args
            expect(mockBatchUpdate).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    notes: expect.arrayContaining([
                        expect.objectContaining({
                            content: 'Completed successfully',
                            userId: 'user-123',
                            userName: 'John Doe'
                        })
                    ])
                })
            );
        });

        it('should throw if response not found', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false });

            await expect(
                IncidentPlaybookService.updateStepProgress('nonexistent', 'step-1', true)
            ).rejects.toThrow('Response introuvable');
        });
    });
});
