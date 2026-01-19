/**
 * Story 28.2 - Firestore Real-time Listeners for Voxel
 *
 * This hook manages real-time subscriptions to Firestore collections
 * and syncs data to the Voxel Zustand store with debounced batch updates.
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

interface RealtimeConfig {
  /** Enable/disable real-time sync */
  enabled: boolean;
  /** Debounce delay in milliseconds for batch updates */
  debounceMs: number;
  /** Collections to subscribe to */
  collections: string[];
}

const DEFAULT_CONFIG: RealtimeConfig = {
  enabled: true,
  debounceMs: 100,
  collections: ['assets', 'risks', 'controls', 'incidents', 'suppliers', 'projects', 'audits'],
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

  const unsubscribersRef = useRef<Unsubscribe[]>([]);
  const pendingUpdatesRef = useRef<{
    added: VoxelNode[];
    modified: VoxelNode[];
    removed: string[];
  }>({ added: [], modified: [], removed: [] });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

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

      console.log(
        `[VoxelRealtime] Flushed updates: +${updates.added.length} ~${updates.modified.length} -${updates.removed.length}`
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

    console.log('[VoxelRealtime] Setting up listeners for org:', organizationId);
    setSyncStatus('syncing');

    // Track successful listener count
    let activeListeners = 0;
    const totalListeners = mergedConfig.collections.length;

    // Setup listener for each collection
    for (const collectionName of mergedConfig.collections) {
      const nodeType = COLLECTION_TO_NODE_TYPE[collectionName];
      if (!nodeType) {
        console.warn(`[VoxelRealtime] Unknown collection: ${collectionName}`);
        continue;
      }

      try {
        const q = query(
          collection(db, collectionName),
          where('organizationId', '==', organizationId)
        );

        const unsubscribe = onSnapshot(
          q,
          (snapshot: QuerySnapshot<DocumentData>) => {
            handleSnapshotChanges(snapshot.docChanges(), nodeType);

            // Update sync status after first successful snapshot
            activeListeners++;
            if (activeListeners >= totalListeners) {
              setSyncStatus('connected');
            }
          },
          (error) => {
            console.error(`[VoxelRealtime] Error in ${collectionName} listener:`, error);
            setSyncStatus('offline');
          }
        );

        unsubscribersRef.current.push(unsubscribe);
      } catch (error) {
        console.error(`[VoxelRealtime] Failed to setup ${collectionName} listener:`, error);
      }
    }

    // Cleanup function
    return () => {
      console.log('[VoxelRealtime] Cleaning up listeners');
      unsubscribersRef.current.forEach((unsub) => unsub());
      unsubscribersRef.current = [];
      isInitializedRef.current = false;

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
    handleSnapshotChanges,
  ]);

  return {
    isEnabled: mergedConfig.enabled,
    collections: mergedConfig.collections,
  };
}

export default useVoxelRealtime;
