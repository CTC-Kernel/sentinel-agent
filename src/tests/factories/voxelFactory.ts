/**
 * Voxel Test Data Factory
 *
 * Factory functions for creating test data for Voxel module tests.
 * Provides consistent, type-safe test data generation.
 */

import type {
  VoxelNode,
  VoxelEdge,
  VoxelAnomaly,
  VoxelAnomalyType,
  VoxelAnomalySeverity,
  VoxelNodeType,
  BlastRadiusConfig,
  BlastRadiusResult,
  VoxelFilters,
  VoxelUIState,
  VoxelSyncState,
} from '@/types/voxel';

import type {
  VoxelAnnotation,
  AnnotationReply,
  AnnotationAuthor,
  Position3D,
  CreateAnnotationDTO,
  CreateReplyDTO,
} from '@/types/voxelAnnotation';

// ============================================================================
// Counter for unique IDs
// ============================================================================

let idCounter = 0;

/**
 * Generate a unique ID for test data
 */
export function generateId(prefix = 'test'): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

/**
 * Reset the ID counter (useful between test suites)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================================
// VoxelNode Factory
// ============================================================================

const DEFAULT_NODE: Omit<VoxelNode, 'id'> = {
  type: 'asset',
  label: 'Test Node',
  status: 'normal',
  position: { x: 0, y: 0, z: 0 },
  size: 1,
  data: {},
  connections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Create a VoxelNode with optional overrides
 */
export function createVoxelNode(overrides: Partial<VoxelNode> = {}): VoxelNode {
  return {
    id: generateId('node'),
    ...DEFAULT_NODE,
    ...overrides,
    position: { ...DEFAULT_NODE.position, ...overrides.position },
  };
}

/**
 * Create multiple VoxelNodes
 */
export function createVoxelNodes(
  count: number,
  overrides: Partial<VoxelNode> | ((index: number) => Partial<VoxelNode>) = {}
): VoxelNode[] {
  return Array.from({ length: count }, (_, index) => {
    const nodeOverrides = typeof overrides === 'function' ? overrides(index) : overrides;
    return createVoxelNode({
      label: `Node ${index + 1}`,
      position: {
        x: Math.random() * 20 - 10,
        y: Math.random() * 20 - 10,
        z: Math.random() * 20 - 10,
      },
      ...nodeOverrides,
    });
  });
}

/**
 * Create a VoxelNode of a specific type
 */
export function createTypedNode(
  type: VoxelNodeType,
  overrides: Partial<VoxelNode> = {}
): VoxelNode {
  const typeDefaults: Record<VoxelNodeType, Partial<VoxelNode>> = {
    asset: { label: 'Test Asset', data: { criticality: 'high' } },
    risk: { label: 'Test Risk', data: { severity: 'high', likelihood: 'medium' } },
    control: { label: 'Test Control', data: { effectiveness: 80 } },
    incident: { label: 'Test Incident', status: 'critical' },
    supplier: { label: 'Test Supplier', data: { riskLevel: 'low' } },
    project: { label: 'Test Project', data: { status: 'active' } },
    audit: { label: 'Test Audit', data: { status: 'in_progress' } },
  };

  return createVoxelNode({
    type,
    ...typeDefaults[type],
    ...overrides,
  });
}

// ============================================================================
// VoxelEdge Factory
// ============================================================================

const DEFAULT_EDGE: Omit<VoxelEdge, 'id' | 'source' | 'target'> = {
  type: 'dependency',
  weight: 1.0,
};

/**
 * Create a VoxelEdge with optional overrides
 */
export function createVoxelEdge(
  source: string,
  target: string,
  overrides: Partial<Omit<VoxelEdge, 'source' | 'target'>> = {}
): VoxelEdge {
  return {
    id: generateId('edge'),
    source,
    target,
    ...DEFAULT_EDGE,
    ...overrides,
  };
}

/**
 * Create edges connecting nodes in sequence
 */
export function createEdgeChain(
  nodeIds: string[],
  overrides: Partial<Omit<VoxelEdge, 'source' | 'target'>> = {}
): VoxelEdge[] {
  const edges: VoxelEdge[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    edges.push(createVoxelEdge(nodeIds[i], nodeIds[i + 1], overrides));
  }
  return edges;
}

/**
 * Create edges from one node to multiple targets
 */
export function createEdgesFromSource(
  sourceId: string,
  targetIds: string[],
  overrides: Partial<Omit<VoxelEdge, 'source' | 'target'>> = {}
): VoxelEdge[] {
  return targetIds.map((targetId) => createVoxelEdge(sourceId, targetId, overrides));
}

// ============================================================================
// VoxelAnomaly Factory
// ============================================================================

const DEFAULT_ANOMALY: Omit<VoxelAnomaly, 'id' | 'nodeId'> = {
  type: 'orphan_control',
  severity: 'medium',
  message: 'Test anomaly message',
  detectedAt: new Date(),
  status: 'active',
  detectionSource: 'client',
};

/**
 * Create a VoxelAnomaly with optional overrides
 */
