/**
 * useVoxelData - Hook for loading and managing Voxel graph data
 *
 * Provides initial data loading with GraphBuilder transformation,
 * React Query caching, and integration with the voxel store.
 *
 * @see Story VOX-6.1: Data Transformer Service
 * @see Story VOX-6.2: Firestore Realtime Integration
 * @see Story VOX-6.3: Multi-Tenant Isolation
 * @see Story VOX-6.4: Graph Building Service
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
 collection,
 query,
 where,
 getDocs,
 orderBy,
 limit,
 QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useStore } from '@/store';
import { useVoxelStore } from '@/stores/voxelStore';
import { ErrorLogger } from '@/services/errorLogger';
import { buildGraph, type GraphBuilderInput, type VoxelGraph } from '@/services/voxel';
import { filterNodesByPermission } from './useRbacNodeFilter';
import type { Asset } from '@/types/assets';
import type { Risk } from '@/types/risks';
import type { Control } from '@/types/controls';
import type { Project } from '@/types/projects';
import type { Audit } from '@/types/audits';
import type { Incident } from '@/types/incidents';
import type { Supplier } from '@/types/business';
import type { VoxelEdge } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface UseVoxelDataOptions {
 /** Enable/disable data fetching */
 enabled?: boolean;
 /** Maximum number of nodes per collection */
 maxNodesPerCollection?: number;
 /** Collections to fetch */
 collections?: (keyof GraphBuilderInput)[];
 /** Stale time in ms (default: 30s) */
 staleTime?: number;
 /** Cache time in ms (default: 5min) */
 cacheTime?: number;
 /** Enable RBAC filtering (default: true) - filters nodes based on user permissions */
 enableRbacFiltering?: boolean;
}

export interface UseVoxelDataReturn {
 /** Whether data is loading */
 isLoading: boolean;
 /** Whether initial load is complete */
 isLoaded: boolean;
 /** Any error that occurred */
 error: Error | null;
 /** Number of nodes loaded */
 nodeCount: number;
 /** Number of edges loaded */
 edgeCount: number;
 /** Refetch data */
 refetch: () => Promise<void>;
 /** Clear and reload */
 reload: () => Promise<void>;
}

const DEFAULT_OPTIONS: UseVoxelDataOptions = {
 enabled: true,
 maxNodesPerCollection: 1000,
 collections: ['assets', 'risks', 'controls', 'projects', 'audits', 'incidents', 'suppliers'],
 staleTime: 30000,
 cacheTime: 300000,
 enableRbacFiltering: true,
};

// ============================================================================
// Firestore Fetchers
// ============================================================================

async function fetchCollection<T>(
 collectionName: string,
 organizationId: string,
 maxNodes: number
): Promise<T[]> {
 const constraints: QueryConstraint[] = [
 where('organizationId', '==', organizationId),
 limit(maxNodes),
 ];

 // Add ordering where applicable
 if (['risks', 'incidents'].includes(collectionName)) {
 constraints.push(orderBy('createdAt', 'desc'));
 }

 try {
 const q = query(collection(db, collectionName), ...constraints);
 const snapshot = await getDocs(q);
 return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
 } catch (error) {
 ErrorLogger.warn(`Failed to fetch ${collectionName}`, 'useVoxelData', { metadata: { error } });
 return [];
 }
}

async function fetchAllCollections(
 organizationId: string,
 collections: (keyof GraphBuilderInput)[],
 maxNodes: number
): Promise<GraphBuilderInput> {
 const results = await Promise.all([
 collections.includes('assets')
 ? fetchCollection<Asset>('assets', organizationId, maxNodes)
 : Promise.resolve([]),
 collections.includes('risks')
 ? fetchCollection<Risk>('risks', organizationId, maxNodes)
 : Promise.resolve([]),
 collections.includes('controls')
 ? fetchCollection<Control>('controls', organizationId, maxNodes)
 : Promise.resolve([]),
 collections.includes('projects')
 ? fetchCollection<Project>('projects', organizationId, maxNodes)
 : Promise.resolve([]),
 collections.includes('audits')
 ? fetchCollection<Audit>('audits', organizationId, maxNodes)
 : Promise.resolve([]),
 collections.includes('incidents')
 ? fetchCollection<Incident>('incidents', organizationId, maxNodes)
 : Promise.resolve([]),
 collections.includes('suppliers')
 ? fetchCollection<Supplier>('suppliers', organizationId, maxNodes)
 : Promise.resolve([]),
 ]);

 return {
 assets: results[0] as Asset[],
 risks: results[1] as Risk[],
 controls: results[2] as Control[],
 projects: results[3] as Project[],
 audits: results[4] as Audit[],
 incidents: results[5] as Incident[],
 suppliers: results[6] as Supplier[],
 };
}

// ============================================================================
// Hook
// ============================================================================

