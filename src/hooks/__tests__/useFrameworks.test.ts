import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useFrameworks,
  useFramework,
  useRequirements,
  useMappings,
  useActiveFrameworks,
  frameworkQueryKeys,
} from '../useFrameworks';
import { FrameworkService } from '../../services/FrameworkService';
import type { RegulatoryFramework, Requirement, ControlMapping, ActiveFramework } from '../../types/framework';

// Mock FrameworkService
vi.mock('../../services/FrameworkService', () => ({
  FrameworkService: {
    getFrameworks: vi.fn(),
    getFramework: vi.fn(),
    getRequirements: vi.fn(),
    getRequirementsByCategory: vi.fn(),
    getMappings: vi.fn(),
    getMappingsByFramework: vi.fn(),
    getActiveFrameworks: vi.fn(),
    activateFramework: vi.fn(),
    deactivateFramework: vi.fn(),
    createMapping: vi.fn(),
    updateMapping: vi.fn(),
    deleteMapping: vi.fn(),
    subscribeToFrameworks: vi.fn(() => vi.fn()),
    subscribeToRequirements: vi.fn(() => vi.fn()),
    subscribeToMappings: vi.fn(() => vi.fn()),
    subscribeToActiveFrameworks: vi.fn(() => vi.fn()),
  },
}));

// Mock store
vi.mock('../../store', () => ({
  useStore: vi.fn(() => ({
    user: {
      uid: 'user-123',
      organizationId: 'org-123',
    },
  })),
}));

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn(),
    handleErrorWithToast: vi.fn(),
  },
}));

