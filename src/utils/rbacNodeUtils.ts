/**
 * RBAC Node filter utility
 * 
 * Standalone function for filtering nodes by permissions,
 * extracted from hooks/voxel/useRbacNodeFilter.ts.
 * 
 * @module utils/rbacNodeUtils
 */

import type { VoxelNode } from '@/types/voxel';
import { hasPermission } from '@/utils/permissions';

// Map node types to resource types for permission checking
const NODE_TYPE_TO_RESOURCE: Record<string, string> = {
 risk: 'Risks',
 control: 'Controls',
 document: 'Documents',
 supplier: 'Suppliers',
 action: 'Actions',
 compliance: 'Compliance',
 incident: 'Incidents',
 asset: 'Assets',
 default: 'Dashboard',
};

/**
 * Filter nodes by RBAC permissions (standalone function for use outside React)
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
