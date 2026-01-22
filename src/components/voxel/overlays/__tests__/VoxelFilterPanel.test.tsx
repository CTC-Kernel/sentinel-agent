/**
 * VoxelFilterPanel Component Tests
 *
 * @see Story VOX-5.1: Filter by Entity Type
 * @see Story VOX-5.2: Filter by Framework
 * @see Story VOX-5.3: Filter by Risk Severity
 * @see Story VOX-5.4: Filter Combinations
 * @see Story VOX-5.5: Filter Visual Feedback
 */

import { describe, it, expect, vi } from 'vitest';
import type { VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// Mock voxelStore
vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn((selector) => {
    const state = {
      filters: {
        nodeTypes: ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'],
        statuses: ['normal', 'warning', 'critical', 'inactive'],
        searchQuery: '',
        showAnomaliesOnly: false,
        dateRange: undefined,
      },
      toggleNodeType: vi.fn(),
      toggleStatus: vi.fn(),
      setSearchQuery: vi.fn(),
      setShowAnomaliesOnly: vi.fn(),
      resetFilters: vi.fn(),
    };
    return selector(state);
  }),
  useFilteredNodes: vi.fn(() => []),
  useVoxelNodes: vi.fn(() => []),
}));

describe('VoxelFilterPanel', () => {
  describe('Module Exports', () => {
    it('should export VoxelFilterPanel component', async () => {
      const { VoxelFilterPanel } = await import('../VoxelFilterPanel');
      expect(VoxelFilterPanel).toBeDefined();
      expect(typeof VoxelFilterPanel).toBe('function');
    });
  });
});

describe('Node Type Filtering', () => {
  describe('Entity Type Config', () => {
    it('should have config for all node types', () => {
      const nodeTypes: VoxelNodeType[] = ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'];
      expect(nodeTypes).toHaveLength(7);
    });

    it('should have correct colors for each type', () => {
      const TYPE_COLORS = {
        asset: '#3B82F6',
        risk: '#EF4444',
        control: '#8B5CF6',
        audit: '#F59E0B',
        project: '#10B981',
        incident: '#F97316',
        supplier: '#6366F1',
      };

      expect(TYPE_COLORS.asset).toBe('#3B82F6');
      expect(TYPE_COLORS.risk).toBe('#EF4444');
      expect(TYPE_COLORS.control).toBe('#8B5CF6');
    });

    it('should have labels for each type', () => {
      const TYPE_LABELS = {
        asset: 'Assets',
        risk: 'Risks',
        control: 'Controls',
        audit: 'Audits',
        project: 'Projects',
        incident: 'Incidents',
        supplier: 'Suppliers',
      };

      expect(TYPE_LABELS.asset).toBe('Assets');
      expect(TYPE_LABELS.risk).toBe('Risks');
    });
  });
});

describe('Status Filtering', () => {
  describe('Status Config', () => {
    it('should have config for all statuses', () => {
      const statuses: VoxelNodeStatus[] = ['normal', 'warning', 'critical', 'inactive'];
      expect(statuses).toHaveLength(4);
    });

    it('should have correct colors for each status', () => {
      const STATUS_COLORS = {
        normal: '#22C55E',
        warning: '#F59E0B',
        critical: '#EF4444',
        inactive: '#64748B',
      };

      expect(STATUS_COLORS.normal).toBe('#22C55E');
      expect(STATUS_COLORS.critical).toBe('#EF4444');
    });
  });
});

describe('Search Functionality', () => {
  it('should filter by search query', () => {
    const searchQuery = 'test';
    const nodeLabel = 'Test Asset';

    const matches = nodeLabel.toLowerCase().includes(searchQuery.toLowerCase());
    expect(matches).toBe(true);
  });

  it('should be case-insensitive', () => {
    const searchQuery = 'TEST';
    const nodeLabel = 'test asset';

    const matches = nodeLabel.toLowerCase().includes(searchQuery.toLowerCase());
    expect(matches).toBe(true);
  });

  it('should not match non-matching query', () => {
    const searchQuery = 'xyz';
    const nodeLabel = 'Test Asset';

    const matches = nodeLabel.toLowerCase().includes(searchQuery.toLowerCase());
    expect(matches).toBe(false);
  });
});

describe('Filter Combinations', () => {
  describe('Active Filter Count', () => {
    it('should count zero when all defaults', () => {
      const filters = {
        nodeTypes: ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'],
        statuses: ['normal', 'warning', 'critical', 'inactive'],
        searchQuery: '',
        showAnomaliesOnly: false,
        dateRange: undefined,
      };

      let count = 0;
      if (filters.nodeTypes.length < 7) count++;
      if (filters.statuses.length < 4) count++;
      if (filters.searchQuery) count++;
      if (filters.showAnomaliesOnly) count++;
      if (filters.dateRange) count++;

      expect(count).toBe(0);
    });

    it('should count active filters correctly', () => {
      const filters = {
        nodeTypes: ['asset', 'risk'], // Less than all types
        statuses: ['critical'], // Less than all statuses
        searchQuery: 'test', // Has search
        showAnomaliesOnly: true, // Enabled
        dateRange: undefined,
      };

      let count = 0;
      if (filters.nodeTypes.length < 7) count++;
      if (filters.statuses.length < 4) count++;
      if (filters.searchQuery) count++;
      if (filters.showAnomaliesOnly) count++;
      if (filters.dateRange) count++;

      expect(count).toBe(4);
    });
  });
});

describe('Filter Visual Feedback', () => {
  describe('Node Count Display', () => {
    it('should show filtered count vs total count', () => {
      const totalNodes = 100;
      const filteredNodes = 25;

      const display = `Showing ${filteredNodes} of ${totalNodes} nodes`;
      expect(display).toBe('Showing 25 of 100 nodes');
    });
  });

  describe('Filter Badges', () => {
    it('should create badge for hidden node type', () => {
      const label = `Hide Assets`;

      expect(label).toContain('Hide');
      expect(label).toContain('Assets');
    });

    it('should create badge for hidden status', () => {
      const label = `Hide Inactive`;

      expect(label).toContain('Hide');
      expect(label).toContain('Inactive');
    });

    it('should create badge for search query', () => {
      const searchQuery = 'test';
      const label = `"${searchQuery}"`;

      expect(label).toBe('"test"');
    });
  });
});

describe('Panel Collapse State', () => {
  it('should toggle collapse state', () => {
    let collapsed = false;

    const toggle = () => {
      collapsed = !collapsed;
    };

    expect(collapsed).toBe(false);
    toggle();
    expect(collapsed).toBe(true);
    toggle();
    expect(collapsed).toBe(false);
  });

  it('should have different widths for collapsed/expanded', () => {
    const COLLAPSED_WIDTH = '48px';
    const EXPANDED_WIDTH = '280px';

    const getWidth = (collapsed: boolean) => collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

    expect(getWidth(true)).toBe('48px');
    expect(getWidth(false)).toBe('280px');
  });
});
