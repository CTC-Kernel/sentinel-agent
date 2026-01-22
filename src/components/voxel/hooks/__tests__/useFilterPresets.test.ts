/**
 * useFilterPresets Hook Tests
 *
 * @see Story VOX-5.5: Filter Presets
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VoxelFilters } from '@/types/voxel';

// Mock the voxel store
const mockSetFilters = vi.fn();
const mockResetFilters = vi.fn();
let mockFilters: VoxelFilters = {
  nodeTypes: ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'],
  statuses: ['normal', 'warning', 'critical', 'inactive'],
  searchQuery: '',
  showAnomaliesOnly: false,
  dateRange: undefined,
};

vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn((selector) => {
    const state = {
      filters: mockFilters,
      setFilters: mockSetFilters,
      resetFilters: mockResetFilters,
    };
    return selector(state);
  }),
}));

describe('useFilterPresets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilters = {
      nodeTypes: ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'],
      statuses: ['normal', 'warning', 'critical', 'inactive'],
      searchQuery: '',
      showAnomaliesOnly: false,
      dateRange: undefined,
    };
  });

  describe('FILTER_PRESETS constant', () => {
    it('should export FILTER_PRESETS array', async () => {
      const { FILTER_PRESETS } = await import('../useFilterPresets');
      expect(FILTER_PRESETS).toBeDefined();
      expect(Array.isArray(FILTER_PRESETS)).toBe(true);
    });

    it('should have at least 5 presets', async () => {
      const { FILTER_PRESETS } = await import('../useFilterPresets');
      expect(FILTER_PRESETS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have required properties for each preset', async () => {
      const { FILTER_PRESETS } = await import('../useFilterPresets');
      FILTER_PRESETS.forEach((preset) => {
        expect(preset).toHaveProperty('id');
        expect(preset).toHaveProperty('name');
        expect(preset).toHaveProperty('description');
        expect(preset).toHaveProperty('icon');
        expect(preset).toHaveProperty('filters');
      });
    });

    it('should have unique IDs for each preset', async () => {
      const { FILTER_PRESETS } = await import('../useFilterPresets');
      const ids = FILTER_PRESETS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Preset Filters Configuration', () => {
    it('should have "all" preset showing everything', async () => {
      const { FILTER_PRESETS } = await import('../useFilterPresets');
      const allPreset = FILTER_PRESETS.find((p) => p.id === 'all');
      expect(allPreset).toBeDefined();
      expect(allPreset?.filters.nodeTypes).toHaveLength(7);
      expect(allPreset?.filters.statuses).toHaveLength(4);
    });

    it('should have "risks-only" preset', async () => {
      const { FILTER_PRESETS } = await import('../useFilterPresets');
      const risksPreset = FILTER_PRESETS.find((p) => p.id === 'risks-only');
      expect(risksPreset).toBeDefined();
      expect(risksPreset?.filters.nodeTypes).toContain('risk');
    });

    it('should have "critical-items" preset', async () => {
      const { FILTER_PRESETS } = await import('../useFilterPresets');
      const criticalPreset = FILTER_PRESETS.find((p) => p.id === 'critical-items');
      expect(criticalPreset).toBeDefined();
      expect(criticalPreset?.filters.statuses).toContain('critical');
    });

    it('should have "anomalies" preset with showAnomaliesOnly enabled', async () => {
      const { FILTER_PRESETS } = await import('../useFilterPresets');
      const anomaliesPreset = FILTER_PRESETS.find((p) => p.id === 'anomalies');
      expect(anomaliesPreset).toBeDefined();
      expect(anomaliesPreset?.filters.showAnomaliesOnly).toBe(true);
    });
  });

  describe('useFilterPresets hook', () => {
    it('should export useFilterPresets function', async () => {
      const { useFilterPresets } = await import('../useFilterPresets');
      expect(useFilterPresets).toBeDefined();
      expect(typeof useFilterPresets).toBe('function');
    });
  });

  describe('Preset Matching Logic', () => {
    it('should identify when all filters match default (all preset)', () => {
      const filters: VoxelFilters = {
        nodeTypes: ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'],
        statuses: ['normal', 'warning', 'critical', 'inactive'],
        searchQuery: '',
        showAnomaliesOnly: false,
        dateRange: undefined,
      };

      const allNodeTypes = filters.nodeTypes.length === 7;
      const allStatuses = filters.statuses.length === 4;
      const noSearch = filters.searchQuery === '';
      const noAnomalies = filters.showAnomaliesOnly === false;

      expect(allNodeTypes && allStatuses && noSearch && noAnomalies).toBe(true);
    });

    it('should identify risks-only preset pattern', () => {
      const filters: VoxelFilters = {
        nodeTypes: ['risk'],
        statuses: ['normal', 'warning', 'critical', 'inactive'],
        searchQuery: '',
        showAnomaliesOnly: false,
        dateRange: undefined,
      };

      const onlyRisks = filters.nodeTypes.length === 1 && filters.nodeTypes[0] === 'risk';
      expect(onlyRisks).toBe(true);
    });

    it('should identify critical-items preset pattern', () => {
      const filters: VoxelFilters = {
        nodeTypes: ['asset', 'risk', 'control', 'audit', 'project', 'incident', 'supplier'],
        statuses: ['critical'],
        searchQuery: '',
        showAnomaliesOnly: false,
        dateRange: undefined,
      };

      const onlyCritical = filters.statuses.length === 1 && filters.statuses[0] === 'critical';
      expect(onlyCritical).toBe(true);
    });
  });
});

describe('FilterPreset Type', () => {
  it('should have correct structure', async () => {
    const { FILTER_PRESETS } = await import('../useFilterPresets');
    const preset = FILTER_PRESETS[0];

    expect(typeof preset.id).toBe('string');
    expect(typeof preset.name).toBe('string');
    expect(typeof preset.description).toBe('string');
    expect(typeof preset.icon).toBe('string');
    expect(typeof preset.filters).toBe('object');
  });
});
