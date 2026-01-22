/**
 * EdgeStyleResolver Tests
 *
 * @see Story VOX-3.1: Edge Component Creation
 * @see Story VOX-3.4: Edge Style Variation
 */

import { describe, it, expect } from 'vitest';
import type { VoxelEdge } from '@/types/voxel';
import {
  resolveEdgeStyle,
  getEdgeHoverStyle,
  getEdgeSelectionStyle,
  getEdgeTypeColor,
  getEdgeTypeHighlightColor,
  getLineWidthFromWeight,
  getOpacityFromWeight,
  edgeConnectsNode,
  getConnectedEdgeStyle,
  EDGE_TYPE_COLORS,
  EDGE_TYPE_HIGHLIGHT_COLORS,
  DEFAULT_EDGE_STYLE,
} from '../EdgeStyleResolver';

// ============================================================================
// Test Data
// ============================================================================

const createMockEdge = (overrides: Partial<VoxelEdge> = {}): VoxelEdge => ({
  id: 'test-edge-1',
  source: 'node-1',
  target: 'node-2',
  type: 'dependency',
  weight: 0.5,
  ...overrides,
});

// ============================================================================
// Color Constants Tests
// ============================================================================

describe('EdgeStyleResolver Color Constants', () => {
  describe('EDGE_TYPE_COLORS', () => {
    it('should have colors for all edge types', () => {
      expect(EDGE_TYPE_COLORS.dependency).toBe('#64748B');
      expect(EDGE_TYPE_COLORS.mitigation).toBe('#8B5CF6');
      expect(EDGE_TYPE_COLORS.assignment).toBe('#3B82F6');
      expect(EDGE_TYPE_COLORS.impact).toBe('#EF4444');
    });
  });

  describe('EDGE_TYPE_HIGHLIGHT_COLORS', () => {
    it('should have highlight colors for all edge types', () => {
      expect(EDGE_TYPE_HIGHLIGHT_COLORS.dependency).toBe('#94A3B8');
      expect(EDGE_TYPE_HIGHLIGHT_COLORS.mitigation).toBe('#A78BFA');
      expect(EDGE_TYPE_HIGHLIGHT_COLORS.assignment).toBe('#60A5FA');
      expect(EDGE_TYPE_HIGHLIGHT_COLORS.impact).toBe('#F87171');
    });

    it('should be lighter than base colors', () => {
      // The highlight colors are intentionally lighter/more saturated
      expect(EDGE_TYPE_HIGHLIGHT_COLORS.dependency).not.toBe(EDGE_TYPE_COLORS.dependency);
    });
  });
});

// ============================================================================
// Line Width Calculations Tests
// ============================================================================

describe('EdgeStyleResolver Line Width Calculations', () => {
  describe('getLineWidthFromWeight', () => {
    it('should return base width for weight 0', () => {
      const width = getLineWidthFromWeight(0);
      expect(width).toBeCloseTo(1, 1);
    });

    it('should return max width for weight 1', () => {
      const width = getLineWidthFromWeight(1);
      expect(width).toBeCloseTo(4, 1);
    });

    it('should return intermediate width for weight 0.5', () => {
      const width = getLineWidthFromWeight(0.5);
      expect(width).toBeGreaterThan(1);
      expect(width).toBeLessThan(4);
    });

    it('should clamp values below 0', () => {
      const width = getLineWidthFromWeight(-0.5);
      expect(width).toBeCloseTo(getLineWidthFromWeight(0), 1);
    });

    it('should clamp values above 1', () => {
      const width = getLineWidthFromWeight(1.5);
      expect(width).toBeCloseTo(getLineWidthFromWeight(1), 1);
    });
  });
});

// ============================================================================
// Opacity Calculations Tests
// ============================================================================

describe('EdgeStyleResolver Opacity Calculations', () => {
  describe('getOpacityFromWeight', () => {
    it('should return min opacity for weight 0', () => {
      const opacity = getOpacityFromWeight(0);
      expect(opacity).toBeCloseTo(0.2, 1);
    });

    it('should return max opacity for weight 1', () => {
      const opacity = getOpacityFromWeight(1);
      expect(opacity).toBeCloseTo(0.8, 1);
    });

    it('should return intermediate opacity for weight 0.5', () => {
      const opacity = getOpacityFromWeight(0.5);
      expect(opacity).toBeGreaterThan(0.2);
      expect(opacity).toBeLessThan(0.8);
    });
  });
});

// ============================================================================
// Style Resolution Tests
// ============================================================================

