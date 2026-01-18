/**
 * Unit tests for AnomalyDetectionService
 *
 * Tests for:
 * - detectOrphanControls()
 * - detectCoverageGaps()
 * - detectCircularDependencies()
 * - detectStaleAssessments()
 * - detectComplianceDrift()
 * - Service class methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AnomalyDetectionService,
  detectOrphanControls,
  detectCoverageGaps,
  detectCircularDependencies,
  detectStaleAssessments,
  detectComplianceDrift,
} from '../anomalyDetectionService';
import type { VoxelNode, VoxelEdge } from '@/types/voxel';
import {
  createVoxelNode,
  createVoxelEdge,
  createMockControl,
  createMockRisk,
  createMockGRCData,
  createVoxelGraph,
  resetIdCounter,
} from '@/tests/factories/voxelFactory';

// Mock the voxelStore
vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: {
    getState: vi.fn(() => ({
      nodes: new Map(),
      edges: new Map(),
    })),
  },
  voxelStoreActions: {
    setAnomalies: vi.fn(),
  },
}));

describe('AnomalyDetectionService', () => {
  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
  });

  // ============================================================================
  // detectOrphanControls Tests
  // ============================================================================

  describe('detectOrphanControls', () => {
    it('should detect controls not linked to any risk', () => {
      const controls = [
        createMockControl({ id: 'ctrl-1', name: 'Linked Control' }),
        createMockControl({ id: 'ctrl-2', name: 'Orphan Control' }),
      ];

      const risks = [
        createMockRisk({
          id: 'risk-1',
          mitigationControlIds: ['ctrl-1'],
        }),
      ];

      const anomalies = detectOrphanControls(
        controls as unknown as Parameters<typeof detectOrphanControls>[0],
        risks as unknown as Parameters<typeof detectOrphanControls>[1],
        'org-1'
      );

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('orphan_control');
      expect(anomalies[0].nodeId).toBe('ctrl-2');
      expect(anomalies[0].organizationId).toBe('org-1');
    });

    it('should not flag controls linked via relatedControlIds', () => {
      const controls = [createMockControl({ id: 'ctrl-1', name: 'Related Control' })];

      const risks = [
        createMockRisk({
          id: 'risk-1',
          relatedControlIds: ['ctrl-1'],
          mitigationControlIds: [],
        }),
      ];

      const anomalies = detectOrphanControls(
        controls as unknown as Parameters<typeof detectOrphanControls>[0],
        risks as unknown as Parameters<typeof detectOrphanControls>[1]
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should not flag inactive controls', () => {
      const controls = [createMockControl({ id: 'ctrl-1', name: 'Inactive Control', status: 'inactive' })];

      const risks: Parameters<typeof detectOrphanControls>[1] = [];

      const anomalies = detectOrphanControls(
        controls as unknown as Parameters<typeof detectOrphanControls>[0],
        risks
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should return empty array when all controls are linked', () => {
      const controls = [
        createMockControl({ id: 'ctrl-1' }),
        createMockControl({ id: 'ctrl-2' }),
      ];

      const risks = [
        createMockRisk({
          id: 'risk-1',
          mitigationControlIds: ['ctrl-1', 'ctrl-2'],
        }),
      ];

      const anomalies = detectOrphanControls(
        controls as unknown as Parameters<typeof detectOrphanControls>[0],
        risks as unknown as Parameters<typeof detectOrphanControls>[1]
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should set severity to medium for orphan controls', () => {
      const controls = [createMockControl({ id: 'ctrl-1' })];
      const risks: Parameters<typeof detectOrphanControls>[1] = [];

      const anomalies = detectOrphanControls(
        controls as unknown as Parameters<typeof detectOrphanControls>[0],
        risks
      );

      expect(anomalies[0].severity).toBe('medium');
    });
  });

  // ============================================================================
  // detectCoverageGaps Tests
  // ============================================================================

  describe('detectCoverageGaps', () => {
    it('should detect open risks without mitigation controls', () => {
      const risks = [
        createMockRisk({
          id: 'risk-1',
          name: 'Uncovered Risk',
          status: 'Ouvert',
          mitigationControlIds: [],
          strategy: 'Traiter',
        }),
      ];

      const anomalies = detectCoverageGaps(
        risks as unknown as Parameters<typeof detectCoverageGaps>[0],
        'org-1'
      );

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('coverage_gap');
      expect(anomalies[0].nodeId).toBe('risk-1');
    });

    it('should not flag risks with "Accepter" strategy', () => {
      const risks = [
        createMockRisk({
          id: 'risk-1',
          status: 'Ouvert',
          mitigationControlIds: [],
          strategy: 'Accepter',
        }),
      ];

      const anomalies = detectCoverageGaps(
        risks as unknown as Parameters<typeof detectCoverageGaps>[0]
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should not flag risks that already have controls', () => {
      const risks = [
        createMockRisk({
          id: 'risk-1',
          status: 'Ouvert',
          mitigationControlIds: ['ctrl-1'],
        }),
      ];

      const anomalies = detectCoverageGaps(
        risks as unknown as Parameters<typeof detectCoverageGaps>[0]
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should not flag closed risks', () => {
      const risks = [
        createMockRisk({
          id: 'risk-1',
          status: 'Ferme',
          mitigationControlIds: [],
        }),
      ];

      const anomalies = detectCoverageGaps(
        risks as unknown as Parameters<typeof detectCoverageGaps>[0]
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should calculate severity based on risk score', () => {
      const highScoreRisk = [
        createMockRisk({
          id: 'risk-1',
          status: 'Ouvert',
          score: 15,
          mitigationControlIds: [],
        }),
      ];

      const anomalies = detectCoverageGaps(
        highScoreRisk as unknown as Parameters<typeof detectCoverageGaps>[0]
      );

      expect(anomalies[0].severity).toBe('critical');
    });

    it('should handle "En cours" status as open', () => {
      const risks = [
        createMockRisk({
          id: 'risk-1',
          status: 'En cours',
          mitigationControlIds: [],
          strategy: 'Traiter',
        }),
      ];

      const anomalies = detectCoverageGaps(
        risks as unknown as Parameters<typeof detectCoverageGaps>[0]
      );

      expect(anomalies).toHaveLength(1);
    });
  });

  // ============================================================================
  // detectStaleAssessments Tests
  // ============================================================================

  describe('detectStaleAssessments', () => {
    it('should detect controls not assessed in over 90 days', () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 100);

      const controls = [
        createMockControl({
          id: 'ctrl-1',
          name: 'Stale Control',
          lastAssessmentDate: staleDate.toISOString(),
        }),
      ];

      const risks: Parameters<typeof detectStaleAssessments>[1] = [];

      const anomalies = detectStaleAssessments(
        controls as unknown as Parameters<typeof detectStaleAssessments>[0],
        risks,
        'org-1'
      );

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('stale_assessment');
      expect(anomalies[0].details?.daysSinceAssessment).toBeGreaterThanOrEqual(100);
    });

    it('should not flag recently assessed controls', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);

      const controls = [
        createMockControl({
          id: 'ctrl-1',
          lastAssessmentDate: recentDate.toISOString(),
        }),
      ];

      const risks: Parameters<typeof detectStaleAssessments>[1] = [];

      const anomalies = detectStaleAssessments(
        controls as unknown as Parameters<typeof detectStaleAssessments>[0],
        risks
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should detect stale risks', () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 120);

      const controls: Parameters<typeof detectStaleAssessments>[0] = [];
      const risks = [
        createMockRisk({
          id: 'risk-1',
          status: 'Ouvert',
          lastAssessmentDate: staleDate.toISOString(),
        }),
      ];

      const anomalies = detectStaleAssessments(
        controls,
        risks as unknown as Parameters<typeof detectStaleAssessments>[1]
      );

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].nodeId).toBe('risk-1');
    });

    it('should use updatedAt as fallback for assessment date', () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 100);

      const controls = [
        createMockControl({
          id: 'ctrl-1',
          updatedAt: staleDate.toISOString(),
        }),
      ];

      const risks: Parameters<typeof detectStaleAssessments>[1] = [];

      const anomalies = detectStaleAssessments(
        controls as unknown as Parameters<typeof detectStaleAssessments>[0],
        risks
      );

      expect(anomalies).toHaveLength(1);
    });

    it('should calculate severity based on days since assessment', () => {
      const veryStaleDate = new Date();
      veryStaleDate.setDate(veryStaleDate.getDate() - 200);

      const controls = [
        createMockControl({
          id: 'ctrl-1',
          lastAssessmentDate: veryStaleDate.toISOString(),
        }),
      ];

      const risks: Parameters<typeof detectStaleAssessments>[1] = [];

      const anomalies = detectStaleAssessments(
        controls as unknown as Parameters<typeof detectStaleAssessments>[0],
        risks
      );

      expect(anomalies[0].severity).toBe('critical');
    });

    it('should not flag inactive controls', () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 100);

      const controls = [
        createMockControl({
          id: 'ctrl-1',
          status: 'inactive',
          lastAssessmentDate: staleDate.toISOString(),
        }),
      ];

      const risks: Parameters<typeof detectStaleAssessments>[1] = [];

      const anomalies = detectStaleAssessments(
        controls as unknown as Parameters<typeof detectStaleAssessments>[0],
        risks
      );

      expect(anomalies).toHaveLength(0);
    });
  });

  // ============================================================================
  // detectComplianceDrift Tests
  // ============================================================================

  describe('detectComplianceDrift', () => {
    it('should detect controls with low effectiveness', () => {
      const controls = [
        createMockControl({
          id: 'ctrl-1',
          name: 'Low Effectiveness Control',
          effectiveness: 30,
        }),
      ];

      const anomalies = detectComplianceDrift(
        controls as unknown as Parameters<typeof detectComplianceDrift>[0],
        'org-1'
      );

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('compliance_drift');
      expect(anomalies[0].details?.actualValue).toBe(30);
      expect(anomalies[0].details?.threshold).toBe(50);
    });

    it('should use maturity as fallback for effectiveness', () => {
      const controls = [
        createMockControl({
          id: 'ctrl-1',
          maturity: 20,
          effectiveness: undefined,
        }),
      ];

      const anomalies = detectComplianceDrift(
        controls as unknown as Parameters<typeof detectComplianceDrift>[0]
      );

      expect(anomalies).toHaveLength(1);
    });

    it('should not flag controls with high effectiveness', () => {
      const controls = [
        createMockControl({
          id: 'ctrl-1',
          effectiveness: 80,
        }),
      ];

      const anomalies = detectComplianceDrift(
        controls as unknown as Parameters<typeof detectComplianceDrift>[0]
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should not flag inactive controls', () => {
      const controls = [
        createMockControl({
          id: 'ctrl-1',
          effectiveness: 20,
          status: 'inactive',
        }),
      ];

      const anomalies = detectComplianceDrift(
        controls as unknown as Parameters<typeof detectComplianceDrift>[0]
      );

      expect(anomalies).toHaveLength(0);
    });

    it('should calculate severity based on effectiveness value', () => {
      const veryLowControls = [
        createMockControl({
          id: 'ctrl-1',
          effectiveness: 20,
        }),
      ];

      const anomalies = detectComplianceDrift(
        veryLowControls as unknown as Parameters<typeof detectComplianceDrift>[0]
      );

      expect(anomalies[0].severity).toBe('critical');
    });
  });

  // ============================================================================
  // detectCircularDependencies Tests
  // ============================================================================

  describe('detectCircularDependencies', () => {
    it('should detect simple cycles', () => {
      // Create: A -> B -> A (cycle)
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
        ['edge-ba', createVoxelEdge('node-b', 'node-a', { id: 'edge-ba' })],
      ]);

      const anomalies = detectCircularDependencies(nodes, edges, 'org-1');

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('circular_dependency');
      expect(anomalies[0].severity).toBe('critical');
      expect(anomalies[0].details?.cyclePath).toBeDefined();
    });

    it('should detect longer cycles', () => {
      // Create: A -> B -> C -> A (cycle)
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });
      const nodeC = createVoxelNode({ id: 'node-c' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
        ['edge-bc', createVoxelEdge('node-b', 'node-c', { id: 'edge-bc' })],
        ['edge-ca', createVoxelEdge('node-c', 'node-a', { id: 'edge-ca' })],
      ]);

      const anomalies = detectCircularDependencies(nodes, edges);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].details?.cyclePath?.length).toBeGreaterThan(2);
    });

    it('should not flag acyclic graphs', () => {
      // Create: A -> B -> C (no cycle)
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });
      const nodeC = createVoxelNode({ id: 'node-c' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
        ['edge-bc', createVoxelEdge('node-b', 'node-c', { id: 'edge-bc' })],
      ]);

      const anomalies = detectCircularDependencies(nodes, edges);

      expect(anomalies).toHaveLength(0);
    });

    it('should handle disconnected graphs', () => {
      // Create two disconnected components
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });
      const nodeC = createVoxelNode({ id: 'node-c' });
      const nodeD = createVoxelNode({ id: 'node-d' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
        ['node-d', nodeD],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
        ['edge-cd', createVoxelEdge('node-c', 'node-d', { id: 'edge-cd' })],
      ]);

      const anomalies = detectCircularDependencies(nodes, edges);

      expect(anomalies).toHaveLength(0);
    });

    it('should handle empty graphs', () => {
      const nodes = new Map<string, VoxelNode>();
      const edges = new Map<string, VoxelEdge>();

      const anomalies = detectCircularDependencies(nodes, edges);

      expect(anomalies).toHaveLength(0);
    });
  });

  // ============================================================================
  // AnomalyDetectionService Class Tests
  // ============================================================================

  describe('AnomalyDetectionService.detectAll', () => {
    it('should run all detection algorithms', () => {
      const { controls, risks } = createMockGRCData();
      const { nodes, edges } = createVoxelGraph({ nodeCount: 5 });

      const anomalies = AnomalyDetectionService.detectAll(
        controls as unknown as Parameters<typeof AnomalyDetectionService.detectAll>[0],
        risks as unknown as Parameters<typeof AnomalyDetectionService.detectAll>[1],
        nodes,
        edges,
        'org-1'
      );

      // Should find at least orphan control and coverage gap from mock data
      expect(anomalies.length).toBeGreaterThanOrEqual(2);
      expect(anomalies.some((a) => a.type === 'orphan_control')).toBe(true);
      expect(anomalies.some((a) => a.type === 'coverage_gap')).toBe(true);
    });
  });

  describe('AnomalyDetectionService.getStatistics', () => {
    it('should calculate statistics correctly', () => {
      const anomalies = [
        { type: 'orphan_control', severity: 'medium', status: 'active' },
        { type: 'orphan_control', severity: 'medium', status: 'active' },
        { type: 'coverage_gap', severity: 'high', status: 'active' },
        { type: 'coverage_gap', severity: 'critical', status: 'resolved' },
      ] as Parameters<typeof AnomalyDetectionService.getStatistics>[0];

      const stats = AnomalyDetectionService.getStatistics(anomalies);

      expect(stats.total).toBe(4);
      expect(stats.byType.orphan_control).toBe(2);
      expect(stats.byType.coverage_gap).toBe(2);
      expect(stats.bySeverity.medium).toBe(2);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.bySeverity.critical).toBe(1);
      expect(stats.byStatus.active).toBe(3);
      expect(stats.byStatus.resolved).toBe(1);
    });
  });

  describe('AnomalyDetectionService.filterAnomalies', () => {
    it('should filter by type', () => {
      const anomalies = [
        { id: '1', type: 'orphan_control', severity: 'medium', status: 'active', nodeId: 'n1' },
        { id: '2', type: 'coverage_gap', severity: 'high', status: 'active', nodeId: 'n2' },
      ] as Parameters<typeof AnomalyDetectionService.filterAnomalies>[0];

      const filtered = AnomalyDetectionService.filterAnomalies(anomalies, {
        types: ['orphan_control'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('orphan_control');
    });

    it('should filter by severity', () => {
      const anomalies = [
        { id: '1', type: 'orphan_control', severity: 'medium', status: 'active', nodeId: 'n1' },
        { id: '2', type: 'coverage_gap', severity: 'high', status: 'active', nodeId: 'n2' },
        { id: '3', type: 'compliance_drift', severity: 'critical', status: 'active', nodeId: 'n3' },
      ] as Parameters<typeof AnomalyDetectionService.filterAnomalies>[0];

      const filtered = AnomalyDetectionService.filterAnomalies(anomalies, {
        severities: ['high', 'critical'],
      });

      expect(filtered).toHaveLength(2);
    });

    it('should filter by status', () => {
      const anomalies = [
        { id: '1', type: 'orphan_control', severity: 'medium', status: 'active', nodeId: 'n1' },
        { id: '2', type: 'coverage_gap', severity: 'high', status: 'resolved', nodeId: 'n2' },
      ] as Parameters<typeof AnomalyDetectionService.filterAnomalies>[0];

      const filtered = AnomalyDetectionService.filterAnomalies(anomalies, {
        statuses: ['active'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe('active');
    });

    it('should filter by nodeId', () => {
      const anomalies = [
        { id: '1', type: 'orphan_control', severity: 'medium', status: 'active', nodeId: 'node-1' },
        { id: '2', type: 'coverage_gap', severity: 'high', status: 'active', nodeId: 'node-2' },
      ] as Parameters<typeof AnomalyDetectionService.filterAnomalies>[0];

      const filtered = AnomalyDetectionService.filterAnomalies(anomalies, {
        nodeId: 'node-1',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].nodeId).toBe('node-1');
    });

    it('should combine multiple filters', () => {
      const anomalies = [
        { id: '1', type: 'orphan_control', severity: 'medium', status: 'active', nodeId: 'n1' },
        { id: '2', type: 'orphan_control', severity: 'high', status: 'active', nodeId: 'n2' },
        { id: '3', type: 'coverage_gap', severity: 'high', status: 'active', nodeId: 'n3' },
      ] as Parameters<typeof AnomalyDetectionService.filterAnomalies>[0];

      const filtered = AnomalyDetectionService.filterAnomalies(anomalies, {
        types: ['orphan_control'],
        severities: ['high'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });
  });

  describe('AnomalyDetectionService.sortBySeverity', () => {
    it('should sort anomalies by severity (critical first)', () => {
      const anomalies = [
        { id: '1', severity: 'low' },
        { id: '2', severity: 'critical' },
        { id: '3', severity: 'medium' },
        { id: '4', severity: 'high' },
      ] as Parameters<typeof AnomalyDetectionService.sortBySeverity>[0];

      const sorted = AnomalyDetectionService.sortBySeverity(anomalies);

      expect(sorted[0].severity).toBe('critical');
      expect(sorted[1].severity).toBe('high');
      expect(sorted[2].severity).toBe('medium');
      expect(sorted[3].severity).toBe('low');
    });

    it('should not mutate original array', () => {
      const anomalies = [
        { id: '1', severity: 'low' },
        { id: '2', severity: 'critical' },
      ] as Parameters<typeof AnomalyDetectionService.sortBySeverity>[0];

      const sorted = AnomalyDetectionService.sortBySeverity(anomalies);

      expect(anomalies[0].severity).toBe('low');
      expect(sorted).not.toBe(anomalies);
    });
  });
});
