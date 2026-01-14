/**
 * ProjectService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from '../projectService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ id: 'mock-collection' })),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    writeBatch: vi.fn(() => ({
        update: vi.fn(),
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
    })),
    arrayUnion: vi.fn((val) => ({ type: 'arrayUnion', value: val })),
    arrayRemove: vi.fn((val) => ({ type: 'arrayRemove', value: val })),
    limit: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../FunctionsService', () => ({
    FunctionsService: {
        deleteResource: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data),
}));

import { getDocs, writeBatch } from 'firebase/firestore';
import { FunctionsService } from '../FunctionsService';

describe('ProjectService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('checkDependencies', () => {
        it('should return no dependencies when project has none', async () => {
            vi.mocked(getDocs).mockResolvedValue({
                docs: [],
            } as never);

            const result = await ProjectService.checkDependencies('project-1', 'org-1');

            expect(result.hasDependencies).toBe(false);
            expect(result.dependencies).toHaveLength(0);
        });

        it('should return risk dependencies', async () => {
            vi.mocked(getDocs)
                .mockResolvedValueOnce({
                    docs: [{
                        id: 'risk-1',
                        data: () => ({ threat: 'Risk Threat 1' }),
                    }],
                } as never)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({ docs: [] } as never);

            const result = await ProjectService.checkDependencies('project-1', 'org-1');

            expect(result.hasDependencies).toBe(true);
            expect(result.dependencies).toHaveLength(1);
            expect(result.dependencies[0].type).toBe('Risque');
            expect(result.dependencies[0].name).toBe('Risk Threat 1');
        });

        it('should return control dependencies', async () => {
            vi.mocked(getDocs)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({
                    docs: [{
                        id: 'control-1',
                        data: () => ({ code: 'CTRL-001', name: 'Control 1' }),
                    }],
                } as never)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({ docs: [] } as never);

            const result = await ProjectService.checkDependencies('project-1', 'org-1');

            expect(result.hasDependencies).toBe(true);
            expect(result.dependencies[0].type).toBe('Contrôle');
            expect(result.dependencies[0].name).toBe('CTRL-001');
        });

        it('should return asset dependencies', async () => {
            vi.mocked(getDocs)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({
                    docs: [{
                        id: 'asset-1',
                        data: () => ({ name: 'Server 1' }),
                    }],
                } as never)
                .mockResolvedValueOnce({ docs: [] } as never);

            const result = await ProjectService.checkDependencies('project-1', 'org-1');

            expect(result.hasDependencies).toBe(true);
            expect(result.dependencies[0].type).toBe('Actif');
            expect(result.dependencies[0].name).toBe('Server 1');
        });

        it('should return audit dependencies', async () => {
            vi.mocked(getDocs)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({ docs: [] } as never)
                .mockResolvedValueOnce({
                    docs: [{
                        id: 'audit-1',
                        data: () => ({ name: 'Annual Audit' }),
                    }],
                } as never);

            const result = await ProjectService.checkDependencies('project-1', 'org-1');

            expect(result.hasDependencies).toBe(true);
            expect(result.dependencies[0].type).toBe('Audit');
            expect(result.dependencies[0].name).toBe('Annual Audit');
        });

        it('should return multiple dependency types', async () => {
            vi.mocked(getDocs)
                .mockResolvedValueOnce({
                    docs: [{ id: 'risk-1', data: () => ({ threat: 'Risk 1' }) }],
                } as never)
                .mockResolvedValueOnce({
                    docs: [{ id: 'control-1', data: () => ({ code: 'CTRL-1' }) }],
                } as never)
                .mockResolvedValueOnce({
                    docs: [{ id: 'asset-1', data: () => ({ name: 'Asset 1' }) }],
                } as never)
                .mockResolvedValueOnce({
                    docs: [{ id: 'audit-1', data: () => ({ name: 'Audit 1' }) }],
                } as never);

            const result = await ProjectService.checkDependencies('project-1', 'org-1');

            expect(result.hasDependencies).toBe(true);
            expect(result.dependencies).toHaveLength(4);
        });

        it('should handle Firebase errors', async () => {
            vi.mocked(getDocs).mockRejectedValue(new Error('Firebase error'));

            await expect(
                ProjectService.checkDependencies('project-1', 'org-1')
            ).rejects.toThrow('Firebase error');
        });
    });

    describe('deleteProjectWithCascade', () => {
        it('should call FunctionsService to delete project', async () => {
            await ProjectService.deleteProjectWithCascade('project-1', 'org-1');

            expect(FunctionsService.deleteResource).toHaveBeenCalledWith('projects', 'project-1');
        });

        it('should handle deletion errors', async () => {
            vi.mocked(FunctionsService.deleteResource).mockRejectedValue(new Error('Delete failed'));

            await expect(
                ProjectService.deleteProjectWithCascade('project-1', 'org-1')
            ).rejects.toThrow('Delete failed');
        });
    });

    describe('syncProjectLinks', () => {
        it('should add project ID to newly linked entities', () => {
            const mockBatch = {
                update: vi.fn(),
                set: vi.fn(),
                commit: vi.fn(),
            };

            ProjectService.syncProjectLinks(mockBatch as never, {
                projectId: 'project-1',
                relatedRiskIds: ['risk-1', 'risk-2'],
                oldRiskIds: [],
            });

            // Should update both risks
            expect(mockBatch.update).toHaveBeenCalledTimes(2);
        });

        it('should remove project ID from unlinked entities', () => {
            const mockBatch = {
                update: vi.fn(),
                set: vi.fn(),
                commit: vi.fn(),
            };

            ProjectService.syncProjectLinks(mockBatch as never, {
                projectId: 'project-1',
                relatedRiskIds: [],
                oldRiskIds: ['risk-1', 'risk-2'],
            });

            expect(mockBatch.update).toHaveBeenCalledTimes(2);
        });

        it('should handle mixed add and remove operations', () => {
            const mockBatch = {
                update: vi.fn(),
                set: vi.fn(),
                commit: vi.fn(),
            };

            ProjectService.syncProjectLinks(mockBatch as never, {
                projectId: 'project-1',
                relatedRiskIds: ['risk-2', 'risk-3'],
                oldRiskIds: ['risk-1', 'risk-2'],
            });

            // risk-3 added, risk-1 removed, risk-2 unchanged
            expect(mockBatch.update).toHaveBeenCalledTimes(2);
        });
    });

    describe('syncNewProjectLinks', () => {
        it('should add project ID to all linked entities', () => {
            const mockBatch = {
                update: vi.fn(),
                set: vi.fn(),
                commit: vi.fn(),
            };

            ProjectService.syncNewProjectLinks(
                mockBatch as never,
                'project-1',
                ['risk-1'],
                ['control-1', 'control-2'],
                ['asset-1']
            );

            // 1 risk + 2 controls + 1 asset = 4 updates
            expect(mockBatch.update).toHaveBeenCalledTimes(4);
        });

        it('should handle undefined link arrays', () => {
            const mockBatch = {
                update: vi.fn(),
                set: vi.fn(),
                commit: vi.fn(),
            };

            ProjectService.syncNewProjectLinks(
                mockBatch as never,
                'project-1',
                undefined,
                undefined,
                undefined
            );

            expect(mockBatch.update).not.toHaveBeenCalled();
        });
    });

    describe('importProjectsFromCSV', () => {
        it('should import projects from CSV data', async () => {
            const csvData = [
                { Nom: 'Project 1', Description: 'Desc 1', Statut: 'En cours' },
                { Nom: 'Project 2', Description: 'Desc 2', Statut: 'Nouveau' },
            ];

            const result = await ProjectService.importProjectsFromCSV(
                csvData,
                'org-1',
                'user-1',
                'John Doe'
            );

            expect(result).toBe(2);
            expect(writeBatch).toHaveBeenCalled();
        });

        it('should skip rows without name', async () => {
            const csvData = [
                { Nom: 'Project 1', Description: 'Desc 1' },
                { Description: 'No name' },
                { Nom: 'Project 3', Description: 'Desc 3' },
            ];

            const result = await ProjectService.importProjectsFromCSV(
                csvData as Record<string, string>[],
                'org-1',
                'user-1',
                'John Doe'
            );

            expect(result).toBe(2);
        });

        it('should handle English column names', async () => {
            const csvData = [
                { name: 'Project EN', description: 'English description', status: 'New' },
            ];

            const result = await ProjectService.importProjectsFromCSV(
                csvData,
                'org-1',
                'user-1',
                'John Doe'
            );

            expect(result).toBe(1);
        });

        it('should not commit batch if no valid projects', async () => {
            const csvData = [
                { Description: 'No name 1' },
                { Description: 'No name 2' },
            ];

            const result = await ProjectService.importProjectsFromCSV(
                csvData,
                'org-1',
                'user-1',
                'John Doe'
            );

            expect(result).toBe(0);
        });

        it('should handle import errors', async () => {
            const mockBatch = {
                set: vi.fn(),
                commit: vi.fn().mockRejectedValue(new Error('Batch commit failed')),
            };
            vi.mocked(writeBatch).mockReturnValue(mockBatch as never);

            const csvData = [{ Nom: 'Project 1' }];

            await expect(
                ProjectService.importProjectsFromCSV(csvData, 'org-1', 'user-1', 'John')
            ).rejects.toThrow('Batch commit failed');
        });
    });
});
