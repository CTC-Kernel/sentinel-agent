/**
 * Unit tests for useBlastRadius hook
 *
 * Tests for:
 * - Simulation start/stop
 * - Config changes
 * - What-If mode
 * - Root cause mode
 * - State management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { VoxelNode, VoxelEdge } from '@/types/voxel';
import {
  createVoxelNode,
  createVoxelEdge,
  resetIdCounter,
} from '@/tests/factories/voxelFactory';

// Create mock nodes and edges
const mockNodes = new Map<string, VoxelNode>([
  ['node-a', createVoxelNode({ id: 'node-a', label: 'Node A', type: 'risk' })],
  ['node-b', createVoxelNode({ id: 'node-b', label: 'Node B', type: 'asset' })],
  ['node-c', createVoxelNode({ id: 'node-c', label: 'Node C', type: 'control' })],
  ['node-d', createVoxelNode({ id: 'node-d', label: 'Node D', type: 'incident' })],
]);

const mockEdges = new Map<string, VoxelEdge>([
  ['edge-ab', createVoxelEdge('node-a', 'node-b', { id: 'edge-ab' })],
  ['edge-bc', createVoxelEdge('node-b', 'node-c', { id: 'edge-bc' })],
  ['edge-cd', createVoxelEdge('node-c', 'node-d', { id: 'edge-cd' })],
]);

const mockSelectNode = vi.fn();
const mockSetCameraTarget = vi.fn();

vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn((selector) => {
    const state = {
      nodes: mockNodes,
      edges: mockEdges,
      selectNode: mockSelectNode,
      setCameraTarget: mockSetCameraTarget,
    };
    return selector(state);
  }),
}));

// Mock BlastRadiusService
vi.mock('@/services/blastRadiusService', () => ({
  BlastRadiusService: {
    calculateBlastRadius: vi.fn((sourceId, nodes, edges, _config) => ({
      sourceNodeId: sourceId,
      affectedNodes: [
        {
          nodeId: 'node-b',
          node: nodes.get('node-b'),
          depth: 1,
          impact: 0.75,
          path: [sourceId, 'node-b'],
          edgeWeightSum: 1.0,
        },
        {
          nodeId: 'node-c',
          node: nodes.get('node-c'),
          depth: 2,
          impact: 0.5,
          path: [sourceId, 'node-b', 'node-c'],
          edgeWeightSum: 2.0,
        },
      ],
      totalImpact: 1.25,
      maxDepth: 2,
      paths: [
        [sourceId, 'node-b'],
        [sourceId, 'node-b', 'node-c'],
      ],
      nodesByType: {
        asset: [{ nodeId: 'node-b', node: nodes.get('node-b'), depth: 1, impact: 0.75, path: [sourceId, 'node-b'], edgeWeightSum: 1.0 }],
        risk: [],
        control: [{ nodeId: 'node-c', node: nodes.get('node-c'), depth: 2, impact: 0.5, path: [sourceId, 'node-b', 'node-c'], edgeWeightSum: 2.0 }],
        incident: [],
        supplier: [],
        project: [],
        audit: [],
      },
      businessImpact: 'medium',
      executionTimeMs: 5,
    })),
    analyzeRootCauses: vi.fn((incidentId, nodes, _edges, _config) => ({
      incidentNodeId: incidentId,
      potentialCauses: [
        {
          nodeId: 'node-c',
          node: nodes.get('node-c'),
          depth: 1,
          likelihood: 0.7,
          paths: [['node-c', incidentId]],
          contributingFactors: ['Control weakness'],
        },
        {
          nodeId: 'node-b',
          node: nodes.get('node-b'),
          depth: 2,
          likelihood: 0.5,
          paths: [['node-b', 'node-c', incidentId]],
          contributingFactors: ['Asset vulnerability'],
        },
      ],
      maxDepth: 2,
      paths: [
        ['node-c', incidentId],
        ['node-b', 'node-c', incidentId],
      ],
      executionTimeMs: 3,
    })),
    applyWhatIfScenario: vi.fn((sourceId, nodes, edges, config, scenario) => {
      const baseline = {
        sourceNodeId: sourceId,
        affectedNodes: [
          { nodeId: 'node-b', node: nodes.get('node-b'), depth: 1, impact: 0.75, path: [sourceId, 'node-b'], edgeWeightSum: 1.0 },
          { nodeId: 'node-c', node: nodes.get('node-c'), depth: 2, impact: 0.5, path: [sourceId, 'node-b', 'node-c'], edgeWeightSum: 2.0 },
        ],
        totalImpact: 1.25,
        maxDepth: 2,
        paths: [],
        nodesByType: { asset: [], risk: [], control: [], incident: [], supplier: [], project: [], audit: [] },
        businessImpact: 'medium' as const,
        executionTimeMs: 5,
      };

      const scenarioResult = {
        sourceNodeId: sourceId,
        affectedNodes: [
          { nodeId: 'node-b', node: nodes.get('node-b'), depth: 1, impact: 0.5, path: [sourceId, 'node-b'], edgeWeightSum: 0.5 },
        ],
        totalImpact: 0.5,
        maxDepth: 1,
        paths: [],
        nodesByType: { asset: [], risk: [], control: [], incident: [], supplier: [], project: [], audit: [] },
        businessImpact: 'low' as const,
        executionTimeMs: 3,
      };

      return {
        baseline,
        scenario: scenarioResult,
        impactDelta: -0.75,
        affectedNodesDelta: -1,
        newlyAffected: [],
        noLongerAffected: ['node-c'],
        changedImpact: [{ nodeId: 'node-b', before: 0.75, after: 0.5 }],
      };
    }),
  },
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  callback(0);
  return 0;
};

describe('useBlastRadius', () => {
  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Initial State Tests
  // ============================================================================

  describe('initial state', () => {
    it('should have correct initial state', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      expect(result.current.sourceNodeId).toBeNull();
      expect(result.current.mode).toBe('blast-radius');
      expect(result.current.isSimulating).toBe(false);
      expect(result.current.blastRadiusResult).toBeNull();
      expect(result.current.rootCauseResult).toBeNull();
      expect(result.current.whatIfResult).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should have default config values', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      expect(result.current.config.maxDepth).toBe(4);
      expect(result.current.config.minProbability).toBe(0.1);
      expect(result.current.config.decayRate).toBe(0.25);
      expect(result.current.config.bidirectional).toBe(false);
    });

    it('should have empty stats initially', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      expect(result.current.stats.totalAffected).toBe(0);
      expect(result.current.stats.totalImpact).toBe(0);
      expect(result.current.stats.maxDepth).toBe(0);
    });
  });

  // ============================================================================
  // startSimulation Tests
  // ============================================================================

  describe('startSimulation', () => {
    it('should start simulation for existing node', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.isSimulating).toBe(false);
        expect(result.current.sourceNodeId).toBe('node-a');
        expect(result.current.blastRadiusResult).not.toBeNull();
      });
    });

    it('should set error for non-existent node', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('non-existent');
      });

      expect(result.current.error).toBe('Node non-existent not found');
    });

    it('should set mode to blast-radius', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      expect(result.current.mode).toBe('blast-radius');
    });

    it('should calculate affected nodes', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.affectedNodeIds.size).toBeGreaterThan(0);
        expect(result.current.affectedNodeIds.has('node-b')).toBe(true);
        expect(result.current.affectedNodeIds.has('node-c')).toBe(true);
      });
    });

    it('should update stats', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.stats.totalAffected).toBe(2);
        expect(result.current.stats.totalImpact).toBe(1.25);
        expect(result.current.stats.maxDepth).toBe(2);
      });
    });

    it('should track impact paths', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.impactPaths.length).toBeGreaterThan(0);
      });
    });

    it('should add to history', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.blastRadiusResult).not.toBeNull();
      });

      // Run another simulation
      act(() => {
        result.current.startSimulation('node-b');
      });

      await waitFor(() => {
        expect(result.current.history.length).toBe(1);
      });
    });
  });

  // ============================================================================
  // stopSimulation Tests
  // ============================================================================

  describe('stopSimulation', () => {
    it('should stop simulation', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      act(() => {
        result.current.stopSimulation();
      });

      expect(result.current.isSimulating).toBe(false);
    });
  });

  // ============================================================================
  // Root Cause Analysis Tests
  // ============================================================================

  describe('startRootCauseAnalysis', () => {
    it('should start root cause analysis', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startRootCauseAnalysis('node-d');
      });

      await waitFor(() => {
        expect(result.current.mode).toBe('root-cause');
        expect(result.current.sourceNodeId).toBe('node-d');
        expect(result.current.rootCauseResult).not.toBeNull();
      });
    });

    it('should identify potential causes', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startRootCauseAnalysis('node-d');
      });

      await waitFor(() => {
        expect(result.current.rootCauseNodeIds.size).toBeGreaterThan(0);
        expect(result.current.rootCauseNodeIds.has('node-c')).toBe(true);
      });
    });

    it('should set error for non-existent node', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startRootCauseAnalysis('non-existent');
      });

      expect(result.current.error).toBe('Node non-existent not found');
    });
  });

  // ============================================================================
  // Config Management Tests
  // ============================================================================

  describe('setConfig', () => {
    it('should update config', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.setConfig({ maxDepth: 5, minProbability: 0.2 });
      });

      expect(result.current.config.maxDepth).toBe(5);
      expect(result.current.config.minProbability).toBe(0.2);
    });

    it('should preserve other config values', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      const originalDecayRate = result.current.config.decayRate;

      act(() => {
        result.current.setConfig({ maxDepth: 6 });
      });

      expect(result.current.config.decayRate).toBe(originalDecayRate);
    });
  });

  describe('resetConfig', () => {
    it('should reset config to defaults', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.setConfig({ maxDepth: 10, minProbability: 0.5 });
      });

      act(() => {
        result.current.resetConfig();
      });

      expect(result.current.config.maxDepth).toBe(4);
      expect(result.current.config.minProbability).toBe(0.1);
    });
  });

  // ============================================================================
  // What-If Scenario Tests
  // ============================================================================

  describe('applyWhatIfScenario', () => {
    it('should apply what-if scenario', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      // First start a simulation
      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.blastRadiusResult).not.toBeNull();
      });

      // Then apply what-if
      act(() => {
        result.current.applyWhatIfScenario({
          type: 'remove_node',
          nodeId: 'node-c',
        });
      });

      await waitFor(() => {
        expect(result.current.mode).toBe('what-if');
        expect(result.current.whatIfResult).not.toBeNull();
      });
    });

    it('should calculate impact delta', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.blastRadiusResult).not.toBeNull();
      });

      act(() => {
        result.current.applyWhatIfScenario({
          type: 'modify_weight',
          edgeId: 'edge-ab',
          newWeight: 0.5,
        });
      });

      await waitFor(() => {
        expect(result.current.whatIfResult?.impactDelta).toBeDefined();
      });
    });

    it('should identify no longer affected nodes', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.blastRadiusResult).not.toBeNull();
      });

      act(() => {
        result.current.applyWhatIfScenario({
          type: 'remove_node',
          nodeId: 'node-b',
        });
      });

      await waitFor(() => {
        expect(result.current.whatIfResult?.noLongerAffected).toBeDefined();
      });
    });

    it('should set error if no source node selected', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.applyWhatIfScenario({
          type: 'remove_node',
          nodeId: 'node-b',
        });
      });

      expect(result.current.error).toBe('No source node selected');
    });
  });

  describe('clearWhatIfScenario', () => {
    it('should clear what-if scenario', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.blastRadiusResult).not.toBeNull();
      });

      act(() => {
        result.current.applyWhatIfScenario({
          type: 'remove_node',
          nodeId: 'node-b',
        });
      });

      await waitFor(() => {
        expect(result.current.whatIfResult).not.toBeNull();
      });

      act(() => {
        result.current.clearWhatIfScenario();
      });

      expect(result.current.mode).toBe('blast-radius');
      expect(result.current.whatIfResult).toBeNull();
      expect(result.current.whatIfScenario).toBeNull();
    });
  });

  // ============================================================================
  // Focus Node Tests
  // ============================================================================

  describe('focusNode', () => {
    it('should select node and set camera target', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.focusNode('node-a');
      });

      expect(mockSelectNode).toHaveBeenCalledWith('node-a');
      expect(mockSetCameraTarget).toHaveBeenCalled();
    });

    it('should not do anything for non-existent node', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.focusNode('non-existent');
      });

      expect(mockSelectNode).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Clear Results Tests
  // ============================================================================

  describe('clearResults', () => {
    it('should clear all results', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.blastRadiusResult).not.toBeNull();
      });

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.sourceNodeId).toBeNull();
      expect(result.current.blastRadiusResult).toBeNull();
      expect(result.current.rootCauseResult).toBeNull();
      expect(result.current.whatIfResult).toBeNull();
      expect(result.current.history).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });
  });

  // ============================================================================
  // Mode Management Tests
  // ============================================================================

  describe('setMode', () => {
    it('should set simulation mode', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.setMode('root-cause');
      });

      expect(result.current.mode).toBe('root-cause');
    });
  });

  // ============================================================================
  // Getter Functions Tests
  // ============================================================================

  describe('getAffectedNode', () => {
    it('should return affected node by ID', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.blastRadiusResult).not.toBeNull();
      });

      const affected = result.current.getAffectedNode('node-b');

      expect(affected).toBeDefined();
      expect(affected?.nodeId).toBe('node-b');
      expect(affected?.impact).toBe(0.75);
    });

    it('should return undefined for non-affected node', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startSimulation('node-a');
      });

      await waitFor(() => {
        expect(result.current.blastRadiusResult).not.toBeNull();
      });

      const affected = result.current.getAffectedNode('node-z');

      expect(affected).toBeUndefined();
    });
  });

  describe('getPotentialCause', () => {
    it('should return potential cause by ID', async () => {
      const { useBlastRadius } = await import('../useBlastRadius');

      const { result } = renderHook(() => useBlastRadius());

      act(() => {
        result.current.startRootCauseAnalysis('node-d');
      });

      await waitFor(() => {
        expect(result.current.rootCauseResult).not.toBeNull();
      });

      const cause = result.current.getPotentialCause('node-c');

      expect(cause).toBeDefined();
      expect(cause?.nodeId).toBe('node-c');
      expect(cause?.likelihood).toBe(0.7);
    });
  });
});
