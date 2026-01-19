/**
 * EbiosService Tests
 * Comprehensive tests for EBIOS RM service operations
 *
 * Story: EBIOS RM Test Coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EbiosService } from '../ebiosService';
import {
  createEbiosAnalysis,
  createWorkshop1Data,
  createRiskSource,
  createTargetedObjective,
  createSMSIProgram,
  createMilestone,
  createRiskContext,
  resetEbiosCounters,
} from '../../tests/factories/ebiosFactory';

// Mock Firestore - use vi.hoisted to properly handle hoisting
const { mockSetDoc, mockGetDoc, mockUpdateDoc, mockDeleteDoc, mockGetDocs, mockOnSnapshot, mockDoc, mockCollection, mockQuery, mockWhere, mockOrderBy, mockLimit } = vi.hoisted(() => ({
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockGetDoc: vi.fn(),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
  mockGetDocs: vi.fn(),
  mockOnSnapshot: vi.fn(),
  mockDoc: vi.fn(() => ({ id: 'mock-doc-id' })),
  mockCollection: vi.fn(() => ({})),
  mockQuery: vi.fn(() => ({})),
  mockWhere: vi.fn(() => ({})),
  mockOrderBy: vi.fn(() => ({})),
  mockLimit: vi.fn(() => ({})),
}));

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } },
}));

// Mock Firestore
vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  onSnapshot: mockOnSnapshot,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('EbiosService', () => {
  const organizationId = 'org-test';
  const userId = 'user-test';

  beforeEach(() => {
    vi.clearAllMocks();
    resetEbiosCounters();
    // Re-establish default mock implementation after clearAllMocks
    mockDoc.mockImplementation(() => ({ id: 'mock-doc-id' }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // Analysis CRUD Operations
  // ============================================================================

  describe('createAnalysis', () => {
    it('should create a new EBIOS analysis with default values', async () => {
      mockDoc.mockReturnValue({ id: 'new-analysis-id' });

      const data = {
        name: 'Test Analysis',
        description: 'Test description',
      };

      const result = await EbiosService.createAnalysis(organizationId, data, userId);

      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        id: 'new-analysis-id',
        organizationId,
        name: 'Test Analysis',
        description: 'Test description',
        status: 'draft',
        currentWorkshop: 1,
        completionPercentage: 0,
        contributesToGlobalScore: true,
      });
      expect(result.workshops).toBeDefined();
      expect(result.workshops[1]).toBeDefined();
      expect(result.workshops[1].status).toBe('not_started');
    });

    it('should create analysis with optional parameters', async () => {
      mockDoc.mockReturnValue({ id: 'analysis-with-options' });

      const data = {
        name: 'Finance Analysis',
        description: 'Analysis for financial sector',
        targetCertificationDate: '2024-12-31',
        sector: 'finance',
      };

      const result = await EbiosService.createAnalysis(organizationId, data, userId);

      expect(result.targetCertificationDate).toBe('2024-12-31');
      expect(result.sector).toBe('finance');
    });

    it('should handle creation errors', async () => {
      const error = new Error('Firestore error');
      mockSetDoc.mockRejectedValueOnce(error);

      await expect(
        EbiosService.createAnalysis(organizationId, { name: 'Test' }, userId)
      ).rejects.toThrow();
    });
  });

  describe('getAnalysis', () => {
    it('should return analysis when found', async () => {
      const mockAnalysis = createEbiosAnalysis({ id: 'existing-analysis' });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockAnalysis,
      });

      const result = await EbiosService.getAnalysis(organizationId, 'existing-analysis');

      expect(result).toMatchObject({
        id: 'existing-analysis',
        organizationId: 'org-test',
      });
    });

    it('should return null when analysis not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await EbiosService.getAnalysis(organizationId, 'non-existent');

      expect(result).toBeNull();
    });

    it('should handle errors', async () => {
      mockGetDoc.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        EbiosService.getAnalysis(organizationId, 'some-id')
      ).rejects.toThrow('Network error');
    });
  });

  describe('listAnalyses', () => {
    it('should list all analyses for an organization', async () => {
      const mockAnalyses = [
        createEbiosAnalysis({ id: 'analysis-1' }),
        createEbiosAnalysis({ id: 'analysis-2' }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        forEach: (cb: (doc: { data: () => typeof mockAnalyses[0] }) => void) => {
          mockAnalyses.forEach((a) => cb({ data: () => a }));
        },
      });

      const result = await EbiosService.listAnalyses(organizationId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('analysis-1');
    });

    it('should filter by status', async () => {
      const mockAnalyses = [
        createEbiosAnalysis({ id: 'draft-1', status: 'draft' }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        forEach: (cb: (doc: { data: () => typeof mockAnalyses[0] }) => void) => {
          mockAnalyses.forEach((a) => cb({ data: () => a }));
        },
      });

      await EbiosService.listAnalyses(organizationId, { status: 'draft' });

      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'draft');
    });

    it('should limit results', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: () => { },
      });

      await EbiosService.listAnalyses(organizationId, { limit: 5 });

      expect(mockLimit).toHaveBeenCalledWith(5);
    });
  });

  describe('updateAnalysis', () => {
    it('should update analysis fields', async () => {
      await EbiosService.updateAnalysis(
        organizationId,
        'analysis-1',
        { name: 'Updated Name', description: 'Updated description' },
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs.name).toBe('Updated Name');
      expect(callArgs.description).toBe('Updated description');
      expect(callArgs.updatedBy).toBe(userId);
      expect(callArgs.updatedAt).toBeDefined();
    });

    it('should handle update errors', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        EbiosService.updateAnalysis(organizationId, 'id', { name: 'New' }, userId)
      ).rejects.toThrow('Update failed');
    });
  });

  describe('deleteAnalysis', () => {
    it('should delete an analysis', async () => {
      await EbiosService.deleteAnalysis(organizationId, 'analysis-to-delete');

      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });

    it('should handle deletion errors', async () => {
      mockDeleteDoc.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(
        EbiosService.deleteAnalysis(organizationId, 'id')
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('subscribeToAnalysis', () => {
    it('should subscribe to real-time updates', () => {
      const callback = vi.fn();
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);

      const result = EbiosService.subscribeToAnalysis(
        organizationId,
        'analysis-id',
        callback
      );

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(result).toBe(unsubscribe);
    });
  });

  // ============================================================================
  // Workshop Operations
  // ============================================================================

  describe('saveWorkshopData', () => {
    it('should save workshop data and update status', async () => {
      const existingAnalysis = createEbiosAnalysis();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingAnalysis,
      });

      const workshopData = createWorkshop1Data();

      await EbiosService.saveWorkshopData(
        organizationId,
        'analysis-id',
        1,
        workshopData,
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs['workshops.1.status']).toBe('in_progress');
      expect(callArgs.updatedBy).toBe(userId);
    });

    it('should throw error if analysis not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        EbiosService.saveWorkshopData(organizationId, 'invalid', 1, {}, userId)
      ).rejects.toThrow('Analysis not found');
    });

    it('should preserve existing status if not not_started', async () => {
      const existingAnalysis = createEbiosAnalysis();
      existingAnalysis.workshops[1].status = 'in_progress';

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingAnalysis,
      });

      await EbiosService.saveWorkshopData(
        organizationId,
        'analysis-id',
        1,
        { scope: { missions: [], essentialAssets: [], supportingAssets: [] } },
        userId
      );

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs['workshops.1.status']).toBe('in_progress');
    });
  });

  describe('completeWorkshop', () => {
    it('should mark workshop as completed and advance to next', async () => {
      const existingAnalysis = createEbiosAnalysis();
      existingAnalysis.workshops[1].status = 'in_progress';

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingAnalysis,
      });

      await EbiosService.completeWorkshop(organizationId, 'analysis-id', 1, userId);

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs.currentWorkshop).toBe(2);
      expect(callArgs.status).toBe('in_progress');
    });

    it('should mark analysis as completed when workshop 5 is completed', async () => {
      const existingAnalysis = createEbiosAnalysis({ currentWorkshop: 5 });
      existingAnalysis.workshops[5].status = 'in_progress';

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingAnalysis,
      });

      await EbiosService.completeWorkshop(organizationId, 'analysis-id', 5, userId);

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs.currentWorkshop).toBe(5);
      expect(callArgs.status).toBe('completed');
    });
  });

  describe('validateWorkshop', () => {
    it('should mark workshop as validated', async () => {
      await EbiosService.validateWorkshop(organizationId, 'analysis-id', 1, userId);

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs['workshops.1.status']).toBe('validated');
      expect(callArgs['workshops.1.validatedBy']).toBe(userId);
    });
  });

  describe('navigateToWorkshop', () => {
    it('should navigate to workshop 1 regardless of status', async () => {
      const existingAnalysis = createEbiosAnalysis({ currentWorkshop: 3 });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingAnalysis,
      });

      await EbiosService.navigateToWorkshop(organizationId, 'analysis-id', 1, userId);

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs.currentWorkshop).toBe(1);
    });

    it('should allow navigation when previous workshop is completed', async () => {
      const existingAnalysis = createEbiosAnalysis({ currentWorkshop: 1 });
      existingAnalysis.workshops[1].status = 'completed';

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingAnalysis,
      });

      await EbiosService.navigateToWorkshop(organizationId, 'analysis-id', 2, userId);

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should throw error when previous workshop is not completed', async () => {
      const existingAnalysis = createEbiosAnalysis({ currentWorkshop: 1 });
      existingAnalysis.workshops[1].status = 'not_started';

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingAnalysis,
      });

      await expect(
        EbiosService.navigateToWorkshop(organizationId, 'analysis-id', 2, userId)
      ).rejects.toThrow('Cannot navigate to workshop 2');
    });
  });

  // ============================================================================
  // Risk Source Library Operations
  // ============================================================================

  describe('getRiskSources', () => {
    it('should return both standard and custom risk sources', async () => {
      const standardSources = [createRiskSource({ isANSSIStandard: true })];
      const customSources = [createRiskSource({ isANSSIStandard: false })];

      mockGetDocs
        .mockResolvedValueOnce({
          forEach: (cb: (doc: { id: string; data: () => typeof standardSources[0] }) => void) => {
            standardSources.forEach((s) => cb({ id: s.id, data: () => s }));
          },
        })
        .mockResolvedValueOnce({
          forEach: (cb: (doc: { id: string; data: () => typeof customSources[0] }) => void) => {
            customSources.forEach((s) => cb({ id: s.id, data: () => s }));
          },
        });

      const result = await EbiosService.getRiskSources(organizationId);

      expect(result).toHaveLength(2);
    });
  });

  describe('createCustomRiskSource', () => {
    it('should create a custom risk source', async () => {
      mockDoc.mockReturnValue({ id: 'custom-source-id' });

      const data = {
        code: 'SR-CUSTOM-01',
        category: 'organized_crime' as const,
        name: 'Custom Risk Source',
        description: 'Custom description',
      };

      const result = await EbiosService.createCustomRiskSource(organizationId, data);

      expect(mockSetDoc).toHaveBeenCalled();
      expect(result.isANSSIStandard).toBe(false);
      expect(result.organizationId).toBe(organizationId);
    });
  });

  describe('getTargetedObjectives', () => {
    it('should return both standard and custom objectives', async () => {
      const standardObjectives = [createTargetedObjective({ isANSSIStandard: true })];
      const customObjectives = [createTargetedObjective({ isANSSIStandard: false })];

      mockGetDocs
        .mockResolvedValueOnce({
          forEach: (cb: (doc: { id: string; data: () => typeof standardObjectives[0] }) => void) => {
            standardObjectives.forEach((o) => cb({ id: o.id, data: () => o }));
          },
        })
        .mockResolvedValueOnce({
          forEach: (cb: (doc: { id: string; data: () => typeof customObjectives[0] }) => void) => {
            customObjectives.forEach((o) => cb({ id: o.id, data: () => o }));
          },
        });

      const result = await EbiosService.getTargetedObjectives(organizationId);

      expect(result).toHaveLength(2);
    });
  });

  // ============================================================================
  // SMSI Program Operations
  // ============================================================================

  describe('getSMSIProgram', () => {
    it('should return SMSI program when found', async () => {
      const mockProgram = createSMSIProgram();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockProgram,
      });

      const result = await EbiosService.getSMSIProgram(organizationId);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Test SMSI Program');
    });

    it('should return null when program not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await EbiosService.getSMSIProgram(organizationId);

      expect(result).toBeNull();
    });
  });

  describe('createSMSIProgram', () => {
    it('should create a new SMSI program', async () => {
      const data = {
        name: 'ISO 27001 Implementation',
        description: 'Implementation program',
        targetCertificationDate: '2025-06-30',
      };

      const result = await EbiosService.createSMSIProgram(organizationId, data, userId);

      expect(mockSetDoc).toHaveBeenCalled();
      expect(result.name).toBe('ISO 27001 Implementation');
      expect(result.currentPhase).toBe('plan');
      expect(result.status).toBe('active');
    });
  });

  describe('getMilestones', () => {
    it('should return milestones ordered by due date', async () => {
      const mockMilestones = [
        createMilestone({ name: 'Milestone 1' }),
        createMilestone({ name: 'Milestone 2' }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        forEach: (cb: (doc: { id: string; data: () => typeof mockMilestones[0] }) => void) => {
          mockMilestones.forEach((m) => cb({ id: m.id, data: () => m }));
        },
      });

      const result = await EbiosService.getMilestones(organizationId);

      expect(result).toHaveLength(2);
      expect(mockOrderBy).toHaveBeenCalledWith('dueDate', 'asc');
    });
  });

  describe('createMilestone', () => {
    it('should create a new milestone', async () => {
      mockDoc.mockReturnValue({ id: 'new-milestone-id' });

      const data = {
        name: 'Complete Risk Assessment',
        phase: 'plan' as const,
        dueDate: '2024-03-31',
      };

      const result = await EbiosService.createMilestone(organizationId, data);

      expect(mockSetDoc).toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });
  });

  describe('updateMilestoneStatus', () => {
    it('should update milestone status', async () => {
      await EbiosService.updateMilestoneStatus(
        organizationId,
        'milestone-1',
        'in_progress'
      );

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs.status).toBe('in_progress');
    });

    it('should set completedAt when status is completed', async () => {
      await EbiosService.updateMilestoneStatus(
        organizationId,
        'milestone-1',
        'completed'
      );

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs.status).toBe('completed');
      expect(callArgs.completedAt).toBeDefined();
    });
  });

  describe('updateMilestone', () => {
    it('should update milestone fields', async () => {
      const updatedMilestone = createMilestone({ name: 'Updated Milestone' });
      mockGetDoc.mockResolvedValueOnce({
        id: 'milestone-1',
        data: () => updatedMilestone,
      });

      const result = await EbiosService.updateMilestone(organizationId, 'milestone-1', {
        name: 'Updated Milestone',
        description: 'Updated description',
      });

      expect(mockUpdateDoc).toHaveBeenCalled();
      expect(result.name).toBe('Updated Milestone');
    });
  });

  describe('updateSMSIProgramPhase', () => {
    it('should update program phase', async () => {
      await EbiosService.updateSMSIProgramPhase(organizationId, 'do', {
        status: 'in_progress',
        progress: 25,
      });

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0][1];
      expect(callArgs['phases.do']).toEqual({ status: 'in_progress', progress: 25 });
      expect(callArgs.currentPhase).toBe('do');
    });
  });

  // ============================================================================
  // Risk Context Operations
  // ============================================================================

  describe('getRiskContext', () => {
    it('should return risk context when found', async () => {
      const mockContext = createRiskContext();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockContext,
      });

      const result = await EbiosService.getRiskContext(organizationId);

      expect(result).toBeDefined();
      expect(result?.businessContext).toBeDefined();
    });

    it('should return null when context not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await EbiosService.getRiskContext(organizationId);

      expect(result).toBeNull();
    });
  });

  describe('saveRiskContext', () => {
    it('should create new risk context', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const contextData = createRiskContext();
      const { ...data } = contextData;

      const result = await EbiosService.saveRiskContext(organizationId, data);

      expect(mockSetDoc).toHaveBeenCalled();
      expect(result.id).toBe('current');
    });

    it('should preserve existing createdAt when updating', async () => {
      const existingContext = createRiskContext();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingContext,
      });

      const { ...data } = existingContext;

      const result = await EbiosService.saveRiskContext(organizationId, data);

      expect(result.createdAt).toBe(existingContext.createdAt);
    });
  });

  // ============================================================================
  // Duplicate Analysis
  // ============================================================================

  describe('duplicateAnalysis', () => {
    it('should duplicate an existing analysis', async () => {
      const existingAnalysis = createEbiosAnalysis({ name: 'Original Analysis' });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingAnalysis,
      });
      mockDoc.mockReturnValue({ id: 'duplicated-analysis-id' });

      const result = await EbiosService.duplicateAnalysis(
        organizationId,
        existingAnalysis.id,
        userId
      );

      expect(mockSetDoc).toHaveBeenCalled();
      expect(result.name).toBe('Original Analysis (Copy)');
      expect(result.status).toBe('draft');
      expect(result.id).toBe('duplicated-analysis-id');
    });

    it('should throw error if original analysis not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        EbiosService.duplicateAnalysis(organizationId, 'non-existent', userId)
      ).rejects.toThrow('Analysis not found');
    });
  });
});