export function useVoxelData(options: UseVoxelDataOptions = {}): UseVoxelDataReturn {
 const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
 const { user } = useStore();
 const organizationId = user?.organizationId;
 const queryClient = useQueryClient();

 // Store actions
 const setNodes = useVoxelStore((s) => s.setNodes);
 const setEdges = useVoxelStore((s) => s.setEdges);
 const clearNodes = useVoxelStore((s) => s.clearNodes);
 const clearEdges = useVoxelStore((s) => s.clearEdges);
 const setSyncStatus = useVoxelStore((s) => s.setSyncStatus);
 const setLastSyncAt = useVoxelStore((s) => s.setLastSyncAt);

 // Track if we've populated the store
 const hasPopulatedRef = useRef(false);

 // Fetch data with React Query
 const {
 data: graphData,
 isLoading,
 error,
 refetch: queryRefetch,
 } = useQuery<VoxelGraph, Error>({
 queryKey: ['voxel-data', organizationId],
 queryFn: async () => {
 if (!organizationId) {
 throw new Error('No organization ID');
 }

 setSyncStatus('syncing');
 ErrorLogger.debug(`Fetching data for org: ${organizationId}`, 'useVoxelData');

 const rawData = await fetchAllCollections(
 organizationId,
 mergedOptions.collections!,
 mergedOptions.maxNodesPerCollection!
 );

 ErrorLogger.debug('Raw data counts: ' + JSON.stringify({
 assets: rawData.assets.length,
 risks: rawData.risks.length,
 controls: rawData.controls.length,
 projects: rawData.projects?.length || 0,
 audits: rawData.audits?.length || 0,
 incidents: rawData.incidents?.length || 0,
 suppliers: rawData.suppliers?.length || 0,
 }), 'useVoxelData');

 // Transform to Voxel graph
 const graph = buildGraph(rawData);

 ErrorLogger.debug(`Built graph: nodes=${graph.nodes.length}, edges=${graph.edges.length}`, 'useVoxelData');

 return graph;
 },
 enabled: mergedOptions.enabled && !!organizationId,
 staleTime: mergedOptions.staleTime,
 gcTime: mergedOptions.cacheTime,
 retry: 2,
 retryDelay: 1000,
 });

 // Apply RBAC filtering to the graph data
 const filteredGraphData = useMemo((): VoxelGraph | undefined => {
 if (!graphData) return undefined;
 if (!mergedOptions.enableRbacFiltering) return graphData;

 const filteredNodes = filterNodesByPermission(graphData.nodes, user);

 // If no nodes were filtered, return original data
 if (filteredNodes.length === graphData.nodes.length) {
 return graphData;
 }

 // Filter edges to only include connections between visible nodes
 const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
 const filteredEdges: VoxelEdge[] = graphData.edges.filter(
 (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
 );

 ErrorLogger.debug('RBAC filtered: ' + JSON.stringify({
 originalNodes: graphData.nodes.length,
 filteredNodes: filteredNodes.length,
 originalEdges: graphData.edges.length,
 filteredEdges: filteredEdges.length,
 }), 'useVoxelData');

 return {
 nodes: filteredNodes,
 edges: filteredEdges,
 };
 }, [graphData, mergedOptions.enableRbacFiltering, user]);

 // Populate store when data is available (use filtered data)
 useEffect(() => {
 if (filteredGraphData && !hasPopulatedRef.current) {
 ErrorLogger.debug(`Populating store with ${filteredGraphData.nodes.length} nodes`, 'useVoxelData');

 // Pass arrays directly - the store converts them to Maps internally
 setNodes(filteredGraphData.nodes);
 setEdges(filteredGraphData.edges);
 setSyncStatus('connected');
 setLastSyncAt(new Date());

 hasPopulatedRef.current = true;
 }
 }, [filteredGraphData, setNodes, setEdges, setSyncStatus, setLastSyncAt]);

 // Handle errors
 useEffect(() => {
 if (error) {
 ErrorLogger.error(error, 'useVoxelData');
 setSyncStatus('offline');
 }
 }, [error, setSyncStatus]);

 // Refetch handler
 const refetch = useCallback(async () => {
 hasPopulatedRef.current = false;
 await queryRefetch();
 }, [queryRefetch]);

 // Full reload handler (clear + refetch)
 const reload = useCallback(async () => {
 hasPopulatedRef.current = false;
 clearNodes();
 clearEdges();
 queryClient.invalidateQueries({ queryKey: ['voxel-data', organizationId] });
 await queryRefetch();
 }, [clearNodes, clearEdges, queryClient, organizationId, queryRefetch]);

 return {
 isLoading,
 isLoaded: !!filteredGraphData,
 error: error || null,
 nodeCount: filteredGraphData?.nodes.length || 0,
 edgeCount: filteredGraphData?.edges.length || 0,
 refetch,
 reload,
 };
}

export default useVoxelData;
