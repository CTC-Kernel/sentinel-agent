/**
 * Unit tests for VoxelFallback2D component
 *
 * @see Story VOX-1.4: WebGL Capability Detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoxelFallback2D } from '../fallback/VoxelFallback2D';

// Mock store
vi.mock('@/store', () => ({
  useStore: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'voxel.fallback.ariaLabel': 'Alternative visualization view',
        'voxel.fallback.mobileTitle': 'Mobile Device Detected',
        'voxel.fallback.mobileDescription': '3D visualization is optimized for desktop.',
        'voxel.fallback.mobileHint': 'For full 3D experience, use a desktop.',
        'voxel.fallback.noWebGLTitle': 'WebGL Not Supported',
        'voxel.fallback.noWebGLDescription': 'Your browser doesn\'t support WebGL.',
        'voxel.fallback.degradedTitle': 'Reduced WebGL Mode',
        'voxel.fallback.degradedDescription': 'Your browser only supports WebGL 1.0.',
        'voxel.fallback.errorTitle': 'Visualization Error',
        'voxel.fallback.errorDescription': 'An error occurred while loading.',
        'voxel.fallback.requirementsTitle': 'System Requirements',
        'voxel.fallback.requirementsGPU': 'WebGL-compatible graphics card',
        'voxel.fallback.requirementsDrivers': 'Up-to-date graphics drivers',
        'voxel.fallback.useAlternative': 'Use Alternative View',
      };
      return translations[key] || key;
    },
  }),
}));

describe('VoxelFallback2D', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the fallback container', () => {
      render(<VoxelFallback2D />);

      const fallback = screen.getByTestId('voxel-fallback-2d');
      expect(fallback).toBeInTheDocument();
    });

    it('has correct aria attributes', () => {
      render(<VoxelFallback2D />);

      const fallback = screen.getByRole('region');
      expect(fallback).toHaveAttribute('aria-label', 'Alternative visualization view');
    });
  });

  describe('mobile reason', () => {
    it('shows mobile title when reason is mobile', () => {
      render(<VoxelFallback2D reason="mobile" />);

      expect(screen.getByText('Mobile Device Detected')).toBeInTheDocument();
    });

    it('shows mobile description', () => {
      render(<VoxelFallback2D reason="mobile" />);

      expect(screen.getByText('3D visualization is optimized for desktop.')).toBeInTheDocument();
    });

    it('shows mobile hint', () => {
      render(<VoxelFallback2D reason="mobile" />);

      expect(screen.getByText('For full 3D experience, use a desktop.')).toBeInTheDocument();
    });
  });

  describe('no-webgl reason', () => {
    it('shows WebGL not supported title', () => {
      render(<VoxelFallback2D reason="no-webgl" />);

      expect(screen.getByText('WebGL Not Supported')).toBeInTheDocument();
    });

    it('shows system requirements section', () => {
      render(<VoxelFallback2D reason="no-webgl" />);

      expect(screen.getByText('System Requirements')).toBeInTheDocument();
      expect(screen.getByText(/WebGL-compatible graphics card/)).toBeInTheDocument();
    });
  });

  describe('webgl1-degraded reason', () => {
    it('shows degraded title', () => {
      render(<VoxelFallback2D reason="webgl1-degraded" />);

      expect(screen.getByText('Reduced WebGL Mode')).toBeInTheDocument();
    });

    it('shows degraded description', () => {
      render(<VoxelFallback2D reason="webgl1-degraded" />);

      expect(screen.getByText('Your browser only supports WebGL 1.0.')).toBeInTheDocument();
    });
  });

  describe('error reason', () => {
    it('shows error title', () => {
      render(<VoxelFallback2D reason="error" />);

      expect(screen.getByText('Visualization Error')).toBeInTheDocument();
    });

    it('shows error description', () => {
      render(<VoxelFallback2D reason="error" />);

      expect(screen.getByText('An error occurred while loading.')).toBeInTheDocument();
    });
  });

  describe('alternative link', () => {
    it('shows alternative link by default', () => {
      render(<VoxelFallback2D />);

      const link = screen.getByRole('link', { name: /Use Alternative View/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/ctc-engine');
    });

    it('uses custom alternative URL when provided', () => {
      render(<VoxelFallback2D alternativeUrl="/custom-view" />);

      const link = screen.getByRole('link', { name: /Use Alternative View/i });
      expect(link).toHaveAttribute('href', '/custom-view');
    });

    it('hides alternative link when showAlternativeLink is false', () => {
      render(<VoxelFallback2D showAlternativeLink={false} />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('custom message', () => {
    it('shows custom message when provided', () => {
      render(<VoxelFallback2D message="Custom error message" />);

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });
});
