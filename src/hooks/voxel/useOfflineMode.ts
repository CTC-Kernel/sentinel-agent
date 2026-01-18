/**
 * Story 28.5 - Offline Mode with Cache
 *
 * Hook for managing offline state and cached data for Voxel.
 * Uses IndexedDB for persistent storage and handles reconnection.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { enableIndexedDbPersistence, disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from '@/firebase';
import { useVoxelStore } from '@/stores/voxelStore';
import type { VoxelNode, VoxelEdge, VoxelAnomaly } from '@/types/voxel';

const CACHE_KEY = 'voxel-offline-cache';
const CACHE_VERSION = 1;

interface CachedData {
  version: number;
  timestamp: number;
  organizationId: string;
  nodes: Array<VoxelNode & { id: string }>;
  edges: Array<VoxelEdge & { id: string }>;
  anomalies: Array<VoxelAnomaly & { id: string }>;
}

interface OfflineModeConfig {
  /** Enable automatic caching */
  enableCache?: boolean;
  /** Cache expiry in milliseconds (default: 24 hours) */
  cacheExpiry?: number;
  /** Polling interval for fallback mode (ms) */
  pollingInterval?: number;
  /** Max retry attempts before fallback */
  maxRetryAttempts?: number;
}

const DEFAULT_CONFIG: Required<OfflineModeConfig> = {
  enableCache: true,
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
  pollingInterval: 30000, // 30 seconds
  maxRetryAttempts: 3,
};

/**
 * Check if IndexedDB is available
 */
function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Save data to localStorage (fallback for IndexedDB)
 */
function saveToLocalStorage(key: string, data: CachedData): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('[OfflineMode] Failed to save to localStorage:', error);
  }
}

/**
 * Load data from localStorage
 */
function loadFromLocalStorage(key: string): CachedData | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Hook for managing offline mode in Voxel
 */
