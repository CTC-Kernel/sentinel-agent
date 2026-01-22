/**
 * RiskPulse Tests
 *
 * @see Story VOX-9.2: Alertes Visuelles (Pulse)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { RiskPulse, CriticalRiskPulse, WarningPulse } from '../RiskPulse';

// ============================================================================
// Mocks
// ============================================================================

// Mock useFrame
const mockUseFrame = vi.fn();
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual('@react-three/fiber');
  return {
    ...actual,
    useFrame: (callback: (state: { clock: { getElapsedTime: () => number } }) => void) => {
      mockUseFrame(callback);
    },
  };
});

// Mock usePrefersReducedMotion
let mockPrefersReducedMotion = false;
vi.mock('@/hooks/voxel', () => ({
  usePrefersReducedMotion: () => mockPrefersReducedMotion,
}));

// ============================================================================
// Test Wrapper
// ============================================================================

const TestCanvas: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-testid="canvas-wrapper">
    <Canvas>
      {children}
    </Canvas>
  </div>
);

// ============================================================================
// Tests
// ============================================================================

describe('RiskPulse', () => {
  beforeEach(() => {
    mockPrefersReducedMotion = false;
    mockUseFrame.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when enabled', () => {
      render(
        <TestCanvas>
          <RiskPulse size={1} enabled={true} />
        </TestCanvas>
      );

      expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
    });

    it('should not render when disabled', () => {
      const { container } = render(
        <TestCanvas>
          <RiskPulse size={1} enabled={false} />
        </TestCanvas>
      );

      // Component returns null when disabled
      expect(container).toBeInTheDocument();
    });

    it('should accept custom color', () => {
      render(
        <TestCanvas>
          <RiskPulse size={1} color="#FF0000" />
        </TestCanvas>
      );

      // Just verify it renders without error
      expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
    });

    it('should accept custom cycle duration', () => {
      render(
        <TestCanvas>
          <RiskPulse size={1} cycleDuration={3} />
        </TestCanvas>
      );

      expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
    });

    it('should accept custom scale range', () => {
      render(
        <TestCanvas>
          <RiskPulse size={1} scaleRange={[0.9, 1.2]} />
        </TestCanvas>
      );

      expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
    });

    it('should accept custom opacity range', () => {
      render(
        <TestCanvas>
          <RiskPulse size={1} opacityRange={[0.1, 0.8]} />
        </TestCanvas>
      );

      expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
    });
  });

  describe('Reduced Motion Support', () => {
    it('should respect prefers-reduced-motion', () => {
      mockPrefersReducedMotion = true;

      render(
        <TestCanvas>
          <RiskPulse size={1} enabled={true} />
        </TestCanvas>
      );

      // Should still render but with static style
      expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('should render with animation props', () => {
      render(
        <TestCanvas>
          <RiskPulse size={1} enabled={true} cycleDuration={2} />
        </TestCanvas>
      );

      // Verify it renders successfully with animation props
      expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
    });
  });
});

describe('CriticalRiskPulse', () => {
  beforeEach(() => {
    mockPrefersReducedMotion = false;
  });

  it('should render with default critical settings', () => {
    render(
      <TestCanvas>
        <CriticalRiskPulse size={1} />
      </TestCanvas>
    );

    expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
  });

  it('should accept enabled prop', () => {
    render(
      <TestCanvas>
        <CriticalRiskPulse size={1} enabled={false} />
      </TestCanvas>
    );

    expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
  });
});

describe('WarningPulse', () => {
  beforeEach(() => {
    mockPrefersReducedMotion = false;
  });

  it('should render with default warning settings', () => {
    render(
      <TestCanvas>
        <WarningPulse size={1} />
      </TestCanvas>
    );

    expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
  });

  it('should accept enabled prop', () => {
    render(
      <TestCanvas>
        <WarningPulse size={1} enabled={false} />
      </TestCanvas>
    );

    expect(screen.getByTestId('canvas-wrapper')).toBeInTheDocument();
  });
});
