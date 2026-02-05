/**
 * Story 28.2 - Firestore Real-time Listeners for Voxel
 *
 * This hook manages real-time subscriptions to Firestore collections
 * and syncs data to the Voxel Zustand store with debounced batch updates.
 *
 * RELIABILITY FIX: Added exponential backoff retry logic for failed listeners
 */

import { useEffect, useRef, useCallback } from 'react';
import {
 collection,
 query,
 where,
 onSnapshot,
 DocumentChange,
 QuerySnapshot,
 DocumentData,
 Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useStore } from '@/store';
import { useVoxelStore } from '@/stores/voxelStore';
import type { VoxelNode, VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';
import { ErrorLogger } from '@/services/errorLogger';

interface RealtimeConfig {
 /** Enable/disable real-time sync */
 enabled: boolean;
 /** Debounce delay in milliseconds for batch updates */
 debounceMs: number;
 /** Collections to subscribe to */
 collections: string[];
 /** Maximum retry attempts per collection */
 maxRetries: number;
 /** Base delay for exponential backoff (ms) */
 retryBaseDelayMs: number;
 /** Maximum delay between retries (ms) */
 retryMaxDelayMs: number;
}

const DEFAULT_CONFIG: RealtimeConfig = {
 enabled: true,
 debounceMs: 100,
 collections: ['assets', 'risks', 'controls', 'incidents', 'suppliers', 'projects', 'audits'],
 maxRetries: 5,
 retryBaseDelayMs: 1000,
 retryMaxDelayMs: 30000,
};

/** Mapping from Firestore collection name to VoxelNodeType */
const COLLECTION_TO_NODE_TYPE: Record<string, VoxelNodeType> = {
 assets: 'asset',
 risks: 'risk',
 controls: 'control',
 incidents: 'incident',
 suppliers: 'supplier',
 projects: 'project',
 audits: 'audit',
};

/**
 * Determine node status based on entity type and data
 */
function determineNodeStatus(type: VoxelNodeType, data: DocumentData): VoxelNodeStatus {
 switch (type) {
 case 'risk': {
 const severity = data.severity || data.riskLevel || data.level;
 if (severity === 'critical' || severity === 'Critique' || severity === 4) return 'critical';
 if (severity === 'high' || severity === 'Élevé' || severity === 3) return 'warning';
 if (severity === 'inactive' || data.status === 'mitigated') return 'inactive';
 return 'normal';
 }

 case 'incident': {
 const status = data.status?.toLowerCase();
 if (status === 'open' || status === 'ouvert' || status === 'new') return 'critical';
 if (status === 'in_progress' || status === 'investigating') return 'warning';
 if (status === 'resolved' || status === 'closed') return 'inactive';
 return 'normal';
 }

 case 'control': {
 const effectiveness = data.effectiveness ?? data.maturity ?? data.score ?? 100;
 if (effectiveness < 30) return 'critical';
 if (effectiveness < 60) return 'warning';
 if (data.status === 'inactive' || data.status === 'deprecated') return 'inactive';
 return 'normal';
 }

 case 'audit': {
 const status = data.status?.toLowerCase();
 if (status === 'failed' || status === 'non_compliant') return 'critical';
 if (status === 'in_progress' || status === 'pending') return 'warning';
 if (status === 'completed' || status === 'compliant') return 'normal';
 return 'normal';
 }

 case 'supplier': {
 const riskLevel = data.riskLevel || data.criticality;
 if (riskLevel === 'critical' || riskLevel === 'high') return 'warning';
 if (data.status === 'inactive' || data.status === 'offboarded') return 'inactive';
 return 'normal';
 }

 case 'asset': {
 const criticality = data.criticality || data.importance;
 if (criticality === 'critical' && data.hasVulnerabilities) return 'critical';
 if (criticality === 'high') return 'warning';
 if (data.status === 'decommissioned' || data.status === 'inactive') return 'inactive';
 return 'normal';
 }

 case 'project': {
 const status = data.status?.toLowerCase();
 if (status === 'at_risk' || status === 'blocked') return 'critical';
 if (status === 'delayed') return 'warning';
 if (status === 'completed' || status === 'cancelled') return 'inactive';
 return 'normal';
 }

 default:
 return 'normal';
 }
}

/**
 * Extract connections (relationships) from entity data
 */
function extractConnections(data: DocumentData): string[] {
 const connections: string[] = [];

 // Common relationship fields
 const relationshipFields = [
 'relatedAssetIds',
 'relatedRiskIds',
 'relatedControlIds',
 'relatedSupplierIds',
 'relatedProjectIds',
 'relatedAuditIds',
 'relatedIncidentIds',
 'linkedAssets',
 'linkedRisks',
 'linkedControls',
 'mitigatedBy',
 'mitigatingControls',
 'affectedAssets',
 'responsibleSuppliers',
 'assetIds',
 'riskIds',
 'controlIds',
 'supplierId',
 'projectId',
 'auditId',
 ];

 for (const field of relationshipFields) {
 const value = data[field];
 if (Array.isArray(value)) {
 connections.push(...value.filter((id: unknown) => typeof id === 'string'));
 } else if (typeof value === 'string' && value) {
 connections.push(value);
 }
 }

 // Remove duplicates
 return [...new Set(connections)];
}

/**
 * Transform a Firestore document to a VoxelNode
 */
function transformToVoxelNode(
 doc: DocumentData,
 id: string,
 type: VoxelNodeType
): VoxelNode {
 const data = doc;

 // Determine label from various possible fields
 const label =
 data.name ||
 data.title ||
 data.description?.substring(0, 50) ||
 data.reference ||
 id;

 // Get or generate position
 const position = data.voxelPosition || {
 x: Math.random() * 20 - 10,
 y: Math.random() * 20 - 10,
 z: Math.random() * 20 - 10,
 };

 // Parse dates
 const createdAt = data.createdAt?.toDate?.() || new Date();
 const updatedAt = data.updatedAt?.toDate?.() || new Date();

 return {
 id,
 type,
 label,
 status: determineNodeStatus(type, data),
 position,
 size: data.size ?? 1,
 data: {
 ...data,
 entityType: type,
 },
 connections: extractConnections(data),
 createdAt,
 updatedAt,
 };
}

/**
 * Hook for real-time Voxel data synchronization with Firestore
 */
export function useVoxelRealtime(config: Partial<RealtimeConfig> = {}) {
 const { user } = useStore();
 const organizationId = user?.organizationId;

 const setSyncStatus = useVoxelStore((s) => s.setSyncStatus);
 const setLastSyncAt = useVoxelStore((s) => s.setLastSyncAt);
 const addNode = useVoxelStore((s) => s.addNode);
 const updateNode = useVoxelStore((s) => s.updateNode);
 const removeNode = useVoxelStore((s) => s.removeNode);

 const unsubscribersRef = useRef<Map<string, Unsubscribe>>(new Map());
 const pendingUpdatesRef = useRef<{
 added: VoxelNode[];
 modified: VoxelNode[];
 removed: string[];
 }>({ added: [], modified: [], removed: [] });
 const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const isInitializedRef = useRef(false);

 // Retry state tracking
 const retryAttemptsRef = useRef<Map<string, number>>(new Map());
 const retryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
 const connectedCollectionsRef = useRef<Set<string>>(new Set());

 // Ref to hold setupCollectionListener for recursive calls
 const setupCollectionListenerRef = useRef<((collectionName: string, orgId: string) => void) | null>(null);

 const mergedConfig = { ...DEFAULT_CONFIG, ...config };

 /**
 * Calculate exponential backoff delay with jitter
 */
 const calculateBackoff = useCallback((attempt: number): number => {
 const baseDelay = mergedConfig.retryBaseDelayMs;
 const maxDelay = mergedConfig.retryMaxDelayMs;
 // Exponential backoff: base * 2^attempt with jitter
 const exponentialDelay = baseDelay * Math.pow(2, attempt);
 const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
 return Math.min(exponentialDelay + jitter, maxDelay);
 }, [mergedConfig.retryBaseDelayMs, mergedConfig.retryMaxDelayMs]);

 /**
 * Flush pending updates to the store
 */
 const flushUpdates = useCallback(() => {
 const updates = pendingUpdatesRef.current;

 if (updates.added.length > 0 || updates.modified.length > 0 || updates.removed.length > 0) {
 // Add new nodes
 updates.added.forEach((node) => addNode(node));

 // Update modified nodes
 updates.modified.forEach((node) => updateNode(node.id, node));

 // Remove deleted nodes
 updates.removed.forEach((id) => removeNode(id));

 // Update sync timestamp
 setLastSyncAt(new Date());

 ErrorLogger.debug(
 `Flushed updates: +${updates.added.length} ~${updates.modified.length} -${updates.removed.length}`,
 'VoxelRealtime'
 );
 }

 // Reset pending updates
 pendingUpdatesRef.current = { added: [], modified: [], removed: [] };
 }, [addNode, updateNode, removeNode, setLastSyncAt]);

 /**
 * Schedule a debounced flush
 */
 const scheduleFlush = useCallback(() => {
 if (debounceTimerRef.current) {
 clearTimeout(debounceTimerRef.current);
 }
 debounceTimerRef.current = setTimeout(flushUpdates, mergedConfig.debounceMs);
 }, [flushUpdates, mergedConfig.debounceMs]);

 /**
 * Handle snapshot changes from a collection
 */
 const handleSnapshotChanges = useCallback(
 (changes: DocumentChange<DocumentData>[], nodeType: VoxelNodeType) => {
 for (const change of changes) {
 const node = transformToVoxelNode(change.doc.data(), change.doc.id, nodeType);

 switch (change.type) {
 case 'added':
 pendingUpdatesRef.current.added.push(node);
 break;
 case 'modified':
 pendingUpdatesRef.current.modified.push(node);
 break;
 case 'removed':
 pendingUpdatesRef.current.removed.push(change.doc.id);
 break;
 }
 }

 scheduleFlush();
 },
 [scheduleFlush]
 );

 /**
 * Update overall sync status based on connected collections
 */
 const updateSyncStatus = useCallback(() => {
 const totalCollections = mergedConfig.collections.length;
 const connectedCount = connectedCollectionsRef.current.size;

 if (connectedCount === 0) {
 setSyncStatus('offline');
 } else if (connectedCount < totalCollections) {
 // Partial connectivity - show syncing
 setSyncStatus('syncing');
 } else {
 setSyncStatus('connected');
 }
 }, [mergedConfig.collections.length, setSyncStatus]);

 /**
 * Setup a single collection listener with retry capability
 */
 const setupCollectionListener = useCallback(
 (collectionName: string, orgId: string) => {
 const nodeType = COLLECTION_TO_NODE_TYPE[collectionName];
 if (!nodeType) {
 ErrorLogger.warn(`Unknown collection: ${collectionName}`, 'VoxelRealtime');
 return;
 }

 // Clear any existing retry timer
 const existingTimer = retryTimersRef.current.get(collectionName);
 if (existingTimer) {
 clearTimeout(existingTimer);
 retryTimersRef.current.delete(collectionName);
 }

 // Unsubscribe from existing listener if any
 const existingUnsub = unsubscribersRef.current.get(collectionName);
 if (existingUnsub) {
 existingUnsub();
 unsubscribersRef.current.delete(collectionName);
 }

 try {
 const q = query(
 collection(db, collectionName),
 where('organizationId', '==', orgId)
 );

 const unsubscribe = onSnapshot(
 q,
 (snapshot: QuerySnapshot<DocumentData>) => {
 handleSnapshotChanges(snapshot.docChanges(), nodeType);

 // Mark collection as connected and reset retry count
 connectedCollectionsRef.current.add(collectionName);
 retryAttemptsRef.current.set(collectionName, 0);
 updateSyncStatus();
 },
 (error) => {
 // Remove from connected set
 connectedCollectionsRef.current.delete(collectionName);
 updateSyncStatus();

 // Get current retry attempt
 const currentAttempt = retryAttemptsRef.current.get(collectionName) ?? 0;

 if (currentAttempt < mergedConfig.maxRetries) {
 // Calculate backoff delay
 const delay = calculateBackoff(currentAttempt);
 const nextAttempt = currentAttempt + 1;

 ErrorLogger.warn(
 `Firestore listener error, retrying (${nextAttempt}/${mergedConfig.maxRetries})`,
 'useVoxelRealtime.setupCollectionListener',
 { metadata: { collectionName, error: error.message, delay } }
 );

 ErrorLogger.warn(
 `Error in ${collectionName} listener, retry ${nextAttempt}/${mergedConfig.maxRetries} in ${Math.round(delay)}ms`,
 'VoxelRealtime'
 );

 // Schedule retry using ref to avoid accessing variable before declaration
 retryAttemptsRef.current.set(collectionName, nextAttempt);
 const retryTimer = setTimeout(() => {
 setupCollectionListenerRef.current?.(collectionName, orgId);
 }, delay);
 retryTimersRef.current.set(collectionName, retryTimer);
 } else {
 // Max retries exceeded
 ErrorLogger.error(
 error,
 'useVoxelRealtime.setupCollectionListener.maxRetriesExceeded',
 { metadata: { collectionName, maxRetries: mergedConfig.maxRetries } }
 );

 ErrorLogger.error(
 new Error(`Max retries (${mergedConfig.maxRetries}) exceeded for ${collectionName} listener`),
 'VoxelRealtime.maxRetriesExceeded'
 );
 }
 }
 );

 unsubscribersRef.current.set(collectionName, unsubscribe);
 } catch (error) {
 ErrorLogger.error(error, 'useVoxelRealtime.setupCollectionListener.setupFailed', {
 metadata: { collectionName },
 });
 }
 },
 [handleSnapshotChanges, updateSyncStatus, calculateBackoff, mergedConfig.maxRetries]
 );

 // Store the callback in ref for recursive calls (must be in effect, not render)
 useEffect(() => {
 setupCollectionListenerRef.current = setupCollectionListener;
 }, [setupCollectionListener]);

 /**
 * Setup real-time listeners
 */
 useEffect(() => {
 if (!mergedConfig.enabled || !user || !organizationId) {
 return;
 }

 // Prevent duplicate initialization
 if (isInitializedRef.current) {
 return;
 }
 isInitializedRef.current = true;

 ErrorLogger.debug(`Setting up listeners for org: ${organizationId}`, 'VoxelRealtime');
 setSyncStatus('syncing');

 // Reset retry state
 retryAttemptsRef.current.clear();
 connectedCollectionsRef.current.clear();

 // Setup listener for each collection
 for (const collectionName of mergedConfig.collections) {
 setupCollectionListener(collectionName, organizationId);
 }

 // Capture ref values at effect start for cleanup
 const currentUnsubscribers = unsubscribersRef.current;
 const currentRetryTimers = retryTimersRef.current;
 const currentRetryAttempts = retryAttemptsRef.current;
 const currentConnectedCollections = connectedCollectionsRef.current;

 // Cleanup function
 return () => {
 ErrorLogger.debug('Cleaning up listeners', 'VoxelRealtime');

 // Clear all unsubscribers
 currentUnsubscribers.forEach((unsub) => unsub());
 currentUnsubscribers.clear();

 // Clear all retry timers
 currentRetryTimers.forEach((timer) => clearTimeout(timer));
 currentRetryTimers.clear();

 // Reset state
 currentRetryAttempts.clear();
 currentConnectedCollections.clear();
 isInitializedRef.current = false;

 // Clear debounce timer - use ref directly since timer may be set after effect start
 if (debounceTimerRef.current) {
 clearTimeout(debounceTimerRef.current);
 debounceTimerRef.current = null;
 }
 };
 }, [
 user,
 organizationId,
 mergedConfig.enabled,
 mergedConfig.collections,
 setSyncStatus,
 setupCollectionListener,
 ]);

 /**
 * Manually retry all failed listeners
 * Useful for reconnection after network recovery
 */
 const retryAllFailed = useCallback(() => {
 if (!organizationId) return;

 const failedCollections = mergedConfig.collections.filter(
 (col) => !connectedCollectionsRef.current.has(col)
 );

 if (failedCollections.length === 0) {
 ErrorLogger.debug('All collections already connected', 'VoxelRealtime');
 return;
 }

 ErrorLogger.info(`Retrying failed collections: ${failedCollections.join(', ')}`, 'VoxelRealtime');

 // Reset retry attempts for failed collections
 failedCollections.forEach((col) => {
 retryAttemptsRef.current.set(col, 0);
 setupCollectionListener(col, organizationId);
 });
 }, [organizationId, mergedConfig.collections, setupCollectionListener]);

 /**
 * Listen for online/offline events to trigger reconnection
 */
 useEffect(() => {
 const handleOnline = () => {
 ErrorLogger.info('Network online - retrying failed listeners', 'VoxelRealtime');
 retryAllFailed();
 };

 window.addEventListener('online', handleOnline);

 return () => {
 window.removeEventListener('online', handleOnline);
 };
 }, [retryAllFailed]);

 // Provide a getter function to avoid accessing ref during render
 const getConnectedCount = useCallback(() => connectedCollectionsRef.current.size, []);

 return {
 isEnabled: mergedConfig.enabled,
 collections: mergedConfig.collections,
 getConnectedCount,
 retryAllFailed,
 };
}

export default useVoxelRealtime;