export function useOfflineMode(
  organizationId: string | undefined,
  config: OfflineModeConfig = {}
) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFirestorePersistenceEnabled, setFirestorePersistenceEnabled] = useState(false);
  const [lastCacheTime, setLastCacheTime] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPollingFallback, setIsPollingFallback] = useState(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodes = useVoxelStore((s) => s.nodes);
  const edges = useVoxelStore((s) => s.edges);
  const anomalies = useVoxelStore((s) => s.anomalies);
  const setNodes = useVoxelStore((s) => s.setNodes);
  const setEdges = useVoxelStore((s) => s.setEdges);
  const setAnomalies = useVoxelStore((s) => s.setAnomalies);
  const setSyncStatus = useVoxelStore((s) => s.setSyncStatus);

  /**
   * Enable Firestore offline persistence
   */
  useEffect(() => {
    if (!mergedConfig.enableCache) return;

    enableIndexedDbPersistence(db)
      .then(() => {
        console.log('[OfflineMode] Firestore persistence enabled');
        setFirestorePersistenceEnabled(true);
      })
      .catch((error) => {
        if (error.code === 'failed-precondition') {
          console.warn('[OfflineMode] Multiple tabs open, persistence limited');
        } else if (error.code === 'unimplemented') {
          console.warn('[OfflineMode] Browser does not support persistence');
        } else {
          console.error('[OfflineMode] Persistence error:', error);
        }
      });
  }, [mergedConfig.enableCache]);

  /**
   * Save current state to cache
   */
  const saveToCache = useCallback(() => {
    if (!organizationId || !mergedConfig.enableCache) return;

    const cacheData: CachedData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      organizationId,
      nodes: Array.from(nodes.values()).map((n) => ({ ...n, id: n.id })),
      edges: Array.from(edges.values()).map((e) => ({ ...e, id: e.id })),
      anomalies: Array.from(anomalies.values()).map((a) => ({ ...a, id: a.id })),
    };

    saveToLocalStorage(`${CACHE_KEY}-${organizationId}`, cacheData);
    setLastCacheTime(new Date());
    console.log('[OfflineMode] Data cached successfully');
  }, [organizationId, nodes, edges, anomalies, mergedConfig.enableCache]);

  /**
   * Load state from cache
   */
  const loadFromCache = useCallback((): boolean => {
    if (!organizationId || !mergedConfig.enableCache) return false;

    const cached = loadFromLocalStorage(`${CACHE_KEY}-${organizationId}`);

    if (!cached) {
      console.log('[OfflineMode] No cached data found');
      return false;
    }

    // Check version compatibility
    if (cached.version !== CACHE_VERSION) {
      console.warn('[OfflineMode] Cache version mismatch, ignoring');
      return false;
    }

    // Check expiry
    const age = Date.now() - cached.timestamp;
    if (age > mergedConfig.cacheExpiry) {
      console.warn('[OfflineMode] Cache expired, ignoring');
      return false;
    }

    // Check organization match
    if (cached.organizationId !== organizationId) {
      console.warn('[OfflineMode] Cache organization mismatch');
      return false;
    }

    // Restore data to store
    setNodes(cached.nodes);
    setEdges(cached.edges);
    setAnomalies(cached.anomalies);
    setLastCacheTime(new Date(cached.timestamp));

    console.log(`[OfflineMode] Loaded ${cached.nodes.length} nodes from cache`);
    return true;
  }, [
    organizationId,
    mergedConfig.enableCache,
    mergedConfig.cacheExpiry,
    setNodes,
    setEdges,
    setAnomalies,
  ]);

  /**
   * Clear cached data
   */
  const clearCache = useCallback(() => {
    if (!organizationId) return;
    localStorage.removeItem(`${CACHE_KEY}-${organizationId}`);
    setLastCacheTime(null);
    console.log('[OfflineMode] Cache cleared');
  }, [organizationId]);

  /**
   * Handle going offline
   */
  const handleOffline = useCallback(() => {
    console.log('[OfflineMode] Going offline');
    setIsOnline(false);
    setSyncStatus('offline');

    // Save current state to cache
    saveToCache();

    // Disable Firestore network to prevent hanging requests
    disableNetwork(db).catch(console.error);
  }, [saveToCache, setSyncStatus]);

  /**
   * Handle coming back online
   */
  const handleOnline = useCallback(() => {
    console.log('[OfflineMode] Coming back online');
    setIsOnline(true);
    setSyncStatus('syncing');

    // Re-enable Firestore network
    enableNetwork(db)
      .then(() => {
        setRetryCount(0);
        setIsPollingFallback(false);
        setSyncStatus('connected');
      })
      .catch((error) => {
        console.error('[OfflineMode] Failed to reconnect:', error);
        handleReconnectFailure();
      });
  }, [setSyncStatus]);

  /**
   * Handle reconnection failure
   */
  const handleReconnectFailure = useCallback(() => {
    setRetryCount((prev) => prev + 1);

    if (retryCount >= mergedConfig.maxRetryAttempts) {
      console.log('[OfflineMode] Max retries reached, enabling polling fallback');
      setIsPollingFallback(true);
      startPollingFallback();
    } else {
      // Exponential backoff retry
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`[OfflineMode] Retrying in ${delay}ms (attempt ${retryCount + 1})`);

      reconnectTimeoutRef.current = setTimeout(() => {
        enableNetwork(db)
          .then(() => {
            setRetryCount(0);
            setSyncStatus('connected');
          })
          .catch(handleReconnectFailure);
      }, delay);
    }
  }, [retryCount, mergedConfig.maxRetryAttempts, setSyncStatus]);

  /**
   * Start polling fallback mode
   */
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log('[OfflineMode] Starting polling fallback');

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Attempt to reconnect
        await enableNetwork(db);
        setIsPollingFallback(false);
        setRetryCount(0);
        setSyncStatus('connected');

        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } catch {
        // Still offline, continue polling
        console.log('[OfflineMode] Still offline, continuing poll');
      }
    }, mergedConfig.pollingInterval);
  }, [mergedConfig.pollingInterval, setSyncStatus]);

  /**
   * Stop polling fallback
   */
  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPollingFallback(false);
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Auto-save cache periodically when online
  useEffect(() => {
    if (!isOnline || !mergedConfig.enableCache) return;

    const interval = setInterval(saveToCache, 60000); // Every minute
    return () => clearInterval(interval);
  }, [isOnline, mergedConfig.enableCache, saveToCache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPollingFallback();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [stopPollingFallback]);

  // Load from cache on initial mount if offline
  useEffect(() => {
    if (!isOnline && mergedConfig.enableCache) {
      loadFromCache();
    }
  }, [isOnline, mergedConfig.enableCache, loadFromCache]);

  return {
    isOnline,
    isFirestorePersistenceEnabled,
    isPollingFallback,
    lastCacheTime,
    retryCount,
    saveToCache,
    loadFromCache,
    clearCache,
    hasIndexedDB: isIndexedDBAvailable(),
  };
}

export default useOfflineMode;
