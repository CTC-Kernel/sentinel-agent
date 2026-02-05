/**
 * VoxelNodeLabel - HTML text label overlay for 3D nodes
 *
 * Uses @react-three/drei Html component to render text labels
 * that always face the camera and remain readable regardless of
 * 3D orientation.
 *
 * @see Story VOX-2.4: Node Labels with HTML Overlay
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';
import { getNodeTypeColor } from '@/services/voxel/NodeStyleResolver';

// ============================================================================
// Types
// ============================================================================

export interface VoxelNodeLabelProps {
 /** Node data containing label and type */
 node: VoxelNode;
 /** Vertical offset from node center (in 3D units) */
 offsetY?: number;
 /** Show type badge alongside label */
 showTypeBadge?: boolean;
 /** Additional CSS class names */
 className?: string;
 /** Hide label when camera is far (distance threshold) */
 visibleDistance?: number;
 /** Current camera distance (for LOD) */
 cameraDistance?: number;
 /** Whether the node is selected */
 isSelected?: boolean;
 /** Whether the node is hovered */
 isHovered?: boolean;
}

// ============================================================================
// Type Badge Labels
// ============================================================================

const TYPE_LABELS: Record<VoxelNodeType, string> = {
 asset: 'Asset',
 risk: 'Risque',
 control: 'Contrôle',
 incident: 'Incident',
 supplier: 'Fournisseur',
 project: 'Projet',
 audit: 'Audit',
};

// ============================================================================
// Styles
// ============================================================================

const baseLabelStyle: React.CSSProperties = {
 fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
 fontSize: '12px',
 fontWeight: 500,
 color: 'white',
 textShadow: '0 1px 3px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.5)',
 whiteSpace: 'nowrap',
 pointerEvents: 'none',
 userSelect: 'none',
 transition: 'opacity 0.2s ease, transform 0.2s ease',
};

const selectedLabelStyle: React.CSSProperties = {
 ...baseLabelStyle,
 fontSize: '14px',
 fontWeight: 600,
 textShadow: '0 1px 4px rgba(0, 0, 0, 0.9), 0 0 12px rgba(0, 0, 0, 0.6)',
};

const hoveredLabelStyle: React.CSSProperties = {
 ...baseLabelStyle,
 fontSize: '13px',
 textShadow: '0 1px 4px rgba(0, 0, 0, 0.85), 0 0 10px rgba(0, 0, 0, 0.55)',
};

const badgeStyle: React.CSSProperties = {
 display: 'inline-block',
 padding: '2px 6px',
 borderRadius: '4px',
 fontSize: '10px',
 fontWeight: 600,
 textTransform: 'uppercase',
 letterSpacing: '0.5px',
 marginLeft: '6px',
};

// ============================================================================
// Component
// ============================================================================

export const VoxelNodeLabel: React.FC<VoxelNodeLabelProps> = ({
 node,
 offsetY = 12,
 showTypeBadge = false,
 className,
 visibleDistance = 200,
 cameraDistance,
 isSelected = false,
 isHovered = false,
}) => {
 // Determine visibility based on camera distance
 const isVisible = useMemo(() => {
 if (cameraDistance === undefined) return true;
 // Always show if selected or hovered
 if (isSelected || isHovered) return true;
 return cameraDistance < visibleDistance;
 }, [cameraDistance, visibleDistance, isSelected, isHovered]);

 // Get style based on state
 const labelStyle = useMemo(() => {
 if (isSelected) return selectedLabelStyle;
 if (isHovered) return hoveredLabelStyle;
 return baseLabelStyle;
 }, [isSelected, isHovered]);

 // Get type badge color
 const typeColor = useMemo(() => getNodeTypeColor(node.type), [node.type]);

 // Calculate opacity based on distance
 const opacity = useMemo(() => {
 if (cameraDistance === undefined) return 1;
 if (isSelected || isHovered) return 1;
 if (cameraDistance > visibleDistance) return 0;
 // Fade out as we approach the distance threshold
 const fadeStart = visibleDistance * 0.7;
 if (cameraDistance < fadeStart) return 1;
 return 1 - (cameraDistance - fadeStart) / (visibleDistance - fadeStart);
 }, [cameraDistance, visibleDistance, isSelected, isHovered]);

 if (!isVisible && opacity === 0) {
 return null;
 }

 return (
 <Html
 position={[0, offsetY, 0]}
 center
 style={{
 opacity,
 transform: isHovered ? 'scale(1.05)' : 'scale(1)',
 }}
 className={className}
 distanceFactor={15}
 occlude={false}
 sprite
 >
 <div
 style={labelStyle}
 role="tooltip"
 aria-label={`${node.label} (${TYPE_LABELS[node.type]})`}
 >
 {node.label}
 {showTypeBadge && (
 <span
 style={{
 ...badgeStyle,
 backgroundColor: typeColor,
 color: 'white',
 }}
 >
 {TYPE_LABELS[node.type]}
 </span>
 )}
 </div>
 </Html>
 );
};

export default VoxelNodeLabel;
