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
import { ErrorLogger } from '@/services/errorLogger';
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
 ErrorLogger.warn('Failed to save to localStorage', 'OfflineMode', { metadata: { error } });
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
 ErrorLogger.debug('Firestore persistence enabled', 'OfflineMode');
 setFirestorePersistenceEnabled(true);
 })
 .catch((error) => {
 if (error.code === 'failed-precondition') {
 ErrorLogger.warn('Multiple tabs open, persistence limited', 'OfflineMode');
 } else if (error.code === 'unimplemented') {
 ErrorLogger.warn('Browser does not support persistence', 'OfflineMode');
 } else {
 ErrorLogger.error(error, 'OfflineMode.enablePersistence');
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
 ErrorLogger.debug('Data cached successfully', 'OfflineMode');
 }, [organizationId, nodes, edges, anomalies, mergedConfig.enableCache]);

 /**
 * Load state from cache
 */
 const loadFromCache = useCallback((): boolean => {
 if (!organizationId || !mergedConfig.enableCache) return false;

 const cached = loadFromLocalStorage(`${CACHE_KEY}-${organizationId}`);

 if (!cached) {
 ErrorLogger.debug('No cached data found', 'OfflineMode');
 return false;
 }

 // Check version compatibility
 if (cached.version !== CACHE_VERSION) {
 ErrorLogger.warn('Cache version mismatch, ignoring', 'OfflineMode');
 return false;
 }

 // Check expiry
 const age = Date.now() - cached.timestamp;
 if (age > mergedConfig.cacheExpiry) {
 ErrorLogger.warn('Cache expired, ignoring', 'OfflineMode');
 return false;
 }

 // Check organization match
 if (cached.organizationId !== organizationId) {
 ErrorLogger.warn('Cache organization mismatch', 'OfflineMode');
 return false;
 }

 // Restore data to store
 setNodes(cached.nodes);
 setEdges(cached.edges);
 setAnomalies(cached.anomalies);
 setLastCacheTime(new Date(cached.timestamp));

 ErrorLogger.debug(`Loaded ${cached.nodes.length} nodes from cache`, 'OfflineMode');
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
 ErrorLogger.debug('Cache cleared', 'OfflineMode');
 }, [organizationId]);

 /**
 * Handle going offline
 */
 const handleOffline = useCallback(() => {
 ErrorLogger.info('Going offline', 'OfflineMode');
 setIsOnline(false);
 setSyncStatus('offline');

 // Save current state to cache
 saveToCache();

 // Disable Firestore network to prevent hanging requests
 disableNetwork(db).catch((err) => ErrorLogger.error(err, 'OfflineMode.disableNetwork'));
 }, [saveToCache, setSyncStatus]);



 /**
 * Handle reconnection failure
 */
 // FIXED: Track polling attempts to prevent infinite polling
 const pollingAttemptsRef = useRef(0);
 const MAX_POLLING_ATTEMPTS = 100; // Stop after ~50 minutes at 30s intervals

 /**
 * Start polling fallback mode
 * FIXED: Added max polling attempts to prevent infinite resource consumption
 */
 const startPollingFallback = useCallback(() => {
 if (pollingIntervalRef.current) return;

 ErrorLogger.info('Starting polling fallback', 'OfflineMode');
 pollingAttemptsRef.current = 0;

 pollingIntervalRef.current = setInterval(async () => {
 pollingAttemptsRef.current += 1;

 // FIXED: Stop polling after max attempts to prevent memory leak
 if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
 ErrorLogger.warn('Max polling attempts reached, stopping fallback', 'OfflineMode');
 if (pollingIntervalRef.current) {
 clearInterval(pollingIntervalRef.current);
 pollingIntervalRef.current = null;
 }
 setIsPollingFallback(false);
 setSyncStatus('offline');
 return;
 }

 try {
 // Attempt to reconnect
 await enableNetwork(db);
 setIsPollingFallback(false);
 setRetryCount(0);
 setSyncStatus('connected');
 pollingAttemptsRef.current = 0;

 // Stop polling on success
 if (pollingIntervalRef.current) {
 clearInterval(pollingIntervalRef.current);
 pollingIntervalRef.current = null;
 }
 } catch {
 // Still offline, continue polling (with attempt tracking)
 ErrorLogger.debug(`Still offline, poll attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS}`, 'OfflineMode');
 }
 }, mergedConfig.pollingInterval);
 }, [mergedConfig.pollingInterval, setSyncStatus]);

 /**
 * Handle reconnection failure
 */
 const handleReconnectFailureRef = useRef<() => void>(() => { });

 const handleReconnectFailure = useCallback(() => {
 setRetryCount((prev) => prev + 1);

 if (retryCount >= mergedConfig.maxRetryAttempts) {
 ErrorLogger.info('Max retries reached, enabling polling fallback', 'OfflineMode');
 setIsPollingFallback(true);
 startPollingFallback();
 } else {
 const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
 ErrorLogger.debug(`Retrying in ${delay}ms (attempt ${retryCount + 1})`, 'OfflineMode');

 reconnectTimeoutRef.current = setTimeout(() => {
 enableNetwork(db)
 .then(() => {
 setRetryCount(0);
 setSyncStatus('connected');
 })
 .catch(() => handleReconnectFailureRef.current());
 }, delay);
 }
 }, [retryCount, mergedConfig.maxRetryAttempts, setSyncStatus, startPollingFallback]);

 useEffect(() => {
 handleReconnectFailureRef.current = handleReconnectFailure;
 }, [handleReconnectFailure]);

 /**
 * Handle coming back online
 */
 const handleOnline = useCallback(() => {
 ErrorLogger.info('Coming back online', 'OfflineMode');
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
 ErrorLogger.error(error, 'OfflineMode.reconnect');
 handleReconnectFailure();
 });
 }, [setSyncStatus, handleReconnectFailure]);

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
 setTimeout(() => loadFromCache(), 0);
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
