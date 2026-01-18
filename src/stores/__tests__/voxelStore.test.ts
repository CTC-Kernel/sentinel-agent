/**
 * Unit tests for voxelStore (Zustand store)
 *
 * Tests for:
 * - Node CRUD actions
 * - Edge CRUD actions
 * - Anomaly management
 * - Filter application
 * - UI actions
 * - Selector hooks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  createVoxelNode,
  createVoxelEdge,
  createVoxelAnomaly,
  resetIdCounter,
} from '@/tests/factories/voxelFactory';


// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// We need to import the store fresh for each test
// to ensure isolated state

describe('voxelStore', () => {
  let useVoxelStore: typeof import('@/stores/voxelStore').useVoxelStore;

  beforeEach(async () => {
    resetIdCounter();
    vi.clearAllMocks();
    localStorageMock.clear();

    // Clear module cache to get fresh store
    vi.resetModules();

    // Import fresh store
    const storeModule = await import('@/stores/voxelStore');
    useVoxelStore = storeModule.useVoxelStore;

    // Reset the store state
    useVoxelStore.getState().reset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================================================
  // Initial State Tests
  // ============================================================================

  describe('initial state', () => {
    it('should have empty collections initially', () => {
      const state = useVoxelStore.getState();

      expect(state.nodes.size).toBe(0);
      expect(state.edges.size).toBe(0);
      expect(state.anomalies.size).toBe(0);
    });

    it('should have default filters', () => {
      const state = useVoxelStore.getState();

      expect(state.filters.nodeTypes).toContain('asset');
      expect(state.filters.nodeTypes).toContain('risk');
      expect(state.filters.statuses).toContain('normal');
      expect(state.filters.searchQuery).toBe('');
      expect(state.filters.showAnomaliesOnly).toBe(false);
    });

    it('should have default UI state', () => {
      const state = useVoxelStore.getState();

      expect(state.ui.selectedNodeId).toBeNull();
      expect(state.ui.hoveredNodeId).toBeNull();
      expect(state.ui.showLabels).toBe(true);
      expect(state.ui.showEdges).toBe(true);
      expect(state.ui.layoutType).toBe('force');
    });

    it('should have default sync state', () => {
      const state = useVoxelStore.getState();

      expect(state.sync.status).toBe('offline');
      expect(state.sync.lastSyncAt).toBeNull();
      expect(state.sync.pendingChanges).toBe(0);
    });
  });

  // ============================================================================
  // Node CRUD Tests
  // ============================================================================

  describe('Node CRUD', () => {
    describe('addNode', () => {
      it('should add a node to the store', () => {
        const node = createVoxelNode({ id: 'test-node', label: 'Test Node' });

        act(() => {
          useVoxelStore.getState().addNode(node);
        });

        const state = useVoxelStore.getState();
        expect(state.nodes.has('test-node')).toBe(true);
        expect(state.nodes.get('test-node')?.label).toBe('Test Node');
      });

      it('should overwrite existing node with same id', () => {
        const node1 = createVoxelNode({ id: 'test-node', label: 'First' });
        const node2 = createVoxelNode({ id: 'test-node', label: 'Second' });

        act(() => {
          useVoxelStore.getState().addNode(node1);
          useVoxelStore.getState().addNode(node2);
        });

        const state = useVoxelStore.getState();
        expect(state.nodes.size).toBe(1);
        expect(state.nodes.get('test-node')?.label).toBe('Second');
      });
    });

    describe('updateNode', () => {
      it('should update existing node', () => {
        const node = createVoxelNode({ id: 'test-node', label: 'Original' });

        act(() => {
          useVoxelStore.getState().addNode(node);
          useVoxelStore.getState().updateNode('test-node', { label: 'Updated' });
        });

        const state = useVoxelStore.getState();
        expect(state.nodes.get('test-node')?.label).toBe('Updated');
      });

      it('should not modify state if node does not exist', () => {
        act(() => {
          useVoxelStore.getState().updateNode('non-existent', { label: 'Updated' });
        });

        const state = useVoxelStore.getState();
        expect(state.nodes.size).toBe(0);
      });

      it('should update the updatedAt timestamp', () => {
        const node = createVoxelNode({ id: 'test-node' });


        act(() => {
          useVoxelStore.getState().addNode(node);
        });

        // Wait a tiny bit to ensure different timestamp
        const beforeUpdate = new Date();

        act(() => {
          useVoxelStore.getState().updateNode('test-node', { label: 'New Label' });
        });

        const state = useVoxelStore.getState();
        const updatedNode = state.nodes.get('test-node');
        expect(updatedNode?.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      });
    });

    describe('removeNode', () => {
      it('should remove existing node', () => {
        const node = createVoxelNode({ id: 'test-node' });

        act(() => {
          useVoxelStore.getState().addNode(node);
          useVoxelStore.getState().removeNode('test-node');
        });

        const state = useVoxelStore.getState();
        expect(state.nodes.has('test-node')).toBe(false);
      });

      it('should also remove connected edges', () => {
        const node1 = createVoxelNode({ id: 'node-1' });
        const node2 = createVoxelNode({ id: 'node-2' });
        const edge = createVoxelEdge('node-1', 'node-2', { id: 'edge-1' });

        act(() => {
          useVoxelStore.getState().addNode(node1);
          useVoxelStore.getState().addNode(node2);
          useVoxelStore.getState().addEdge(edge);
          useVoxelStore.getState().removeNode('node-1');
        });

        const state = useVoxelStore.getState();
        expect(state.edges.has('edge-1')).toBe(false);
      });
    });

    describe('setNodes', () => {
      it('should replace all nodes', () => {
        const node1 = createVoxelNode({ id: 'old-node' });
        const newNodes = [
          createVoxelNode({ id: 'new-1' }),
          createVoxelNode({ id: 'new-2' }),
        ];

        act(() => {
          useVoxelStore.getState().addNode(node1);
          useVoxelStore.getState().setNodes(newNodes);
        });

        const state = useVoxelStore.getState();
        expect(state.nodes.size).toBe(2);
        expect(state.nodes.has('old-node')).toBe(false);
        expect(state.nodes.has('new-1')).toBe(true);
        expect(state.nodes.has('new-2')).toBe(true);
      });
    });

    describe('clearNodes', () => {
      it('should remove all nodes and edges', () => {
        const nodes = [createVoxelNode({ id: 'n1' }), createVoxelNode({ id: 'n2' })];
        const edge = createVoxelEdge('n1', 'n2', { id: 'e1' });

        act(() => {
          nodes.forEach((n) => useVoxelStore.getState().addNode(n));
          useVoxelStore.getState().addEdge(edge);
          useVoxelStore.getState().clearNodes();
        });

        const state = useVoxelStore.getState();
        expect(state.nodes.size).toBe(0);
        expect(state.edges.size).toBe(0);
      });
    });
  });

  // ============================================================================
  // Edge CRUD Tests
  // ============================================================================

  describe('Edge CRUD', () => {
    describe('addEdge', () => {
      it('should add an edge to the store', () => {
        const edge = createVoxelEdge('node-1', 'node-2', { id: 'test-edge' });

        act(() => {
          useVoxelStore.getState().addEdge(edge);
        });

        const state = useVoxelStore.getState();
        expect(state.edges.has('test-edge')).toBe(true);
      });
    });

    describe('updateEdge', () => {
      it('should update existing edge', () => {
        const edge = createVoxelEdge('node-1', 'node-2', { id: 'test-edge', weight: 0.5 });

        act(() => {
          useVoxelStore.getState().addEdge(edge);
          useVoxelStore.getState().updateEdge('test-edge', { weight: 0.8 });
        });

        const state = useVoxelStore.getState();
        expect(state.edges.get('test-edge')?.weight).toBe(0.8);
      });

      it('should not modify state if edge does not exist', () => {
        act(() => {
          useVoxelStore.getState().updateEdge('non-existent', { weight: 1 });
        });

        const state = useVoxelStore.getState();
        expect(state.edges.size).toBe(0);
      });
    });

    describe('removeEdge', () => {
      it('should remove existing edge', () => {
        const edge = createVoxelEdge('node-1', 'node-2', { id: 'test-edge' });

        act(() => {
          useVoxelStore.getState().addEdge(edge);
          useVoxelStore.getState().removeEdge('test-edge');
        });

        const state = useVoxelStore.getState();
        expect(state.edges.has('test-edge')).toBe(false);
      });
    });

    describe('setEdges', () => {
      it('should replace all edges', () => {
        const oldEdge = createVoxelEdge('n1', 'n2', { id: 'old-edge' });
        const newEdges = [
          createVoxelEdge('n3', 'n4', { id: 'new-1' }),
          createVoxelEdge('n5', 'n6', { id: 'new-2' }),
        ];

        act(() => {
          useVoxelStore.getState().addEdge(oldEdge);
          useVoxelStore.getState().setEdges(newEdges);
        });

        const state = useVoxelStore.getState();
        expect(state.edges.size).toBe(2);
        expect(state.edges.has('old-edge')).toBe(false);
      });
    });

    describe('clearEdges', () => {
      it('should remove all edges', () => {
        const edges = [
          createVoxelEdge('n1', 'n2', { id: 'e1' }),
          createVoxelEdge('n3', 'n4', { id: 'e2' }),
        ];

        act(() => {
          edges.forEach((e) => useVoxelStore.getState().addEdge(e));
          useVoxelStore.getState().clearEdges();
        });

        const state = useVoxelStore.getState();
        expect(state.edges.size).toBe(0);
      });
    });
  });

  // ============================================================================
  // Anomaly CRUD Tests
  // ============================================================================

  describe('Anomaly CRUD', () => {
    describe('addAnomaly', () => {
      it('should add an anomaly to the store', () => {
        const anomaly = createVoxelAnomaly('node-1', { id: 'test-anomaly' });

        act(() => {
          useVoxelStore.getState().addAnomaly(anomaly);
        });

        const state = useVoxelStore.getState();
        expect(state.anomalies.has('test-anomaly')).toBe(true);
      });

      it('should update node anomalyIds when node exists', () => {
        const node = createVoxelNode({ id: 'node-1', anomalyIds: [] });
        const anomaly = createVoxelAnomaly('node-1', { id: 'test-anomaly' });

        act(() => {
          useVoxelStore.getState().addNode(node);
          useVoxelStore.getState().addAnomaly(anomaly);
        });

        const state = useVoxelStore.getState();
        const updatedNode = state.nodes.get('node-1');
        expect(updatedNode?.anomalyIds).toContain('test-anomaly');
      });
    });

    describe('updateAnomaly', () => {
      it('should update existing anomaly', () => {
        const anomaly = createVoxelAnomaly('node-1', { id: 'test-anomaly', status: 'active' });

        act(() => {
          useVoxelStore.getState().addAnomaly(anomaly);
          useVoxelStore.getState().updateAnomaly('test-anomaly', { status: 'resolved' });
        });

        const state = useVoxelStore.getState();
        expect(state.anomalies.get('test-anomaly')?.status).toBe('resolved');
      });
    });

    describe('removeAnomaly', () => {
      it('should remove anomaly and update node anomalyIds', () => {
        const node = createVoxelNode({ id: 'node-1', anomalyIds: ['test-anomaly'] });
        const anomaly = createVoxelAnomaly('node-1', { id: 'test-anomaly' });

        act(() => {
          useVoxelStore.getState().addNode(node);
          useVoxelStore.getState().addAnomaly(anomaly);
          useVoxelStore.getState().removeAnomaly('test-anomaly');
        });

        const state = useVoxelStore.getState();
        expect(state.anomalies.has('test-anomaly')).toBe(false);
        expect(state.nodes.get('node-1')?.anomalyIds).not.toContain('test-anomaly');
      });
    });

    describe('acknowledgeAnomaly', () => {
      it('should set anomaly status to acknowledged', () => {
        const anomaly = createVoxelAnomaly('node-1', { id: 'test-anomaly', status: 'active' });

        act(() => {
          useVoxelStore.getState().addAnomaly(anomaly);
          useVoxelStore.getState().acknowledgeAnomaly('test-anomaly');
        });

        const state = useVoxelStore.getState();
        expect(state.anomalies.get('test-anomaly')?.status).toBe('acknowledged');
      });
    });

    describe('resolveAnomaly', () => {
      it('should set anomaly status to resolved', () => {
        const anomaly = createVoxelAnomaly('node-1', { id: 'test-anomaly', status: 'active' });

        act(() => {
          useVoxelStore.getState().addAnomaly(anomaly);
          useVoxelStore.getState().resolveAnomaly('test-anomaly');
        });

        const state = useVoxelStore.getState();
        expect(state.anomalies.get('test-anomaly')?.status).toBe('resolved');
      });
    });

    describe('dismissAnomaly', () => {
      it('should set anomaly status to dismissed', () => {
        const anomaly = createVoxelAnomaly('node-1', { id: 'test-anomaly', status: 'active' });

        act(() => {
          useVoxelStore.getState().addAnomaly(anomaly);
          useVoxelStore.getState().dismissAnomaly('test-anomaly');
        });

        const state = useVoxelStore.getState();
        expect(state.anomalies.get('test-anomaly')?.status).toBe('dismissed');
      });
    });
  });

  // ============================================================================
  // Filter Actions Tests
  // ============================================================================

  describe('Filter Actions', () => {
    describe('setNodeTypeFilter', () => {
      it('should set node type filter', () => {
        act(() => {
          useVoxelStore.getState().setNodeTypeFilter(['asset', 'risk']);
        });

        const state = useVoxelStore.getState();
        expect(state.filters.nodeTypes).toEqual(['asset', 'risk']);
      });
    });

    describe('toggleNodeType', () => {
      it('should add node type if not present', () => {
        act(() => {
          useVoxelStore.getState().setNodeTypeFilter(['asset']);
          useVoxelStore.getState().toggleNodeType('risk');
        });

        const state = useVoxelStore.getState();
        expect(state.filters.nodeTypes).toContain('risk');
      });

      it('should remove node type if present', () => {
        act(() => {
          useVoxelStore.getState().setNodeTypeFilter(['asset', 'risk']);
          useVoxelStore.getState().toggleNodeType('risk');
        });

        const state = useVoxelStore.getState();
        expect(state.filters.nodeTypes).not.toContain('risk');
      });
    });

    describe('setStatusFilter', () => {
      it('should set status filter', () => {
        act(() => {
          useVoxelStore.getState().setStatusFilter(['normal', 'warning']);
        });

        const state = useVoxelStore.getState();
        expect(state.filters.statuses).toEqual(['normal', 'warning']);
      });
    });

    describe('toggleStatus', () => {
      it('should toggle status in filter', () => {
        act(() => {
          useVoxelStore.getState().setStatusFilter(['normal']);
          useVoxelStore.getState().toggleStatus('critical');
        });

        const state = useVoxelStore.getState();
        expect(state.filters.statuses).toContain('critical');
      });
    });

    describe('setDateRangeFilter', () => {
      it('should set date range filter', () => {
        const range = { start: new Date('2024-01-01'), end: new Date('2024-12-31') };

        act(() => {
          useVoxelStore.getState().setDateRangeFilter(range);
        });

        const state = useVoxelStore.getState();
        expect(state.filters.dateRange).toEqual(range);
      });

      it('should clear date range filter', () => {
        act(() => {
          useVoxelStore.getState().setDateRangeFilter({ start: new Date(), end: new Date() });
          useVoxelStore.getState().setDateRangeFilter(undefined);
        });

        const state = useVoxelStore.getState();
        expect(state.filters.dateRange).toBeUndefined();
      });
    });

    describe('setSearchQuery', () => {
      it('should set search query', () => {
        act(() => {
          useVoxelStore.getState().setSearchQuery('test query');
        });

        const state = useVoxelStore.getState();
        expect(state.filters.searchQuery).toBe('test query');
      });
    });

    describe('setShowAnomaliesOnly', () => {
      it('should set show anomalies only filter', () => {
        act(() => {
          useVoxelStore.getState().setShowAnomaliesOnly(true);
        });

        const state = useVoxelStore.getState();
        expect(state.filters.showAnomaliesOnly).toBe(true);
      });
    });

    describe('resetFilters', () => {
      it('should reset all filters to defaults', () => {
        act(() => {
          useVoxelStore.getState().setSearchQuery('test');
          useVoxelStore.getState().setShowAnomaliesOnly(true);
          useVoxelStore.getState().setNodeTypeFilter(['asset']);
          useVoxelStore.getState().resetFilters();
        });

        const state = useVoxelStore.getState();
        expect(state.filters.searchQuery).toBe('');
        expect(state.filters.showAnomaliesOnly).toBe(false);
        expect(state.filters.nodeTypes.length).toBeGreaterThan(1);
      });
    });
  });

  // ============================================================================
  // UI Actions Tests
  // ============================================================================

  describe('UI Actions', () => {
    describe('selectNode', () => {
      it('should set selected node id', () => {
        act(() => {
          useVoxelStore.getState().selectNode('node-1');
        });

        const state = useVoxelStore.getState();
        expect(state.ui.selectedNodeId).toBe('node-1');
      });

      it('should clear selection with null', () => {
        act(() => {
          useVoxelStore.getState().selectNode('node-1');
          useVoxelStore.getState().selectNode(null);
        });

        const state = useVoxelStore.getState();
        expect(state.ui.selectedNodeId).toBeNull();
      });
    });

    describe('hoverNode', () => {
      it('should set hovered node id', () => {
        act(() => {
          useVoxelStore.getState().hoverNode('node-1');
        });

        const state = useVoxelStore.getState();
        expect(state.ui.hoveredNodeId).toBe('node-1');
      });
    });

    describe('setCameraPosition', () => {
      it('should set camera position', () => {
        const position = { x: 10, y: 20, z: 30 };

        act(() => {
          useVoxelStore.getState().setCameraPosition(position);
        });

        const state = useVoxelStore.getState();
        expect(state.ui.cameraPosition).toEqual(position);
      });
    });

    describe('setCameraTarget', () => {
      it('should set camera target', () => {
        const target = { x: 5, y: 5, z: 5 };

        act(() => {
          useVoxelStore.getState().setCameraTarget(target);
        });

        const state = useVoxelStore.getState();
        expect(state.ui.cameraTarget).toEqual(target);
      });
    });

    describe('setZoom', () => {
      it('should set zoom level', () => {
        act(() => {
          useVoxelStore.getState().setZoom(2);
        });

        const state = useVoxelStore.getState();
        expect(state.ui.zoom).toBe(2);
      });
    });

    describe('toggleLabels', () => {
      it('should toggle show labels', () => {
        const initialValue = useVoxelStore.getState().ui.showLabels;

        act(() => {
          useVoxelStore.getState().toggleLabels();
        });

        const state = useVoxelStore.getState();
        expect(state.ui.showLabels).toBe(!initialValue);
      });
    });

    describe('toggleEdges', () => {
      it('should toggle show edges', () => {
        const initialValue = useVoxelStore.getState().ui.showEdges;

        act(() => {
          useVoxelStore.getState().toggleEdges();
        });

        const state = useVoxelStore.getState();
        expect(state.ui.showEdges).toBe(!initialValue);
      });
    });

    describe('setLayoutType', () => {
      it('should set layout type', () => {
        act(() => {
          useVoxelStore.getState().setLayoutType('radial');
        });

        const state = useVoxelStore.getState();
        expect(state.ui.layoutType).toBe('radial');
      });
    });

    describe('resetUI', () => {
      it('should reset UI to defaults', () => {
        act(() => {
          useVoxelStore.getState().selectNode('node-1');
          useVoxelStore.getState().setZoom(3);
          useVoxelStore.getState().toggleLabels();
          useVoxelStore.getState().resetUI();
        });

        const state = useVoxelStore.getState();
        expect(state.ui.selectedNodeId).toBeNull();
        expect(state.ui.zoom).toBe(1);
        expect(state.ui.showLabels).toBe(true);
      });
    });
  });

  // ============================================================================
  // Sync Actions Tests
  // ============================================================================

  describe('Sync Actions', () => {
    describe('setSyncStatus', () => {
      it('should set sync status', () => {
        act(() => {
          useVoxelStore.getState().setSyncStatus('connected');
        });

        const state = useVoxelStore.getState();
        expect(state.sync.status).toBe('connected');
      });
    });

    describe('setLastSyncAt', () => {
      it('should set last sync timestamp', () => {
        const date = new Date();

        act(() => {
          useVoxelStore.getState().setLastSyncAt(date);
        });

        const state = useVoxelStore.getState();
        expect(state.sync.lastSyncAt).toEqual(date);
      });
    });

    describe('incrementPendingChanges', () => {
      it('should increment pending changes', () => {
        act(() => {
          useVoxelStore.getState().incrementPendingChanges();
          useVoxelStore.getState().incrementPendingChanges();
        });

        const state = useVoxelStore.getState();
        expect(state.sync.pendingChanges).toBe(2);
      });
    });

    describe('decrementPendingChanges', () => {
      it('should decrement pending changes', () => {
        act(() => {
          useVoxelStore.getState().incrementPendingChanges();
          useVoxelStore.getState().incrementPendingChanges();
          useVoxelStore.getState().decrementPendingChanges();
        });

        const state = useVoxelStore.getState();
        expect(state.sync.pendingChanges).toBe(1);
      });

      it('should not go below zero', () => {
        act(() => {
          useVoxelStore.getState().decrementPendingChanges();
        });

        const state = useVoxelStore.getState();
        expect(state.sync.pendingChanges).toBe(0);
      });
    });

    describe('resetPendingChanges', () => {
      it('should reset pending changes to zero', () => {
        act(() => {
          useVoxelStore.getState().incrementPendingChanges();
          useVoxelStore.getState().incrementPendingChanges();
          useVoxelStore.getState().resetPendingChanges();
        });

        const state = useVoxelStore.getState();
        expect(state.sync.pendingChanges).toBe(0);
      });
    });
  });

  // ============================================================================
  // Reset Action Tests
  // ============================================================================

  describe('reset', () => {
    it('should reset entire store to initial state', () => {
      act(() => {
        useVoxelStore.getState().addNode(createVoxelNode({ id: 'n1' }));
        useVoxelStore.getState().addEdge(createVoxelEdge('n1', 'n2', { id: 'e1' }));
        useVoxelStore.getState().addAnomaly(createVoxelAnomaly('n1', { id: 'a1' }));
        useVoxelStore.getState().selectNode('n1');
        useVoxelStore.getState().setSearchQuery('test');
        useVoxelStore.getState().reset();
      });

      const state = useVoxelStore.getState();
      expect(state.nodes.size).toBe(0);
      expect(state.edges.size).toBe(0);
      expect(state.anomalies.size).toBe(0);
      expect(state.ui.selectedNodeId).toBeNull();
      expect(state.filters.searchQuery).toBe('');
    });
  });
});
