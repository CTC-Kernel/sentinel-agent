/**
 * Unit tests for useWebXR hook
 *
 * Tests for:
 * - XR detection
 * - Session request
 * - Fallback handling
 * - VR/AR session management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { resetIdCounter } from '@/tests/factories/voxelFactory';

// Mock navigator.xr
const mockXR = {
  isSessionSupported: vi.fn(),
  requestSession: vi.fn(),
};

const mockXRSession = {
  end: vi.fn(),
  inputSources: [],
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe('useWebXR', () => {
  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();

    // Default mock: WebXR available
    Object.defineProperty(navigator, 'xr', {
      value: mockXR,
      writable: true,
      configurable: true,
    });

    mockXR.isSessionSupported.mockResolvedValue(true);
    mockXR.requestSession.mockResolvedValue(mockXRSession);
    mockXRSession.end.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Initial State Tests
  // ============================================================================

  describe('initial state', () => {
    it('should have correct initial status', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR({ autoDetect: false }));

      expect(result.current.status.isDetecting).toBe(true);
      expect(result.current.session).toBeNull();
      expect(result.current.isVRActive).toBe(false);
      expect(result.current.isARActive).toBe(false);
    });

    it('should auto-detect on mount by default', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.isDetecting).toBe(false);
      });
    });

    it('should not auto-detect when autoDetect is false', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR({ autoDetect: false }));

      // Wait a bit to ensure no detection happens
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockXR.isSessionSupported).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // WebXR Detection Tests
  // ============================================================================

  describe('detectSupport', () => {
    it('should detect VR support', async () => {
      mockXR.isSessionSupported.mockImplementation((mode) => {
        return Promise.resolve(mode === 'immersive-vr');
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
        expect(result.current.status.arSupported).toBe(false);
      });
    });

    it('should detect AR support', async () => {
      mockXR.isSessionSupported.mockImplementation((mode) => {
        return Promise.resolve(mode === 'immersive-ar');
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.arSupported).toBe(true);
        expect(result.current.status.vrSupported).toBe(false);
      });
    });

    it('should detect both VR and AR support', async () => {
      mockXR.isSessionSupported.mockResolvedValue(true);

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
        expect(result.current.status.arSupported).toBe(true);
      });
    });

    it('should set webXRAvailable to true when navigator.xr exists', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.webXRAvailable).toBe(true);
      });
    });

    it('should set webXRAvailable to false when navigator.xr does not exist', async () => {
      Object.defineProperty(navigator, 'xr', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.webXRAvailable).toBe(false);
      });
    });

    it('should handle detection errors gracefully', async () => {
      mockXR.isSessionSupported.mockRejectedValue(new Error('Detection failed'));

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.error).toBeDefined();
        expect(result.current.status.isDetecting).toBe(false);
      });
    });

    it('should call onDetectionComplete callback', async () => {
      const onDetectionComplete = vi.fn();

      const { useWebXR } = await import('../useWebXR');

      renderHook(() => useWebXR({ onDetectionComplete }));

      await waitFor(() => {
        expect(onDetectionComplete).toHaveBeenCalled();
      });
    });

    it('should call onError callback on detection failure', async () => {
      mockXR.isSessionSupported.mockRejectedValue(new Error('Failed'));
      const onError = vi.fn();

      const { useWebXR } = await import('../useWebXR');

      renderHook(() => useWebXR({ onError }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // VR Session Tests
  // ============================================================================

  describe('requestVRSession', () => {
    it('should request VR session when supported', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
      });

      let session: XRSession | null = null;
      await act(async () => {
        session = await result.current.requestVRSession();
      });

      expect(session).toBe(mockXRSession);
      expect(result.current.isVRActive).toBe(true);
      expect(result.current.status.activeSession).toBe('immersive-vr');
    });

    it('should return null when VR is not supported', async () => {
      mockXR.isSessionSupported.mockImplementation((mode) => {
        return Promise.resolve(mode !== 'immersive-vr');
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(false);
      });

      let session: XRSession | null = null;
      await act(async () => {
        session = await result.current.requestVRSession();
      });

      expect(session).toBeNull();
    });

    it('should call onSessionStart callback', async () => {
      const onSessionStart = vi.fn();

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR({ onSessionStart }));

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
      });

      await act(async () => {
        await result.current.requestVRSession();
      });

      expect(onSessionStart).toHaveBeenCalledWith('immersive-vr');
    });

    it('should handle session request errors', async () => {
      mockXR.requestSession.mockRejectedValueOnce(new Error('Session denied'));
      const onError = vi.fn();

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR({ onError }));

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
      });

      let session: XRSession | null = mockXRSession;
      await act(async () => {
        session = await result.current.requestVRSession();
      });

      expect(session).toBeNull();
      expect(onError).toHaveBeenCalled();
    });

    it('should return existing session if already active', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
      });

      // Start first session
      await act(async () => {
        await result.current.requestVRSession();
      });

      // Try to start another
      let session: XRSession | null = null;
      await act(async () => {
        session = await result.current.requestVRSession();
      });

      // Should return the existing session
      expect(session).toBe(mockXRSession);
    });
  });

  // ============================================================================
  // AR Session Tests
  // ============================================================================

  describe('requestARSession', () => {
    it('should request AR session when supported', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.arSupported).toBe(true);
      });

      let session: XRSession | null = null;
      await act(async () => {
        session = await result.current.requestARSession();
      });

      expect(session).toBe(mockXRSession);
      expect(result.current.isARActive).toBe(true);
      expect(result.current.status.activeSession).toBe('immersive-ar');
    });

    it('should return null when AR is not supported', async () => {
      mockXR.isSessionSupported.mockImplementation((mode) => {
        return Promise.resolve(mode !== 'immersive-ar');
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.arSupported).toBe(false);
      });

      let session: XRSession | null = null;
      await act(async () => {
        session = await result.current.requestARSession();
      });

      expect(session).toBeNull();
    });

    it('should call onSessionStart callback with AR mode', async () => {
      const onSessionStart = vi.fn();

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR({ onSessionStart }));

      await waitFor(() => {
        expect(result.current.status.arSupported).toBe(true);
      });

      await act(async () => {
        await result.current.requestARSession();
      });

      expect(onSessionStart).toHaveBeenCalledWith('immersive-ar');
    });
  });

  // ============================================================================
  // End Session Tests
  // ============================================================================

  describe('endSession', () => {
    it('should end active session', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
      });

      await act(async () => {
        await result.current.requestVRSession();
      });

      expect(result.current.session).not.toBeNull();

      await act(async () => {
        await result.current.endSession();
      });

      expect(result.current.session).toBeNull();
      expect(result.current.isVRActive).toBe(false);
    });

    it('should not throw when no active session', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      // Should not throw
      await act(async () => {
        await result.current.endSession();
      });
    });

    it('should call onSessionEnd callback', async () => {
      const onSessionEnd = vi.fn();

      // Setup session end event handler
      mockXRSession.addEventListener.mockImplementation((event: string, handler: () => void) => {
        if (event === 'end') {
          // Simulate session end
          setTimeout(handler, 0);
        }
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR({ onSessionEnd }));

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
      });

      await act(async () => {
        await result.current.requestVRSession();
      });

      await waitFor(() => {
        expect(onSessionEnd).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Device Info Tests
  // ============================================================================

  describe('deviceInfo', () => {
    it('should return VR supported message when VR is available', async () => {
      mockXR.isSessionSupported.mockImplementation((mode) => {
        return Promise.resolve(mode === 'immersive-vr');
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.deviceInfo.toLowerCase()).toContain('vr');
      });
    });

    it('should return AR supported message when AR is available', async () => {
      mockXR.isSessionSupported.mockImplementation((mode) => {
        return Promise.resolve(mode === 'immersive-ar');
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.deviceInfo.toLowerCase()).toContain('ar');
      });
    });

    it('should indicate no XR devices when none available', async () => {
      mockXR.isSessionSupported.mockResolvedValue(false);

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.deviceInfo.toLowerCase()).toContain('no');
      });
    });

    it('should indicate WebXR not available', async () => {
      Object.defineProperty(navigator, 'xr', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.deviceInfo.toLowerCase()).toContain('not available');
      });
    });
  });

  // ============================================================================
  // Capabilities Tests
  // ============================================================================

  describe('capabilities', () => {
    it('should detect capabilities when VR is supported', async () => {
      mockXR.isSessionSupported.mockResolvedValue(true);

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.capabilities).toBeDefined();
        expect(result.current.status.capabilities.localFloor).toBe(true);
      });
    });

    it('should detect capabilities when AR is supported', async () => {
      mockXR.isSessionSupported.mockResolvedValue(true);

      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.capabilities.hitTest).toBe(true);
        expect(result.current.status.capabilities.domOverlay).toBe(true);
      });
    });
  });

  // ============================================================================
  // Permission Tests
  // ============================================================================

  describe('permissions', () => {
    it('should set permissionGranted after successful session request', async () => {
      const { useWebXR } = await import('../useWebXR');

      const { result } = renderHook(() => useWebXR());

      await waitFor(() => {
        expect(result.current.status.vrSupported).toBe(true);
      });

      expect(result.current.status.permissionGranted).toBe(false);

      await act(async () => {
        await result.current.requestVRSession();
      });

      expect(result.current.status.permissionGranted).toBe(true);
    });
  });
});
