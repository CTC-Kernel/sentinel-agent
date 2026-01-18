/**
 * Story 34.1 - WebXR Detection Hook
 *
 * Provides WebXR support detection, capability checking, and session management
 * for VR and AR experiences in the Voxel Intelligence Engine.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type XRSessionMode = 'immersive-vr' | 'immersive-ar' | 'inline';

export interface XRDeviceCapabilities {
  /** Whether the device supports hand tracking */
  handTracking: boolean;
  /** Whether the device supports hit testing (AR) */
  hitTest: boolean;
  /** Whether the device supports anchors (AR) */
  anchors: boolean;
  /** Whether the device supports plane detection */
  planeDetection: boolean;
  /** Whether the device supports depth sensing */
  depthSensing: boolean;
  /** Whether the device supports DOM overlay (AR) */
  domOverlay: boolean;
  /** Whether the device supports bounded reference space */
  boundedFloor: boolean;
  /** Whether the device supports local reference space */
  localFloor: boolean;
}

export interface XRSupportStatus {
  /** Whether WebXR API is available in the browser */
  webXRAvailable: boolean;
  /** Whether VR mode is supported */
  vrSupported: boolean;
  /** Whether AR mode is supported */
  arSupported: boolean;
  /** Device capabilities */
  capabilities: XRDeviceCapabilities;
  /** Current active session mode, if any */
  activeSession: XRSessionMode | null;
  /** Whether permission has been granted */
  permissionGranted: boolean;
  /** Error message if detection failed */
  error: string | null;
  /** Whether detection is in progress */
  isDetecting: boolean;
}

export interface UseWebXROptions {
  /** Auto-detect on mount */
  autoDetect?: boolean;
  /** Callback when XR session starts */
  onSessionStart?: (mode: XRSessionMode) => void;
  /** Callback when XR session ends */
  onSessionEnd?: () => void;
  /** Callback when detection completes */
  onDetectionComplete?: (status: XRSupportStatus) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseWebXRReturn {
  /** Current XR support status */
  status: XRSupportStatus;
  /** Manually trigger detection */
  detectSupport: () => Promise<void>;
  /** Request VR session */
  requestVRSession: () => Promise<XRSession | null>;
  /** Request AR session */
  requestARSession: () => Promise<XRSession | null>;
  /** End current XR session */
  endSession: () => Promise<void>;
  /** Current XR session */
  session: XRSession | null;
  /** Whether VR is currently active */
  isVRActive: boolean;
  /** Whether AR is currently active */
  isARActive: boolean;
  /** Device info string for display */
  deviceInfo: string;
}

// ============================================================================
// Constants
// ============================================================================

const INITIAL_CAPABILITIES: XRDeviceCapabilities = {
  handTracking: false,
  hitTest: false,
  anchors: false,
  planeDetection: false,
  depthSensing: false,
  domOverlay: false,
  boundedFloor: false,
  localFloor: false,
};

const INITIAL_STATUS: XRSupportStatus = {
  webXRAvailable: false,
  vrSupported: false,
  arSupported: false,
  capabilities: { ...INITIAL_CAPABILITIES },
  activeSession: null,
  permissionGranted: false,
  error: null,
  isDetecting: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if WebXR is available in the current browser
 */
function isWebXRAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'xr' in navigator;
}

/**
 * Check support for a specific XR session mode
 */
async function checkSessionSupport(mode: XRSessionMode): Promise<boolean> {
  if (!isWebXRAvailable()) return false;

  try {
    const supported = await navigator.xr?.isSessionSupported(mode);
    return supported ?? false;
  } catch (error) {
    console.warn(`[useWebXR] Error checking ${mode} support:`, error);
    return false;
  }
}

/**
 * Detect device capabilities by checking optional features
 */
async function detectCapabilities(): Promise<XRDeviceCapabilities> {
  const capabilities: XRDeviceCapabilities = { ...INITIAL_CAPABILITIES };

  if (!isWebXRAvailable()) return capabilities;

  // Check VR capabilities
  try {
    // Try to check for hand-tracking support via feature descriptor
    // Note: This is a simplified check; actual availability may vary
    const vrSession = await navigator.xr?.requestSession?.('immersive-vr', {
      optionalFeatures: ['hand-tracking', 'local-floor', 'bounded-floor'],
    }).catch(() => null);

    if (vrSession) {
      capabilities.handTracking = vrSession.inputSources?.some(
        (source) => source.hand !== undefined
      ) ?? false;
      capabilities.localFloor = true;
      await vrSession.end();
    }
  } catch {
    // Silent fail for capability detection
  }

  // Check AR capabilities
  try {
    const arSession = await navigator.xr?.requestSession?.('immersive-ar', {
      optionalFeatures: ['hit-test', 'anchors', 'plane-detection', 'depth-sensing', 'dom-overlay'],
    }).catch(() => null);

    if (arSession) {
      capabilities.hitTest = true;
      capabilities.anchors = true;
      capabilities.planeDetection = true;
      capabilities.domOverlay = true;
      await arSession.end();
    }
  } catch {
    // Silent fail for capability detection
  }

  return capabilities;
}

/**
 * Get user-friendly device info string
 */
function getDeviceInfo(status: XRSupportStatus): string {
  if (!status.webXRAvailable) {
    return 'WebXR not available';
  }

  const modes: string[] = [];
  if (status.vrSupported) modes.push('VR');
  if (status.arSupported) modes.push('AR');

  if (modes.length === 0) {
    return 'No XR devices detected';
  }

  const features: string[] = [];
  if (status.capabilities.handTracking) features.push('Hand Tracking');
  if (status.capabilities.hitTest) features.push('Surface Detection');
  if (status.capabilities.planeDetection) features.push('Plane Detection');

  const featureStr = features.length > 0 ? ` (${features.join(', ')})` : '';
  return `${modes.join(' & ')} supported${featureStr}`;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useWebXR(options: UseWebXROptions = {}): UseWebXRReturn {
  const {
    autoDetect = true,
    onSessionStart,
    onSessionEnd,
    onDetectionComplete,
    onError,
  } = options;

  const [status, setStatus] = useState<XRSupportStatus>(INITIAL_STATUS);
  const [session, setSession] = useState<XRSession | null>(null);
  const detectionRef = useRef(false);

  // Detect XR support
  const detectSupport = useCallback(async () => {
    if (detectionRef.current) return;
    detectionRef.current = true;

    setStatus((prev) => ({ ...prev, isDetecting: true, error: null }));

    try {
      const webXRAvailable = isWebXRAvailable();

      if (!webXRAvailable) {
        const newStatus: XRSupportStatus = {
          ...INITIAL_STATUS,
          webXRAvailable: false,
          isDetecting: false,
          error: 'WebXR API not available in this browser',
        };
        setStatus(newStatus);
        onDetectionComplete?.(newStatus);
        return;
      }

      // Check VR and AR support in parallel
      const [vrSupported, arSupported] = await Promise.all([
        checkSessionSupport('immersive-vr'),
        checkSessionSupport('immersive-ar'),
      ]);

      // Detect capabilities (only if at least one mode is supported)
      let capabilities = { ...INITIAL_CAPABILITIES };
      if (vrSupported || arSupported) {
        // For now, just mark basic capabilities based on support
        // Full capability detection would require actually starting sessions
        if (vrSupported) {
          capabilities.localFloor = true;
        }
        if (arSupported) {
          capabilities.hitTest = true;
          capabilities.domOverlay = true;
        }
      }

      const newStatus: XRSupportStatus = {
        webXRAvailable,
        vrSupported,
        arSupported,
        capabilities,
        activeSession: null,
        permissionGranted: false,
        error: null,
        isDetecting: false,
      };

      setStatus(newStatus);
      onDetectionComplete?.(newStatus);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during XR detection';
      const newStatus: XRSupportStatus = {
        ...INITIAL_STATUS,
        isDetecting: false,
        error: errorMessage,
      };
      setStatus(newStatus);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      detectionRef.current = false;
    }
  }, [onDetectionComplete, onError]);

  // Request VR session
  const requestVRSession = useCallback(async (): Promise<XRSession | null> => {
    if (!status.vrSupported || !navigator.xr) {
      onError?.(new Error('VR is not supported on this device'));
      return null;
    }

    if (session) {
      console.warn('[useWebXR] A session is already active');
      return session;
    }

    try {
      const vrSession = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'bounded-floor'],
      });

      // Handle session end
      vrSession.addEventListener('end', () => {
        setSession(null);
        setStatus((prev) => ({ ...prev, activeSession: null }));
        onSessionEnd?.();
      });

      setSession(vrSession);
      setStatus((prev) => ({
        ...prev,
        activeSession: 'immersive-vr',
        permissionGranted: true,
      }));
      onSessionStart?.('immersive-vr');

      return vrSession;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start VR session';
      setStatus((prev) => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    }
  }, [status.vrSupported, session, onSessionStart, onSessionEnd, onError]);

