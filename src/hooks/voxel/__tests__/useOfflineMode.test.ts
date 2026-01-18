/**
 * Unit tests for useOfflineMode hook
 *
 * Tests for:
 * - Online/offline detection
 * - Cache save/load
 * - Firestore persistence
 * - Reconnection handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { resetIdCounter } from '@/tests/factories/voxelFactory';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.onLine
let mockOnline = true;
Object.defineProperty(navigator, 'onLine', {
  get: () => mockOnline,
  configurable: true,
});

// Mock Firebase Firestore
const mockEnableIndexedDbPersistence = vi.fn();
const mockDisableNetwork = vi.fn();
const mockEnableNetwork = vi.fn();

vi.mock('firebase/firestore', () => ({
  enableIndexedDbPersistence: (...args: unknown[]) => mockEnableIndexedDbPersistence(...args),
  disableNetwork: (...args: unknown[]) => mockDisableNetwork(...args),
  enableNetwork: (...args: unknown[]) => mockEnableNetwork(...args),
}));

vi.mock('@/firebase', () => ({
  db: {},
}));

// Mock voxelStore
const mockSetNodes = vi.fn();
const mockSetEdges = vi.fn();
const mockSetAnomalies = vi.fn();
const mockSetSyncStatus = vi.fn();

vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn((selector) => {
    const state = {
      nodes: new Map(),
      edges: new Map(),
      anomalies: new Map(),
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      setAnomalies: mockSetAnomalies,
      setSyncStatus: mockSetSyncStatus,
    };
    return selector(state);
  }),
}));

describe('useOfflineMode', () => {
  let onlineHandler: (event: Event) => void;
  let offlineHandler: (event: Event) => void;

  beforeEach(() => {
    resetIdCounter();
    vi.clearAllMocks();
    localStorageMock.clear();
    mockOnline = true;

    mockEnableIndexedDbPersistence.mockResolvedValue(undefined);
    mockDisableNetwork.mockResolvedValue(undefined);
    mockEnableNetwork.mockResolvedValue(undefined);

    // Capture event handlers
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'online') onlineHandler = handler as (event: Event) => void;
      if (event === 'offline') offlineHandler = handler as (event: Event) => void;
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Initial State Tests
  // ============================================================================

  describe('initial state', () => {
    it('should initialize with online status based on navigator.onLine', async () => {
      mockOnline = true;
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123'));

      expect(result.current.isOnline).toBe(true);
    });

    it('should initialize offline when navigator.onLine is false', async () => {
      mockOnline = false;
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123'));

      expect(result.current.isOnline).toBe(false);
    });

    it('should have null lastCacheTime initially', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123'));

      expect(result.current.lastCacheTime).toBeNull();
    });
  });

  // ============================================================================
  // Firestore Persistence Tests
  // ============================================================================

  describe('Firestore persistence', () => {
    it('should enable IndexedDB persistence on mount', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      await waitFor(() => {
        expect(mockEnableIndexedDbPersistence).toHaveBeenCalled();
      });
    });

    it('should not enable persistence when enableCache is false', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      renderHook(() => useOfflineMode('org-123', { enableCache: false }));

      expect(mockEnableIndexedDbPersistence).not.toHaveBeenCalled();
    });

    it('should handle failed-precondition error gracefully', async () => {
      mockEnableIndexedDbPersistence.mockRejectedValueOnce({ code: 'failed-precondition' });
      const { useOfflineMode } = await import('../useOfflineMode');

      // Should not throw
      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      await waitFor(() => {
        expect(result.current.isFirestorePersistenceEnabled).toBe(false);
      });
    });

    it('should handle unimplemented error gracefully', async () => {
      mockEnableIndexedDbPersistence.mockRejectedValueOnce({ code: 'unimplemented' });
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      await waitFor(() => {
        expect(result.current.isFirestorePersistenceEnabled).toBe(false);
      });
    });
  });

  // ============================================================================
  // Cache Save/Load Tests
  // ============================================================================

  describe('saveToCache', () => {
    it('should save data to localStorage', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        result.current.saveToCache();
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const key = localStorageMock.setItem.mock.calls[0][0];
      expect(key).toContain('org-123');
    });

    it('should update lastCacheTime after saving', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        result.current.saveToCache();
      });

      expect(result.current.lastCacheTime).not.toBeNull();
    });

    it('should not save when organizationId is undefined', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode(undefined, { enableCache: true }));

      act(() => {
        result.current.saveToCache();
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should not save when enableCache is false', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: false }));

      act(() => {
        result.current.saveToCache();
      });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('loadFromCache', () => {
    it('should load data from localStorage', async () => {
      const cachedData = {
        version: 1,
        timestamp: Date.now(),
        organizationId: 'org-123',
        nodes: [{ id: 'node-1', label: 'Test Node' }],
        edges: [],
        anomalies: [],
      };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData));

      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      let loaded = false;
      act(() => {
        loaded = result.current.loadFromCache();
      });

      expect(loaded).toBe(true);
      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should return false when no cached data exists', async () => {
      localStorageMock.getItem.mockReturnValueOnce(null);
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      let loaded = false;
      act(() => {
        loaded = result.current.loadFromCache();
      });

      expect(loaded).toBe(false);
    });

    it('should return false for version mismatch', async () => {
      const cachedData = {
        version: 999, // Wrong version
        timestamp: Date.now(),
        organizationId: 'org-123',
        nodes: [],
        edges: [],
        anomalies: [],
      };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData));

      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      let loaded = false;
      act(() => {
        loaded = result.current.loadFromCache();
      });

      expect(loaded).toBe(false);
    });

    it('should return false for expired cache', async () => {
      const cachedData = {
        version: 1,
        timestamp: Date.now() - 48 * 60 * 60 * 1000, // 48 hours ago
        organizationId: 'org-123',
        nodes: [],
        edges: [],
        anomalies: [],
      };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData));

      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      let loaded = false;
      act(() => {
        loaded = result.current.loadFromCache();
      });

      expect(loaded).toBe(false);
    });

    it('should return false for organization mismatch', async () => {
      const cachedData = {
        version: 1,
        timestamp: Date.now(),
        organizationId: 'different-org',
        nodes: [],
        edges: [],
        anomalies: [],
      };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData));

      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      let loaded = false;
      act(() => {
        loaded = result.current.loadFromCache();
      });

      expect(loaded).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should remove cached data', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        result.current.clearCache();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it('should reset lastCacheTime', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      // First save to set lastCacheTime
      act(() => {
        result.current.saveToCache();
      });

      expect(result.current.lastCacheTime).not.toBeNull();

      // Then clear
      act(() => {
        result.current.clearCache();
      });

      expect(result.current.lastCacheTime).toBeNull();
    });
  });

  // ============================================================================
  // Online/Offline Event Handling Tests
  // ============================================================================

  describe('online/offline events', () => {
    it('should update isOnline when going offline', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      expect(result.current.isOnline).toBe(true);

      act(() => {
        mockOnline = false;
        offlineHandler(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
    });

    it('should save cache when going offline', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        mockOnline = false;
        offlineHandler(new Event('offline'));
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should disable Firestore network when going offline', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        mockOnline = false;
        offlineHandler(new Event('offline'));
      });

      expect(mockDisableNetwork).toHaveBeenCalled();
    });

    it('should set sync status to offline when going offline', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        mockOnline = false;
        offlineHandler(new Event('offline'));
      });

      expect(mockSetSyncStatus).toHaveBeenCalledWith('offline');
    });

    it('should update isOnline when coming back online', async () => {
      mockOnline = false;
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      expect(result.current.isOnline).toBe(false);

      act(() => {
        mockOnline = true;
        onlineHandler(new Event('online'));
      });

      expect(result.current.isOnline).toBe(true);
    });

    it('should enable Firestore network when coming back online', async () => {
      mockOnline = false;
      const { useOfflineMode } = await import('../useOfflineMode');

      renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        mockOnline = true;
        onlineHandler(new Event('online'));
      });

      await waitFor(() => {
        expect(mockEnableNetwork).toHaveBeenCalled();
      });
    });

    it('should set sync status to syncing when coming back online', async () => {
      mockOnline = false;
      const { useOfflineMode } = await import('../useOfflineMode');

      renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        mockOnline = true;
        onlineHandler(new Event('online'));
      });

      expect(mockSetSyncStatus).toHaveBeenCalledWith('syncing');
    });
  });

  // ============================================================================
  // Reconnection Handling Tests
  // ============================================================================

  describe('reconnection handling', () => {
    it('should reset retry count on successful reconnection', async () => {
      mockOnline = false;
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      // Simulate coming back online
      act(() => {
        mockOnline = true;
        onlineHandler(new Event('online'));
      });

      await waitFor(() => {
        expect(result.current.retryCount).toBe(0);
      });
    });

    it('should set sync status to connected after successful reconnection', async () => {
      mockOnline = false;
      mockEnableNetwork.mockResolvedValueOnce(undefined);

      const { useOfflineMode } = await import('../useOfflineMode');

      renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      act(() => {
        mockOnline = true;
        onlineHandler(new Event('online'));
      });

      await waitFor(() => {
        expect(mockSetSyncStatus).toHaveBeenCalledWith('connected');
      });
    });
  });

  // ============================================================================
  // IndexedDB Availability Tests
  // ============================================================================

  describe('hasIndexedDB', () => {
    it('should indicate IndexedDB availability', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { result } = renderHook(() => useOfflineMode('org-123'));

      expect(typeof result.current.hasIndexedDB).toBe('boolean');
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('cleanup', () => {
    it('should remove event listeners on unmount', async () => {
      const { useOfflineMode } = await import('../useOfflineMode');

      const { unmount } = renderHook(() => useOfflineMode('org-123', { enableCache: true }));

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });
});
