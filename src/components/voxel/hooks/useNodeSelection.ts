/**
 * useNodeSelection - Hook for managing node selection state
 *
 * Provides convenient methods for selecting, deselecting, and checking
 * node selection state. Integrates with voxelStore.
 *
 * @see Story VOX-4.4: Node Click Selection
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import { useCallback } from 'react';
import { useVoxelStore, useSelectedNode } from '@/stores/voxelStore';

export interface UseNodeSelectionReturn {
 /** Currently selected node ID */
 selectedNodeId: string | null;
 /** Currently selected node data */
 selectedNode: ReturnType<typeof useSelectedNode>;
 /** Select a node by ID */
 select: (nodeId: string) => void;
 /** Deselect the current node */
 deselect: () => void;
 /** Toggle selection for a node */
 toggle: (nodeId: string) => void;
 /** Check if a specific node is selected */
 isSelected: (nodeId: string) => boolean;
}

/**
 * Hook for managing node selection with convenience methods.
 *
 * @example
 * ```tsx
 * const { select, deselect, isSelected, selectedNode } = useNodeSelection();
 *
 * // In node click handler
 * <mesh onClick={() => select(nodeId)} />
 *
 * // In background click handler
 * <mesh onClick={deselect} />
 * ```
 */
export function useNodeSelection(): UseNodeSelectionReturn {
 const selectNode = useVoxelStore((state) => state.selectNode);
 const selectedNodeId = useVoxelStore((state) => state.ui.selectedNodeId);
 const selectedNode = useSelectedNode();

 const select = useCallback(
 (nodeId: string) => {
 selectNode(nodeId);
 },
 [selectNode]
 );

 const deselect = useCallback(() => {
 selectNode(null);
 }, [selectNode]);

 const toggle = useCallback(
 (nodeId: string) => {
 if (selectedNodeId === nodeId) {
 selectNode(null);
 } else {
 selectNode(nodeId);
 }
 },
 [selectNode, selectedNodeId]
 );

 const isSelected = useCallback(
 (nodeId: string) => {
 return selectedNodeId === nodeId;
 },
 [selectedNodeId]
 );

 return {
 selectedNodeId,
 selectedNode,
 select,
 deselect,
 toggle,
 isSelected,
 };
}

export default useNodeSelection;
