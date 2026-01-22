/**
 * Voxel 3D Module - Component Exports
 *
 * Central export file for all Voxel 3D visualization components.
 *
 * @see Story VOX-1.1: R3F Canvas Integration
 */

// Core components
export { VoxelCanvas } from './VoxelCanvas';
export type { VoxelCanvasProps } from './VoxelCanvas';

export { VoxelScene } from './VoxelScene';
export type { VoxelSceneProps } from './VoxelScene';

export { VoxelViewer } from './VoxelViewer';
export type { VoxelViewerProps } from './VoxelViewer';

// Fallback components
export { VoxelSkeleton } from './fallback/VoxelSkeleton';
export type { VoxelSkeletonProps } from './fallback/VoxelSkeleton';

export { VoxelErrorBoundary } from './fallback/VoxelErrorBoundary';
export type { VoxelErrorBoundaryProps } from './fallback/VoxelErrorBoundary';

export { VoxelFallback2D } from './fallback/VoxelFallback2D';
export type { VoxelFallback2DProps, FallbackReason } from './fallback/VoxelFallback2D';

// Node components (Epic VOX-2)
export {
  VoxelNode,
  VoxelNodeLabel,
  VoxelNodeLOD,
  NodeHighDetail,
  NodeMediumDetail,
  NodeLowDetail,
  AssetNode,
  RiskNode,
  ControlNode,
  VoxelNodeRenderer,
} from './nodes';
export type {
  VoxelNodeProps,
  VoxelNodeLabelProps,
  VoxelNodeLODProps,
  NodeHighDetailProps,
  NodeMediumDetailProps,
  NodeLowDetailProps,
  AssetNodeProps,
  RiskNodeProps,
  ControlNodeProps,
  VoxelNodeRendererProps,
} from './nodes';

// Edge components (Epic VOX-3)
export {
  VoxelEdge,
  VoxelEdgeCurved,
  EdgeManager,
} from './edges';
export type {
  VoxelEdgeProps,
  VoxelEdgeCurvedProps,
  EdgeManagerProps,
} from './edges';

// Hooks (Epic VOX-4, VOX-5)
export {
  useNodeSelection,
  useHoverState,
  useCameraAnimation,
  useFilterPresets,
  FILTER_PRESETS,
} from './hooks';
export type {
  UseNodeSelectionReturn,
  UseHoverStateReturn,
  UseHoverStateOptions,
  UseCameraAnimationReturn,
  CameraAnimationConfig,
  UseFilterPresetsReturn,
  FilterPreset,
} from './hooks';

// Effects (Epic VOX-4)
export {
  SelectionGlow,
  HoverGlow,
} from './effects';
export type {
  SelectionGlowProps,
  HoverGlowProps,
} from './effects';

// Overlays (Epic VOX-4, VOX-5)
export {
  VoxelTooltip,
  VoxelDetailPanel,
  VoxelFilterPanel,
  VoxelToolbar,
} from './overlays';
export type {
  VoxelTooltipProps,
  VoxelDetailPanelProps,
  VoxelFilterPanelProps,
  VoxelToolbarProps,
} from './overlays';