export function createVoxelAnomaly(
  nodeId: string,
  overrides: Partial<Omit<VoxelAnomaly, 'nodeId'>> = {}
): VoxelAnomaly {
  return {
    id: generateId('anomaly'),
    nodeId,
    ...DEFAULT_ANOMALY,
    ...overrides,
  };
}

/**
 * Create anomalies of different severities
 */
export function createAnomaliesWithSeverities(
  nodeId: string,
  severities: VoxelAnomalySeverity[] = ['critical', 'high', 'medium', 'low']
): VoxelAnomaly[] {
  return severities.map((severity) =>
    createVoxelAnomaly(nodeId, {
      severity,
      message: `${severity} severity anomaly`,
    })
  );
}

/**
 * Create anomalies of different types
 */
export function createAnomaliesWithTypes(
  nodeId: string,
  types: VoxelAnomalyType[] = ['orphan_control', 'coverage_gap', 'circular_dependency']
): VoxelAnomaly[] {
  return types.map((type) =>
    createVoxelAnomaly(nodeId, {
      type,
      message: `Anomaly of type ${type}`,
    })
  );
}

// ============================================================================
// Voxel Graph Factory
// ============================================================================

export interface VoxelGraphOptions {
  nodeCount?: number;
  edgeCount?: number;
  anomalyCount?: number;
  connected?: boolean;
  circular?: boolean;
}

/**
 * Create a complete Voxel graph with nodes, edges, and anomalies
 */
export function createVoxelGraph(options: VoxelGraphOptions = {}): {
  nodes: Map<string, VoxelNode>;
  edges: Map<string, VoxelEdge>;
  anomalies: Map<string, VoxelAnomaly>;
  nodeIds: string[];
  edgeIds: string[];
  anomalyIds: string[];
} {
  const {
    nodeCount = 5,
    edgeCount = 4,
    anomalyCount = 2,
    connected = true,
    circular = false,
  } = options;

  const nodes = new Map<string, VoxelNode>();
  const edges = new Map<string, VoxelEdge>();
  const anomalies = new Map<string, VoxelAnomaly>();
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  const anomalyIds: string[] = [];

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    const node = createVoxelNode({
      label: `Node ${i + 1}`,
      position: {
        x: Math.cos((i / nodeCount) * Math.PI * 2) * 10,
        y: i * 2,
        z: Math.sin((i / nodeCount) * Math.PI * 2) * 10,
      },
    });
    nodes.set(node.id, node);
    nodeIds.push(node.id);
  }

  // Create edges
  if (connected && nodeCount > 1) {
    // Create chain of edges
    const chainEdges = createEdgeChain(nodeIds.slice(0, Math.min(edgeCount + 1, nodeCount)));
    chainEdges.forEach((edge) => {
      edges.set(edge.id, edge);
      edgeIds.push(edge.id);
    });

    // Create circular edge if requested
    if (circular && nodeCount > 2) {
      const circularEdge = createVoxelEdge(nodeIds[nodeIds.length - 1], nodeIds[0]);
      edges.set(circularEdge.id, circularEdge);
      edgeIds.push(circularEdge.id);
    }
  }

  // Create anomalies
  for (let i = 0; i < Math.min(anomalyCount, nodeCount); i++) {
    const anomaly = createVoxelAnomaly(nodeIds[i]);
    anomalies.set(anomaly.id, anomaly);
    anomalyIds.push(anomaly.id);
  }

  return { nodes, edges, anomalies, nodeIds, edgeIds, anomalyIds };
}

// ============================================================================
// BlastRadius Factory
// ============================================================================

/**
 * Create a BlastRadiusConfig with optional overrides
 */
export function createBlastRadiusConfig(
  startNodeId: string,
  overrides: Partial<BlastRadiusConfig> = {}
): BlastRadiusConfig {
  return {
    startNodeId,
    maxDepth: 3,
    minProbability: 0.1,
    ...overrides,
  };
}

/**
 * Create a BlastRadiusResult with optional overrides
 */
export function createBlastRadiusResult(
  overrides: Partial<BlastRadiusResult> = {}
): BlastRadiusResult {
  return {
    impactedNodes: [
      { nodeId: 'node-1', depth: 1, probability: 0.75, path: ['source', 'node-1'] },
      { nodeId: 'node-2', depth: 2, probability: 0.5, path: ['source', 'node-1', 'node-2'] },
    ],
    totalImpact: 1.25,
    businessImpact: 'medium',
    ...overrides,
  };
}

// ============================================================================
// Annotation Factory
// ============================================================================

/**
 * Create an AnnotationAuthor with optional overrides
 */
export function createAnnotationAuthor(
  overrides: Partial<AnnotationAuthor> = {}
): AnnotationAuthor {
  const id = generateId('user');
  return {
    id,
    displayName: `Test User ${id}`,
    email: `testuser-${id}@example.com`,
    ...overrides,
  };
}

/**
 * Create a Position3D with optional overrides
 */
