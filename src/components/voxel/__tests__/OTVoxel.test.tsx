/**
 * Story 36-3: IT/OT Voxel Mapping - Unit Tests
 *
 * Tests for OT-specific Voxel components and utilities:
 * - Segment zone calculations
 * - Connection type detection
 * - Filter state management
 * - Node styling constants
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { VoxelNode, VoxelEdge } from '../../../types/voxel';

// Import utilities and hooks
import { SEGMENT_COLORS, CRITICALITY_SIZES, CRITICALITY_GLOW } from '../OTNodeMesh';
import { calculateSegmentZones, applySegmentLayout } from '../SegmentZones';
import { getConnectionType, isCrossSegmentConnection } from '../ITOTEdge';
import { useSegmentFilter } from '../SegmentFilter';

// ============================================================================
// Mock Data Factories
// ============================================================================

const createMockNode = (
  overrides: Partial<VoxelNode> = {}
): VoxelNode => ({
  id: `node-${Math.random().toString(36).substr(2, 9)}`,
  type: 'asset',
  label: 'Test Node',
  status: 'normal',
  position: { x: 0, y: 0, z: 0 },
  size: 1,
  data: {},
  connections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockEdge = (
  overrides: Partial<VoxelEdge> = {}
): VoxelEdge => ({
  id: `edge-${Math.random().toString(36).substr(2, 9)}`,
  source: 'node-1',
  target: 'node-2',
  type: 'dependency',
  weight: 1,
  ...overrides,
});

// ============================================================================
// OTNodeMesh Constants Tests
// ============================================================================

describe('OTNodeMesh Constants', () => {
  describe('SEGMENT_COLORS', () => {
    it('should have colors for all network segments', () => {
      expect(SEGMENT_COLORS.IT).toBeDefined();
      expect(SEGMENT_COLORS.OT).toBeDefined();
      expect(SEGMENT_COLORS.DMZ).toBeDefined();
    });

    it('should have valid hex color format', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      expect(SEGMENT_COLORS.IT).toMatch(hexPattern);
      expect(SEGMENT_COLORS.OT).toMatch(hexPattern);
      expect(SEGMENT_COLORS.DMZ).toMatch(hexPattern);
    });

    it('should have distinct colors for each segment', () => {
      expect(SEGMENT_COLORS.IT).not.toBe(SEGMENT_COLORS.OT);
      expect(SEGMENT_COLORS.IT).not.toBe(SEGMENT_COLORS.DMZ);
      expect(SEGMENT_COLORS.OT).not.toBe(SEGMENT_COLORS.DMZ);
    });
  });

  describe('CRITICALITY_SIZES', () => {
    it('should have sizes for all criticality levels', () => {
      expect(CRITICALITY_SIZES.safety).toBeDefined();
      expect(CRITICALITY_SIZES.production).toBeDefined();
      expect(CRITICALITY_SIZES.operations).toBeDefined();
      expect(CRITICALITY_SIZES.monitoring).toBeDefined();
    });

    it('should have safety as largest size', () => {
      expect(CRITICALITY_SIZES.safety).toBeGreaterThan(CRITICALITY_SIZES.production);
      expect(CRITICALITY_SIZES.production).toBeGreaterThan(CRITICALITY_SIZES.operations);
      expect(CRITICALITY_SIZES.operations).toBeGreaterThan(CRITICALITY_SIZES.monitoring);
    });

    it('should have all sizes greater than 0', () => {
      Object.values(CRITICALITY_SIZES).forEach((size) => {
        expect(size).toBeGreaterThan(0);
      });
    });
  });

  describe('CRITICALITY_GLOW', () => {
    it('should have glow intensities for all criticality levels', () => {
      expect(CRITICALITY_GLOW.safety).toBeDefined();
      expect(CRITICALITY_GLOW.production).toBeDefined();
      expect(CRITICALITY_GLOW.operations).toBeDefined();
      expect(CRITICALITY_GLOW.monitoring).toBeDefined();
    });

    it('should have safety as highest glow intensity', () => {
      expect(CRITICALITY_GLOW.safety).toBeGreaterThan(CRITICALITY_GLOW.production);
      expect(CRITICALITY_GLOW.production).toBeGreaterThan(CRITICALITY_GLOW.operations);
    });
  });
});

// ============================================================================
// SegmentZones Utility Tests
// ============================================================================

describe('SegmentZones Utilities', () => {
  describe('calculateSegmentZones', () => {
    it('should return zones for all three segments', () => {
      const nodes = [
        createMockNode({ networkSegment: 'IT', position: { x: -10, y: 0, z: 0 } }),
        createMockNode({ networkSegment: 'OT', position: { x: 10, y: 0, z: 0 } }),
        createMockNode({ networkSegment: 'DMZ', position: { x: 0, y: 0, z: 0 } }),
      ];

      const zones = calculateSegmentZones(nodes);

      expect(zones).toHaveLength(3);
      expect(zones.find((z) => z.segment === 'IT')).toBeDefined();
      expect(zones.find((z) => z.segment === 'OT')).toBeDefined();
      expect(zones.find((z) => z.segment === 'DMZ')).toBeDefined();
    });

    it('should calculate correct node counts', () => {
      const nodes = [
        createMockNode({ networkSegment: 'IT' }),
        createMockNode({ networkSegment: 'IT' }),
        createMockNode({ networkSegment: 'IT' }),
        createMockNode({ networkSegment: 'OT' }),
        createMockNode({ networkSegment: 'OT' }),
      ];

      const zones = calculateSegmentZones(nodes);

      const itZone = zones.find((z) => z.segment === 'IT');
      const otZone = zones.find((z) => z.segment === 'OT');
      const dmzZone = zones.find((z) => z.segment === 'DMZ');

      expect(itZone?.nodeCount).toBe(3);
      expect(otZone?.nodeCount).toBe(2);
      expect(dmzZone?.nodeCount).toBe(0);
    });

    it('should mark empty segments as not visible', () => {
      const nodes = [
        createMockNode({ networkSegment: 'IT' }),
      ];

      const zones = calculateSegmentZones(nodes);

      const itZone = zones.find((z) => z.segment === 'IT');
      const otZone = zones.find((z) => z.segment === 'OT');

      expect(itZone?.visible).toBe(true);
      expect(otZone?.visible).toBe(false);
    });

    it('should calculate zone position as center of nodes', () => {
      const nodes = [
        createMockNode({ networkSegment: 'IT', position: { x: 0, y: 0, z: 0 } }),
        createMockNode({ networkSegment: 'IT', position: { x: 10, y: 0, z: 0 } }),
      ];

      const zones = calculateSegmentZones(nodes);
      const itZone = zones.find((z) => z.segment === 'IT');

      // Center should be at x=5
      expect(itZone?.position.x).toBe(5);
    });

    it('should add padding to zone size', () => {
      const nodes = [
        createMockNode({ networkSegment: 'OT', position: { x: 0, y: 0, z: 0 } }),
        createMockNode({ networkSegment: 'OT', position: { x: 10, y: 0, z: 10 } }),
      ];

      const padding = 5;
      const zones = calculateSegmentZones(nodes, padding);
      const otZone = zones.find((z) => z.segment === 'OT');

      // Width should be 10 (spread) + 10 (2*padding) = 20
      expect(otZone?.size.width).toBe(20);
    });
  });

  describe('applySegmentLayout', () => {
    it('should offset IT nodes to the left', () => {
      const nodes = [
        createMockNode({ id: 'it-1', networkSegment: 'IT', position: { x: 0, y: 0, z: 0 } }),
      ];

      const result = applySegmentLayout(nodes, 30);

      expect(result[0].position.x).toBe(-30);
    });

    it('should offset OT nodes to the right', () => {
      const nodes = [
        createMockNode({ id: 'ot-1', networkSegment: 'OT', position: { x: 0, y: 0, z: 0 } }),
      ];

      const result = applySegmentLayout(nodes, 30);

      expect(result[0].position.x).toBe(30);
    });

    it('should keep DMZ nodes centered', () => {
      const nodes = [
        createMockNode({ id: 'dmz-1', networkSegment: 'DMZ', position: { x: 0, y: 0, z: 0 } }),
      ];

      const result = applySegmentLayout(nodes, 30);

      expect(result[0].position.x).toBe(0);
    });

    it('should preserve y and z positions', () => {
      const nodes = [
        createMockNode({
          id: 'it-1',
          networkSegment: 'IT',
          position: { x: 5, y: 10, z: 15 }
        }),
      ];

      const result = applySegmentLayout(nodes, 30);

      expect(result[0].position.y).toBe(10);
      expect(result[0].position.z).toBe(15);
    });
  });
});

// ============================================================================
// ITOTEdge Utility Tests
// ============================================================================

describe('ITOTEdge Utilities', () => {
  describe('getConnectionType', () => {
    it('should return it-to-ot for IT to OT connection', () => {
      expect(getConnectionType('IT', 'OT')).toBe('it-to-ot');
    });

    it('should return ot-to-it for OT to IT connection', () => {
      expect(getConnectionType('OT', 'IT')).toBe('ot-to-it');
    });

    it('should return it-to-dmz for IT to DMZ connection', () => {
      expect(getConnectionType('IT', 'DMZ')).toBe('it-to-dmz');
    });

    it('should return dmz-to-ot for DMZ to OT connection', () => {
      expect(getConnectionType('DMZ', 'OT')).toBe('dmz-to-ot');
    });

    it('should return same-segment for same segment connections', () => {
      expect(getConnectionType('IT', 'IT')).toBe('same-segment');
      expect(getConnectionType('OT', 'OT')).toBe('same-segment');
      expect(getConnectionType('DMZ', 'DMZ')).toBe('same-segment');
    });
  });

  describe('isCrossSegmentConnection', () => {
    it('should return true for different segments', () => {
      expect(isCrossSegmentConnection('IT', 'OT')).toBe(true);
      expect(isCrossSegmentConnection('OT', 'DMZ')).toBe(true);
      expect(isCrossSegmentConnection('IT', 'DMZ')).toBe(true);
    });

    it('should return false for same segment', () => {
      expect(isCrossSegmentConnection('IT', 'IT')).toBe(false);
      expect(isCrossSegmentConnection('OT', 'OT')).toBe(false);
      expect(isCrossSegmentConnection('DMZ', 'DMZ')).toBe(false);
    });

    it('should return false for undefined segments', () => {
      expect(isCrossSegmentConnection(undefined, 'OT')).toBe(false);
      expect(isCrossSegmentConnection('IT', undefined)).toBe(false);
      expect(isCrossSegmentConnection(undefined, undefined)).toBe(false);
    });
  });
});

// ============================================================================
// useSegmentFilter Hook Tests
// ============================================================================

describe('useSegmentFilter Hook', () => {
  it('should initialize with default visibility (all visible)', () => {
    const { result } = renderHook(() => useSegmentFilter());

    expect(result.current.visibility.IT).toBe(true);
    expect(result.current.visibility.OT).toBe(true);
    expect(result.current.visibility.DMZ).toBe(true);
  });

  it('should initialize with custom visibility', () => {
    const { result } = renderHook(() =>
      useSegmentFilter({
        initialVisibility: { IT: true, OT: false, DMZ: true },
      })
    );

    expect(result.current.visibility.IT).toBe(true);
    expect(result.current.visibility.OT).toBe(false);
    expect(result.current.visibility.DMZ).toBe(true);
  });

  it('should toggle individual segments', () => {
    const { result } = renderHook(() => useSegmentFilter());

    act(() => {
      result.current.toggleSegment('OT');
    });

    expect(result.current.visibility.OT).toBe(false);
    expect(result.current.visibility.IT).toBe(true);

    act(() => {
      result.current.toggleSegment('OT');
    });

    expect(result.current.visibility.OT).toBe(true);
  });

  it('should show all segments', () => {
    const { result } = renderHook(() =>
      useSegmentFilter({
        initialVisibility: { IT: false, OT: false, DMZ: false },
      })
    );

    act(() => {
      result.current.showAll();
    });

    expect(result.current.visibility.IT).toBe(true);
    expect(result.current.visibility.OT).toBe(true);
    expect(result.current.visibility.DMZ).toBe(true);
  });

  it('should hide all segments', () => {
    const { result } = renderHook(() => useSegmentFilter());

    act(() => {
      result.current.hideAll();
    });

    expect(result.current.visibility.IT).toBe(false);
    expect(result.current.visibility.OT).toBe(false);
    expect(result.current.visibility.DMZ).toBe(false);
  });

  it('should apply OT-only preset', () => {
    const { result } = renderHook(() => useSegmentFilter());

    act(() => {
      result.current.applyPreset('ot-only');
    });

    expect(result.current.visibility.IT).toBe(false);
    expect(result.current.visibility.OT).toBe(true);
    expect(result.current.visibility.DMZ).toBe(false);
  });

  it('should apply IT-only preset', () => {
    const { result } = renderHook(() => useSegmentFilter());

    act(() => {
      result.current.applyPreset('it-only');
    });

    expect(result.current.visibility.IT).toBe(true);
    expect(result.current.visibility.OT).toBe(false);
    expect(result.current.visibility.DMZ).toBe(false);
  });

  it('should apply all preset', () => {
    const { result } = renderHook(() =>
      useSegmentFilter({
        initialVisibility: { IT: false, OT: false, DMZ: false },
      })
    );

    act(() => {
      result.current.applyPreset('all');
    });

    expect(result.current.visibility.IT).toBe(true);
    expect(result.current.visibility.OT).toBe(true);
    expect(result.current.visibility.DMZ).toBe(true);
  });

  it('should enable cross-segment mode for boundary preset', () => {
    const { result } = renderHook(() => useSegmentFilter());

    expect(result.current.showCrossSegmentOnly).toBe(false);

    act(() => {
      result.current.applyPreset('it-ot-boundary');
    });

    expect(result.current.showCrossSegmentOnly).toBe(true);
  });

  it('should check segment visibility correctly', () => {
    const { result } = renderHook(() =>
      useSegmentFilter({
        initialVisibility: { IT: true, OT: false, DMZ: true },
      })
    );

    expect(result.current.isSegmentVisible('IT')).toBe(true);
    expect(result.current.isSegmentVisible('OT')).toBe(false);
    expect(result.current.isSegmentVisible('DMZ')).toBe(true);
    expect(result.current.isSegmentVisible(undefined)).toBe(true);
  });

  it('should call onChange callback', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useSegmentFilter({ onChange }));

    act(() => {
      result.current.toggleSegment('OT');
    });

    expect(onChange).toHaveBeenCalledWith({
      IT: true,
      OT: false,
      DMZ: true,
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('IT/OT Voxel Integration', () => {
  it('should correctly classify mixed segment nodes', () => {
    const nodes = [
      createMockNode({ id: 'it-1', networkSegment: 'IT', position: { x: -20, y: 0, z: 0 } }),
      createMockNode({ id: 'it-2', networkSegment: 'IT', position: { x: -15, y: 5, z: 0 } }),
      createMockNode({ id: 'dmz-1', networkSegment: 'DMZ', position: { x: 0, y: 0, z: 0 } }),
      createMockNode({ id: 'ot-1', networkSegment: 'OT', position: { x: 20, y: 0, z: 0 } }),
      createMockNode({ id: 'ot-2', networkSegment: 'OT', position: { x: 25, y: 5, z: 0 } }),
      createMockNode({ id: 'ot-3', networkSegment: 'OT', position: { x: 22, y: 2, z: 0 } }),
    ];

    const zones = calculateSegmentZones(nodes);

    // Verify zone counts
    expect(zones.find((z) => z.segment === 'IT')?.nodeCount).toBe(2);
    expect(zones.find((z) => z.segment === 'DMZ')?.nodeCount).toBe(1);
    expect(zones.find((z) => z.segment === 'OT')?.nodeCount).toBe(3);

    // Verify all zones are visible
    zones.forEach((zone) => {
      expect(zone.visible).toBe(true);
    });
  });

  it('should create proper cross-segment edge relationships', () => {
    const itNode = createMockNode({ id: 'it-server', networkSegment: 'IT' });
    const dmzNode = createMockNode({ id: 'dmz-firewall', networkSegment: 'DMZ' });
    const otNode = createMockNode({ id: 'ot-plc', networkSegment: 'OT' });

    // IT -> DMZ -> OT path
    const _edge1 = createMockEdge({
      id: 'edge-it-dmz',
      source: itNode.id,
      target: dmzNode.id,
      type: 'dependency'
    });
    const _edge2 = createMockEdge({
      id: 'edge-dmz-ot',
      source: dmzNode.id,
      target: otNode.id,
      type: 'dependency'
    });

    // Verify cross-segment detection
    expect(isCrossSegmentConnection(
      itNode.networkSegment,
      dmzNode.networkSegment
    )).toBe(true);
    expect(isCrossSegmentConnection(
      dmzNode.networkSegment,
      otNode.networkSegment
    )).toBe(true);

    // Verify connection types
    expect(getConnectionType('IT', 'DMZ')).toBe('it-to-dmz');
    expect(getConnectionType('DMZ', 'OT')).toBe('dmz-to-ot');
  });

  it('should respect filter state for segment visibility', () => {
    const { result } = renderHook(() => useSegmentFilter());

    const nodes = [
      createMockNode({ networkSegment: 'IT' }),
      createMockNode({ networkSegment: 'OT' }),
      createMockNode({ networkSegment: 'DMZ' }),
    ];

    // Initially all visible
    nodes.forEach((node) => {
      expect(result.current.isSegmentVisible(node.networkSegment)).toBe(true);
    });

    // Apply OT-only filter
    act(() => {
      result.current.applyPreset('ot-only');
    });

    expect(result.current.isSegmentVisible('IT')).toBe(false);
    expect(result.current.isSegmentVisible('OT')).toBe(true);
    expect(result.current.isSegmentVisible('DMZ')).toBe(false);
  });
});
