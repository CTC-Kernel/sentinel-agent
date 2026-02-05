/**
 * EdgeManager - Manages rendering of all edges in the scene
 *
 * Responsibilities:
 * - Renders all visible edges from voxelStore
 * - Resolves node positions for edge endpoints
 * - Handles edge filtering by type
 * - Highlights edges connected to selected nodes
 *
 * @see Story VOX-3.1: Edge Component Creation
 * @see Story VOX-3.2: Asset-Risk Connections
 * @see Story VOX-3.3: Control-Asset Connections
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useMemo } from 'react';
import type { VoxelEdge as VoxelEdgeType, VoxelNode } from '@/types/voxel';
import { useVoxelStore, useVoxelEdges, useVoxelNodes } from '@/stores/voxelStore';
import { VoxelEdge } from './VoxelEdge';

// ============================================================================
// Types
// ============================================================================

export interface EdgeManagerProps {
 /** Optional edge type filter */
 filterByType?: VoxelEdgeType['type'][];
 /** Custom onClick handler for edges */
 onEdgeClick?: (edge: VoxelEdgeType) => void;
 /** Custom onHover handler for edges */
 onEdgeHover?: (edge: VoxelEdgeType | null) => void;
 /** Disable all edge interactions */
 disabled?: boolean;
 /** Minimum weight threshold to show edge */
 minWeight?: number;
 /** Show edges for specific node only */
 forNodeId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get node position as tuple
 */
function getNodePosition(node: VoxelNode): [number, number, number] {
 return [node.position.x, node.position.y, node.position.z];
}

/**
 * Create a map of node IDs to positions for fast lookup
 */
function createNodePositionMap(
 nodes: VoxelNode[]
): Map<string, [number, number, number]> {
 const map = new Map<string, [number, number, number]>();
 for (const node of nodes) {
 map.set(node.id, getNodePosition(node));
 }
 return map;
}

// ============================================================================
// Component
// ============================================================================

export const EdgeManager: React.FC<EdgeManagerProps> = ({
 filterByType,
 onEdgeClick,
 onEdgeHover,
 disabled = false,
 minWeight = 0,
 forNodeId,
}) => {
 // Get edges and nodes from store using selectors (returns arrays)
 const edges = useVoxelEdges();
 const nodes = useVoxelNodes();
 const selectedNodeId = useVoxelStore((state) => state.ui.selectedNodeId);

 // Create position lookup map
 const nodePositions = useMemo(() => {
 return createNodePositionMap(nodes);
 }, [nodes]);

 // Filter and process edges
 const visibleEdges = useMemo(() => {
 let filtered = edges;

 // Filter by type
 if (filterByType && filterByType.length > 0) {
 filtered = filtered.filter((edge) => filterByType.includes(edge.type));
 }

 // Filter by minimum weight
 if (minWeight > 0) {
 filtered = filtered.filter((edge) => edge.weight >= minWeight);
 }

 // Filter for specific node
 if (forNodeId) {
 filtered = filtered.filter(
 (edge) => edge.source === forNodeId || edge.target === forNodeId
 );
 }

 // Only include edges where both nodes exist
 return filtered.filter((edge) => {
 return nodePositions.has(edge.source) && nodePositions.has(edge.target);
 });
 }, [edges, filterByType, minWeight, forNodeId, nodePositions]);

 // Check if edge is connected to selected node
 const isEdgeHighlighted = useMemo(() => {
 if (!selectedNodeId) return new Set<string>();

 const highlighted = new Set<string>();
 for (const edge of visibleEdges) {
 if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
 highlighted.add(edge.id);
 }
 }
 return highlighted;
 }, [selectedNodeId, visibleEdges]);

 return (
 <group name="edge-manager">
 {visibleEdges.map((edge) => {
 const sourcePos = nodePositions.get(edge.source);
 const targetPos = nodePositions.get(edge.target);

 // Should never happen due to filtering, but TypeScript needs this
 if (!sourcePos || !targetPos) return null;

 return (
 <VoxelEdge
 key={edge.id || 'unknown'}
 data={edge}
 sourcePosition={sourcePos}
 targetPosition={targetPos}
 disabled={disabled}
 onClick={onEdgeClick}
 onHover={onEdgeHover}
 forceHighlight={isEdgeHighlighted.has(edge.id)}
 />
 );
 })}
 </group>
 );
};

export default EdgeManager;
