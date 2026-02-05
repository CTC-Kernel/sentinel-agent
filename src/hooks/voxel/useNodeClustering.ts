/**
 * useNodeClustering - Hook for automatic node clustering
 *
 * Groups nearby nodes into clusters when zoomed out to improve
 * performance and readability. Clusters expand when zoomed in.
 *
 * @see Story VOX-9.4: Clustering Automatique
 * @see FR48: System auto-clusters nodes when zoomed out for better overview
 */

import { useMemo, useCallback } from 'react';
import type { VoxelNode } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface ClusterConfig {
 /** Minimum distance between nodes to form a cluster (default: 50) */
 clusterDistance?: number;
 /** Minimum nodes required to form a cluster (default: 3) */
 minNodesPerCluster?: number;
 /** Maximum nodes in a single cluster (default: 20) */
 maxNodesPerCluster?: number;
 /** Whether clustering is enabled (default: true) */
 enabled?: boolean;
 /** Zoom level at which clusters start forming (default: 500) */
 clusterZoomThreshold?: number;
 /** Current camera distance for adaptive clustering */
 cameraDistance?: number;
}

export interface NodeCluster {
 /** Unique cluster identifier */
 id: string;
 /** Cluster center position */
 position: { x: number; y: number; z: number };
 /** Nodes in this cluster */
 nodes: VoxelNode[];
 /** Number of nodes */
 count: number;
 /** Dominant type in cluster */
 dominantType: VoxelNode['type'];
 /** Highest severity status in cluster */
 maxStatus: VoxelNode['status'];
 /** Combined label for cluster */
 label: string;
 /** Cluster radius based on node spread */
 radius: number;
}

export interface ClusteringResult {
 /** Clusters formed from grouped nodes */
 clusters: NodeCluster[];
 /** Nodes that weren't clustered (remain individual) */
 standaloneNodes: VoxelNode[];
 /** Whether clustering is currently active */
 isActive: boolean;
 /** Total cluster count */
 clusterCount: number;
}

