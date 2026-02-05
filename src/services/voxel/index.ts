/**
 * Voxel Services - Service Exports
 *
 * Central export file for all Voxel-related services.
 *
 * @see Story VOX-2.1: Node Component Creation
 * @see Story VOX-3.1: Edge Component Creation
 * @see Epic VOX-2: Node Visualization
 * @see Epic VOX-3: Edge & Connection Visualization
 */

// Node styling service
export {
 resolveNodeStyle,
 getHoverStyle,
 getSelectionStyle,
 getNodeTypeColor,
 getNodeTypeGeometry,
 getRiskColor,
 getSizeFromCriticality,
 getSizeFromSeverity,
 NODE_TYPE_COLORS,
 NODE_TYPE_GEOMETRIES,
 RISK_SEVERITY_COLORS,
 STATUS_COLORS,
} from './NodeStyleResolver';

export type {
 GeometryType,
 NodeStyle,
 NodeHoverStyle,
 NodeSelectionStyle,
} from './NodeStyleResolver';

// Edge styling service
export {
 resolveEdgeStyle,
 getEdgeHoverStyle,
 getEdgeSelectionStyle,
 getEdgeTypeColor,
 getEdgeTypeHighlightColor,
 getLineWidthFromWeight,
 getOpacityFromWeight,
 edgeConnectsNode,
 getConnectedEdgeStyle,
 EDGE_TYPE_COLORS,
 EDGE_TYPE_HIGHLIGHT_COLORS,
 DEFAULT_EDGE_STYLE,
} from './EdgeStyleResolver';

export type {
 EdgeStyle,
 EdgeHoverStyle,
 EdgeSelectionStyle,
} from './EdgeStyleResolver';

// Graph building service
export {
 GraphBuilder,
 buildGraph,
 updateNodeFromEntity,
} from './GraphBuilder';

export type {
 GraphBuilderInput,
 VoxelGraph,
} from './GraphBuilder';
