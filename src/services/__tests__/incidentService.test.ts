/**
 * IncidentService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncidentService } from '../incidentService';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ id: 'mock-collection' })),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-log-id' })),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
    })),
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

import { addDoc, writeBatch } from 'firebase/firestore';
import { FunctionsService } from '../FunctionsService';

describe('IncidentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('deleteIncidentWithLog', () => {
        it('should delete incident and create audit log', async () => {
            await IncidentService.deleteIncidentWithLog({
                incidentId: 'incident-1',
                organizationId: 'org-1',
                userId: 'user-1',
                userEmail: 'user@test.com',
            });

            expect(FunctionsService.deleteResource).toHaveBeenCalledWith('incidents', 'incident-1');
            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    organizationId: 'org-1',
                    action: 'DELETE',
                    resource: 'Incident',
                    userId: 'user-1',
                    userEmail: 'user@test.com',
                    severity: 'critical',
                })
            );
        });

        it('should handle deletion errors', async () => {
            vi.mocked(FunctionsService.deleteResource).mockRejectedValue(new Error('Delete failed'));

            await expect(
                IncidentService.deleteIncidentWithLog({
                    incidentId: 'incident-1',
                    organizationId: 'org-1',
                    userId: 'user-1',
                    userEmail: 'user@test.com',
                })
            ).rejects.toThrow('Delete failed');
        });
    });

    describe('bulkDeleteIncidents', () => {
        it('should delete multiple incidents', async () => {
            vi.mocked(FunctionsService.deleteResource).mockResolvedValue(undefined);
            const incidentIds = ['incident-1', 'incident-2', 'incident-3'];

            await IncidentService.bulkDeleteIncidents(
                incidentIds,
                'org-1',
                'user-1',
                'user@test.com'
            );

            expect(FunctionsService.deleteResource).toHaveBeenCalledTimes(3);
        });

        it('should handle bulk deletion errors', async () => {
            vi.mocked(FunctionsService.deleteResource).mockRejectedValueOnce(new Error('Bulk delete failed'));

            await expect(
                IncidentService.bulkDeleteIncidents(
                    ['incident-1'],
                    'org-1',
                    'user-1',
                    'user@test.com'
                )
            ).rejects.toThrow('Bulk delete failed');
        });
    });

    describe('importIncidentsFromCSV', () => {
        it('should import incidents from CSV data with French headers', async () => {
            const csvData = [
                { Titre: 'Incident 1', Description: 'Desc 1', Sévérité: 'High', Statut: 'Nouveau' },
                { Titre: 'Incident 2', Description: 'Desc 2', Sévérité: 'Medium', Statut: 'En cours' },
            ];

            const result = await IncidentService.importIncidentsFromCSV(
                csvData,
                'org-1',
                'user-1',
                'John Doe'
            );

            expect(result).toBe(2);
            expect(writeBatch).toHaveBeenCalled();
        });

        it('should import incidents with English headers', async () => {
            const csvData = [
                { title: 'Incident EN', description: 'English description', Severity: 'Critical' },
            ];

            const result = await IncidentService.importIncidentsFromCSV(
                csvData,
                'org-1',
                'user-1',
                'John Doe'
            );

            expect(result).toBe(1);
        });

        it('should skip rows without title', async () => {
            const csvData = [
                { Titre: 'Incident 1', Description: 'Desc 1' },
                { Description: 'No title' },
                { Titre: 'Incident 3', Description: 'Desc 3' },
            ];

            const result = await IncidentService.importIncidentsFromCSV(
                csvData,
                'org-1',
                'user-1',
                'John Doe'
            );

            expect(result).toBe(2);
        });

        it('should normalize severity values', async () => {
            const mockBatch = {
                set: vi.fn(),
                commit: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(writeBatch).mockReturnValue(mockBatch as never);

            const csvData = [
                { Titre: 'Test', Sévérité: 'HIGH' },
                { Titre: 'Test 2', Sévérité: 'low' },
                { Titre: 'Test 3', Sévérité: 'invalid' },
            ];

            await IncidentService.importIncidentsFromCSV(
                csvData,
                'org-1',
                'user-1',
                'John Doe'
            );

            // Check that severity is normalized
            const calls = mockBatch.set.mock.calls;
            expect(calls[0][1].severity).toBe('High');
            expect(calls[1][1].severity).toBe('Low');
            expect(calls[2][1].severity).toBe('Medium'); // Default for invalid
        });

        it('should not commit batch if no valid incidents', async () => {
            const mockBatch = {
                set: vi.fn(),
                commit: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(writeBatch).mockReturnValue(mockBatch as never);

            const csvData = [
                { Description: 'No title 1' },
                { Description: 'No title 2' },
            ];

            const result = await IncidentService.importIncidentsFromCSV(
                csvData,
                'org-1',
                'user-1',
                'John Doe'
            );

            expect(result).toBe(0);
            expect(mockBatch.commit).not.toHaveBeenCalled();
        });

        it('should handle import errors', async () => {
            const mockBatch = {
                set: vi.fn(),
                commit: vi.fn().mockRejectedValue(new Error('Batch commit failed')),
            };
            vi.mocked(writeBatch).mockReturnValue(mockBatch as never);

            const csvData = [{ Titre: 'Incident 1' }];

            await expect(
                IncidentService.importIncidentsFromCSV(csvData, 'org-1', 'user-1', 'John')
            ).rejects.toThrow('Batch commit failed');
        });
    });
});