describe('useFrameworks hooks', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('frameworkQueryKeys', () => {
    it('should generate correct query keys', () => {
      expect(frameworkQueryKeys.all).toEqual(['frameworks']);
      expect(frameworkQueryKeys.list()).toEqual(['frameworks', 'list']);
      expect(frameworkQueryKeys.detail('nis2-v1')).toEqual(['frameworks', 'detail', 'nis2-v1']);
      expect(frameworkQueryKeys.requirements('nis2-v1')).toEqual(['frameworks', 'requirements', 'nis2-v1']);
      expect(frameworkQueryKeys.requirementsByCategory('nis2-v1', 'fr')).toEqual([
        'frameworks',
        'requirements',
        'nis2-v1',
        'byCategory',
        'fr',
      ]);
      expect(frameworkQueryKeys.mappings('org-123', 'ctrl-001')).toEqual([
        'frameworks',
        'mappings',
        'org-123',
        'ctrl-001',
      ]);
      expect(frameworkQueryKeys.activeFrameworks('org-123')).toEqual(['frameworks', 'active', 'org-123']);
    });
  });

  describe('useFrameworks', () => {
    it('should fetch frameworks successfully', async () => {
      const mockFrameworks: RegulatoryFramework[] = [
        {
          id: 'nis2-v1',
          code: 'NIS2',
          name: 'NIS2 Directive',
          version: '2022/2555',
          jurisdiction: 'EU',
          effectiveDate: '2024-10-17',
          isActive: true,
          displayOrder: 1,
        },
        {
          id: 'dora-v1',
          code: 'DORA',
          name: 'Digital Operational Resilience Act',
          version: '2022/2554',
          jurisdiction: 'EU',
          effectiveDate: '2025-01-17',
          isActive: true,
          displayOrder: 2,
        },
      ];

      vi.mocked(FrameworkService.getFrameworks).mockResolvedValueOnce(mockFrameworks);

      const { result } = renderHook(() => useFrameworks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].code).toBe('NIS2');
      expect(result.current.data?.[1].code).toBe('DORA');
    });

    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() => useFrameworks({ enabled: false }), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(FrameworkService.getFrameworks).not.toHaveBeenCalled();
    });
  });

  describe('useFramework', () => {
    it('should fetch a single framework', async () => {
      const mockFramework: RegulatoryFramework = {
        id: 'nis2-v1',
        code: 'NIS2',
        name: 'NIS2 Directive',
        version: '2022/2555',
        jurisdiction: 'EU',
        effectiveDate: '2024-10-17',
        isActive: true,
      };

      vi.mocked(FrameworkService.getFramework).mockResolvedValueOnce(mockFramework);

      const { result } = renderHook(() => useFramework('nis2-v1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.code).toBe('NIS2');
      expect(FrameworkService.getFramework).toHaveBeenCalledWith('nis2-v1');
    });

    it('should not fetch without frameworkId', async () => {
      const { result } = renderHook(() => useFramework(''), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(FrameworkService.getFramework).not.toHaveBeenCalled();
    });
  });

  describe('useRequirements', () => {
    it('should fetch requirements for a framework', async () => {
      const mockRequirements: Requirement[] = [
        {
          id: 'nis2-art21',
          frameworkId: 'nis2-v1',
          articleRef: 'Article 21',
          title: 'Cybersecurity risk-management measures',
          description: 'Requirements for risk management',
          category: 'risk_management',
          criticality: 'high',
          order: 1,
        },
      ];

      vi.mocked(FrameworkService.getRequirements).mockResolvedValueOnce(mockRequirements);

      const { result } = renderHook(
        () => useRequirements({ frameworkId: 'nis2-v1' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].articleRef).toBe('Article 21');
      expect(result.current.isGrouped).toBe(false);
    });

    it('should fetch requirements grouped by category', async () => {
      const mockGroupedRequirements = [
        {
          category: 'risk_management' as const,
          categoryLabel: 'Gestion des risques',
          requirements: [
            {
              id: 'nis2-art21',
              frameworkId: 'nis2-v1',
              articleRef: 'Article 21',
              title: 'Cybersecurity risk-management measures',
              description: 'Requirements for risk management',
              category: 'risk_management' as const,
              criticality: 'high' as const,
              order: 1,
            },
          ],
          count: 1,
        },
      ];

      vi.mocked(FrameworkService.getRequirementsByCategory).mockResolvedValueOnce(mockGroupedRequirements);

      const { result } = renderHook(
        () => useRequirements({ frameworkId: 'nis2-v1', groupByCategory: true, locale: 'fr' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].categoryLabel).toBe('Gestion des risques');
      expect(result.current.isGrouped).toBe(true);
    });

    it('should not fetch without frameworkId', async () => {
      const { result } = renderHook(
        () => useRequirements({ frameworkId: '' }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(FrameworkService.getRequirements).not.toHaveBeenCalled();
    });
  });

  describe('useMappings', () => {
    it('should fetch mappings for a control', async () => {
      const mockMappings: ControlMapping[] = [
        {
          id: 'mapping-1',
          organizationId: 'org-123',
          controlId: 'ctrl-001',
          requirementId: 'nis2-art21',
          frameworkId: 'nis2-v1',
          coveragePercentage: 80,
          coverageStatus: 'partial',
        },
      ];

      vi.mocked(FrameworkService.getMappings).mockResolvedValueOnce(mockMappings);

      const { result } = renderHook(
        () => useMappings({ controlId: 'ctrl-001' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].coveragePercentage).toBe(80);
      expect(FrameworkService.getMappings).toHaveBeenCalledWith('org-123', 'ctrl-001');
    });

    it('should not fetch without controlId', async () => {
      const { result } = renderHook(
        () => useMappings({ controlId: '' }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(FrameworkService.getMappings).not.toHaveBeenCalled();
    });
  });

  describe('useActiveFrameworks', () => {
    it('should fetch active frameworks for organization', async () => {
      const mockActiveFrameworks: ActiveFramework[] = [
        {
          frameworkId: 'nis2-v1',
          frameworkCode: 'NIS2',
          activatedAt: '2026-01-01T00:00:00Z',
          activatedBy: 'user-123',
        },
      ];

      vi.mocked(FrameworkService.getActiveFrameworks).mockResolvedValueOnce(mockActiveFrameworks);

      const { result } = renderHook(() => useActiveFrameworks(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].frameworkCode).toBe('NIS2');
      expect(FrameworkService.getActiveFrameworks).toHaveBeenCalledWith('org-123');
    });
  });
});
