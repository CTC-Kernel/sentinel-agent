import { Asset, Risk, Project, Audit, Incident, Supplier, Control } from './index';

// ============================================================================
// Core Types
// ============================================================================

export type VoxelNodeType =
  | 'asset'
  | 'risk'
  | 'control'
  | 'incident'
  | 'supplier'
  | 'project'
  | 'audit';

export type VoxelNodeStatus =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'inactive';

export interface VoxelNode {
  id: string;
  type: VoxelNodeType;
  label: string;
  status: VoxelNodeStatus;
  position: { x: number; y: number; z: number };
  data: Record<string, unknown>;
  connections: string[];
  anomalyIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VoxelEdge {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'mitigation' | 'assignment' | 'impact';
  weight: number;
}

export interface VoxelAnomaly {
  id: string;
  type: 'orphan' | 'stale' | 'inconsistency' | 'cycle' | 'cluster' | 'trend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  nodeId: string;
  message: string;
  detectedAt: Date;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
}

// ============================================================================
// Filter & UI State Types
// ============================================================================

export interface VoxelFilters {
  nodeTypes: VoxelNodeType[];
  statuses: VoxelNodeStatus[];
  dateRange?: { start: Date; end: Date };
  searchQuery: string;
  showAnomaliesOnly: boolean;
}

export interface VoxelUIState {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  zoom: number;
  showLabels: boolean;
  showEdges: boolean;
  layoutType: 'force' | 'hierarchical' | 'radial' | 'timeline';
}

export interface VoxelSyncState {
  status: 'connected' | 'syncing' | 'offline';
  lastSyncAt: Date | null;
  pendingChanges: number;
}

// ============================================================================
// View Presets
// ============================================================================

export type ViewPreset = 'executive' | 'rssi' | 'auditor' | 'soc' | 'compliance' | 'custom';

export interface ViewPresetConfig {
  layers: VoxelNodeType[];
  layout: VoxelUIState['layoutType'];
  camera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };
  description: string;
  icon: string;
}

// ============================================================================
// Blast Radius Analysis
// ============================================================================

export interface BlastRadiusConfig {
  startNodeId: string;
  maxDepth: number;
  minProbability: number;
  simulateFailure?: string[];
}

export interface BlastRadiusResult {
  impactedNodes: Array<{
    nodeId: string;
    depth: number;
    probability: number;
    path: string[];
  }>;
  totalImpact: number;
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// Legacy Types (kept for backward compatibility)
// ============================================================================

export type LayerType = 'asset' | 'risk' | 'project' | 'audit' | 'incident' | 'supplier' | 'control';

export interface LegacyVoxelNode {
  id: string;
  type: LayerType;
  position: [number, number, number];
  color: string;
  size: number;
  data: DataNode['data'];
  connections: string[];
}

export type DataNode =
  | { id: string; type: 'asset'; data: Asset }
  | { id: string; type: 'risk'; data: Risk }
  | { id: string; type: 'project'; data: Project }
  | { id: string; type: 'audit'; data: Audit }
  | { id: string; type: 'incident'; data: Incident }
  | { id: string; type: 'supplier'; data: Supplier }
  | { id: string; type: 'control'; data: Control };

export interface AISuggestedLink {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'risk_factor' | 'dependency' | 'impact' | 'mitigation';
  confidence: number;
  reasoning: string;
}

export interface AIInsight {
  id: string;
  type: 'critical_path' | 'cluster' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  relatedIds: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}
