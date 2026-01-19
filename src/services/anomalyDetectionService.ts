/**
 * Epic 29: Story 29.4 - Client-side Anomaly Detection Service
 *
 * Real-time client-side detection for immediate feedback.
 * Detects: orphan controls, coverage gaps, circular dependencies
 */

import {
  VoxelAnomaly,
  VoxelAnomalyType,
  VoxelAnomalySeverity,
  VoxelAnomalyDetails,
  VoxelNode,
  VoxelEdge,
} from '../types/voxel';
import { Control, Risk } from '../types';
import { useVoxelStore, voxelStoreActions } from '../stores/voxelStore';

// Extended types for anomaly detection (fields may exist on Firestore docs)
interface ControlWithAssessment extends Control {
  lastAssessmentDate?: string;
  effectiveness?: number;
  score?: number;
  updatedAt?: string;
}

interface RiskWithAssessment extends Risk {
  lastAssessmentDate?: string;
  mitigationControlIds?: string[];
  relatedControlIds?: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const STALE_THRESHOLD_DAYS = 90;
const EFFECTIVENESS_THRESHOLD = 50;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for an anomaly
 */
const generateAnomalyId = (): string => {
  return `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate severity based on anomaly type and context
 */
const calculateSeverity = (
  type: VoxelAnomalyType,
  details: VoxelAnomalyDetails = {}
): VoxelAnomalySeverity => {
  switch (type) {
    case 'circular_dependency':
      return 'critical';
    case 'coverage_gap': {
      // coverage_gap stores riskScore in nested context
      const contextData = (details.context || details) as Record<string, unknown>;
      const riskScore = contextData.riskScore as number;
      if (riskScore >= 15) return 'critical';
      if (riskScore >= 10) return 'high';
      if (riskScore >= 5) return 'medium';
      return 'low';
    }
    case 'orphan_control':
      return 'medium';
    case 'stale_assessment': {
      const days = details.daysSinceAssessment as number;
      if (days > 180) return 'critical';
      if (days > 120) return 'high';
      return 'medium';
    }
    case 'compliance_drift': {
      const value = details.actualValue as number;
      if (value < 30) return 'critical';
      if (value < EFFECTIVENESS_THRESHOLD) return 'high';
      return 'medium';
    }
    default:
      return 'medium';
  }
};

/**
 * Create an anomaly object
 */
const createAnomaly = (
  type: VoxelAnomalyType,
  nodeId: string,
  message: string,
  details: VoxelAnomalyDetails = {},
  organizationId?: string
): VoxelAnomaly => {
  const severity = calculateSeverity(type, details);
  return {
    id: generateAnomalyId(),
    type,
    severity,
    nodeId,
    message,
    details,
    detectedAt: new Date(),
    status: 'active',
    detectionSource: 'client',
    organizationId,
  };
};

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect orphan controls - controls not linked to any risk
 */
export const detectOrphanControls = (
  controls: (Control | ControlWithAssessment)[],
  risks: (Risk | RiskWithAssessment)[],
  organizationId?: string
): VoxelAnomaly[] => {
  const anomalies: VoxelAnomaly[] = [];

  // Build set of linked control IDs from all risks
  const linkedControlIds = new Set<string>();
  risks.forEach((risk) => {
    const r = risk as RiskWithAssessment;
    if (r.mitigationControlIds && Array.isArray(r.mitigationControlIds)) {
      r.mitigationControlIds.forEach((id) => linkedControlIds.add(id));
    }
    if (r.relatedControlIds && Array.isArray(r.relatedControlIds)) {
      r.relatedControlIds.forEach((id) => linkedControlIds.add(id));
    }
  });

  // Find orphan controls
  controls.forEach((control) => {
    if (!linkedControlIds.has(control.id) && control.status !== 'Inactif') {
      anomalies.push(
        createAnomaly(
          'orphan_control',
          control.id,
          `Controle "${control.name || control.code}" n'est lié à aucun risque`,
          {
            context: {
              controlCode: control.code,
              controlName: control.name,
            },
          },
          organizationId
        )
      );
    }
  });

  return anomalies;
};

/**
 * Detect coverage gaps - risks without mitigation controls
 */
export const detectCoverageGaps = (
  risks: (Risk | RiskWithAssessment)[],
  organizationId?: string
): VoxelAnomaly[] => {
  const anomalies: VoxelAnomaly[] = [];
  const openStatuses = ['Ouvert', 'En cours', 'open', 'in_progress'];

  risks.forEach((risk) => {
    const r = risk as RiskWithAssessment;
    // Only check open risks
    if (!openStatuses.includes(r.status || '')) return;

    const hasControls =
      r.mitigationControlIds &&
      Array.isArray(r.mitigationControlIds) &&
      r.mitigationControlIds.length > 0;

    // Skip accepted risks
    if (r.strategy === 'Accepter') return;

    if (!hasControls) {
      anomalies.push(
        createAnomaly(
          'coverage_gap',
          r.id,
          `Risque "${r.threat}" sans contrôle de mitigation`,
          {
            context: {
              riskScore: r.score || 0,
              riskThreat: r.threat,
              strategy: r.strategy,
            },
            threshold: 1,
            actualValue: 0,
          },
          organizationId
        )
      );
    }
  });

  return anomalies;
};

