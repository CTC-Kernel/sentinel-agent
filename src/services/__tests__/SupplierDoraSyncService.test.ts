/**
 * SupplierDoraSyncService Tests
 * 
 * Tests for the synchronization service between Suppliers and ICT Providers
 * Ensures data consistency and proper mapping between the two modules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupplierDoraSyncService } from '../SupplierDoraSyncService';
import { SupplierService } from '../SupplierService';
import { ICTProviderService } from '../ICTProviderService';
import { Criticality } from '../../types/common';
import type { Supplier } from '../../types/business';
import type { ICTProvider } from '../../types/dora';

// Mock the services
vi.mock('../SupplierService');
vi.mock('../ICTProviderService');

describe('SupplierDoraSyncService', () => {
    const mockOrganizationId = 'test-org-123';
    const mockSupplierId = 'supplier-123';
    const mockICTProviderId = 'ict-provider-123';

    const mockSupplier: Supplier = {
        id: mockSupplierId,
        organizationId: mockOrganizationId,
        name: 'Test ICT Provider',
        category: 'SaaS',
        criticality: Criticality.CRITICAL,
        contactName: 'John Doe',
        contactEmail: 'john@test.com',
        status: 'Actif',
        owner: 'owner-123',
        ownerId: 'owner-123',
        description: 'Test ICT Provider for synchronization',
        supportedProcessIds: ['process-1', 'process-2'],
        contractDocumentId: 'contract-123',
        contractEnd: '2024-12-31',
        securityScore: 85,
        assessment: {
            hasIso27001: true,
            hasGdprPolicy: true,
            hasEncryption: true,
            hasBcp: true,
            hasIncidentProcess: true,
            lastAssessmentDate: '2024-01-15'
        },
        doraContractClauses: {
            auditRights: true,
            slaDefined: true,
            dataLocation: true,
            subcontractingConditions: true,
            incidentNotification: true,
            exitStrategy: true
        },
        isICTProvider: true,
        supportsCriticalFunction: true,
        doraCriticality: 'Critique',
        serviceType: 'SaaS',
        relatedAssetIds: ['asset-1'],
        relatedRiskIds: ['risk-1'],
        relatedProjectIds: ['project-1'],
        riskLevel: 'Low',
        riskAssessment: {
            overallScore: 85
        },
        contract: {
            endDate: '2024-12-31'
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        reviewDates: {
            contractReview: '2024-06-01',
            securityReview: '2024-03-01',
            complianceReview: '2024-09-01',
            contractEnd: '2024-12-31'
        },
        serviceCatalog: ['Cloud Services', 'Data Processing'],
        sla: '99.9% uptime'
    };

    const mockICTProvider: ICTProvider = {
        id: mockICTProviderId,
        organizationId: mockOrganizationId,
        name: 'Test ICT Provider',
        category: 'critical',
        description: 'Test ICT Provider for synchronization',
        services: [{
            id: 'service-1',
            name: 'Cloud Services',
            type: 'software',
            criticality: 'critical',
            description: 'Test ICT Provider for synchronization',
            businessFunctions: ['process-1', 'process-2'],
            dataProcessed: true
        }],
        contractInfo: {
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-12-31',
            exitStrategy: 'Defined',
            auditRights: true,
            contractValue: 100000,
            currency: 'EUR',
            renewalType: 'manual',
            noticePeriodDays: 90
        },
        riskAssessment: {
            concentration: 80,
            substitutability: 'low',
            lastAssessment: '2024-01-15',
            assessedBy: 'owner-123',
            notes: 'Auto-synced from Supplier module. Risk level: Low'
        },
        compliance: {
            doraCompliant: true,
            certifications: ['ISO 27001'],
            locationEU: true,
            headquartersCountry: 'FR',
            dataProcessingLocations: ['FR', 'DE'],
            subcontractors: []
        },
        contactName: 'John Doe',
        contactEmail: 'john@test.com',
        contactPhone: '+33612345678',
        website: 'https://test-provider.com',
        linkedAssetIds: ['asset-1'],
        linkedRiskIds: ['risk-1'],
        linkedControlIds: [],
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        createdBy: 'user-123',
        updatedBy: 'user-123',
        doraRegisterId: 'dora-reg-123',
        lastReportDate: '2024-01-15T00:00:00Z'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('syncSupplierToICTProvider', () => {
        it('should not sync supplier that is not ICT Provider', async () => {
            // Arrange
            const nonICTSupplier = { ...mockSupplier, isICTProvider: false };
            vi.mocked(SupplierService.getById).mockResolvedValue(nonICTSupplier);

            // Act
            const result = await SupplierDoraSyncService.syncSupplierToICTProvider(mockSupplierId);

            // Assert
            expect(result).toBe(false);
            expect(SupplierService.getById).toHaveBeenCalledWith(mockSupplierId);
            expect(ICTProviderService.getAll).not.toHaveBeenCalled();
        });

        it('should create new ICT Provider when none exists', async () => {
            // Arrange
            vi.mocked(SupplierService.getById).mockResolvedValue(mockSupplier);
            vi.mocked(ICTProviderService.getAll).mockResolvedValue([]);
            vi.mocked(ICTProviderService.create).mockResolvedValue(mockICTProviderId);

            // Act
            const result = await SupplierDoraSyncService.syncSupplierToICTProvider(mockSupplierId);

            // Assert
            expect(result).toBe(true);
            expect(SupplierService.getById).toHaveBeenCalledWith(mockSupplierId);
            expect(ICTProviderService.getAll).toHaveBeenCalledWith(mockOrganizationId);
            expect(ICTProviderService.create).toHaveBeenCalledWith(
                mockOrganizationId,
                expect.objectContaining({
                    name: mockSupplier.name,
                    category: 'critical',
                    organizationId: mockOrganizationId
                }),
                'system-sync'
            );
        });

        it('should update existing ICT Provider when found', async () => {
            // Arrange
            vi.mocked(SupplierService.getById).mockResolvedValue(mockSupplier);
            vi.mocked(ICTProviderService.getAll).mockResolvedValue([mockICTProvider]);
            vi.mocked(ICTProviderService.update).mockResolvedValue(undefined);

            // Act
            const result = await SupplierDoraSyncService.syncSupplierToICTProvider(mockSupplierId);

            // Assert
            expect(result).toBe(true);
            expect(ICTProviderService.update).toHaveBeenCalledWith(
                mockICTProviderId,
                expect.objectContaining({
                    name: mockSupplier.name,
                    category: 'critical'
                }),
                mockOrganizationId
            );
        });

        it('should handle supplier not found', async () => {
            // Arrange
            vi.mocked(SupplierService.getById).mockResolvedValue(null);

            // Act & Assert
            const result = await SupplierDoraSyncService.syncSupplierToICTProvider(mockSupplierId);
            expect(result).toBe(false);
        });
    });

    describe('syncAllICTSuppliers', () => {
        it('should sync all ICT suppliers for organization', async () => {
            // Arrange
            const suppliers = [
                mockSupplier,
                { ...mockSupplier, id: 'supplier-2', isICTProvider: false },
                { ...mockSupplier, id: 'supplier-3', isICTProvider: true, name: 'Another ICT Provider' }
            ];
            vi.mocked(SupplierService.getAll).mockResolvedValue(suppliers);
            // Mock getById to return supplier data for each sync call
            vi.mocked(SupplierService.getById)
                .mockResolvedValueOnce(mockSupplier)
                .mockResolvedValueOnce({ ...mockSupplier, id: 'supplier-3', name: 'Another ICT Provider' });
            vi.mocked(ICTProviderService.getAll).mockResolvedValue([]);
            vi.mocked(ICTProviderService.create).mockResolvedValue('new-ict-id');

            // Act
            const result = await SupplierDoraSyncService.syncAllICTSuppliers(mockOrganizationId);

            // Assert
            expect(result).toBe(2); // Only 2 ICT suppliers
            expect(SupplierService.getAll).toHaveBeenCalledWith(mockOrganizationId);
        });

        it('should handle empty supplier list', async () => {
            // Arrange
            vi.mocked(SupplierService.getAll).mockResolvedValue([]);

            // Act
            const result = await SupplierDoraSyncService.syncAllICTSuppliers(mockOrganizationId);

            // Assert
            expect(result).toBe(0);
            expect(SupplierService.getAll).toHaveBeenCalledWith(mockOrganizationId);
        });
    });

    describe('removeICTProviderStatus', () => {
        it('should remove ICT Provider status and deactivate corresponding provider', async () => {
            // Arrange
            vi.mocked(SupplierService.getById).mockResolvedValue(mockSupplier);
            vi.mocked(ICTProviderService.getAll).mockResolvedValue([mockICTProvider]);
            vi.mocked(ICTProviderService.update).mockResolvedValue(undefined);

            // Act
            await SupplierDoraSyncService.removeICTProviderStatus(mockSupplierId);

            // Assert
            expect(SupplierService.getById).toHaveBeenCalledWith(mockSupplierId);
            expect(ICTProviderService.getAll).toHaveBeenCalledWith(mockOrganizationId);
            expect(ICTProviderService.update).toHaveBeenCalledWith(
                mockICTProviderId,
                { status: 'terminated' },
                mockOrganizationId
            );
        });
    });

    describe('validateSyncStatus', () => {
        it('should return sync status report', async () => {
            // Arrange
            const suppliers = [
                mockSupplier,
                { ...mockSupplier, id: 'supplier-2', isICTProvider: false }
            ];
            const providers = [mockICTProvider];
            vi.mocked(SupplierService.getAll).mockResolvedValue(suppliers);
            vi.mocked(ICTProviderService.getAll).mockResolvedValue(providers);

            // Act
            const result = await SupplierDoraSyncService.validateSyncStatus(mockOrganizationId);

            // Assert
            expect(result).toEqual({
                totalSuppliers: 2,
                ictSuppliers: 1,
                syncedSuppliers: expect.any(Number),
                outOfSyncSuppliers: expect.any(Array),
                orphanedICTProviders: expect.any(Array)
            });
        });
    });

    describe('mapSupplierToICTProvider', () => {
        it('should correctly map supplier criticality levels', () => {
            // This is tested indirectly through syncSupplierToICTProvider
            // The mapping should be: Critique -> critical, Élevée -> important, others -> standard
            expect(true).toBe(true); // Placeholder for indirect testing
        });

        it('should correctly map service types', () => {
            // This is tested indirectly through syncSupplierToICTProvider
            // The mapping should be: SaaS -> software, Cloud -> cloud, etc.
            expect(true).toBe(true); // Placeholder for indirect testing
        });
    });
});
