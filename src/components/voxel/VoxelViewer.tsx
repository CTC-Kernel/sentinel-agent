/**
 * VoxelViewer - Main wrapper component for 3D visualization
 *
 * Combines VoxelCanvas with ErrorBoundary for robust error handling
 * and provides the main entry point for the Voxel 3D module.
 *
 * Features:
 * - WebGL capability detection with graceful fallback
 * - Mobile device detection with 2D fallback
 * - Error boundary for runtime WebGL errors
 * - Loading state management
 *
 * @see Story VOX-1.1: R3F Canvas Integration
 * @see Story VOX-1.4: WebGL Capability Detection
 */

import React, { useState, useCallback, Suspense } from 'react';
import { VoxelErrorBoundary } from './fallback/VoxelErrorBoundary';
import { VoxelSkeleton } from './fallback/VoxelSkeleton';
import { VoxelFallback2D, FallbackReason } from './fallback/VoxelFallback2D';
import { VoxelCanvas } from './VoxelCanvas';
import { useWebGLCapability } from '@/hooks/voxel';
import { ErrorLogger } from '@/services/errorLogger';

export interface VoxelViewerProps {
  /** Optional className for the container */
  className?: string;
  /** Force 2D fallback (for testing) */
  forceFallback?: boolean;
  /** Custom fallback reason (for testing) */
  fallbackReason?: FallbackReason;
}

export const VoxelViewer: React.FC<VoxelViewerProps> = ({
  className = '',
  forceFallback = false,
  fallbackReason,
}) => {
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // Detect WebGL capability
  const { capability, shouldShow3D, isMobile } = useWebGLCapability();

  // Handle canvas creation
  const handleCanvasCreated = useCallback(() => {
    setIsReady(true);
    setLoadError(null);
  }, []);

  // Handle canvas errors
  const handleCanvasError = useCallback((error: Error) => {
    ErrorLogger.error(error, 'VoxelViewer.handleCanvasError');
    setLoadError(error);
  }, []);

  // Handle error boundary errors
  const handleBoundaryError = useCallback((error: Error) => {
    ErrorLogger.error(error, 'VoxelViewer.handleBoundaryError');
    setLoadError(error);
  }, []);

  // Show loading while checking capability
  if (capability === 'checking' && !forceFallback) {
    return (
      <div
        className={`relative w-full h-full ${className}`}
        data-testid="voxel-viewer"
      >
        <VoxelSkeleton />
      </div>
    );
  }

  // Determine fallback reason
  const determinedFallbackReason: FallbackReason = fallbackReason ||
    (isMobile ? 'mobile' : capability === 'none' ? 'no-webgl' : 'error');

  // Show 2D fallback if:
  // - forceFallback is true (testing)
  // - Mobile device detected
  // - No WebGL support
  if (forceFallback || !shouldShow3D) {
    return (
      <div
        className={`relative w-full h-full ${className}`}
        data-testid="voxel-viewer"
      >
        <VoxelFallback2D reason={determinedFallbackReason} />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full ${className}`}
      data-testid="voxel-viewer"
    >
      <VoxelErrorBoundary
        onError={handleBoundaryError}
        fallback={<VoxelFallback2D reason="error" />}
      >
        <Suspense fallback={<VoxelSkeleton />}>
          <VoxelCanvas
            onCreated={handleCanvasCreated}
            onError={handleCanvasError}
            className={capability === 'webgl1' ? 'webgl-degraded' : undefined}
          />
        </Suspense>
      </VoxelErrorBoundary>

      {/* Loading overlay - shown until canvas is ready */}
      {!isReady && !loadError && (
        <div className="absolute inset-0 pointer-events-none">
          <VoxelSkeleton />
        </div>
      )}
    </div>
  );
};

export default VoxelViewer;
