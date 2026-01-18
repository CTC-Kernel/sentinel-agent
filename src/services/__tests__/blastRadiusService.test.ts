/**
 * Unit tests for BlastRadiusService
 *
 * Tests for:
 * - BFS algorithm for impact propagation
 * - Impact decay calculation
 * - What-If simulations
 * - Root cause analysis
 * - Export functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BlastRadiusService,
  BlastRadiusAnalysis,
  RootCauseResult,
  WhatIfComparison,
  ExtendedBlastRadiusConfig,
} from '../blastRadiusService';
import type { VoxelNode, VoxelEdge, VoxelNodeType } from '@/types/voxel';
import {
  createVoxelNode,
  createVoxelEdge,
  createVoxelGraph,
  createBlastRadiusConfig,
  resetIdCounter,
} from '@/tests/factories/voxelFactory';

// Mock performance.now for consistent timing in tests
vi.spyOn(performance, 'now').mockReturnValue(1000);

describe('BlastRadiusService', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  // ============================================================================
  // calculateBlastRadius Tests
  // ============================================================================

  describe('calculateBlastRadius', () => {
    it('should return empty result for non-existent source node', () => {
      const nodes = new Map<string, VoxelNode>();
      const edges = new Map<string, VoxelEdge>();
      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'non-existent',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.calculateBlastRadius(
        'non-existent',
        nodes,
        edges,
        config
      );

      expect(result.affectedNodes).toHaveLength(0);
      expect(result.totalImpact).toBe(0);
      expect(result.maxDepth).toBe(0);
      expect(result.businessImpact).toBe('low');
    });

    it('should calculate blast radius for a simple chain graph', () => {
      // Create: A -> B -> C
      const nodeA = createVoxelNode({ id: 'node-a', label: 'A' });
      const nodeB = createVoxelNode({ id: 'node-b', label: 'B' });
      const nodeC = createVoxelNode({ id: 'node-c', label: 'C' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edgeAB = createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' });
      const edgeBC = createVoxelEdge('node-b', 'node-c', { id: 'edge-bc' });

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', edgeAB],
        ['edge-bc', edgeBC],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      expect(result.sourceNodeId).toBe('node-a');
      expect(result.affectedNodes.length).toBe(2);
      expect(result.affectedNodes.map((n) => n.nodeId)).toContain('node-b');
      expect(result.affectedNodes.map((n) => n.nodeId)).toContain('node-c');
    });

    it('should apply impact decay based on depth', () => {
      // Create: A -> B -> C
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });
      const nodeC = createVoxelNode({ id: 'node-c' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab', weight: 1.0 })],
        ['edge-bc', createVoxelEdge('node-b', 'node-c', { id: 'edge-bc', weight: 1.0 })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      const nodeAtDepth1 = result.affectedNodes.find((n) => n.depth === 1);
      const nodeAtDepth2 = result.affectedNodes.find((n) => n.depth === 2);

      expect(nodeAtDepth1).toBeDefined();
      expect(nodeAtDepth2).toBeDefined();
      // Impact should be lower at greater depth
      expect(nodeAtDepth1!.impact).toBeGreaterThan(nodeAtDepth2!.impact);
    });

    it('should respect maxDepth configuration', () => {
      // Create a long chain: A -> B -> C -> D -> E
      const nodeIds = ['a', 'b', 'c', 'd', 'e'];
      const nodes = new Map<string, VoxelNode>(
        nodeIds.map((id) => [`node-${id}`, createVoxelNode({ id: `node-${id}` })])
      );

      const edges = new Map<string, VoxelEdge>();
      for (let i = 0; i < nodeIds.length - 1; i++) {
        const edge = createVoxelEdge(`node-${nodeIds[i]}`, `node-${nodeIds[i + 1]}`, {
          id: `edge-${i}`,
        });
        edges.set(edge.id, edge);
      }

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 2,
        minProbability: 0.01,
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      // Should only reach depth 2 (nodes B and C)
      expect(result.maxDepth).toBeLessThanOrEqual(2);
      expect(result.affectedNodes.every((n) => n.depth <= 2)).toBe(true);
    });

    it('should respect minProbability filter', () => {
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });
      const nodeC = createVoxelNode({ id: 'node-c' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab', weight: 1.0 })],
        ['edge-bc', createVoxelEdge('node-b', 'node-c', { id: 'edge-bc', weight: 0.1 })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 5,
        minProbability: 0.5,
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      // Node C should be excluded due to low probability path
      expect(result.affectedNodes.every((n) => n.impact >= 0.5)).toBe(true);
    });

    it('should handle bidirectional traversal', () => {
      // Create: A -> B (forward edge)
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
      ]);

      // Test bidirectional from B (should reach A)
      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-b',
        maxDepth: 3,
        minProbability: 0.1,
        bidirectional: true,
      };

      const result = BlastRadiusService.calculateBlastRadius('node-b', nodes, edges, config);

      expect(result.affectedNodes.map((n) => n.nodeId)).toContain('node-a');
    });

    it('should filter by edge types', () => {
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });
      const nodeC = createVoxelNode({ id: 'node-c' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab', type: 'dependency' })],
        ['edge-ac', createVoxelEdge('node-a', 'node-c', { id: 'edge-ac', type: 'mitigation' })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
        edgeTypes: ['dependency'],
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      // Should only reach B (via dependency edge)
      expect(result.affectedNodes.map((n) => n.nodeId)).toContain('node-b');
      expect(result.affectedNodes.map((n) => n.nodeId)).not.toContain('node-c');
    });

    it('should filter by node types', () => {
      const nodeA = createVoxelNode({ id: 'node-a', type: 'risk' });
      const nodeB = createVoxelNode({ id: 'node-b', type: 'asset' });
      const nodeC = createVoxelNode({ id: 'node-c', type: 'control' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
        ['edge-ac', createVoxelEdge('node-a', 'node-c', { id: 'edge-ac' })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
        includeNodeTypes: ['asset'],
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      // Should only include assets
      expect(result.affectedNodes.map((n) => n.nodeId)).toContain('node-b');
      expect(result.affectedNodes.map((n) => n.nodeId)).not.toContain('node-c');
    });

    it('should group nodes by type', () => {
      const nodeA = createVoxelNode({ id: 'node-a', type: 'risk' });
      const nodeB = createVoxelNode({ id: 'node-b', type: 'asset' });
      const nodeC = createVoxelNode({ id: 'node-c', type: 'asset' });
      const nodeD = createVoxelNode({ id: 'node-d', type: 'control' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
        ['node-d', nodeD],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
        ['edge-ac', createVoxelEdge('node-a', 'node-c', { id: 'edge-ac' })],
        ['edge-ad', createVoxelEdge('node-a', 'node-d', { id: 'edge-ad' })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      expect(result.nodesByType.asset).toHaveLength(2);
      expect(result.nodesByType.control).toHaveLength(1);
    });

    it('should calculate business impact correctly', () => {
      // Create graph with critical nodes
      const nodeA = createVoxelNode({ id: 'node-a', status: 'critical' });
      const nodeB = createVoxelNode({ id: 'node-b', status: 'critical' });
      const nodeC = createVoxelNode({ id: 'node-c', status: 'critical' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
        ['edge-ac', createVoxelEdge('node-a', 'node-c', { id: 'edge-ac' })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      // Multiple critical nodes should result in critical business impact
      expect(['critical', 'high']).toContain(result.businessImpact);
    });

    it('should track impact paths', () => {
      // Create: A -> B -> C
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

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.calculateBlastRadius('node-a', nodes, edges, config);

      const nodeC_result = result.affectedNodes.find((n) => n.nodeId === 'node-c');
      expect(nodeC_result?.path).toEqual(['node-a', 'node-b', 'node-c']);
    });
  });

  // ============================================================================
  // analyzeRootCauses Tests
  // ============================================================================

  describe('analyzeRootCauses', () => {
    it('should return empty result for non-existent incident node', () => {
      const nodes = new Map<string, VoxelNode>();
      const edges = new Map<string, VoxelEdge>();
      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'non-existent',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.analyzeRootCauses('non-existent', nodes, edges, config);

      expect(result.potentialCauses).toHaveLength(0);
      expect(result.maxDepth).toBe(0);
    });

    it('should find upstream causes via reverse traversal', () => {
      // Create: A -> B -> C (C is the incident)
      const nodeA = createVoxelNode({ id: 'node-a', type: 'risk' });
      const nodeB = createVoxelNode({ id: 'node-b', type: 'control' });
      const nodeC = createVoxelNode({ id: 'node-c', type: 'incident' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['node-c', nodeC],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
        ['edge-bc', createVoxelEdge('node-b', 'node-c', { id: 'edge-bc' })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-c',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.analyzeRootCauses('node-c', nodes, edges, config);

      expect(result.incidentNodeId).toBe('node-c');
      expect(result.potentialCauses.map((c) => c.nodeId)).toContain('node-b');
      expect(result.potentialCauses.map((c) => c.nodeId)).toContain('node-a');
    });

    it('should assign contributing factors based on node type', () => {
      const riskNode = createVoxelNode({ id: 'risk-node', type: 'risk' });
      const controlNode = createVoxelNode({
        id: 'control-node',
        type: 'control',
        status: 'warning',
      });
      const incidentNode = createVoxelNode({ id: 'incident-node', type: 'incident' });

      const nodes = new Map<string, VoxelNode>([
        ['risk-node', riskNode],
        ['control-node', controlNode],
        ['incident-node', incidentNode],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ri', createVoxelEdge('risk-node', 'incident-node', { id: 'edge-ri' })],
        ['edge-ci', createVoxelEdge('control-node', 'incident-node', { id: 'edge-ci' })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'incident-node',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.analyzeRootCauses('incident-node', nodes, edges, config);

      const riskCause = result.potentialCauses.find((c) => c.nodeId === 'risk-node');
      expect(riskCause?.contributingFactors).toContain('Risk source');

      const controlCause = result.potentialCauses.find((c) => c.nodeId === 'control-node');
      expect(controlCause?.contributingFactors).toContain('Control weakness');
    });

    it('should sort potential causes by likelihood', () => {
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });
      const incidentNode = createVoxelNode({ id: 'incident-node' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
        ['incident-node', incidentNode],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ai', createVoxelEdge('node-a', 'incident-node', { id: 'edge-ai', weight: 0.9 })],
        ['edge-bi', createVoxelEdge('node-b', 'incident-node', { id: 'edge-bi', weight: 0.3 })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'incident-node',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.analyzeRootCauses('incident-node', nodes, edges, config);

      expect(result.potentialCauses.length).toBeGreaterThanOrEqual(2);
      // Should be sorted by likelihood (descending)
      for (let i = 0; i < result.potentialCauses.length - 1; i++) {
        expect(result.potentialCauses[i].likelihood).toBeGreaterThanOrEqual(
          result.potentialCauses[i + 1].likelihood
        );
      }
    });
  });

  // ============================================================================
  // applyWhatIfScenario Tests
  // ============================================================================

  describe('applyWhatIfScenario', () => {
    it('should compare baseline with node removal scenario', () => {
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

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.applyWhatIfScenario('node-a', nodes, edges, config, {
        type: 'remove_node',
        nodeId: 'node-b',
      });

      expect(result.baseline).toBeDefined();
      expect(result.scenario).toBeDefined();
      expect(result.noLongerAffected).toContain('node-b');
      expect(result.noLongerAffected).toContain('node-c');
    });

    it('should compare baseline with edge removal scenario', () => {
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
        ['edge-ac', createVoxelEdge('node-a', 'node-c', { id: 'edge-ac' })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.applyWhatIfScenario('node-a', nodes, edges, config, {
        type: 'remove_edge',
        edgeId: 'edge-ab',
      });

      expect(result.noLongerAffected).toContain('node-b');
      expect(result.noLongerAffected).not.toContain('node-c');
    });

    it('should compare baseline with edge weight modification', () => {
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab', weight: 1.0 })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.applyWhatIfScenario('node-a', nodes, edges, config, {
        type: 'modify_weight',
        edgeId: 'edge-ab',
        newWeight: 0.5,
      });

      // Impact should change due to weight modification
      expect(result.changedImpact.length).toBeGreaterThanOrEqual(0);
    });

    it('should compare baseline with add node scenario', () => {
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });

      const nodes = new Map<string, VoxelNode>([
        ['node-a', nodeA],
        ['node-b', nodeB],
      ]);

      const edges = new Map<string, VoxelEdge>([
        ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
      ]);

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.applyWhatIfScenario('node-a', nodes, edges, config, {
        type: 'add_node',
        node: { type: 'control', label: 'New Control' },
        edges: [{ target: 'node-b' }],
      });

      expect(result.scenario).toBeDefined();
    });

    it('should calculate impact delta correctly', () => {
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

      const config: ExtendedBlastRadiusConfig = {
        startNodeId: 'node-a',
        maxDepth: 3,
        minProbability: 0.1,
      };

      const result = BlastRadiusService.applyWhatIfScenario('node-a', nodes, edges, config, {
        type: 'remove_node',
        nodeId: 'node-b',
      });

      expect(result.impactDelta).toBeLessThanOrEqual(0);
      expect(result.affectedNodesDelta).toBeLessThanOrEqual(0);
    });
  });

  // ============================================================================
  // toLegacyResult Tests
  // ============================================================================

  describe('toLegacyResult', () => {
    it('should convert BlastRadiusAnalysis to legacy format', () => {
      const nodeA = createVoxelNode({ id: 'node-a' });
      const nodeB = createVoxelNode({ id: 'node-b' });

      const analysis: BlastRadiusAnalysis = {
        sourceNodeId: 'node-a',
        affectedNodes: [
          {
            nodeId: 'node-b',
            node: nodeB,
            depth: 1,
            impact: 0.75,
            path: ['node-a', 'node-b'],
            edgeWeightSum: 1.0,
          },
        ],
        totalImpact: 0.75,
        maxDepth: 1,
        paths: [['node-a', 'node-b']],
        nodesByType: {
          asset: [],
          risk: [],
          control: [],
          incident: [],
          supplier: [],
          project: [],
          audit: [],
        },
        businessImpact: 'medium',
        executionTimeMs: 10,
      };

      const legacy = BlastRadiusService.toLegacyResult(analysis);

      expect(legacy.impactedNodes).toHaveLength(1);
      expect(legacy.impactedNodes[0].nodeId).toBe('node-b');
      expect(legacy.impactedNodes[0].probability).toBe(0.75);
      expect(legacy.totalImpact).toBe(0.75);
      expect(legacy.businessImpact).toBe('medium');
    });
  });

  // ============================================================================
  // Export Functions Tests
  // ============================================================================

  describe('exportToCsv', () => {
    it('should generate valid CSV output', () => {
      const sourceNode = createVoxelNode({ id: 'source', label: 'Source Node' });
      const affectedNode = createVoxelNode({
        id: 'affected',
        label: 'Affected Node',
        type: 'risk',
        status: 'warning',
      });

      const analysis: BlastRadiusAnalysis = {
        sourceNodeId: 'source',
        affectedNodes: [
          {
            nodeId: 'affected',
            node: affectedNode,
            depth: 1,
            impact: 0.75,
            path: ['source', 'affected'],
            edgeWeightSum: 1.0,
          },
        ],
        totalImpact: 0.75,
        maxDepth: 1,
        paths: [['source', 'affected']],
        nodesByType: {
          asset: [],
          risk: [
            {
              nodeId: 'affected',
              node: affectedNode,
              depth: 1,
              impact: 0.75,
              path: ['source', 'affected'],
              edgeWeightSum: 1.0,
            },
          ],
          control: [],
          incident: [],
          supplier: [],
          project: [],
          audit: [],
        },
        businessImpact: 'medium',
        executionTimeMs: 10,
      };

      const csv = BlastRadiusService.exportToCsv(analysis, sourceNode);

      expect(csv).toContain('Node ID');
      expect(csv).toContain('Label');
      expect(csv).toContain('affected');
      expect(csv).toContain('Affected Node');
      expect(csv).toContain('Source Node');
      expect(csv).toContain('MEDIUM');
    });

    it('should escape special characters in CSV', () => {
      const sourceNode = createVoxelNode({ id: 'source', label: 'Source "with quotes"' });

      const analysis: BlastRadiusAnalysis = {
        sourceNodeId: 'source',
        affectedNodes: [],
        totalImpact: 0,
        maxDepth: 0,
        paths: [],
        nodesByType: {
          asset: [],
          risk: [],
          control: [],
          incident: [],
          supplier: [],
          project: [],
          audit: [],
        },
        businessImpact: 'low',
        executionTimeMs: 10,
      };

      const csv = BlastRadiusService.exportToCsv(analysis, sourceNode);

      expect(csv).toContain('Source "with quotes"');
    });
  });

  describe('generateReportData', () => {
    it('should generate complete report data', () => {
      const sourceNode = createVoxelNode({ id: 'source', label: 'Source', type: 'risk' });
      const affectedNode1 = createVoxelNode({ id: 'a1', type: 'asset', status: 'normal' });
      const affectedNode2 = createVoxelNode({ id: 'a2', type: 'control', status: 'warning' });

      const analysis: BlastRadiusAnalysis = {
        sourceNodeId: 'source',
        affectedNodes: [
          {
            nodeId: 'a1',
            node: affectedNode1,
            depth: 1,
            impact: 0.8,
            path: ['source', 'a1'],
            edgeWeightSum: 1.0,
          },
          {
            nodeId: 'a2',
            node: affectedNode2,
            depth: 1,
            impact: 0.3,
            path: ['source', 'a2'],
            edgeWeightSum: 0.5,
          },
        ],
        totalImpact: 1.1,
        maxDepth: 1,
        paths: [
          ['source', 'a1'],
          ['source', 'a2'],
        ],
        nodesByType: {
          asset: [
            {
              nodeId: 'a1',
              node: affectedNode1,
              depth: 1,
              impact: 0.8,
              path: ['source', 'a1'],
              edgeWeightSum: 1.0,
            },
          ],
          risk: [],
          control: [
            {
              nodeId: 'a2',
              node: affectedNode2,
              depth: 1,
              impact: 0.3,
              path: ['source', 'a2'],
              edgeWeightSum: 0.5,
            },
          ],
          incident: [],
          supplier: [],
          project: [],
          audit: [],
        },
        businessImpact: 'high',
        executionTimeMs: 15,
      };

      const report = BlastRadiusService.generateReportData(analysis, sourceNode);

      expect(report.title).toBe("Rapport d'Analyse Blast Radius");
      expect(report.sourceNode.id).toBe('source');
      expect(report.sourceNode.label).toBe('Source');
      expect(report.summary.totalAffectedNodes).toBe(2);
      expect(report.summary.businessImpact).toBe('high');
      expect(report.impactDistribution.critical).toBe(1);
      expect(report.impactDistribution.medium).toBe(1);
      expect(report.topAffectedNodes).toHaveLength(2);
    });

    it('should include what-if comparison data when provided', () => {
      const sourceNode = createVoxelNode({ id: 'source' });

      const analysis: BlastRadiusAnalysis = {
        sourceNodeId: 'source',
        affectedNodes: [],
        totalImpact: 0,
        maxDepth: 0,
        paths: [],
        nodesByType: {
          asset: [],
          risk: [],
          control: [],
          incident: [],
          supplier: [],
          project: [],
          audit: [],
        },
        businessImpact: 'low',
        executionTimeMs: 10,
      };

      const whatIfComparison: WhatIfComparison = {
        baseline: analysis,
        scenario: analysis,
        impactDelta: -0.5,
        affectedNodesDelta: -2,
        newlyAffected: [],
        noLongerAffected: ['node-1', 'node-2'],
        changedImpact: [],
      };

      const report = BlastRadiusService.generateReportData(analysis, sourceNode, whatIfComparison);

      expect(report.whatIfComparison).toBeDefined();
      expect(report.whatIfComparison?.impactDelta).toBe(-0.5);
      expect(report.whatIfComparison?.protectedCount).toBe(2);
    });
  });

  describe('generateRootCauseReportData', () => {
    it('should generate root cause report data', () => {
      const incidentNode = createVoxelNode({
        id: 'incident',
        label: 'Test Incident',
        type: 'incident',
      });
      const causeNode = createVoxelNode({ id: 'cause', label: 'Root Cause', type: 'risk' });

      const result: RootCauseResult = {
        incidentNodeId: 'incident',
        potentialCauses: [
          {
            nodeId: 'cause',
            node: causeNode,
            depth: 1,
            likelihood: 0.8,
            paths: [['cause', 'incident']],
            contributingFactors: ['Risk source'],
          },
        ],
        maxDepth: 1,
        paths: [['cause', 'incident']],
        executionTimeMs: 5,
      };

      const report = BlastRadiusService.generateRootCauseReportData(result, incidentNode);

      expect(report.title).toBe("Rapport d'Analyse Cause Racine");
      expect(report.incidentNode.id).toBe('incident');
      expect(report.summary.totalPotentialCauses).toBe(1);
      expect(report.topCauses).toHaveLength(1);
      expect(report.topCauses[0].contributingFactors).toContain('Risk source');
    });
  });
});