export interface UseNodeClusteringReturn extends ClusteringResult {
 /** Get all visible items (clusters + standalone nodes) */
 getVisibleItems: () => (NodeCluster | VoxelNode)[];
 /** Check if a node is part of a cluster */
 isNodeClustered: (nodeId: string) => boolean;
 /** Get the cluster containing a specific node */
 getClusterForNode: (nodeId: string) => NodeCluster | null;
 /** Expand a cluster to show its nodes */
 expandCluster: (clusterId: string) => VoxelNode[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<ClusterConfig> = {
 clusterDistance: 50,
 minNodesPerCluster: 3,
 maxNodesPerCluster: 20,
 enabled: true,
 clusterZoomThreshold: 500,
 cameraDistance: 0,
};

const STATUS_PRIORITY: Record<VoxelNode['status'], number> = {
 critical: 4,
 warning: 3,
 normal: 2,
 inactive: 1,
};

// ============================================================================
// Clustering Algorithm
// ============================================================================

/**
 * Calculate Euclidean distance between two positions
 */
function distance3D(
 a: { x: number; y: number; z: number },
 b: { x: number; y: number; z: number }
): number {
 const dx = a.x - b.x;
 const dy = a.y - b.y;
 const dz = a.z - b.z;
 return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Get the dominant type in a node group
 */
function getDominantType(nodes: VoxelNode[]): VoxelNode['type'] {
 const counts: Record<string, number> = {};
 for (const node of nodes) {
 counts[node.type] = (counts[node.type] || 0) + 1;
 }
 let maxType: VoxelNode['type'] = 'asset';
 let maxCount = 0;
 for (const [type, count] of Object.entries(counts)) {
 if (count > maxCount) {
 maxCount = count;
 maxType = type as VoxelNode['type'];
 }
 }
 return maxType;
}

/**
 * Get the highest severity status in a node group
 */
function getMaxStatus(nodes: VoxelNode[]): VoxelNode['status'] {
 let maxStatus: VoxelNode['status'] = 'inactive';
 let maxPriority = 0;
 for (const node of nodes) {
 const priority = STATUS_PRIORITY[node.status];
 if (priority > maxPriority) {
 maxPriority = priority;
 maxStatus = node.status;
 }
 }
 return maxStatus;
}

/**
 * Calculate cluster center and radius
 */
function calculateClusterBounds(nodes: VoxelNode[]): {
 center: { x: number; y: number; z: number };
 radius: number;
} {
 if (nodes.length === 0) {
 return { center: { x: 0, y: 0, z: 0 }, radius: 0 };
 }

 // Calculate center
 const sum = nodes.reduce(
 (acc, node) => ({
 x: acc.x + node.position.x,
 y: acc.y + node.position.y,
 z: acc.z + node.position.z,
 }),
 { x: 0, y: 0, z: 0 }
 );
 const center = {
 x: sum.x / nodes.length,
 y: sum.y / nodes.length,
 z: sum.z / nodes.length,
 };

 // Calculate radius (max distance from center)
 let maxDist = 0;
 for (const node of nodes) {
 const dist = distance3D(center, node.position);
 if (dist > maxDist) maxDist = dist;
 }

 return { center, radius: maxDist };
}

/**
 * Generate cluster label
 */
function generateClusterLabel(nodes: VoxelNode[], dominantType: VoxelNode['type']): string {
 const typeLabels: Record<VoxelNode['type'], string> = {
 risk: 'Risks',
 asset: 'Assets',
 control: 'Controls',
 incident: 'Incidents',
 supplier: 'Suppliers',
 project: 'Projects',
 audit: 'Audits',
 };
 return `${nodes.length} ${typeLabels[dominantType] || 'Items'}`;
}

/**
 * Cluster nodes using spatial proximity algorithm
 * Uses a simple grid-based clustering approach for performance
 */
export function clusterNodes(nodes: VoxelNode[], config: ClusterConfig = {}): ClusteringResult {
 const mergedConfig = { ...DEFAULT_CONFIG, ...config };
 const {
 clusterDistance,
 minNodesPerCluster,
 maxNodesPerCluster,
 enabled,
 clusterZoomThreshold,
 cameraDistance,
 } = mergedConfig;

 // Return all nodes as standalone if clustering disabled or zoomed in
 if (!enabled || cameraDistance < clusterZoomThreshold) {
 return {
 clusters: [],
 standaloneNodes: nodes,
 isActive: false,
 clusterCount: 0,
 };
 }

 // Adaptive cluster distance based on zoom level
 const adaptiveDistance = clusterDistance * (1 + cameraDistance / 1000);

 // Track which nodes have been assigned
 const assigned = new Set<string>();
 const clusters: NodeCluster[] = [];

 // Sort nodes by position for more consistent clustering
 const sortedNodes = [...nodes].sort((a, b) => {
 if (a.position.x !== b.position.x) return a.position.x - b.position.x;
 if (a.position.z !== b.position.z) return a.position.z - b.position.z;
 return a.position.y - b.position.y;
 });

 // Find clusters using simple proximity grouping
 for (const node of sortedNodes) {
 if (assigned.has(node.id)) continue;

 // Find nearby unassigned nodes
 const nearby: VoxelNode[] = [node];
 assigned.add(node.id);

 for (const other of sortedNodes) {
 if (assigned.has(other.id)) continue;
 if (nearby.length >= maxNodesPerCluster) break;

 // Check distance to cluster center (use first node as initial center)
 const clusterCenter = calculateClusterBounds(nearby).center;
 if (distance3D(clusterCenter, other.position) <= adaptiveDistance) {
 nearby.push(other);
 assigned.add(other.id);
 }
 }

 // Only form cluster if enough nodes
 if (nearby.length >= minNodesPerCluster) {
 const { center, radius } = calculateClusterBounds(nearby);
 const dominantType = getDominantType(nearby);

 clusters.push({
 id: `cluster-${clusters.length}`,
 position: center,
 nodes: nearby,
 count: nearby.length,
 dominantType,
 maxStatus: getMaxStatus(nearby),
 label: generateClusterLabel(nearby, dominantType),
 radius: Math.max(radius, 10), // Minimum visual radius
 });
 } else {
 // Not enough for cluster, remove from assigned so they stay standalone
 nearby.forEach((n) => assigned.delete(n.id));
 }
 }

 // Standalone nodes are those not in any cluster
 const standaloneNodes = nodes.filter((n) => !assigned.has(n.id));

 return {
 clusters,
 standaloneNodes,
 isActive: clusters.length > 0,
 clusterCount: clusters.length,
 };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for automatic node clustering based on zoom level
 *
 * @example
 * ```tsx
 * const { clusters, standaloneNodes, isActive } = useNodeClustering(nodes, {
 * cameraDistance: distance,
 * clusterDistance: 60,
 * });
 *
 * return (
 * <>
 * {clusters.map(cluster => (
 * <ClusterMesh key={cluster.id} cluster={cluster} />
 * ))}
 * {standaloneNodes.map(node => (
 * <NodeMesh key={node.id} node={node} />
 * ))}
 * </>
 * );
 * ```
 */
export function useNodeClustering(
 nodes: VoxelNode[],
 config: ClusterConfig = {}
): UseNodeClusteringReturn {
 // Memoize clustering result
 const result = useMemo(() => clusterNodes(nodes, config), [nodes, config]);

 // Build node-to-cluster map for quick lookups
 const nodeClusterMap = useMemo(() => {
 const map = new Map<string, NodeCluster>();
 for (const cluster of result.clusters) {
 for (const node of cluster.nodes) {
 map.set(node.id, cluster);
 }
 }
 return map;
 }, [result.clusters]);

 // Get all visible items
 const getVisibleItems = useCallback((): (NodeCluster | VoxelNode)[] => {
 return [...result.clusters, ...result.standaloneNodes];
 }, [result]);

 // Check if node is clustered
 const isNodeClustered = useCallback(
 (nodeId: string): boolean => {
 return nodeClusterMap.has(nodeId);
 },
 [nodeClusterMap]
 );

 // Get cluster for node
 const getClusterForNode = useCallback(
 (nodeId: string): NodeCluster | null => {
 return nodeClusterMap.get(nodeId) || null;
 },
 [nodeClusterMap]
 );

 // Expand cluster
 const expandCluster = useCallback(
 (clusterId: string): VoxelNode[] => {
 const cluster = result.clusters.find((c) => c.id === clusterId);
 return cluster?.nodes || [];
 },
 [result.clusters]
 );

 return {
 ...result,
 getVisibleItems,
 isNodeClustered,
 getClusterForNode,
 expandCluster,
 };
}

export default useNodeClustering;
