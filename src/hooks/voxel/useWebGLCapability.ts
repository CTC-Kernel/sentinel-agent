/**
 * useWebGLCapability - WebGL support detection hook
 *
 * Detects WebGL 2.0, 1.0, or no support for graceful degradation.
 * Used to determine whether to show 3D canvas or 2D fallback.
 *
 * @see Story VOX-1.4: WebGL Capability Detection
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import { useState, useEffect } from 'react';

/**
 * WebGL capability levels
 * - 'webgl2': Full WebGL 2.0 support (recommended)
 * - 'webgl1': WebGL 1.0 only (reduced features)
 * - 'none': No WebGL support (fallback required)
 * - 'checking': Detection in progress
 */
export type WebGLCapability = 'webgl2' | 'webgl1' | 'none' | 'checking';

/**
 * Extended capability information
 */
export interface WebGLCapabilityInfo {
  /** Current capability level */
  capability: WebGLCapability;
  /** Whether WebGL is available (webgl1 or webgl2) */
  isAvailable: boolean;
  /** Whether this is a mobile device */
  isMobile: boolean;
  /** Whether to show 3D view (not mobile and WebGL available) */
  shouldShow3D: boolean;
  /** GPU renderer info if available */
  renderer?: string;
  /** GPU vendor info if available */
  vendor?: string;
  /** Max texture size supported */
  maxTextureSize?: number;
  /** Max vertex uniforms supported */
  maxVertexUniforms?: number;
}

/**
 * Check if device is mobile based on viewport and touch capability
 */
function checkIsMobile(): boolean {
  if (typeof window === 'undefined') return false;

  // Check viewport width
  const isSmallViewport = window.innerWidth < 768;

  // Check for touch capability
  const hasTouch =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0;

  // Check user agent for common mobile patterns
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    );

  return isSmallViewport || (hasTouch && isMobileUA);
}

/**
 * Detect WebGL capability and extract GPU information
 */
function detectWebGLCapability(): Omit<WebGLCapabilityInfo, 'shouldShow3D' | 'isMobile'> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { capability: 'none', isAvailable: false };
  }

  const canvas = document.createElement('canvas');
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  let capability: WebGLCapability = 'none';

  // Try WebGL 2.0 first
  try {
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (gl) {
      capability = 'webgl2';
    }
  } catch {
    // WebGL 2.0 not available
  }

  // Fall back to WebGL 1.0
  if (!gl) {
    try {
      gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
      if (gl) {
        capability = 'webgl1';
      }
    } catch {
      // WebGL 1.0 not available
    }

    // Try experimental-webgl as last resort
    if (!gl) {
      try {
        gl = canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
        if (gl) {
          capability = 'webgl1';
        }
      } catch {
        // No WebGL support
      }
    }
  }

  const isAvailable = capability !== 'none';
  const result: Omit<WebGLCapabilityInfo, 'shouldShow3D' | 'isMobile'> = {
    capability,
    isAvailable,
  };

  // Extract GPU information if WebGL is available
  if (gl) {
    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        result.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        result.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      }
      result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      result.maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    } catch {
      // Extension not available or error getting parameters
    }

    // Clean up context
    const loseContext = gl.getExtension('WEBGL_lose_context');
    if (loseContext) {
      loseContext.loseContext();
    }
  }

  return result;
}

/**
 * Hook to detect WebGL capability
 *
 * @returns WebGL capability information including mobile detection
 *
 * @example
 * ```tsx
 * const { capability, shouldShow3D, isMobile } = useWebGLCapability();
 *
 * if (!shouldShow3D) {
 *   return <VoxelFallback2D reason={isMobile ? 'mobile' : 'no-webgl'} />;
 * }
 *
 * return <VoxelCanvas degraded={capability === 'webgl1'} />;
 * ```
 */
export function useWebGLCapability(): WebGLCapabilityInfo {
  const [info] = useState<WebGLCapabilityInfo>(() => {
    const webglInfo = detectWebGLCapability();
    const isMobile = checkIsMobile();
    const shouldShow3D = !isMobile && webglInfo.isAvailable;
    return {
      ...webglInfo,
      isMobile,
      shouldShow3D,
    };
  });

  useEffect(() => {
    // Already detected during initialization
  }, []);

  return info;
}

/**
 * Simple hook that returns just the capability level
 * For cases where you only need the basic capability info
 */
export function useWebGLSupport(): WebGLCapability {
  const { capability } = useWebGLCapability();
  return capability;
}

export default useWebGLCapability;
