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
  size: number;
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

// ============================================================================
// Anomaly Types (Epic 29)
// ============================================================================

export type VoxelAnomalyType =
  | 'orphan_control'      // Control not linked to any risk
  | 'circular_dependency' // Circular risk→control→risk chain
  | 'coverage_gap'        // Risk without mitigation controls
  | 'stale_assessment'    // Assessment older than 90 days
  | 'compliance_drift'    // Control effectiveness below threshold
  | 'orphan'              // Legacy: general orphan entity
  | 'stale'               // Legacy: general stale entity
  | 'inconsistency'       // Data inconsistency detected
  | 'cycle'               // Legacy: circular dependency
  | 'cluster'             // Anomalous clustering pattern
  | 'trend';              // Concerning trend detected

export type VoxelAnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type VoxelAnomalyStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed' | 'ignored';

export interface VoxelAnomalyDetails {
  /** Path of node IDs forming a cycle (for circular_dependency) */
  cyclePath?: string[];
  /** Related node IDs involved in the anomaly */
  relatedNodeIds?: string[];
  /** Days since last assessment (for stale_assessment) */
  daysSinceAssessment?: number;
  /** Expected threshold that was violated */
  threshold?: number;
  /** Actual value that triggered the anomaly */
  actualValue?: number;
  /** Additional context-specific information */
  context?: Record<string, unknown>;
}

export interface VoxelAnomaly {
  id: string;
  type: VoxelAnomalyType;
  severity: VoxelAnomalySeverity;
  nodeId: string;
  message: string;
  detectedAt: Date;
  status: VoxelAnomalyStatus;
  /** Additional details about the anomaly */
  details?: VoxelAnomalyDetails;
  /** User who resolved/dismissed the anomaly */
  resolvedBy?: string;
  /** Timestamp when the anomaly was resolved */
  resolvedAt?: Date;
  /** Justification for ignoring/dismissing */
  dismissalReason?: string;
  /** Source of detection: 'server' | 'client' */
  detectionSource?: 'server' | 'client';
  /** Organization ID for multi-tenant filtering */
  organizationId?: string;
}

// ============================================================================
// Alert Configuration (Story 29.8)
// ============================================================================

export interface AlertThreshold {
  anomalyType: VoxelAnomalyType;
  minSeverity: VoxelAnomalySeverity;
  enabled: boolean;
}

export interface AlertChannelConfig {
  inApp: boolean;
  email: boolean;
  /** Future: push notifications */
  push?: boolean;
}

export interface VoxelAlertConfig {
  id: string;
  organizationId: string;
  thresholds: AlertThreshold[];
  channels: AlertChannelConfig;
  /** Rate limiting: max alerts per hour */
  maxAlertsPerHour: number;
  /** Cooldown period in minutes between alerts of same type */
  cooldownMinutes: number;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

export const DEFAULT_ALERT_CONFIG: Omit<VoxelAlertConfig, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> = {
  thresholds: [
    { anomalyType: 'orphan_control', minSeverity: 'medium', enabled: true },
    { anomalyType: 'circular_dependency', minSeverity: 'high', enabled: true },
    { anomalyType: 'coverage_gap', minSeverity: 'high', enabled: true },
    { anomalyType: 'stale_assessment', minSeverity: 'medium', enabled: true },
    { anomalyType: 'compliance_drift', minSeverity: 'high', enabled: true },
  ],
  channels: {
    inApp: true,
    email: false,
  },
  maxAlertsPerHour: 10,
  cooldownMinutes: 30,
};

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