/**
 * Detect stale assessments - entities not assessed within threshold
 */
export const detectStaleAssessments = (
  controls: (Control | ControlWithAssessment)[],
  risks: (Risk | RiskWithAssessment)[],
  organizationId?: string
): VoxelAnomaly[] => {
  const anomalies: VoxelAnomaly[] = [];
  const now = new Date();
  const threshold = new Date(now.getTime() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  // Check controls
  controls.forEach((control) => {
    const c = control as ControlWithAssessment;
    if (c.status === 'Inactif') return;

    let lastAssessment: Date | null = null;
    if (c.lastAssessmentDate) {
      lastAssessment = new Date(c.lastAssessmentDate);
    } else if (c.updatedAt) {
      lastAssessment = new Date(c.updatedAt);
    } else if (c.lastUpdated) {
      lastAssessment = new Date(c.lastUpdated);
    }

    if (lastAssessment && lastAssessment < threshold) {
      const daysSince = Math.floor(
        (now.getTime() - lastAssessment.getTime()) / (1000 * 60 * 60 * 24)
      );
      anomalies.push(
        createAnomaly(
          'stale_assessment',
          c.id,
          `Contrôle "${c.name || c.code}" non évalué depuis ${daysSince} jours`,
          {
            daysSinceAssessment: daysSince,
            threshold: STALE_THRESHOLD_DAYS,
            context: {
              lastAssessmentDate: lastAssessment.toISOString(),
            },
          },
          organizationId
        )
      );
    }
  });

  // Check risks
  const openStatuses = ['Ouvert', 'En cours', 'open', 'in_progress'];
  risks.forEach((risk) => {
    const r = risk as RiskWithAssessment;
    if (!openStatuses.includes(r.status || '')) return;

    let lastAssessment: Date | null = null;
    if (r.lastAssessmentDate) {
      lastAssessment = new Date(r.lastAssessmentDate);
    } else if (r.updatedAt) {
      lastAssessment = new Date(r.updatedAt);
    }

    if (lastAssessment && lastAssessment < threshold) {
      const daysSince = Math.floor(
        (now.getTime() - lastAssessment.getTime()) / (1000 * 60 * 60 * 24)
      );
      anomalies.push(
        createAnomaly(
          'stale_assessment',
          r.id,
          `Risque "${r.threat}" non réévalué depuis ${daysSince} jours`,
          {
            daysSinceAssessment: daysSince,
            threshold: STALE_THRESHOLD_DAYS,
            context: {
              lastAssessmentDate: lastAssessment.toISOString(),
            },
          },
          organizationId
        )
      );
    }
  });

  return anomalies;
};

/**
 * Detect compliance drift - control effectiveness below threshold
 */
export const detectComplianceDrift = (
  controls: (Control | ControlWithAssessment)[],
  organizationId?: string
): VoxelAnomaly[] => {
  const anomalies: VoxelAnomaly[] = [];

  controls.forEach((control) => {
    const c = control as ControlWithAssessment;
    if (c.status === 'Inactif') return;

    const effectiveness =
      c.effectiveness ?? c.maturity ?? c.score;

    if (typeof effectiveness === 'number' && effectiveness < EFFECTIVENESS_THRESHOLD) {
      anomalies.push(
        createAnomaly(
          'compliance_drift',
          c.id,
          `Contrôle "${c.name || c.code}" efficacité insuffisante (${effectiveness}%)`,
          {
            actualValue: effectiveness,
            threshold: EFFECTIVENESS_THRESHOLD,
            context: {
              controlCode: c.code,
            },
          },
          organizationId
        )
      );
    }
  });

  return anomalies;
};

/**
 * Detect circular dependencies using DFS on Voxel graph data
 */
export const detectCircularDependencies = (
  nodes: Map<string, VoxelNode>,
  edges: Map<string, VoxelEdge>,
  organizationId?: string
): VoxelAnomaly[] => {
  const anomalies: VoxelAnomaly[] = [];

  // Build adjacency list from edges
  const graph = new Map<string, string[]>();

  // Initialize all nodes in graph
  nodes.forEach((_, nodeId) => {
    graph.set(nodeId, []);
  });

  // Add edges to graph
  edges.forEach((edge) => {
    const connections = graph.get(edge.source) || [];
    connections.push(edge.target);
    graph.set(edge.source, connections);
  });

  // DFS-based cycle detection
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const foundCycles: string[][] = [];

  const dfs = (nodeId: string, path: string[] = []): string[] | null => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];

    for (const neighbor of neighbors) {
      if (!graph.has(neighbor)) continue;

      if (!visited.has(neighbor)) {
        const cyclePath = dfs(neighbor, [...path]);
        if (cyclePath) return cyclePath;
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        const cyclePath = path.slice(cycleStart);
        cyclePath.push(neighbor);
        return cyclePath;
      }
    }

    recursionStack.delete(nodeId);
    return null;
  };

  // Run DFS from each unvisited node
  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      const cyclePath = dfs(nodeId);
      if (cyclePath) {
        // Check uniqueness
        const cycleKey = [...cyclePath].sort().join(',');
        if (!foundCycles.some((c) => [...c].sort().join(',') === cycleKey)) {
          foundCycles.push(cyclePath);
        }
      }
    }
  }

  // Create anomalies for each cycle
  for (const cyclePath of foundCycles) {
    const firstNodeId = cyclePath[0];
    const node = nodes.get(firstNodeId);

    anomalies.push(
      createAnomaly(
        'circular_dependency',
        firstNodeId,
        `Dépendance circulaire détectée impliquant ${cyclePath.length - 1} éléments`,
        {
          cyclePath,
          relatedNodeIds: cyclePath.slice(0, -1),
          context: {
            cycleLength: cyclePath.length - 1,
            nodeType: node?.type,
          },
        },
        organizationId
      )
    );
  }

  return anomalies;
};

