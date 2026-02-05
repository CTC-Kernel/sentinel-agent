/**
 * useRbacNodeFilter - Hook for filtering Voxel nodes based on user permissions
 *
 * Implements RBAC (Role-Based Access Control) filtering for the 3D visualization.
 * Admin users get full access to all nodes; other roles see only entities
 * they have read permission for.
 *
 * @see Story VOX-8.5: RBAC Node Filtering
 * @see Story VOX-8.6: Admin Full Access
 */

import { useMemo } from 'react';
import { useStore } from '@/store';
import { hasPermission } from '@/utils/permissions';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';
import type { ResourceType } from '@/types/common';

// ============================================================================
// Types
// ============================================================================

export interface UseRbacNodeFilterOptions {
 /** Enable/disable filtering (default: true) */
 enabled?: boolean;
}

export interface UseRbacNodeFilterReturn {
 /** Filter nodes based on user permissions */
 filterNodes: (nodes: VoxelNode[]) => VoxelNode[];
 /** Check if user can view a specific node type */
 canViewNodeType: (type: VoxelNodeType) => boolean;
 /** Get all viewable node types for current user */
 viewableNodeTypes: VoxelNodeType[];
 /** Whether user is admin (has full access) */
 isAdmin: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maps VoxelNodeType to ResourceType for permission checking
 */
const NODE_TYPE_TO_RESOURCE: Record<VoxelNodeType, ResourceType> = {
 asset: 'Asset',
 risk: 'Risk',
 control: 'Control',
 project: 'Project',
 audit: 'Audit',
 incident: 'Incident',
 supplier: 'Supplier',
};

/**
 * All voxel node types
 */
const ALL_NODE_TYPES: VoxelNodeType[] = [
 'asset',
 'risk',
 'control',
 'project',
 'audit',
 'incident',
 'supplier',
];

// ============================================================================
// Hook
// ============================================================================

export function useRbacNodeFilter(
 options: UseRbacNodeFilterOptions = {}
): UseRbacNodeFilterReturn {
 const { enabled = true } = options;
 const { user } = useStore();

 // Check if user is admin via permission system
 const isAdmin = useMemo(() => {
 return hasPermission(user, 'Settings', 'manage');
 }, [user]);

 // Calculate viewable node types based on permissions
 const viewableNodeTypes = useMemo((): VoxelNodeType[] => {
 if (!user || !enabled) {
 return ALL_NODE_TYPES; // No filtering when disabled or no user
 }

 // Admin can view all types
 if (isAdmin) {
 return ALL_NODE_TYPES;
 }

 // Filter based on read permissions
 return ALL_NODE_TYPES.filter((nodeType) => {
 const resourceType = NODE_TYPE_TO_RESOURCE[nodeType];
 return hasPermission(user, resourceType, 'read');
 });
 }, [user, enabled, isAdmin]);

 // Check if user can view a specific node type
 const canViewNodeType = useMemo(() => {
 return (type: VoxelNodeType): boolean => {
 if (!user || !enabled) {
 return true; // No filtering when disabled or no user
 }

 // Admin can view all types
 if (isAdmin) {
 return true;
 }

 const resourceType = NODE_TYPE_TO_RESOURCE[type];
 return hasPermission(user, resourceType, 'read');
 };
 }, [user, enabled, isAdmin]);

 // Filter nodes based on permissions
 const filterNodes = useMemo(() => {
 return (nodes: VoxelNode[]): VoxelNode[] => {
 if (!user || !enabled) {
 return nodes; // No filtering when disabled or no user
 }

 // Admin sees all nodes
 if (isAdmin) {
 return nodes;
 }

 // Filter nodes by type permission
 return nodes.filter((node) => {
 const resourceType = NODE_TYPE_TO_RESOURCE[node.type];
 return hasPermission(user, resourceType, 'read');
 });
 };
 }, [user, enabled, isAdmin]);

 return {
 filterNodes,
 canViewNodeType,
 viewableNodeTypes,
 isAdmin,
 };
}

/**
 * Filter nodes by RBAC permissions (standalone function for use outside React)
 *
 * @param nodes - Nodes to filter
 * @param user - User profile for permission checking
 * @returns Filtered nodes
 */
export function filterNodesByPermission(
 nodes: VoxelNode[],
 user: Parameters<typeof hasPermission>[0]
): VoxelNode[] {
 if (!user) {
 return nodes;
 }

 // Admin sees all nodes
 if (hasPermission(user, 'Settings', 'manage')) {
 return nodes;
 }

 return nodes.filter((node) => {
 const resourceType = NODE_TYPE_TO_RESOURCE[node.type];
 return hasPermission(user, resourceType, 'read');
 });
}

export default useRbacNodeFilter;
