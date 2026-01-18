/**
 * Unit tests for useNodeAnimation hook
 *
 * Tests for:
 * - Enter/exit animations
 * - Highlight animations
 * - Spring configurations
 * - Animation presets
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createVoxelNode,
  createVoxelNodes,
  resetIdCounter,
} from '@/tests/factories/voxelFactory';

// Mock react-spring
const mockSpringApi = {
  start: vi.fn(),
  stop: vi.fn(),
  set: vi.fn(),
};

const mockSpringValue = {
  scale: 1,
  opacity: 1,
  emissiveIntensity: 0,
  positionY: 0,
};

vi.mock('@react-spring/three', () => ({
  useSpring: vi.fn(() => [mockSpringValue, mockSpringApi]),
  config: {
    default: { tension: 170, friction: 26 },
    gentle: { tension: 120, friction: 14 },
    wobbly: { tension: 180, friction: 12 },
    stiff: { tension: 210, friction: 20 },
    slow: { tension: 280, friction: 60 },
  },
}));

describe('useNodeAnimation', () => {
  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Single Node Animation Tests
  // ============================================================================

  describe('useNodeAnimation', () => {
    it('should initialize with correct spring values', async () => {
      const { useNodeAnimation } = await import('../useNodeAnimation');
      const node = createVoxelNode({ position: { x: 0, y: 5, z: 0 } });

      const { result } = renderHook(() => useNodeAnimation(node));

      expect(result.current.spring).toBeDefined();
    });

    it('should handle null node', async () => {
      const { useNodeAnimation } = await import('../useNodeAnimation');

      const { result } = renderHook(() => useNodeAnimation(null));

      expect(result.current.spring).toBeDefined();
    });

    it('should accept custom config', async () => {
      const { useNodeAnimation } = await import('../useNodeAnimation');
      const node = createVoxelNode();

      const { result } = renderHook(() =>
        useNodeAnimation(node, {
          enterDuration: 500,
          exitDuration: 300,
          tension: 300,
          friction: 30,
        })
      );

      expect(result.current.spring).toBeDefined();
    });

    describe('animateEnter', () => {
      it('should trigger enter animation', async () => {
        const { useNodeAnimation } = await import('../useNodeAnimation');
        const node = createVoxelNode({ position: { x: 0, y: 5, z: 0 } });

        const { result } = renderHook(() => useNodeAnimation(node));

        act(() => {
          result.current.animateEnter();
        });

        expect(mockSpringApi.start).toHaveBeenCalled();
        const startCall = mockSpringApi.start.mock.calls[0][0];
        expect(startCall.from.scale).toBe(0);
        expect(startCall.from.opacity).toBe(0);
        expect(startCall.to.scale).toBe(1);
        expect(startCall.to.opacity).toBe(1);
      });

      it('should animate from below node position', async () => {
        const { useNodeAnimation } = await import('../useNodeAnimation');
        const node = createVoxelNode({ position: { x: 0, y: 10, z: 0 } });

        const { result } = renderHook(() => useNodeAnimation(node));

        act(() => {
          result.current.animateEnter();
        });

        const startCall = mockSpringApi.start.mock.calls[0][0];
        expect(startCall.from.positionY).toBeLessThan(10);
        expect(startCall.to.positionY).toBe(10);
      });
    });

    describe('animateExit', () => {
      it('should trigger exit animation', async () => {
        const { useNodeAnimation } = await import('../useNodeAnimation');
        const node = createVoxelNode();

        const { result } = renderHook(() => useNodeAnimation(node));

        act(() => {
          result.current.animateExit();
        });

        expect(mockSpringApi.start).toHaveBeenCalled();
        const startCall = mockSpringApi.start.mock.calls[0][0];
        expect(startCall.to.scale).toBe(0);
        expect(startCall.to.opacity).toBe(0);
      });

      it('should call onComplete callback when animation finishes', async () => {
        const { useNodeAnimation } = await import('../useNodeAnimation');
        const node = createVoxelNode();
        const onComplete = vi.fn();

        const { result } = renderHook(() => useNodeAnimation(node));

        act(() => {
          result.current.animateExit(onComplete);
        });

        expect(mockSpringApi.start).toHaveBeenCalled();
        const startCall = mockSpringApi.start.mock.calls[0][0];
        expect(startCall.onRest).toBeDefined();
      });
    });

    describe('animateHighlight', () => {
      it('should trigger highlight pulse animation', async () => {
        const { useNodeAnimation } = await import('../useNodeAnimation');
        const node = createVoxelNode();

        const { result } = renderHook(() => useNodeAnimation(node));

        act(() => {
          result.current.animateHighlight();
        });

        expect(mockSpringApi.start).toHaveBeenCalled();
        const startCall = mockSpringApi.start.mock.calls[0][0];
        expect(startCall.from.emissiveIntensity).toBe(0);
      });
    });

    describe('animatePulse', () => {
      it('should trigger scale pulse animation', async () => {
        const { useNodeAnimation } = await import('../useNodeAnimation');
        const node = createVoxelNode();

        const { result } = renderHook(() => useNodeAnimation(node));

        act(() => {
          result.current.animatePulse(0.5);
        });

        expect(mockSpringApi.start).toHaveBeenCalled();
      });

      it('should use default intensity if not provided', async () => {
        const { useNodeAnimation } = await import('../useNodeAnimation');
        const node = createVoxelNode();

        const { result } = renderHook(() => useNodeAnimation(node));

        act(() => {
          result.current.animatePulse();
        });

        expect(mockSpringApi.start).toHaveBeenCalled();
      });
    });

    describe('animatePosition', () => {
      it('should animate to new Y position', async () => {
        const { useNodeAnimation } = await import('../useNodeAnimation');
        const node = createVoxelNode({ position: { x: 0, y: 5, z: 0 } });

        const { result } = renderHook(() => useNodeAnimation(node));

        act(() => {
          result.current.animatePosition(10);
        });

        expect(mockSpringApi.start).toHaveBeenCalled();
        const startCall = mockSpringApi.start.mock.calls[0][0];
        expect(startCall.to.positionY).toBe(10);
      });
    });
  });

  // ============================================================================
  // Multiple Nodes Animation Tests
  // ============================================================================

  describe('useNodesAnimation', () => {
    it('should track animation state for multiple nodes', async () => {
      const { useNodesAnimation } = await import('../useNodeAnimation');
      const nodes = new Map(createVoxelNodes(5).map((n) => [n.id, n]));

      const { result } = renderHook(() => useNodesAnimation(nodes));

      expect(result.current.getAnimationChanges).toBeDefined();
      expect(result.current.getStaggerDelay).toBeDefined();
      expect(result.current.isAnimating).toBeDefined();
    });

    describe('getAnimationChanges', () => {
      it('should detect entering nodes', async () => {
        const { useNodesAnimation } = await import('../useNodeAnimation');

        const { result, rerender } = renderHook(
          ({ nodes }) => useNodesAnimation(nodes),
          { initialProps: { nodes: new Map() } }
        );

        // Add some nodes
        const newNodes = new Map(createVoxelNodes(3).map((n) => [n.id, n]));
        rerender({ nodes: newNodes });

        const changes = result.current.getAnimationChanges();

        expect(changes.entering.length).toBe(3);
        expect(changes.exiting.length).toBe(0);
      });

      it('should detect exiting nodes', async () => {
        const { useNodesAnimation } = await import('../useNodeAnimation');
        const initialNodes = new Map(createVoxelNodes(3).map((n) => [n.id, n]));

        const { result, rerender } = renderHook(
          ({ nodes }) => useNodesAnimation(nodes),
          { initialProps: { nodes: initialNodes } }
        );

        // First call to establish baseline
        result.current.getAnimationChanges();

        // Remove all nodes
        rerender({ nodes: new Map() });

        const changes = result.current.getAnimationChanges();

        expect(changes.exiting.length).toBe(3);
        expect(changes.entering.length).toBe(0);
      });

      it('should detect stable nodes', async () => {
        const { useNodesAnimation } = await import('../useNodeAnimation');
        const nodes = new Map(createVoxelNodes(3).map((n) => [n.id, n]));

        const { result, rerender } = renderHook(
          ({ nodes: ns }) => useNodesAnimation(ns),
          { initialProps: { nodes } }
        );

        // First call to establish baseline
        result.current.getAnimationChanges();

        // Rerender with same nodes
        rerender({ nodes });

        const changes = result.current.getAnimationChanges();

        expect(changes.stable.length).toBe(3);
        expect(changes.entering.length).toBe(0);
        expect(changes.exiting.length).toBe(0);
      });
    });

    describe('getStaggerDelay', () => {
      it('should calculate staggered delay', async () => {
        const { useNodesAnimation } = await import('../useNodeAnimation');
        const nodes = new Map();

        const { result } = renderHook(() => useNodesAnimation(nodes));

        const delay0 = result.current.getStaggerDelay(0, 5);
        const delay2 = result.current.getStaggerDelay(2, 5);
        const delay4 = result.current.getStaggerDelay(4, 5);

        expect(delay0).toBe(0);
        expect(delay2).toBeGreaterThan(delay0);
        expect(delay4).toBeGreaterThan(delay2);
      });

      it('should return 0 for single node', async () => {
        const { useNodesAnimation } = await import('../useNodeAnimation');
        const nodes = new Map();

        const { result } = renderHook(() => useNodesAnimation(nodes));

        const delay = result.current.getStaggerDelay(0, 1);

        expect(delay).toBe(0);
      });
    });

    describe('isAnimating', () => {
      it('should return false for nodes not in animation', async () => {
        const { useNodesAnimation } = await import('../useNodeAnimation');
        const nodes = new Map();

        const { result } = renderHook(() => useNodesAnimation(nodes));

        expect(result.current.isAnimating('non-existent')).toBe(false);
      });
    });

    describe('resetAnimationState', () => {
      it('should reset animation state for a node', async () => {
        const { useNodesAnimation } = await import('../useNodeAnimation');
        const nodes = new Map();

        const { result } = renderHook(() => useNodesAnimation(nodes));

        // Should not throw
        act(() => {
          result.current.resetAnimationState('node-id');
        });
      });
    });
  });

  // ============================================================================
  // Animation Presets Tests
  // ============================================================================

  describe('ANIMATION_PRESETS', () => {
    it('should export realtime preset', async () => {
      const { ANIMATION_PRESETS } = await import('../useNodeAnimation');

      expect(ANIMATION_PRESETS.realtime).toBeDefined();
      expect(ANIMATION_PRESETS.realtime.enterDuration).toBeLessThan(300);
      expect(ANIMATION_PRESETS.realtime.tension).toBeGreaterThan(300);
    });

    it('should export viewTransition preset', async () => {
      const { ANIMATION_PRESETS } = await import('../useNodeAnimation');

      expect(ANIMATION_PRESETS.viewTransition).toBeDefined();
      expect(ANIMATION_PRESETS.viewTransition.enterDuration).toBeGreaterThan(300);
    });

    it('should export playful preset', async () => {
      const { ANIMATION_PRESETS } = await import('../useNodeAnimation');

      expect(ANIMATION_PRESETS.playful).toBeDefined();
      expect(ANIMATION_PRESETS.playful.friction).toBeLessThan(20);
    });

    it('should export subtle preset', async () => {
      const { ANIMATION_PRESETS } = await import('../useNodeAnimation');

      expect(ANIMATION_PRESETS.subtle).toBeDefined();
      expect(ANIMATION_PRESETS.subtle.friction).toBeGreaterThan(30);
    });
  });
});