describe('EdgeStyleResolver resolveEdgeStyle', () => {
  describe('Default Style', () => {
    it('should export DEFAULT_EDGE_STYLE constant', () => {
      expect(DEFAULT_EDGE_STYLE).toBeDefined();
      expect(DEFAULT_EDGE_STYLE.color).toBe('#64748B');
      expect(DEFAULT_EDGE_STYLE.lineWidth).toBe(1);
      expect(DEFAULT_EDGE_STYLE.dashed).toBe(false);
    });
  });

  describe('Dependency Edges', () => {
    it('should resolve dependency edge with gray color', () => {
      const edge = createMockEdge({ type: 'dependency' });
      const style = resolveEdgeStyle(edge);

      expect(style.color).toBe('#64748B');
    });

    it('should make weak dependency edges dashed', () => {
      const edge = createMockEdge({ type: 'dependency', weight: 0.3 });
      const style = resolveEdgeStyle(edge);

      expect(style.dashed).toBe(true);
      expect(style.dashScale).toBeDefined();
    });

    it('should not dash strong dependency edges', () => {
      const edge = createMockEdge({ type: 'dependency', weight: 0.7 });
      const style = resolveEdgeStyle(edge);

      expect(style.dashed).toBe(false);
    });
  });

  describe('Impact Edges (Risk-Asset)', () => {
    it('should resolve impact edge with red color', () => {
      const edge = createMockEdge({ type: 'impact' });
      const style = resolveEdgeStyle(edge);

      expect(style.color).toBe('#EF4444');
    });

    it('should not dash impact edges', () => {
      const edge = createMockEdge({ type: 'impact', weight: 0.2 });
      const style = resolveEdgeStyle(edge);

      expect(style.dashed).toBe(false);
    });
  });

  describe('Mitigation Edges (Control-Asset)', () => {
    it('should resolve mitigation edge with purple color', () => {
      const edge = createMockEdge({ type: 'mitigation' });
      const style = resolveEdgeStyle(edge);

      expect(style.color).toBe('#8B5CF6');
    });
  });

  describe('Assignment Edges', () => {
    it('should resolve assignment edge with blue color', () => {
      const edge = createMockEdge({ type: 'assignment' });
      const style = resolveEdgeStyle(edge);

      expect(style.color).toBe('#3B82F6');
    });
  });

  describe('Weight-based Styling', () => {
    it('should increase line width with weight', () => {
      const weakEdge = createMockEdge({ weight: 0.2 });
      const strongEdge = createMockEdge({ weight: 0.9 });

      const weakStyle = resolveEdgeStyle(weakEdge);
      const strongStyle = resolveEdgeStyle(strongEdge);

      expect(strongStyle.lineWidth).toBeGreaterThan(weakStyle.lineWidth);
    });

    it('should increase opacity with weight', () => {
      const weakEdge = createMockEdge({ weight: 0.2 });
      const strongEdge = createMockEdge({ weight: 0.9 });

      const weakStyle = resolveEdgeStyle(weakEdge);
      const strongStyle = resolveEdgeStyle(strongEdge);

      expect(strongStyle.opacity).toBeGreaterThan(weakStyle.opacity);
    });
  });
});

// ============================================================================
// Hover and Selection Style Tests
// ============================================================================

describe('EdgeStyleResolver Interaction Styles', () => {
  describe('getEdgeHoverStyle', () => {
    it('should return opacity boost value', () => {
      const hover = getEdgeHoverStyle();
      expect(hover.opacityBoost).toBe(0.3);
    });

    it('should return line width multiplier', () => {
      const hover = getEdgeHoverStyle();
      expect(hover.lineWidthMultiplier).toBe(1.5);
    });
  });

  describe('getEdgeSelectionStyle', () => {
    it('should return high opacity', () => {
      const selection = getEdgeSelectionStyle();
      expect(selection.opacity).toBe(0.9);
    });

    it('should return line width multiplier', () => {
      const selection = getEdgeSelectionStyle();
      expect(selection.lineWidthMultiplier).toBe(2);
    });

    it('should return white glow color', () => {
      const selection = getEdgeSelectionStyle();
      expect(selection.glowColor).toBe('#FFFFFF');
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('EdgeStyleResolver Utility Functions', () => {
  describe('getEdgeTypeColor', () => {
    it('should return correct color for each type', () => {
      expect(getEdgeTypeColor('dependency')).toBe('#64748B');
      expect(getEdgeTypeColor('mitigation')).toBe('#8B5CF6');
      expect(getEdgeTypeColor('assignment')).toBe('#3B82F6');
      expect(getEdgeTypeColor('impact')).toBe('#EF4444');
    });
  });

  describe('getEdgeTypeHighlightColor', () => {
    it('should return correct highlight color for each type', () => {
      expect(getEdgeTypeHighlightColor('dependency')).toBe('#94A3B8');
      expect(getEdgeTypeHighlightColor('mitigation')).toBe('#A78BFA');
      expect(getEdgeTypeHighlightColor('assignment')).toBe('#60A5FA');
      expect(getEdgeTypeHighlightColor('impact')).toBe('#F87171');
    });
  });

  describe('edgeConnectsNode', () => {
    it('should return true when edge source matches node', () => {
      const edge = createMockEdge({ source: 'node-1', target: 'node-2' });
      expect(edgeConnectsNode(edge, 'node-1')).toBe(true);
    });

    it('should return true when edge target matches node', () => {
      const edge = createMockEdge({ source: 'node-1', target: 'node-2' });
      expect(edgeConnectsNode(edge, 'node-2')).toBe(true);
    });

    it('should return false when node is not connected', () => {
      const edge = createMockEdge({ source: 'node-1', target: 'node-2' });
      expect(edgeConnectsNode(edge, 'node-3')).toBe(false);
    });
  });

  describe('getConnectedEdgeStyle', () => {
    it('should use highlight color', () => {
      const edge = createMockEdge({ type: 'impact' });
      const style = getConnectedEdgeStyle(edge);

      expect(style.color).toBe('#F87171'); // Highlight color
    });

    it('should boost opacity', () => {
      const edge = createMockEdge({ weight: 0.5 });
      const baseStyle = resolveEdgeStyle(edge);
      const connectedStyle = getConnectedEdgeStyle(edge);

      expect(connectedStyle.opacity).toBeGreaterThan(baseStyle.opacity);
    });

    it('should increase line width', () => {
      const edge = createMockEdge({ weight: 0.5 });
      const baseStyle = resolveEdgeStyle(edge);
      const connectedStyle = getConnectedEdgeStyle(edge);

      expect(connectedStyle.lineWidth).toBeGreaterThan(baseStyle.lineWidth);
    });
  });
});
