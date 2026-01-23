import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FrameworkService } from '../FrameworkService';
import type {
  RegulatoryFramework,
  Requirement,
  ControlMapping,
  ActiveFramework,
} from '../../types/framework';

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {},
}));

// Mock Firestore functions
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockWriteBatch = vi.fn();

const mockCollection = vi.fn(() => ({}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => {
    // For collection refs (auto-generated ID), return with id
    if (args.length === 1) {
      return { id: 'mock-doc-id' };
    }
    // For explicit doc refs
    return { id: args[args.length - 1] as string };
  },
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  collection: () => mockCollection(),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  writeBatch: () => mockWriteBatch(),
  Unsubscribe: vi.fn(),
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    handleErrorWithToast: vi.fn(),
  },
}));

describe('FrameworkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getFrameworks', () => {
    it('should return list of frameworks', async () => {
      const mockFrameworks: Partial<RegulatoryFramework>[] = [
        {
          id: 'nis2-v1',
          code: 'NIS2',
          name: 'NIS2 Directive',
          version: '2022/2555',
          jurisdiction: 'EU',
          isActive: true,
          displayOrder: 1,
        },
        {
          id: 'dora-v1',
          code: 'DORA',
          name: 'Digital Operational Resilience Act',
          version: '2022/2554',
          jurisdiction: 'EU',
          isActive: true,
          displayOrder: 2,
        },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockFrameworks.map((f) => ({
          id: f.id,
          data: () => f,
        })),
      });

      const result = await FrameworkService.getFrameworks();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('NIS2');
      expect(result[1].code).toBe('DORA');
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    it('should throw and log error on failure', async () => {
      const error = new Error('Firestore error');
      mockGetDocs.mockRejectedValueOnce(error);

      await expect(FrameworkService.getFrameworks()).rejects.toThrow('Firestore error');
    });
  });

  describe('getFramework', () => {
    it('should return a single framework by ID', async () => {
      const mockFramework: Partial<RegulatoryFramework> = {
        id: 'nis2-v1',
        code: 'NIS2',
        name: 'NIS2 Directive',
        version: '2022/2555',
        jurisdiction: 'EU',
        isActive: true,
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'nis2-v1',
        data: () => mockFramework,
      });

      const result = await FrameworkService.getFramework('nis2-v1');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('NIS2');
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent framework', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await FrameworkService.getFramework('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getRequirements', () => {
    it('should return requirements for a framework', async () => {
      const mockRequirements: Partial<Requirement>[] = [
        {
          id: 'nis2-art21',
          frameworkId: 'nis2-v1',
          articleRef: 'Article 21',
          title: 'Cybersecurity risk-management measures',
          category: 'risk_management',
          criticality: 'high',
          order: 1,
        },
        {
          id: 'nis2-art23',
          frameworkId: 'nis2-v1',
          articleRef: 'Article 23',
          title: 'Incident reporting',
          category: 'incident_management',
          criticality: 'high',
          order: 2,
        },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockRequirements.map((r) => ({
          id: r.id,
          data: () => r,
        })),
      });

      const result = await FrameworkService.getRequirements('nis2-v1');

      expect(result).toHaveLength(2);
      expect(result[0].articleRef).toBe('Article 21');
      expect(result[1].articleRef).toBe('Article 23');
    });
  });

  describe('getRequirementsByCategory', () => {
    it('should group requirements by category with labels', async () => {
      const mockRequirements: Partial<Requirement>[] = [
        {
          id: 'nis2-art21',
          frameworkId: 'nis2-v1',
          category: 'risk_management',
          order: 1,
        },
        {
          id: 'nis2-art21-2',
          frameworkId: 'nis2-v1',
          category: 'risk_management',
          order: 2,
        },
        {
          id: 'nis2-art23',
          frameworkId: 'nis2-v1',
          category: 'incident_management',
          order: 3,
        },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockRequirements.map((r) => ({
          id: r.id,
          data: () => r,
        })),
      });

      const result = await FrameworkService.getRequirementsByCategory('nis2-v1', 'fr');

      expect(result).toHaveLength(2);

      const riskCategory = result.find((c) => c.category === 'risk_management');
      expect(riskCategory).toBeDefined();
      expect(riskCategory?.requirements).toHaveLength(2);
      expect(riskCategory?.categoryLabel).toBe('Gestion des risques');

      const incidentCategory = result.find((c) => c.category === 'incident_management');
      expect(incidentCategory).toBeDefined();
      expect(incidentCategory?.requirements).toHaveLength(1);
      expect(incidentCategory?.categoryLabel).toBe('Gestion des incidents');
    });
  });

  describe('getMappings', () => {
    it('should return mappings for a control', async () => {
      const mockMappings: Partial<ControlMapping>[] = [
        {
          id: 'mapping-1',
          organizationId: 'org-123',
          controlId: 'ctrl-001',
          requirementId: 'nis2-art21',
          frameworkId: 'nis2-v1',
          coveragePercentage: 80,
          coverageStatus: 'partial',
        },
        {
          id: 'mapping-2',
          organizationId: 'org-123',
          controlId: 'ctrl-001',
          requirementId: 'dora-art5',
          frameworkId: 'dora-v1',
          coveragePercentage: 100,
          coverageStatus: 'full',
        },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockMappings.map((m) => ({
          id: m.id,
          data: () => m,
        })),
      });

      const result = await FrameworkService.getMappings('org-123', 'ctrl-001');

      expect(result).toHaveLength(2);
      expect(result[0].frameworkId).toBe('nis2-v1');
      expect(result[1].frameworkId).toBe('dora-v1');
    });
  });

  describe('createMapping', () => {
    it('should create a new mapping', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const mapping = {
        organizationId: 'org-123',
        controlId: 'ctrl-001',
        requirementId: 'nis2-art21',
        frameworkId: 'nis2-v1',
        coveragePercentage: 80,
        coverageStatus: 'partial' as const,
      };

      const result = await FrameworkService.createMapping(mapping);

      expect(result.id).toBe('mock-doc-id');
      expect(result.controlId).toBe('ctrl-001');
      expect(result.createdAt).toBeDefined();
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateMapping', () => {
    it('should update a mapping', async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);

      await FrameworkService.updateMapping('mapping-1', {
        coveragePercentage: 100,
        coverageStatus: 'full',
        isValidated: true,
      });

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteMapping', () => {
    it('should delete a mapping', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await FrameworkService.deleteMapping('mapping-1');

      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeToFrameworks', () => {
    it('should set up a real-time subscription', () => {
      const mockUnsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe);

      const callback = vi.fn();
      const unsubscribe = FrameworkService.subscribeToFrameworks(callback);

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getActiveFrameworks', () => {
    it('should return active frameworks for an organization', async () => {
      const mockActiveFrameworks: Partial<ActiveFramework>[] = [
        {
          frameworkId: 'nis2-v1',
          frameworkCode: 'NIS2',
          activatedAt: '2026-01-01T00:00:00Z',
          activatedBy: 'user-123',
        },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockActiveFrameworks.map((af) => ({
          id: af.frameworkId,
          data: () => af,
        })),
      });

      const result = await FrameworkService.getActiveFrameworks('org-123');

      expect(result).toHaveLength(1);
      expect(result[0].frameworkCode).toBe('NIS2');
    });
  });

  describe('activateFramework', () => {
    it('should activate a framework for an organization', async () => {
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await FrameworkService.activateFramework(
        'org-123',
        'nis2-v1',
        'NIS2',
        'user-123',
        { targetComplianceDate: '2026-10-17' }
      );

      expect(result.frameworkId).toBe('nis2-v1');
      expect(result.frameworkCode).toBe('NIS2');
      expect(result.activatedBy).toBe('user-123');
      expect(result.targetComplianceDate).toBe('2026-10-17');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('deactivateFramework', () => {
    it('should deactivate a framework for an organization', async () => {
      mockDeleteDoc.mockResolvedValueOnce(undefined);

      await FrameworkService.deactivateFramework('org-123', 'nis2-v1');

      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchCreateMappings', () => {
    it('should batch create multiple mappings', async () => {
      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValueOnce(undefined),
      };
      mockWriteBatch.mockReturnValueOnce(mockBatch);

      const mappings = [
        {
          organizationId: 'org-123',
          controlId: 'ctrl-001',
          requirementId: 'nis2-art21',
          frameworkId: 'nis2-v1',
          coveragePercentage: 80,
          coverageStatus: 'partial' as const,
        },
        {
          organizationId: 'org-123',
          controlId: 'ctrl-001',
          requirementId: 'nis2-art23',
          frameworkId: 'nis2-v1',
          coveragePercentage: 100,
          coverageStatus: 'full' as const,
        },
      ];

      const result = await FrameworkService.batchCreateMappings(mappings);

      expect(result).toHaveLength(2);
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });
});