export function createPosition3D(overrides: Partial<Position3D> = {}): Position3D {
  return {
    x: 0,
    y: 0,
    z: 0,
    ...overrides,
  };
}

/**
 * Create a VoxelAnnotation with optional overrides
 */
export function createVoxelAnnotation(
  overrides: Partial<VoxelAnnotation> = {}
): VoxelAnnotation {
  const id = generateId('annotation');
  const author = overrides.author || createAnnotationAuthor();
  const now = new Date().toISOString();

  return {
    id,
    organizationId: 'org-test',
    nodeId: undefined,
    position: createPosition3D(overrides.position),
    content: 'Test annotation content',
    author,
    createdAt: now,
    updatedAt: now,
    type: 'note',
    color: '#3b82f6',
    visibility: 'public',
    attachments: [],
    replies: [],
    replyCount: 0,
    status: 'open',
    readBy: [author.id],
    mentions: [],
    isPinned: false,
    ...overrides,
  };
}

/**
 * Create an AnnotationReply with optional overrides
 */
export function createAnnotationReply(
  annotationId: string,
  overrides: Partial<AnnotationReply> = {}
): AnnotationReply {
  const id = generateId('reply');
  const author = overrides.author || createAnnotationAuthor();
  const now = new Date().toISOString();

  return {
    id,
    annotationId,
    content: 'Test reply content',
    author,
    createdAt: now,
    mentions: [],
    isEdited: false,
    ...overrides,
  };
}

/**
 * Create a CreateAnnotationDTO with optional overrides
 */
export function createAnnotationDTO(
  overrides: Partial<CreateAnnotationDTO> = {}
): CreateAnnotationDTO {
  return {
    position: createPosition3D(),
    content: 'Test annotation content',
    type: 'note',
    visibility: 'public',
    ...overrides,
  };
}

/**
 * Create a CreateReplyDTO with optional overrides
 */
export function createReplyDTO(
  annotationId: string,
  overrides: Partial<CreateReplyDTO> = {}
): CreateReplyDTO {
  return {
    annotationId,
    content: 'Test reply content',
    ...overrides,
  };
}

// ============================================================================
// Store State Factories
// ============================================================================

/**
 * Create VoxelFilters with optional overrides
 */
export function createVoxelFilters(overrides: Partial<VoxelFilters> = {}): VoxelFilters {
  return {
    nodeTypes: ['asset', 'risk', 'control', 'incident', 'supplier', 'project', 'audit'],
    statuses: ['normal', 'warning', 'critical', 'inactive'],
    dateRange: undefined,
    searchQuery: '',
    showAnomaliesOnly: false,
    ...overrides,
  };
}

/**
 * Create VoxelUIState with optional overrides
 */
export function createVoxelUIState(overrides: Partial<VoxelUIState> = {}): VoxelUIState {
  return {
    selectedNodeId: null,
    hoveredNodeId: null,
    cameraPosition: { x: 0, y: 10, z: 20 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    zoom: 1,
    showLabels: true,
    showEdges: true,
    layoutType: 'force',
    ...overrides,
  };
}

/**
 * Create VoxelSyncState with optional overrides
 */
export function createVoxelSyncState(overrides: Partial<VoxelSyncState> = {}): VoxelSyncState {
  return {
    status: 'connected',
    lastSyncAt: new Date(),
    pendingChanges: 0,
    ...overrides,
  };
}

// ============================================================================
// Mock Data Helpers
// ============================================================================

/**
 * Create mock Control data for anomaly detection tests
 */
export function createMockControl(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: generateId('control'),
    code: 'CTL-001',
    name: 'Test Control',
    status: 'active',
    effectiveness: 80,
    maturity: 3,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock Risk data for anomaly detection tests
 */
export function createMockRisk(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: generateId('risk'),
    name: 'Test Risk',
    threat: 'Test Threat',
    status: 'Ouvert',
    score: 10,
    strategy: 'Traiter',
    mitigationControlIds: [],
    relatedControlIds: [],
    ...overrides,
  };
}

/**
 * Create a set of interconnected mock data for integration tests
 */
export function createMockGRCData(): {
  controls: Record<string, unknown>[];
  risks: Record<string, unknown>[];
} {
  const control1 = createMockControl({ id: 'ctrl-1', name: 'Password Policy' });
  const control2 = createMockControl({ id: 'ctrl-2', name: 'Access Control' });
  const orphanControl = createMockControl({ id: 'ctrl-3', name: 'Orphan Control' });

  const risk1 = createMockRisk({
    id: 'risk-1',
    name: 'Data Breach',
    mitigationControlIds: ['ctrl-1', 'ctrl-2'],
  });
  const risk2 = createMockRisk({
    id: 'risk-2',
    name: 'Unauthorized Access',
    relatedControlIds: ['ctrl-1'],
  });
  const uncoveredRisk = createMockRisk({
    id: 'risk-3',
    name: 'Uncovered Risk',
    mitigationControlIds: [],
    strategy: 'Traiter',
  });

  return {
    controls: [control1, control2, orphanControl],
    risks: [risk1, risk2, uncoveredRisk],
  };
}