  // Request AR session
  const requestARSession = useCallback(async (): Promise<XRSession | null> => {
    if (!status.arSupported || !navigator.xr) {
      onError?.(new Error('AR is not supported on this device'));
      return null;
    }

    if (session) {
      console.warn('[useWebXR] A session is already active');
      return session;
    }

    try {
      // Get the DOM overlay root element
      const overlayElement = document.getElementById('ar-overlay') || document.body;

      const arSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'anchors', 'plane-detection'],
        domOverlay: { root: overlayElement },
      });

      // Handle session end
      arSession.addEventListener('end', () => {
        setSession(null);
        setStatus((prev) => ({ ...prev, activeSession: null }));
        onSessionEnd?.();
      });

      setSession(arSession);
      setStatus((prev) => ({
        ...prev,
        activeSession: 'immersive-ar',
        permissionGranted: true,
      }));
      onSessionStart?.('immersive-ar');

      return arSession;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start AR session';
      setStatus((prev) => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    }
  }, [status.arSupported, session, onSessionStart, onSessionEnd, onError]);

  // End current session
  const endSession = useCallback(async () => {
    if (session) {
      try {
        await session.end();
        setSession(null);
        setStatus((prev) => ({ ...prev, activeSession: null }));
      } catch (error) {
        console.error('[useWebXR] Error ending session:', error);
      }
    }
  }, [session]);

  // Auto-detect on mount
  useEffect(() => {
    if (autoDetect) {
      detectSupport();
    }
  }, [autoDetect, detectSupport]);

  // Derived state
  const isVRActive = status.activeSession === 'immersive-vr';
  const isARActive = status.activeSession === 'immersive-ar';
  const deviceInfo = useMemo(() => getDeviceInfo(status), [status]);

  return {
    status,
    detectSupport,
    requestVRSession,
    requestARSession,
    endSession,
    session,
    isVRActive,
    isARActive,
    deviceInfo,
  };
}

export default useWebXR;
