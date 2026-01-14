/**
 * AssetService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetService } from '../assetService';
import { createUser } from '../../tests/factories/userFactory';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({ id: 'mock-collection' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-asset-id' })),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    arrayUnion: vi.fn((val) => ({ type: 'arrayUnion', value: val })),
    increment: vi.fn((val) => ({ type: 'increment', value: val })),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('../logger', () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../FunctionsService', () => ({
    FunctionsService: {
        deleteResource: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data),
}));

vi.mock('../../schemas/assetSchema', () => ({
    assetSchema: {
        parse: vi.fn((data) => data),
        partial: vi.fn(() => ({
            parse: vi.fn((data) => data),
        })),
    },
}));

import { addDoc, updateDoc, getDocs } from 'firebase/firestore';
import { logAction } from '../logger';
import { FunctionsService } from '../FunctionsService';

describe('AssetService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new asset', async () => {
            const user = createUser({ organizationId: 'org-1' });
            const assetData = {
                name: 'Server 1',
                type: 'hardware',
                criticality: 'high',
            };

            const result = await AssetService.create(assetData as never, user);

            expect(result).toBe('new-asset-id');
            expect(addDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalledWith(user, 'CREATE', 'Asset', expect.any(String));
        });

        it('should link asset to project when preSelectedProjectId is provided', async () => {
            const user = createUser({ organizationId: 'org-1' });
            const assetData = { name: 'Server 1', type: 'hardware' };

            await AssetService.create(assetData as never, user, 'project-1');

            expect(updateDoc).toHaveBeenCalled();
        });

        it('should track storage usage for assets with estimated size', async () => {
            const user = createUser({ organizationId: 'org-1' });
            const assetData = {
                name: 'Data Storage',
                type: 'data',
                estimatedSizeMB: 100,
            };

            await AssetService.create(assetData as never, user);

            // Should attempt to update organization's storage usage
            expect(updateDoc).toHaveBeenCalled();
        });

        it('should throw error when user has no organization', async () => {
            const user = createUser();
            (user as { organizationId: string | undefined }).organizationId = undefined;
            const assetData = { name: 'Server 1' };

            await expect(
                AssetService.create(assetData as never, user)
            ).rejects.toThrow('User organization ID is missing');
        });
    });

    describe('update', () => {
        it('should update an existing asset', async () => {
            const user = createUser({ organizationId: 'org-1' });
            const updateData = { name: 'Updated Server', criticality: 'medium' };

            await AssetService.update('asset-1', updateData as never, user);

            expect(updateDoc).toHaveBeenCalled();
            expect(logAction).toHaveBeenCalledWith(user, 'UPDATE', 'Asset', expect.any(String));
        });

        it('should throw error when user has no organization', async () => {
            const user = createUser();
            (user as { organizationId: string | undefined }).organizationId = undefined;

            await expect(
                AssetService.update('asset-1', { name: 'Test' } as never, user)
            ).rejects.toThrow('User organization ID is missing');
        });
    });

    describe('delete', () => {
        it('should delete an asset', async () => {
            const user = createUser({ organizationId: 'org-1' });

            await AssetService.delete('asset-1', 'Server 1', user);

            expect(FunctionsService.deleteResource).toHaveBeenCalledWith('assets', 'asset-1');
            expect(logAction).toHaveBeenCalledWith(user, 'DELETE', 'Asset', expect.any(String));
        });

        it('should throw error when user has no organization', async () => {
            const user = createUser();
            (user as { organizationId: string | undefined }).organizationId = undefined;

            await expect(
                AssetService.delete('asset-1', 'Server', user)
            ).rejects.toThrow('User organization ID is missing');
        });
    });

    describe('bulkDelete', () => {
        it('should delete multiple assets', async () => {
            const user = createUser({ organizationId: 'org-1' });
            const ids = ['asset-1', 'asset-2', 'asset-3'];

            await AssetService.bulkDelete(ids, user);

            expect(FunctionsService.deleteResource).toHaveBeenCalledTimes(3);
            expect(logAction).toHaveBeenCalledWith(
                user,
                'DELETE',
                'Asset',
                expect.stringContaining('3 actifs')
            );
        });

        it('should throw error when user has no organization', async () => {
            const user = createUser();
            (user as { organizationId: string | undefined }).organizationId = undefined;

            await expect(
                AssetService.bulkDelete(['asset-1'], user)
            ).rejects.toThrow('User organization ID is missing');
        });
    });

    describe('calculateDepreciation', () => {
        it('should calculate depreciation for an asset', () => {
            // Asset purchased 2.5 years ago
            const purchaseDate = new Date();
            purchaseDate.setFullYear(purchaseDate.getFullYear() - 2);
            purchaseDate.setMonth(purchaseDate.getMonth() - 6);
            const price = 10000;

            const result = AssetService.calculateDepreciation(price, purchaseDate.toISOString());

            // After ~2.5 years with 5-year linear depreciation: ~50% remaining
            // Allow for timing variance (4500-5500)
            expect(result).toBeGreaterThanOrEqual(4500);
            expect(result).toBeLessThanOrEqual(5500);
        });

        it('should return 0 for fully depreciated assets', () => {
            // Asset purchased 6 years ago (fully depreciated)
            const purchaseDate = new Date();
            purchaseDate.setFullYear(purchaseDate.getFullYear() - 6);
            const price = 10000;

            const result = AssetService.calculateDepreciation(price, purchaseDate.toISOString());

            expect(result).toBe(0);
        });

        it('should return original price for new assets', () => {
            const purchaseDate = new Date().toISOString();
            const price = 10000;

            const result = AssetService.calculateDepreciation(price, purchaseDate);

            expect(result).toBe(10000);
        });

        it('should return price when no purchase date provided', () => {
            const result = AssetService.calculateDepreciation(10000, '');

            expect(result).toBe(10000);
        });

        it('should return price when price is 0', () => {
            const result = AssetService.calculateDepreciation(0, '2023-01-01');

            expect(result).toBe(0);
        });
    });

    describe('getAssetHistory', () => {
        it('should return filtered logs for an asset', async () => {
            const mockLogs = [
                { id: 'log-1', details: 'Création Actif: Server 1', resourceType: 'Asset' },
                { id: 'log-2', details: 'Mise à jour Actif: Server 1', resourceType: 'Asset' },
                { id: 'log-3', details: 'Création Actif: Server 2', resourceType: 'Asset' },
            ];

            vi.mocked(getDocs).mockResolvedValue({
                docs: mockLogs.map(log => ({
                    id: log.id,
                    data: () => log,
                })),
            } as never);

            const result = await AssetService.getAssetHistory('Server 1', 'org-1');

            expect(result.logs).toHaveLength(2);
            expect(result.logs.every(l => l.details?.includes('Server 1'))).toBe(true);
        });

        it('should return empty array when no logs found', async () => {
            vi.mocked(getDocs).mockResolvedValue({
                docs: [],
            } as never);

            const result = await AssetService.getAssetHistory('NonExistent', 'org-1');

            expect(result.logs).toHaveLength(0);
        });
    });

    describe('getAssetRelationships', () => {
        it('should return all relationships for an asset', async () => {
            // Mock all relationship queries
            vi.mocked(getDocs)
                .mockResolvedValueOnce({
                    docs: [{ id: 'risk-1', data: () => ({ name: 'Risk 1' }) }],
                } as never)
                .mockResolvedValueOnce({
                    docs: [{ id: 'incident-1', data: () => ({ name: 'Incident 1' }) }],
                } as never)
                .mockResolvedValueOnce({
                    docs: [{ id: 'project-1', data: () => ({ name: 'Project 1' }) }],
                } as never)
                .mockResolvedValueOnce({
                    docs: [{ id: 'audit-1', data: () => ({ name: 'Audit 1' }) }],
                } as never)
                .mockResolvedValueOnce({
                    docs: [{ id: 'doc-1', data: () => ({ name: 'Document 1' }) }],
                } as never)
                .mockResolvedValueOnce({
                    docs: [{ id: 'control-1', data: () => ({ name: 'Control 1' }) }],
                } as never);

            const result = await AssetService.getAssetRelationships('asset-1', 'org-1');

            expect(result.risks).toHaveLength(1);
            expect(result.incidents).toHaveLength(1);
            expect(result.projects).toHaveLength(1);
            expect(result.audits).toHaveLength(1);
            expect(result.documents).toHaveLength(1);
            expect(result.controls).toHaveLength(1);
        });

        it('should return empty arrays when no relationships exist', async () => {
            vi.mocked(getDocs).mockResolvedValue({
                docs: [],
            } as never);

            const result = await AssetService.getAssetRelationships('asset-1', 'org-1');

            expect(result.risks).toHaveLength(0);
            expect(result.incidents).toHaveLength(0);
            expect(result.projects).toHaveLength(0);
            expect(result.audits).toHaveLength(0);
            expect(result.documents).toHaveLength(0);
            expect(result.controls).toHaveLength(0);
        });
    });
});
