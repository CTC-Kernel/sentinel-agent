/**
 * VoxelTooltip - 3D tooltip overlay for hovered nodes
 *
 * Displays a brief summary of node information when hovering.
 * Uses @react-three/drei Html component for DOM rendering in 3D space.
 *
 * @see Story VOX-4.5: Hover Tooltip
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React from 'react';
import { Html } from '@react-three/drei';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';
import {
  VOXEL_NODE_TYPE_COLORS_CSS,
  getVoxelPanelStyles,
} from '../voxelTheme';

// ============================================================================
// Types
// ============================================================================

export interface VoxelTooltipProps {
 /** Node data to display */
 node: VoxelNode;
 /** Vertical offset from node center */
 offsetY?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default offset above the node */
const DEFAULT_OFFSET_Y = 1;

/** Node type display labels */
const TYPE_LABELS: Record<VoxelNodeType, string> = {
 asset: 'Asset',
 risk: 'Risk',
 control: 'Control',
 audit: 'Audit',
 project: 'Project',
 incident: 'Incident',
 supplier: 'Supplier',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a brief metric based on node type
 */
function getNodeMetric(node: VoxelNode): string | null {
 if (!node.data) return null;

 switch (node.type) {
 case 'risk':
 if ('likelihood' in node.data && 'impact' in node.data) {
 const likelihood = node.data.likelihood as number;
 const impact = node.data.impact as number;
 return `Score: ${likelihood * impact}`;
 }
 break;
 case 'asset':
 if ('criticality' in node.data) {
 const criticality = node.data.criticality as number;
 return `Criticality: ${criticality}/5`;
 }
 break;
 case 'control':
 if ('effectiveness' in node.data) {
 const effectiveness = node.data.effectiveness as number;
 return `Effectiveness: ${Math.round(effectiveness * 100)}%`;
 }
 break;
 }

 return null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * VoxelTooltip renders a floating tooltip above a 3D node.
 *
 * The tooltip shows the node's type, name, and a key metric.
 * It uses glass morphism styling to match the Digital Galaxy theme.
 *
 * @example
 * ```tsx
 * {hoveredNodeId === node.id && (
 * <VoxelTooltip node={node} offsetY={nodeSize * 0.5 + 1} />
 * )}
 * ```
 */
export const VoxelTooltip: React.FC<VoxelTooltipProps> = ({
 node,
 offsetY = DEFAULT_OFFSET_Y,
}) => {
 const typeLabel = TYPE_LABELS[node.type];
 const typeColor = VOXEL_NODE_TYPE_COLORS_CSS[node.type];
 const metric = getNodeMetric(node);
 const panelStyles = getVoxelPanelStyles();

 return (
 <Html
 position={[0, node.size * 0.5 + offsetY, 0]}
 center
 distanceFactor={100}
 style={{
 pointerEvents: 'none',
 transform: 'translateY(-100%)',
 }}
 >
 <div
 className="voxel-tooltip"
 style={{
 ...panelStyles,
 borderRadius: '8px',
 padding: '8px 12px',
 color: 'hsl(var(--foreground))',
 fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
 fontSize: '13px',
 lineHeight: '1.4',
 whiteSpace: 'nowrap',
 minWidth: '120px',
 maxWidth: '200px',
 }}
 >
 {/* Type badge */}
 <div
 style={{
 display: 'inline-block',
 background: typeColor,
 color: 'hsl(var(--foreground))',
 padding: '2px 8px',
 borderRadius: '4px',
 fontSize: '10px',
 fontWeight: 600,
 textTransform: 'uppercase',
 letterSpacing: '0.5px',
 marginBottom: '4px',
 }}
 >
 {typeLabel}
 </div>

 {/* Node name */}
 <div
 style={{
 fontWeight: 500,
 overflow: 'hidden',
 textOverflow: 'ellipsis',
 }}
 >
 {node.label}
 </div>

 {/* Metric (if available) */}
 {metric && (
 <div
 style={{
 color: 'hsl(var(--muted-foreground))',
 fontSize: '11px',
 marginTop: '2px',
 }}
 >
 {metric}
 </div>
 )}
 </div>
 </Html>
 );
};

export default VoxelTooltip;
