/**
 * Unit tests for VoxelViewer component
 * Tests ErrorBoundary integration and loading states
 *
 * @see Story VOX-1.1: R3F Canvas Integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock window.matchMedia for JSDOM (used by VoxelScene's usePrefersReducedMotion)
Object.defineProperty(window, 'matchMedia', {
 writable: true,
 value: vi.fn().mockImplementation((query: string) => ({
 matches: false,
 media: query,
 onchange: null,
 addListener: vi.fn(),
 removeListener: vi.fn(),
 addEventListener: vi.fn(),
 removeEventListener: vi.fn(),
 dispatchEvent: vi.fn(),
 })),
});

// Mock R3F Canvas
vi.mock('@react-three/fiber', () => ({
 Canvas: ({ children, onCreated }: {
 children: React.ReactNode;
 onCreated?: () => void;
 }) => {
 React.useEffect(() => {
 // Simulate async canvas creation
 const timer = setTimeout(() => {
 onCreated?.();
 }, 0);
 return () => clearTimeout(timer);
 }, [onCreated]);

 return (
 <div data-testid="r3f-canvas">
 {children}
 </div>
 );
 },
 useFrame: vi.fn(),
 useThree: () => ({
 gl: { domElement: document.createElement('canvas') },
 camera: {
 position: { set: vi.fn() },
 lookAt: vi.fn(),
 },
 scene: {},
 }),
}));

// Mock drei components
vi.mock('@react-three/drei', () => ({
 OrbitControls: React.forwardRef((_props: unknown, ref: unknown) => (
 <div data-testid="orbit-controls" ref={ref as React.Ref<HTMLDivElement>} />
 )),
 Grid: () => <div data-testid="grid" />,
 Stars: () => <div data-testid="stars" />,
}));

// Mock store
vi.mock('@/store', () => ({
 useStore: () => ({
 t: (key: string) => {
 const translations: Record<string, string> = {
 'voxel.loading': 'Loading 3D environment...',
 'voxel.error': 'Unable to load 3D visualization',
 };
 return translations[key] || key;
 },
 }),
}));

// Mock ErrorLogger
vi.mock('@/services/errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 handleErrorWithToast: vi.fn(),
 },
}));

// Mock useWebGLCapability hook with configurable return value
const mockWebGLCapability = {
 capability: 'webgl2' as 'checking' | 'none' | 'webgl1' | 'webgl2',
 shouldShow3D: true,
 isMobile: false,
};

vi.mock('@/hooks/voxel', () => ({
 useWebGLCapability: vi.fn(() => mockWebGLCapability),
}));

import { VoxelViewer } from '../VoxelViewer';
import { VoxelErrorBoundary } from '../fallback/VoxelErrorBoundary';
import { VoxelSkeleton } from '../fallback/VoxelSkeleton';

describe('VoxelViewer', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 // Reset to default values
 mockWebGLCapability.capability = 'webgl2';
 mockWebGLCapability.shouldShow3D = true;
 mockWebGLCapability.isMobile = false;
 });

 describe('rendering', () => {
 it('renders the viewer container', () => {
 render(<VoxelViewer />);

 const viewer = screen.getByTestId('voxel-viewer');
 expect(viewer).toBeInTheDocument();
 });

 it('renders with custom className', () => {
 render(<VoxelViewer className="custom-class" />);

 const viewer = screen.getByTestId('voxel-viewer');
 expect(viewer).toHaveClass('custom-class');
 });

 it('renders the canvas container', async () => {
 render(<VoxelViewer />);

 await waitFor(() => {
 const canvas = screen.getByTestId('voxel-canvas-container');
 expect(canvas).toBeInTheDocument();
 });
 });
 });

 describe('loading state', () => {
 it('shows loading skeleton initially', () => {
 // Set capability to 'checking' to trigger skeleton display
 mockWebGLCapability.capability = 'checking';

 render(<VoxelViewer />);

 const skeleton = screen.getByTestId('voxel-skeleton');
 expect(skeleton).toBeInTheDocument();
 });
 });
});

describe('VoxelSkeleton', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('renders with default loading message', () => {
 render(<VoxelSkeleton />);

 const skeleton = screen.getByTestId('voxel-skeleton');
 expect(skeleton).toBeInTheDocument();
 });

 it('renders with custom message', () => {
 render(<VoxelSkeleton message="Custom loading..." />);

 expect(screen.getByText('Custom loading...')).toBeInTheDocument();
 });

 it('has progressbar role for accessibility', () => {
 render(<VoxelSkeleton />);

 const skeleton = screen.getByRole('progressbar');
 expect(skeleton).toBeInTheDocument();
 });
});

describe('VoxelErrorBoundary', () => {
 // Suppress console.error for error boundary tests
 const originalError = console.error;
 beforeEach(() => {
 console.error = vi.fn();
 });
 afterEach(() => {
 console.error = originalError;
 });

 it('renders children when no error', () => {
 render(
 <VoxelErrorBoundary>
 <div data-testid="child">Child content</div>
 </VoxelErrorBoundary>
 );

 expect(screen.getByTestId('child')).toBeInTheDocument();
 });

 it('renders fallback when error occurs', () => {
 const ThrowError = () => {
 throw new Error('Test error');
 };

 render(
 <VoxelErrorBoundary>
 <ThrowError />
 </VoxelErrorBoundary>
 );

 const fallback = screen.getByTestId('voxel-error-fallback');
 expect(fallback).toBeInTheDocument();
 });

 it('renders custom fallback when provided', () => {
 const ThrowError = () => {
 throw new Error('Test error');
 };

 render(
 <VoxelErrorBoundary fallback={<div data-testid="custom-fallback">Custom</div>}>
 <ThrowError />
 </VoxelErrorBoundary>
 );

 expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
 });

 it('calls onError callback when error occurs', () => {
 const onError = vi.fn();
 const ThrowError = () => {
 throw new Error('Test error');
 };

 render(
 <VoxelErrorBoundary onError={onError}>
 <ThrowError />
 </VoxelErrorBoundary>
 );

 expect(onError).toHaveBeenCalled();
 expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
 expect(onError.mock.calls[0][0].message).toBe('Test error');
 });

 it('shows WebGL-specific message for WebGL errors', () => {
 const ThrowError = () => {
 throw new Error('WebGL context lost');
 };

 render(
 <VoxelErrorBoundary>
 <ThrowError />
 </VoxelErrorBoundary>
 );

 expect(screen.getByText('WebGL non supporté')).toBeInTheDocument();
 });
});
