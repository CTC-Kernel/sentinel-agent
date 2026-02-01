/**
 * GraphBuilder Service Tests
 *
 * @see Story VOX-6.1: Data Transformer Service
 * @see Story VOX-6.4: Graph Building Service
 */

import { describe, it, expect } from 'vitest';
import { buildGraph, updateNodeFromEntity, type GraphBuilderInput } from '../GraphBuilder';
import type { Asset } from '@/types/assets';
import type { Risk } from '@/types/risks';
import type { Control } from '@/types/controls';
import { Criticality } from '@/types/common';

// ============================================================================
// Mock Data
// ============================================================================

const mockAsset: Asset = {
  id: 'asset-1',
  organizationId: 'org-1',
  name: 'Test Asset',
  type: 'Matériel',
  owner: 'John Doe',
  confidentiality: Criticality.HIGH,
  integrity: Criticality.MEDIUM,
  availability: Criticality.LOW,
  location: 'Paris',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockRisk: Risk = {
  id: 'risk-1',
  organizationId: 'org-1',
  assetId: 'asset-1',
  threat: 'Test Threat',
  vulnerability: 'Test Vulnerability',
  probability: 3,
  impact: 4,
  score: 12,
  strategy: 'Atténuer',
  status: 'Ouvert',
  owner: 'Jane Doe',
  mitigationControlIds: ['control-1'],
};

const mockControl: Control = {
  id: 'control-1',
  organizationId: 'org-1',
  code: 'A.1.1',
  name: 'Test Control',
  status: 'Implémenté',
  relatedAssetIds: ['asset-1'],
  relatedRiskIds: ['risk-1'],
};

// ============================================================================
// Tests
// ============================================================================

describe('GraphBuilder', () => {
  describe('buildGraph', () => {
    it('should build a graph from empty input', () => {
      const input: GraphBuilderInput = {
        assets: [],
        risks: [],
        controls: [],
      };

      const graph = buildGraph(input);

      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('should build nodes for assets', () => {
      const input: GraphBuilderInput = {
        assets: [mockAsset],
        risks: [],
        controls: [],
      };

      const graph = buildGraph(input);

      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].id).toBe('asset-1');
      expect(graph.nodes[0].type).toBe('asset');
      expect(graph.nodes[0].label).toBe('Test Asset');
    });

    it('should build nodes for risks', () => {
      const input: GraphBuilderInput = {
        assets: [],
        risks: [mockRisk],
        controls: [],
      };

      const graph = buildGraph(input);

      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].id).toBe('risk-1');
      expect(graph.nodes[0].type).toBe('risk');
      expect(graph.nodes[0].label).toBe('Test Threat');
    });

    it('should build nodes for controls', () => {
      const input: GraphBuilderInput = {
        assets: [],
        risks: [],
        controls: [mockControl],
      };

      const graph = buildGraph(input);

      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].id).toBe('control-1');
      expect(graph.nodes[0].type).toBe('control');
      expect(graph.nodes[0].label).toContain('A.1.1');
    });

    it('should build edges between risks and assets', () => {
      const input: GraphBuilderInput = {
        assets: [mockAsset],
        risks: [mockRisk],
        controls: [],
      };

      const graph = buildGraph(input);

      const impactEdge = graph.edges.find(
        (e) => e.source === 'risk-1' && e.target === 'asset-1'
      );
      expect(impactEdge).toBeDefined();
      expect(impactEdge?.type).toBe('impact');
    });

    it('should build edges between controls and risks', () => {
      const input: GraphBuilderInput = {
        assets: [],
        risks: [mockRisk],
        controls: [mockControl],
      };

      const graph = buildGraph(input);

      const mitigationEdge = graph.edges.find(
        (e) => e.source === 'control-1' && e.target === 'risk-1'
      );
      expect(mitigationEdge).toBeDefined();
      expect(mitigationEdge?.type).toBe('mitigation');
    });

    it('should build edges between controls and assets', () => {
      const input: GraphBuilderInput = {
        assets: [mockAsset],
        risks: [],
        controls: [mockControl],
      };

      const graph = buildGraph(input);

      const dependencyEdge = graph.edges.find(
        (e) => e.source === 'control-1' && e.target === 'asset-1'
      );
      expect(dependencyEdge).toBeDefined();
      expect(dependencyEdge?.type).toBe('dependency');
    });

    it('should build complete graph with all entity types', () => {
      const input: GraphBuilderInput = {
        assets: [mockAsset],
        risks: [mockRisk],
        controls: [mockControl],
      };

      const graph = buildGraph(input);

      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges.length).toBeGreaterThan(0);

      // Check that all node types are present
      const nodeTypes = graph.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('asset');
      expect(nodeTypes).toContain('risk');
      expect(nodeTypes).toContain('control');
    });
  });

  describe('Node Status Mapping', () => {
    it('should map asset status based on criticality', () => {
      const criticalAsset: Asset = {
        ...mockAsset,
        confidentiality: Criticality.CRITICAL,
      };

      const input: GraphBuilderInput = {
        assets: [criticalAsset],
        risks: [],
        controls: [],
      };

      const graph = buildGraph(input);
      expect(graph.nodes[0].status).toBe('critical');
    });

    it('should map risk status based on score', () => {
      const criticalRisk: Risk = {
        ...mockRisk,
        score: 25,
      };

      const input: GraphBuilderInput = {
        assets: [],
        risks: [criticalRisk],
        controls: [],
      };

      const graph = buildGraph(input);
      expect(graph.nodes[0].status).toBe('critical');
    });

    it('should map control status based on implementation', () => {
      const nonCompliantControl: Control = {
        ...mockControl,
        status: 'Non commencé',
      };

      const input: GraphBuilderInput = {
        assets: [],
        risks: [],
        controls: [nonCompliantControl],
      };

      const graph = buildGraph(input);
      expect(graph.nodes[0].status).toBe('critical');
    });
  });

  describe('Node Positions', () => {
    it('should assign 3D positions to nodes', () => {
      const input: GraphBuilderInput = {
        assets: [mockAsset],
        risks: [],
        controls: [],
      };

      const graph = buildGraph(input);
      const node = graph.nodes[0];

      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(typeof node.position.z).toBe('number');
    });

    it('should distribute nodes in 3D space', () => {
      const input: GraphBuilderInput = {
        assets: [
          { ...mockAsset, id: 'asset-1' },
          { ...mockAsset, id: 'asset-2', name: 'Asset 2' },
          { ...mockAsset, id: 'asset-3', name: 'Asset 3' },
        ],
        risks: [],
        controls: [],
      };

      const graph = buildGraph(input);

      // Check that not all positions are the same
      const positions = graph.nodes.map((n) => `${n.position.x},${n.position.y},${n.position.z}`);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(3);
    });
  });

  describe('Edge Weights', () => {
    it('should calculate edge weight from risk score', () => {
      const highScoreRisk: Risk = {
        ...mockRisk,
        score: 25,
      };

      const input: GraphBuilderInput = {
        assets: [mockAsset],
        risks: [highScoreRisk],
        controls: [],
      };

      const graph = buildGraph(input);
      const edge = graph.edges.find((e) => e.type === 'impact');

      expect(edge?.weight).toBe(1); // 25/25 = 1
    });
  });

  describe('updateNodeFromEntity', () => {
    it('should update a node while preserving position', () => {
      const input: GraphBuilderInput = {
        assets: [mockAsset],
        risks: [],
        controls: [],
      };

      const graph = buildGraph(input);
      const originalNode = graph.nodes[0];
      const originalPosition = { ...originalNode.position };

      const updatedAsset: Asset = {
        ...mockAsset,
        name: 'Updated Asset Name',
      };

      const updatedNode = updateNodeFromEntity(updatedAsset, 'asset', originalNode);

      expect(updatedNode.label).toBe('Updated Asset Name');
      expect(updatedNode.position).toEqual(originalPosition);
    });
  });

  describe('Node Connections', () => {
    it('should populate connections array on nodes', () => {
      const input: GraphBuilderInput = {
        assets: [mockAsset],
        risks: [mockRisk],
        controls: [mockControl],
      };

      const graph = buildGraph(input);

      const riskNode = graph.nodes.find((n) => n.id === 'risk-1');
      const controlNode = graph.nodes.find((n) => n.id === 'control-1');

      // Risk should be connected to asset and control
      expect(riskNode?.connections).toContain('asset-1');
      expect(riskNode?.connections).toContain('control-1');

      // Control should be connected to asset and risk
      expect(controlNode?.connections).toContain('asset-1');
      expect(controlNode?.connections).toContain('risk-1');
    });
  });
});

describe('GraphBuilderInput Type', () => {
  it('should accept optional collections', () => {
    const minimalInput: GraphBuilderInput = {
      assets: [],
      risks: [],
      controls: [],
    };

    const fullInput: GraphBuilderInput = {
      assets: [],
      risks: [],
      controls: [],
      projects: [],
      audits: [],
      incidents: [],
      suppliers: [],
    };

    expect(() => buildGraph(minimalInput)).not.toThrow();
    expect(() => buildGraph(fullInput)).not.toThrow();
  });
});
