/**
 * NodeStyleResolver Tests
 *
 * @see Story VOX-2.1: Node Component Creation
 */

import { describe, it, expect } from 'vitest';
import type { VoxelNode } from '@/types/voxel';
import {
  resolveNodeStyle,
  getHoverStyle,
  getSelectionStyle,
  getNodeTypeColor,
  getNodeTypeGeometry,
  getRiskColor,
  getSizeFromCriticality,
  getSizeFromSeverity,
  NODE_TYPE_COLORS,
  NODE_TYPE_GEOMETRIES,
  RISK_SEVERITY_COLORS,
  STATUS_COLORS,
  DEFAULT_NODE_STYLE,
} from '../NodeStyleResolver';

// ============================================================================
// Test Data
// ============================================================================

const createMockNode = (overrides: Partial<VoxelNode> = {}): VoxelNode => ({
  id: 'test-node-1',
  type: 'asset',
  label: 'Test Node',
  position: { x: 0, y: 0, z: 0 },
  status: 'normal',
  size: 8,
  data: {},
  connections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ============================================================================
// Color Constants Tests
// ============================================================================

describe('NodeStyleResolver Color Constants', () => {
  describe('NODE_TYPE_COLORS', () => {
    it('should have colors for all node types', () => {
      expect(NODE_TYPE_COLORS.asset).toBe('#3B82F6');
      expect(NODE_TYPE_COLORS.risk).toBe('#EF4444');
      expect(NODE_TYPE_COLORS.control).toBe('#8B5CF6');
      expect(NODE_TYPE_COLORS.incident).toBe('#F97316');
      expect(NODE_TYPE_COLORS.supplier).toBe('#06B6D4');
      expect(NODE_TYPE_COLORS.project).toBe('#10B981');
      expect(NODE_TYPE_COLORS.audit).toBe('#6366F1');
    });
  });

  describe('RISK_SEVERITY_COLORS', () => {
    it('should have daltonism-safe colors for all severity levels', () => {
      expect(RISK_SEVERITY_COLORS.critical).toBe('#EF4444');
      expect(RISK_SEVERITY_COLORS.high).toBe('#F97316');
      expect(RISK_SEVERITY_COLORS.medium).toBe('#EAB308');
      expect(RISK_SEVERITY_COLORS.low).toBe('#22C55E');
    });
  });

  describe('STATUS_COLORS', () => {
    it('should have colors for all status types', () => {
      expect(STATUS_COLORS.normal).toBe('');
      expect(STATUS_COLORS.warning).toBe('#F59E0B');
      expect(STATUS_COLORS.critical).toBe('#EF4444');
      expect(STATUS_COLORS.inactive).toBe('#6B7280');
    });
  });
});

// ============================================================================
// Geometry Constants Tests
// ============================================================================

describe('NodeStyleResolver Geometry Constants', () => {
  describe('NODE_TYPE_GEOMETRIES', () => {
    it('should map node types to distinct geometries', () => {
      expect(NODE_TYPE_GEOMETRIES.asset).toBe('sphere');
      expect(NODE_TYPE_GEOMETRIES.risk).toBe('icosahedron');
      expect(NODE_TYPE_GEOMETRIES.control).toBe('box');
      expect(NODE_TYPE_GEOMETRIES.incident).toBe('octahedron');
      expect(NODE_TYPE_GEOMETRIES.supplier).toBe('cylinder');
      expect(NODE_TYPE_GEOMETRIES.project).toBe('sphere');
      expect(NODE_TYPE_GEOMETRIES.audit).toBe('box');
    });
  });
});

// ============================================================================
// Size Calculation Tests
// ============================================================================

describe('NodeStyleResolver Size Calculations', () => {
  describe('getSizeFromCriticality', () => {
    it('should return minimum size for criticality 1', () => {
      const size = getSizeFromCriticality(1);
      // normalized = 1/5 = 0.2, multiplier = 0.5 + 0.2 * 1.5 = 0.8, size = 8 * 0.8 = 6.4
      expect(size).toBeCloseTo(6.4, 1);
    });

    it('should return maximum size for criticality 5', () => {
      const size = getSizeFromCriticality(5);
      expect(size).toBeCloseTo(16, 1); // BASE_SIZE * MAX_SIZE_MULTIPLIER
    });

    it('should return intermediate size for criticality 3', () => {
      const size = getSizeFromCriticality(3);
      expect(size).toBeGreaterThan(4);
      expect(size).toBeLessThan(16);
    });

    it('should clamp values below 1', () => {
      const size = getSizeFromCriticality(0);
      expect(size).toBeCloseTo(getSizeFromCriticality(1), 1);
    });

    it('should clamp values above 5', () => {
      const size = getSizeFromCriticality(10);
      expect(size).toBeCloseTo(getSizeFromCriticality(5), 1);
    });
  });

  describe('getSizeFromSeverity', () => {
    it('should map low severity to small size', () => {
      const size = getSizeFromSeverity('low');
      expect(size).toBeCloseTo(getSizeFromCriticality(1), 1);
    });

    it('should map medium severity to medium-small size', () => {
      const size = getSizeFromSeverity('medium');
      expect(size).toBeCloseTo(getSizeFromCriticality(2), 1);
    });

    it('should map high severity to medium-large size', () => {
      const size = getSizeFromSeverity('high');
      expect(size).toBeCloseTo(getSizeFromCriticality(3), 1);
    });

    it('should map critical severity to large size', () => {
      const size = getSizeFromSeverity('critical');
      expect(size).toBeCloseTo(getSizeFromCriticality(4), 1);
    });
  });
});

// ============================================================================
// Style Resolution Tests
// ============================================================================

describe('NodeStyleResolver resolveNodeStyle', () => {
  describe('Default Styles', () => {
    it('should export DEFAULT_NODE_STYLE constant', () => {
      expect(DEFAULT_NODE_STYLE).toBeDefined();
      expect(DEFAULT_NODE_STYLE.geometry).toBe('sphere');
      expect(DEFAULT_NODE_STYLE.metalness).toBe(0.3);
      expect(DEFAULT_NODE_STYLE.roughness).toBe(0.7);
    });
  });

  describe('Asset Nodes', () => {
    it('should resolve asset node with blue sphere', () => {
      const node = createMockNode({ type: 'asset' });
      const style = resolveNodeStyle(node);

      expect(style.geometry).toBe('sphere');
      expect(style.color).toBe('#3B82F6');
      expect(style.opacity).toBe(1.0);
    });
  });

  describe('Risk Nodes', () => {
    it('should resolve risk node with icosahedron geometry', () => {
      const node = createMockNode({ type: 'risk' });
      const style = resolveNodeStyle(node);

      expect(style.geometry).toBe('icosahedron');
    });

    it('should use severity color for risks', () => {
      const node = createMockNode({
        type: 'risk',
        data: { severity: 'critical' },
      });
      const style = resolveNodeStyle(node);

      expect(style.color).toBe('#EF4444');
    });

    it('should use high severity color', () => {
      const node = createMockNode({
        type: 'risk',
        data: { severity: 'high' },
      });
      const style = resolveNodeStyle(node);

      expect(style.color).toBe('#F97316');
    });

    it('should use medium severity color', () => {
      const node = createMockNode({
        type: 'risk',
        data: { severity: 'medium' },
      });
      const style = resolveNodeStyle(node);

      expect(style.color).toBe('#EAB308');
    });

    it('should use low severity color', () => {
      const node = createMockNode({
        type: 'risk',
        data: { severity: 'low' },
      });
      const style = resolveNodeStyle(node);

      expect(style.color).toBe('#22C55E');
    });

    it('should size risk by severity', () => {
      const lowRisk = createMockNode({
        type: 'risk',
        data: { severity: 'low' },
      });
      const criticalRisk = createMockNode({
        type: 'risk',
        data: { severity: 'critical' },
      });

      const lowStyle = resolveNodeStyle(lowRisk);
      const criticalStyle = resolveNodeStyle(criticalRisk);

      expect(criticalStyle.size).toBeGreaterThan(lowStyle.size);
    });
  });

  describe('Control Nodes', () => {
    it('should resolve control node with purple box', () => {
      const node = createMockNode({ type: 'control' });
      const style = resolveNodeStyle(node);

      expect(style.geometry).toBe('box');
      expect(style.color).toBe('#8B5CF6');
    });
  });

  describe('Incident Nodes', () => {
    it('should resolve incident node with orange octahedron', () => {
      const node = createMockNode({ type: 'incident' });
      const style = resolveNodeStyle(node);

      expect(style.geometry).toBe('octahedron');
      expect(style.color).toBe('#F97316');
    });
  });

  describe('Supplier Nodes', () => {
    it('should resolve supplier node with cyan cylinder', () => {
      const node = createMockNode({ type: 'supplier' });
      const style = resolveNodeStyle(node);

      expect(style.geometry).toBe('cylinder');
      expect(style.color).toBe('#06B6D4');
    });
  });

  describe('Status Modifications', () => {
    it('should apply reduced opacity for inactive status', () => {
      const node = createMockNode({ status: 'inactive' });
      const style = resolveNodeStyle(node);

      expect(style.opacity).toBe(0.5);
      expect(style.color).toBe('#6B7280');
    });

    it('should apply emissive glow for warning status', () => {
      const node = createMockNode({ status: 'warning' });
      const style = resolveNodeStyle(node);

      expect(style.emissiveIntensity).toBe(0.1);
    });

    it('should apply stronger emissive glow for critical status', () => {
      const node = createMockNode({ status: 'critical' });
      const style = resolveNodeStyle(node);

      expect(style.emissiveIntensity).toBe(0.2);
    });

    it('should have no emissive for normal status', () => {
      const node = createMockNode({ status: 'normal' });
      const style = resolveNodeStyle(node);

      expect(style.emissiveIntensity).toBe(0);
    });
  });

  describe('Size from Node Data', () => {
    it('should use criticality from node data', () => {
      const node = createMockNode({
        data: { criticality: 5 },
      });
      const style = resolveNodeStyle(node);

      expect(style.size).toBeCloseTo(16, 1);
    });

    it('should use node.size as fallback', () => {
      const node = createMockNode({ size: 12 });
      const style = resolveNodeStyle(node);

      expect(style.size).toBe(12);
    });

    it('should use base size when no size info', () => {
      const node = createMockNode();
      const style = resolveNodeStyle(node);

      expect(style.size).toBe(8);
    });
  });

  describe('PBR Material Properties', () => {
    it('should return consistent metalness and roughness', () => {
      const node = createMockNode();
      const style = resolveNodeStyle(node);

      expect(style.metalness).toBe(0.3);
      expect(style.roughness).toBe(0.7);
    });

    it('should set emissive color to match base color', () => {
      const node = createMockNode({ type: 'control' });
      const style = resolveNodeStyle(node);

      expect(style.emissive).toBe(style.color);
    });
  });
});

// ============================================================================
// Hover and Selection Style Tests
// ============================================================================

describe('NodeStyleResolver Interaction Styles', () => {
  describe('getHoverStyle', () => {
    it('should return hover scale multiplier', () => {
      const hover = getHoverStyle();
      expect(hover.scale).toBe(1.05);
    });

    it('should return emissive boost value', () => {
      const hover = getHoverStyle();
      expect(hover.emissiveBoost).toBe(0.1);
    });
  });

  describe('getSelectionStyle', () => {
    it('should return selection scale multiplier', () => {
      const selection = getSelectionStyle();
      expect(selection.scale).toBe(1.1);
    });

    it('should return white outline color', () => {
      const selection = getSelectionStyle();
      expect(selection.outlineColor).toBe('#FFFFFF');
    });

    it('should return outline thickness', () => {
      const selection = getSelectionStyle();
      expect(selection.outlineThickness).toBe(2);
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('NodeStyleResolver Utility Functions', () => {
  describe('getNodeTypeColor', () => {
    it('should return correct color for each type', () => {
      expect(getNodeTypeColor('asset')).toBe('#3B82F6');
      expect(getNodeTypeColor('risk')).toBe('#EF4444');
      expect(getNodeTypeColor('control')).toBe('#8B5CF6');
    });
  });

  describe('getNodeTypeGeometry', () => {
    it('should return correct geometry for each type', () => {
      expect(getNodeTypeGeometry('asset')).toBe('sphere');
      expect(getNodeTypeGeometry('risk')).toBe('icosahedron');
      expect(getNodeTypeGeometry('control')).toBe('box');
    });
  });

  describe('getRiskColor', () => {
    it('should return correct color for each severity', () => {
      expect(getRiskColor('critical')).toBe('#EF4444');
      expect(getRiskColor('high')).toBe('#F97316');
      expect(getRiskColor('medium')).toBe('#EAB308');
      expect(getRiskColor('low')).toBe('#22C55E');
    });
  });
});
