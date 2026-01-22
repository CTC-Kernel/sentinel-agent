/**
 * Voxel Hooks Index
 *
 * Centralized exports for all Voxel-related React hooks.
 */

export { useVoxelRealtime } from './useVoxelRealtime';
export { useVoxelData } from './useVoxelData';
export type { UseVoxelDataOptions, UseVoxelDataReturn } from './useVoxelData';
export { useNodeAnimation, useNodesAnimation, ANIMATION_PRESETS } from './useNodeAnimation';
export type { NodeAnimationState, NodeAnimationConfig, AnimationPreset } from './useNodeAnimation';
export { useOfflineMode } from './useOfflineMode';
export { useBlastRadius } from './useBlastRadius';
export type { SimulationMode, BlastRadiusState, BlastRadiusActions, UseBlastRadiusReturn } from './useBlastRadius';

// Epic 31: View Presets & Analytics hooks
export { useViewPresets } from './useViewPresets';
export type { UseViewPresetsReturn } from './useViewPresets';
export { useViewTransition, VIEW_TRANSITION_PRESETS } from './useViewTransition';
export type {
  ViewTransitionConfig,
  CameraState,
  ViewTransitionState,
  UseViewTransitionReturn,
  ViewTransitionPreset,
} from './useViewTransition';
export { useVoxelUrlState } from './useVoxelUrlState';
export type { VoxelUrlState, UseVoxelUrlStateOptions, UseVoxelUrlStateReturn } from './useVoxelUrlState';

// Epic 32: Performance & Export hooks
export { useFrustumCulling, calculateOptimalCellSize, getCullingStats } from './useFrustumCulling';
export type {
  UseFrustumCullingOptions,
  FrustumCullingState,
  UseFrustumCullingReturn,
} from './useFrustumCulling';

export { useLayoutWorker } from './useLayoutWorker';
export type {
  LayoutWorkerConfig,
  PositionUpdate,
  LayoutStats,
  UseLayoutWorkerOptions,
  UseLayoutWorkerReturn,
} from './useLayoutWorker';

export {
  useMemoryManagement,
  formatMemorySize,
  getMemoryStatusColor,
  calculateTextureMemory,
} from './useMemoryManagement';
export type {
  MemoryStats,
  MemoryConfig,
  UseMemoryManagementOptions,
  UseMemoryManagementReturn,
} from './useMemoryManagement';

// Epic 33: Annotations & Collaboration hooks
export { useAnnotations } from './useAnnotations';
export type { UseAnnotationsOptions, UseAnnotationsReturn } from './useAnnotations';

// Epic 34: AR/VR Foundation hooks
export { useWebXR } from './useWebXR';
export type {
  XRSessionMode,
  XRDeviceCapabilities,
  XRSupportStatus,
  UseWebXROptions,
  UseWebXRReturn,
} from './useWebXR';

export {
  useVRPerformance,
  getVRPerformanceColor,
  formatFrameTime,
  calculateHeadroom,
  VR_REFRESH_RATES,
} from './useVRPerformance';
export type {
  VRQualityLevel,
  VRPerformanceStatus,
  VRFrameStats,
  VRQualitySettings,
  UseVRPerformanceOptions,
  UseVRPerformanceReturn,
} from './useVRPerformance';

// VOX-1.4: WebGL Capability Detection
export { useWebGLCapability, useWebGLSupport } from './useWebGLCapability';
export type { WebGLCapability, WebGLCapabilityInfo } from './useWebGLCapability';

// VOX-8.4: Reduced Motion Support
export {
  usePrefersReducedMotion,
  getAnimationDuration,
  getTransitionStyle,
} from './usePrefersReducedMotion';

// VOX-8.5 & VOX-8.6: RBAC Node Filtering
export { useRbacNodeFilter, filterNodesByPermission } from './useRbacNodeFilter';
export type { UseRbacNodeFilterOptions, UseRbacNodeFilterReturn } from './useRbacNodeFilter';

// VOX-9.7: Export Capture
export { useExportCapture } from './useExportCapture';
export type {
  ExportOptions,
  WatermarkOptions,
  UseExportCaptureReturn,
} from './useExportCapture';

// VOX-9.1: Zoom Semantic
export { useZoomSemantic, getZoomSemanticValues } from './useZoomSemantic';
export type {
  ZoomLevel,
  ZoomSemanticConfig,
  ZoomSemanticState,
  UseZoomSemanticReturn,
} from './useZoomSemantic';

// VOX-9.4: Node Clustering
export { useNodeClustering, clusterNodes } from './useNodeClustering';
export type {
  ClusterConfig,
  NodeCluster,
  ClusteringResult,
  UseNodeClusteringReturn,
} from './useNodeClustering';

// Re-export store hooks for convenience
export {
  useVoxelStore,
  useVoxelNode,
  useVoxelNodes,
  useFilteredNodes,
  useVoxelEdges,
  useVisibleEdges,
  useVoxelAnomalies,
  useActiveAnomalies,
  useNodeAnomalies,
  useSelectedNode,
  useHoveredNode,
  useVoxelFilters,
  useVoxelUI,
  useVoxelSync,
  useCurrentPreset,
  useNodeCountByType,
  useAnomalyCountBySeverity,
} from '@/stores/voxelStore';
