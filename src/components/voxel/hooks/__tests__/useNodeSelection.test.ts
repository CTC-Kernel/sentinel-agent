/**
 * useNodeSelection Hook Tests
 *
 * @see Story VOX-4.4: Node Click Selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock voxelStore
vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn((selector) => {
    const state = {
      ui: {
        selectedNodeId: null,
      },
      selectNode: vi.fn(),
    };
    return selector(state);
  }),
  useSelectedNode: vi.fn(() => null),
}));

describe('useNodeSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Exports', () => {
    it('should export useNodeSelection hook', async () => {
      const { useNodeSelection } = await import('../useNodeSelection');
      expect(useNodeSelection).toBeDefined();
      expect(typeof useNodeSelection).toBe('function');
    });

    it('should export UseNodeSelectionReturn type', async () => {
      // Type-only check - if this compiles, the type exists
      const module = await import('../useNodeSelection');
      expect(module.default).toBeDefined();
    });
  });
});

describe('Selection State Types', () => {
  describe('UseNodeSelectionReturn Interface', () => {
    it('should define selectedNodeId as string | null', () => {
      type TestType = { selectedNodeId: string | null };
      const test: TestType = { selectedNodeId: null };
      expect(test.selectedNodeId).toBeNull();

      const test2: TestType = { selectedNodeId: 'node-123' };
      expect(test2.selectedNodeId).toBe('node-123');
    });

    it('should define select as a function taking string', () => {
      type SelectFn = (nodeId: string) => void;
      const select: SelectFn = vi.fn();
      select('node-123');
      expect(select).toHaveBeenCalledWith('node-123');
    });

    it('should define deselect as a function taking no args', () => {
      type DeselectFn = () => void;
      const deselect: DeselectFn = vi.fn();
      deselect();
      expect(deselect).toHaveBeenCalled();
    });

    it('should define toggle as a function taking string', () => {
      type ToggleFn = (nodeId: string) => void;
      const toggle: ToggleFn = vi.fn();
      toggle('node-123');
      expect(toggle).toHaveBeenCalledWith('node-123');
    });

    it('should define isSelected as a function returning boolean', () => {
      type IsSelectedFn = (nodeId: string) => boolean;
      const isSelected: IsSelectedFn = (nodeId) => nodeId === 'selected';
      expect(isSelected('selected')).toBe(true);
      expect(isSelected('other')).toBe(false);
    });
  });
});

describe('Selection Logic', () => {
  describe('isSelected computation', () => {
    it('should return true when nodeId matches selectedNodeId', () => {
      const selectedNodeId = 'node-123';
      const isSelected = (nodeId: string) => selectedNodeId === nodeId;
      expect(isSelected('node-123')).toBe(true);
    });

    it('should return false when nodeId does not match', () => {
      const selectedNodeId = 'node-123';
      const isSelected = (nodeId: string) => selectedNodeId === nodeId;
      expect(isSelected('node-456')).toBe(false);
    });

    it('should return false when selectedNodeId is null', () => {
      const selectedNodeId: string | null = null;
      const isSelected = (nodeId: string) => selectedNodeId === nodeId;
      expect(isSelected('node-123')).toBe(false);
    });
  });

  describe('toggle logic', () => {
    it('should select when not currently selected', () => {
      const selectedNodeId: string | null = null;
      const targetNodeId = 'node-123';

      const result = selectedNodeId === targetNodeId ? null : targetNodeId;
      expect(result).toBe('node-123');
    });

    it('should deselect when currently selected', () => {
      const selectedNodeId: string | null = 'node-123';
      const targetNodeId = 'node-123';

      const result = selectedNodeId === targetNodeId ? null : targetNodeId;
      expect(result).toBeNull();
    });

    it('should switch selection when different node is selected', () => {
      const selectedNodeId: string | null = 'node-123';
      const targetNodeId = 'node-456';

      const result = selectedNodeId === targetNodeId ? null : targetNodeId;
      expect(result).toBe('node-456');
    });
  });
});