// ============================================================================
// Anomaly Detection Service Class
// ============================================================================

/**
 * Client-side Anomaly Detection Service
 * Integrates with Voxel store for real-time anomaly detection
 */
export class AnomalyDetectionService {
  /**
   * Run all client-side detection algorithms
   */
  static detectAll(
    controls: (Control | ControlWithAssessment)[],
    risks: (Risk | RiskWithAssessment)[],
    nodes: Map<string, VoxelNode>,
    edges: Map<string, VoxelEdge>,
    organizationId?: string
  ): VoxelAnomaly[] {
    const allAnomalies: VoxelAnomaly[] = [];

    // Run all detectors
    allAnomalies.push(...detectOrphanControls(controls, risks, organizationId));
    allAnomalies.push(...detectCoverageGaps(risks, organizationId));
    allAnomalies.push(...detectStaleAssessments(controls, risks, organizationId));
    allAnomalies.push(...detectComplianceDrift(controls, organizationId));
    allAnomalies.push(...detectCircularDependencies(nodes, edges, organizationId));

    return allAnomalies;
  }

  /**
   * Run detection and update Voxel store
   */
  static detectAndUpdateStore(
    controls: (Control | ControlWithAssessment)[],
    risks: (Risk | RiskWithAssessment)[],
    organizationId?: string
  ): VoxelAnomaly[] {
    const state = useVoxelStore.getState();
    const { nodes, edges } = state;

    const anomalies = this.detectAll(controls, risks, nodes, edges, organizationId);

    // Update store with detected anomalies
    voxelStoreActions.setAnomalies(anomalies);

    return anomalies;
  }

  /**
   * Get anomaly statistics
   */
  static getStatistics(anomalies: VoxelAnomaly[]): {
    total: number;
    byType: Record<VoxelAnomalyType, number>;
    bySeverity: Record<VoxelAnomalySeverity, number>;
    byStatus: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    anomalies.forEach((anomaly) => {
      // By type
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;

      // By severity
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;

      // By status
      byStatus[anomaly.status] = (byStatus[anomaly.status] || 0) + 1;
    });

    return {
      total: anomalies.length,
      byType: byType as Record<VoxelAnomalyType, number>,
      bySeverity: bySeverity as Record<VoxelAnomalySeverity, number>,
      byStatus,
    };
  }

  /**
   * Filter anomalies by criteria
   */
  static filterAnomalies(
    anomalies: VoxelAnomaly[],
    filters: {
      types?: VoxelAnomalyType[];
      severities?: VoxelAnomalySeverity[];
      statuses?: string[];
      nodeId?: string;
    }
  ): VoxelAnomaly[] {
    return anomalies.filter((anomaly) => {
      if (filters.types && !filters.types.includes(anomaly.type)) {
        return false;
      }
      if (filters.severities && !filters.severities.includes(anomaly.severity)) {
        return false;
      }
      if (filters.statuses && !filters.statuses.includes(anomaly.status)) {
        return false;
      }
      if (filters.nodeId && anomaly.nodeId !== filters.nodeId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Sort anomalies by severity (critical first)
   */
  static sortBySeverity(anomalies: VoxelAnomaly[]): VoxelAnomaly[] {
    const severityOrder: Record<VoxelAnomalySeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...anomalies].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }
}

export default AnomalyDetectionService;
