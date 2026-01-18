/**
 * Epic 30: Simulation Blast Radius Service
 *
 * Core algorithms for blast radius simulation and root cause analysis:
 * - BFS-based impact propagation from source node
 * - Impact decay based on distance (100% -> 75% -> 50% -> 25%)
 * - Edge weight consideration for impact calculation
 * - Reverse BFS for root cause analysis
 */

import type {
  VoxelNode,
  VoxelEdge,
  VoxelNodeType,
  BlastRadiusConfig,
  BlastRadiusResult,
} from '../types/voxel';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended blast radius configuration
 */
export interface ExtendedBlastRadiusConfig extends BlastRadiusConfig {
  /** Impact decay per depth level (default: 0.25 = 25% reduction per level) */
  decayRate?: number;
  /** Whether to follow edges in both directions */
  bidirectional?: boolean;
  /** Edge types to traverse (empty = all) */
  edgeTypes?: VoxelEdge['type'][];
  /** Node types to include in results (empty = all) */
  includeNodeTypes?: VoxelNodeType[];
}

/**
 * Individual affected node result
 */
export interface AffectedNode {
  nodeId: string;
  node: VoxelNode;
  depth: number;
  impact: number;
  path: string[];
  edgeWeightSum: number;
}

/**
 * Full blast radius result with paths
 */
export interface BlastRadiusAnalysis {
  sourceNodeId: string;
  affectedNodes: AffectedNode[];
  totalImpact: number;
  maxDepth: number;
  paths: string[][];
  nodesByType: Record<VoxelNodeType, AffectedNode[]>;
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  executionTimeMs: number;
}

/**
 * Root cause analysis result
 */
export interface RootCauseResult {
  incidentNodeId: string;
  potentialCauses: PotentialCause[];
  maxDepth: number;
  paths: string[][];
  executionTimeMs: number;
}

/**
 * Individual potential root cause
 */
export interface PotentialCause {
  nodeId: string;
  node: VoxelNode;
  depth: number;
  likelihood: number;
  paths: string[][];
  contributingFactors: string[];
}

/**
 * What-If scenario types
 */
export type WhatIfScenario =
  | { type: 'remove_node'; nodeId: string }
  | { type: 'add_node'; node: Partial<VoxelNode>; edges: Partial<VoxelEdge>[] }
  | { type: 'remove_edge'; edgeId: string }
  | { type: 'add_edge'; edge: Partial<VoxelEdge> }
  | { type: 'modify_weight'; edgeId: string; newWeight: number };

/**
 * What-If comparison result
 */
export interface WhatIfComparison {
  baseline: BlastRadiusAnalysis;
  scenario: BlastRadiusAnalysis;
  impactDelta: number;
  affectedNodesDelta: number;
  newlyAffected: string[];
  noLongerAffected: string[];
  changedImpact: Array<{ nodeId: string; before: number; after: number; delta: number }>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default impact decay rates per depth level */
const DEFAULT_DECAY_RATES = [1.0, 0.75, 0.5, 0.25, 0.1];

/** Business impact thresholds */
const IMPACT_THRESHOLDS = {
  critical: 75,
  high: 50,
  medium: 25,
  low: 0,
};

// ============================================================================
// Blast Radius Algorithm (BFS)
// ============================================================================

/**
 * Calculate impact at a given depth with edge weight consideration
 */
const calculateImpact = (
  depth: number,
  edgeWeight: number,
  decayRate: number,
  customDecayRates?: number[]
): number => {
  const rates = customDecayRates || DEFAULT_DECAY_RATES;
  const baseImpact = rates[Math.min(depth, rates.length - 1)] ?? rates[rates.length - 1];
  // Edge weight affects impact (higher weight = stronger connection = more impact)
  const weightMultiplier = Math.min(Math.max(edgeWeight, 0.1), 2.0);
  return baseImpact * weightMultiplier;
};

/**
 * Calculate business impact level based on total impact and affected nodes
 */
const calculateBusinessImpact = (
  totalImpact: number,
  affectedCount: number,
  criticalCount: number
): BlastRadiusResult['businessImpact'] => {
  // Weighted score based on multiple factors
  const normalizedImpact = (totalImpact / Math.max(affectedCount, 1)) * 100;

  if (criticalCount > 2 || normalizedImpact >= IMPACT_THRESHOLDS.critical) {
    return 'critical';
  }
  if (criticalCount > 0 || normalizedImpact >= IMPACT_THRESHOLDS.high) {
    return 'high';
  }
  if (normalizedImpact >= IMPACT_THRESHOLDS.medium) {
    return 'medium';
  }
  return 'low';
};

/**
 * Build adjacency list from edges
 */
const buildAdjacencyList = (
  nodes: Map<string, VoxelNode>,
  edges: Map<string, VoxelEdge>,
  bidirectional: boolean = false,
  edgeTypes?: VoxelEdge['type'][]
): Map<string, Array<{ targetId: string; weight: number; edgeId: string }>> => {
  const adjacencyList = new Map<string, Array<{ targetId: string; weight: number; edgeId: string }>>();

  // Initialize all nodes
  nodes.forEach((_, nodeId) => {
    adjacencyList.set(nodeId, []);
  });

  // Add edges
  edges.forEach((edge) => {
    // Filter by edge type if specified
    if (edgeTypes && edgeTypes.length > 0 && !edgeTypes.includes(edge.type)) {
      return;
    }

    // Forward direction
    const sourceConnections = adjacencyList.get(edge.source) || [];
    sourceConnections.push({
      targetId: edge.target,
      weight: edge.weight,
      edgeId: edge.id,
    });
    adjacencyList.set(edge.source, sourceConnections);

    // Backward direction if bidirectional
    if (bidirectional) {
      const targetConnections = adjacencyList.get(edge.target) || [];
      targetConnections.push({
        targetId: edge.source,
        weight: edge.weight,
        edgeId: edge.id,
      });
      adjacencyList.set(edge.target, targetConnections);
    }
  });

  return adjacencyList;
};

/**
 * Build reverse adjacency list (for root cause analysis)
 */
const buildReverseAdjacencyList = (
  nodes: Map<string, VoxelNode>,
  edges: Map<string, VoxelEdge>,
  edgeTypes?: VoxelEdge['type'][]
): Map<string, Array<{ sourceId: string; weight: number; edgeId: string }>> => {
  const reverseList = new Map<string, Array<{ sourceId: string; weight: number; edgeId: string }>>();

  // Initialize all nodes
  nodes.forEach((_, nodeId) => {
    reverseList.set(nodeId, []);
  });

  // Add reverse edges
  edges.forEach((edge) => {
    // Filter by edge type if specified
    if (edgeTypes && edgeTypes.length > 0 && !edgeTypes.includes(edge.type)) {
      return;
    }

    const targetConnections = reverseList.get(edge.target) || [];
    targetConnections.push({
      sourceId: edge.source,
      weight: edge.weight,
      edgeId: edge.id,
    });
    reverseList.set(edge.target, targetConnections);
  });

  return reverseList;
};

// ============================================================================
// Blast Radius Service Class
// ============================================================================

/**
 * Blast Radius Analysis Service
 * Provides algorithms for impact propagation and root cause analysis
 */
export class BlastRadiusService {
  /**
   * Calculate blast radius from a source node using BFS
   * Time complexity: O(V + E) where V = nodes, E = edges
   */
  static calculateBlastRadius(
    sourceNodeId: string,
    nodes: Map<string, VoxelNode>,
    edges: Map<string, VoxelEdge>,
    config: ExtendedBlastRadiusConfig
  ): BlastRadiusAnalysis {
    const startTime = performance.now();

    // Validate source node exists
    const sourceNode = nodes.get(sourceNodeId);
    if (!sourceNode) {
      return {
        sourceNodeId,
        affectedNodes: [],
        totalImpact: 0,
        maxDepth: 0,
        paths: [],
        nodesByType: {} as Record<VoxelNodeType, AffectedNode[]>,
        businessImpact: 'low',
        executionTimeMs: performance.now() - startTime,
      };
    }

    const {
      maxDepth,
      minProbability = 0.1,
      decayRate = 0.25,
      bidirectional = false,
      edgeTypes,
      includeNodeTypes,
    } = config;

    // Build adjacency list
    const adjacencyList = buildAdjacencyList(nodes, edges, bidirectional, edgeTypes);

    // BFS state
    const visited = new Map<string, AffectedNode>();
    const queue: Array<{
      nodeId: string;
      depth: number;
      path: string[];
      cumulativeWeight: number;
    }> = [];

    // Initialize with source node
    queue.push({
      nodeId: sourceNodeId,
      depth: 0,
      path: [sourceNodeId],
      cumulativeWeight: 1.0,
    });

    // BFS traversal
    while (queue.length > 0) {
      const current = queue.shift()!;
      const { nodeId, depth, path, cumulativeWeight } = current;

      // Skip if already visited with better impact
      const existingVisit = visited.get(nodeId);
      if (existingVisit && existingVisit.impact >= calculateImpact(depth, cumulativeWeight, decayRate)) {
        continue;
      }

      // Skip source node in results (but still traverse from it)
      if (nodeId !== sourceNodeId) {
        const node = nodes.get(nodeId);
        if (!node) continue;

        // Filter by node type if specified
        if (includeNodeTypes && includeNodeTypes.length > 0 && !includeNodeTypes.includes(node.type)) {
          continue;
        }

        const impact = calculateImpact(depth, cumulativeWeight, decayRate);

        // Skip if below minimum probability/impact threshold
        if (impact < minProbability) {
          continue;
        }

        visited.set(nodeId, {
          nodeId,
          node,
          depth,
          impact,
          path: [...path],
          edgeWeightSum: cumulativeWeight,
        });
      }

      // Stop if max depth reached
      if (depth >= maxDepth) {
        continue;
      }

      // Traverse neighbors
      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.targetId) || visited.get(neighbor.targetId)!.depth > depth + 1) {
          queue.push({
            nodeId: neighbor.targetId,
            depth: depth + 1,
            path: [...path, neighbor.targetId],
            cumulativeWeight: cumulativeWeight * neighbor.weight,
          });
        }
      }
    }

    // Build results
    const affectedNodes = Array.from(visited.values()).sort((a, b) => b.impact - a.impact);
    const totalImpact = affectedNodes.reduce((sum, n) => sum + n.impact, 0);
    const actualMaxDepth = affectedNodes.reduce((max, n) => Math.max(max, n.depth), 0);
    const paths = affectedNodes.map((n) => n.path);

    // Group by type
    const nodesByType: Record<VoxelNodeType, AffectedNode[]> = {
      asset: [],
      risk: [],
      control: [],
      incident: [],
      supplier: [],
      project: [],
      audit: [],
    };
    affectedNodes.forEach((n) => {
      nodesByType[n.node.type].push(n);
    });

    // Calculate business impact
    const criticalCount = affectedNodes.filter(
      (n) => n.node.status === 'critical' || n.impact >= 0.75
    ).length;
    const businessImpact = calculateBusinessImpact(totalImpact, affectedNodes.length, criticalCount);

    return {
      sourceNodeId,
      affectedNodes,
      totalImpact,
      maxDepth: actualMaxDepth,
      paths,
      nodesByType,
      businessImpact,
      executionTimeMs: performance.now() - startTime,
    };
  }

  /**
   * Perform root cause analysis using reverse BFS
   * Finds potential upstream causes for an incident/anomaly
   */
  static analyzeRootCauses(
    incidentNodeId: string,
    nodes: Map<string, VoxelNode>,
    edges: Map<string, VoxelEdge>,
    config: Omit<ExtendedBlastRadiusConfig, 'startNodeId'> & { startNodeId?: string }
  ): RootCauseResult {
    const startTime = performance.now();

    // Validate incident node exists
    const incidentNode = nodes.get(incidentNodeId);
    if (!incidentNode) {
      return {
        incidentNodeId,
        potentialCauses: [],
        maxDepth: 0,
        paths: [],
        executionTimeMs: performance.now() - startTime,
      };
    }

    const {
      maxDepth,
      minProbability = 0.1,
      edgeTypes,
    } = config;

    // Build reverse adjacency list (traverse backwards)
    const reverseList = buildReverseAdjacencyList(nodes, edges, edgeTypes);

    // BFS state
    const visited = new Map<string, {
      nodeId: string;
      depth: number;
      paths: string[][];
      likelihood: number;
    }>();
    const queue: Array<{
      nodeId: string;
      depth: number;
      path: string[];
      cumulativeLikelihood: number;
    }> = [];

    // Initialize with incident node
    queue.push({
      nodeId: incidentNodeId,
      depth: 0,
      path: [incidentNodeId],
      cumulativeLikelihood: 1.0,
    });

    // Reverse BFS traversal
    while (queue.length > 0) {
      const current = queue.shift()!;
      const { nodeId, depth, path, cumulativeLikelihood } = current;

      // Skip source node in results
      if (nodeId !== incidentNodeId) {
        const existing = visited.get(nodeId);
        if (existing) {
          // Add this path to existing entry
          existing.paths.push([...path]);
          existing.likelihood = Math.max(existing.likelihood, cumulativeLikelihood);
        } else {
          visited.set(nodeId, {
            nodeId,
            depth,
            paths: [[...path]],
            likelihood: cumulativeLikelihood,
          });
        }
      }

      // Stop if max depth reached
      if (depth >= maxDepth) {
        continue;
      }

      // Traverse upstream (reverse direction)
      const upstreamNodes = reverseList.get(nodeId) || [];
      for (const upstream of upstreamNodes) {
        const newLikelihood = cumulativeLikelihood * upstream.weight;
        if (newLikelihood < minProbability) continue;

        const existingVisit = visited.get(upstream.sourceId);
        if (!existingVisit || existingVisit.depth > depth + 1) {
          queue.push({
            nodeId: upstream.sourceId,
            depth: depth + 1,
            path: [...path, upstream.sourceId],
            cumulativeLikelihood: newLikelihood,
          });
        }
      }
    }

    // Build potential causes
    const potentialCauses: PotentialCause[] = [];
    visited.forEach((data, nodeId) => {
      const node = nodes.get(nodeId);
      if (!node) return;

      // Calculate contributing factors based on node type and connections
      const contributingFactors: string[] = [];
      if (node.type === 'risk') contributingFactors.push('Risk source');
      if (node.type === 'control' && node.status !== 'normal') contributingFactors.push('Control weakness');
      if (node.type === 'supplier') contributingFactors.push('Third-party dependency');
      if (node.type === 'asset' && node.status === 'critical') contributingFactors.push('Critical asset');
      if (data.paths.length > 1) contributingFactors.push('Multiple impact paths');

      potentialCauses.push({
        nodeId,
        node,
        depth: data.depth,
        likelihood: data.likelihood,
        paths: data.paths,
        contributingFactors,
      });
    });

    // Sort by likelihood (descending)
    potentialCauses.sort((a, b) => b.likelihood - a.likelihood);

    const allPaths = potentialCauses.flatMap((c) => c.paths);
    const actualMaxDepth = potentialCauses.reduce((max, c) => Math.max(max, c.depth), 0);

    return {
      incidentNodeId,
      potentialCauses,
      maxDepth: actualMaxDepth,
      paths: allPaths,
      executionTimeMs: performance.now() - startTime,
    };
  }

  /**
   * Apply What-If scenario to graph and recalculate blast radius
   */
  static applyWhatIfScenario(
    sourceNodeId: string,
    nodes: Map<string, VoxelNode>,
    edges: Map<string, VoxelEdge>,
    config: ExtendedBlastRadiusConfig,
    scenario: WhatIfScenario
  ): WhatIfComparison {
    // Calculate baseline
    const baseline = this.calculateBlastRadius(sourceNodeId, nodes, edges, config);

    // Create modified copies of nodes and edges
    const modifiedNodes = new Map(nodes);
    const modifiedEdges = new Map(edges);

    // Apply scenario
    switch (scenario.type) {
      case 'remove_node': {
        modifiedNodes.delete(scenario.nodeId);
        // Remove connected edges
        modifiedEdges.forEach((edge, edgeId) => {
          if (edge.source === scenario.nodeId || edge.target === scenario.nodeId) {
            modifiedEdges.delete(edgeId);
          }
        });
        break;
      }
      case 'add_node': {
        const newNodeId = scenario.node.id || `temp-node-${Date.now()}`;
        modifiedNodes.set(newNodeId, {
          id: newNodeId,
          type: scenario.node.type || 'control',
          label: scenario.node.label || 'New Node',
          status: scenario.node.status || 'normal',
          position: scenario.node.position || { x: 0, y: 0, z: 0 },
          data: scenario.node.data || {},
          connections: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        // Add edges
        scenario.edges.forEach((edge, index) => {
          const edgeId = edge.id || `temp-edge-${Date.now()}-${index}`;
          modifiedEdges.set(edgeId, {
            id: edgeId,
            source: edge.source || newNodeId,
            target: edge.target || '',
            type: edge.type || 'mitigation',
            weight: edge.weight ?? 1.0,
          });
        });
        break;
      }
      case 'remove_edge': {
        modifiedEdges.delete(scenario.edgeId);
        break;
      }
      case 'add_edge': {
        const edgeId = scenario.edge.id || `temp-edge-${Date.now()}`;
        modifiedEdges.set(edgeId, {
          id: edgeId,
          source: scenario.edge.source || '',
          target: scenario.edge.target || '',
          type: scenario.edge.type || 'dependency',
          weight: scenario.edge.weight ?? 1.0,
        });
        break;
      }
      case 'modify_weight': {
        const edge = modifiedEdges.get(scenario.edgeId);
        if (edge) {
          modifiedEdges.set(scenario.edgeId, {
            ...edge,
            weight: scenario.newWeight,
          });
        }
        break;
      }
    }

    // Calculate scenario blast radius
    const scenarioResult = this.calculateBlastRadius(sourceNodeId, modifiedNodes, modifiedEdges, config);

    // Calculate comparison metrics
    const baselineNodeIds = new Set(baseline.affectedNodes.map((n) => n.nodeId));
    const scenarioNodeIds = new Set(scenarioResult.affectedNodes.map((n) => n.nodeId));

    const newlyAffected = [...scenarioNodeIds].filter((id) => !baselineNodeIds.has(id));
    const noLongerAffected = [...baselineNodeIds].filter((id) => !scenarioNodeIds.has(id));

    const changedImpact: Array<{ nodeId: string; before: number; after: number; delta: number }> = [];
    baseline.affectedNodes.forEach((baseNode) => {
      const scenarioNode = scenarioResult.affectedNodes.find((n) => n.nodeId === baseNode.nodeId);
      if (scenarioNode && Math.abs(scenarioNode.impact - baseNode.impact) > 0.01) {
        changedImpact.push({
          nodeId: baseNode.nodeId,
          before: baseNode.impact,
          after: scenarioNode.impact,
          delta: scenarioNode.impact - baseNode.impact,
        });
      }
    });

    return {
      baseline,
      scenario: scenarioResult,
      impactDelta: scenarioResult.totalImpact - baseline.totalImpact,
      affectedNodesDelta: scenarioResult.affectedNodes.length - baseline.affectedNodes.length,
      newlyAffected,
      noLongerAffected,
      changedImpact,
    };
  }

  /**
   * Convert to legacy BlastRadiusResult format for compatibility
   */
  static toLegacyResult(analysis: BlastRadiusAnalysis): BlastRadiusResult {
    return {
      impactedNodes: analysis.affectedNodes.map((n) => ({
        nodeId: n.nodeId,
        depth: n.depth,
        probability: n.impact,
        path: n.path,
      })),
      totalImpact: analysis.totalImpact,
      businessImpact: analysis.businessImpact,
    };
  }

  // ============================================================================
  // Export Functions (Story 30.8)
  // ============================================================================

  /**
   * Generate CSV export of blast radius results
   */
  static exportToCsv(
    analysis: BlastRadiusAnalysis,
    sourceNode: VoxelNode | null
  ): string {
    const headers = [
      'Node ID',
      'Label',
      'Type',
      'Status',
      'Depth',
      'Impact (%)',
      'Path',
    ];

    const rows = analysis.affectedNodes.map((node) => [
      node.nodeId,
      node.node.label || '',
      node.node.type,
      node.node.status,
      node.depth.toString(),
      (node.impact * 100).toFixed(1),
      node.path.join(' -> '),
    ]);

    // Add header row
    const csvContent = [
      `# Blast Radius Analysis Report`,
      `# Generated: ${new Date().toISOString()}`,
      `# Source Node: ${sourceNode?.label || analysis.sourceNodeId}`,
      `# Total Affected: ${analysis.affectedNodes.length}`,
      `# Total Impact: ${analysis.totalImpact.toFixed(2)}`,
      `# Max Depth: ${analysis.maxDepth}`,
      `# Business Impact: ${analysis.businessImpact.toUpperCase()}`,
      ``,
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Generate report data for PDF export
   */
  static generateReportData(
    analysis: BlastRadiusAnalysis,
    sourceNode: VoxelNode | null,
    whatIfComparison?: WhatIfComparison
  ): BlastRadiusReportData {
    const impactByLevel = {
      critical: analysis.affectedNodes.filter((n) => n.impact >= 0.75).length,
      high: analysis.affectedNodes.filter((n) => n.impact >= 0.5 && n.impact < 0.75).length,
      medium: analysis.affectedNodes.filter((n) => n.impact >= 0.25 && n.impact < 0.5).length,
      low: analysis.affectedNodes.filter((n) => n.impact < 0.25).length,
    };

    const nodesByType: Record<VoxelNodeType, Array<{ label: string; impact: number }>> = {
      asset: [],
      risk: [],
      control: [],
      incident: [],
      supplier: [],
      project: [],
      audit: [],
    };

    analysis.affectedNodes.forEach((node) => {
      nodesByType[node.node.type].push({
        label: node.node.label || node.nodeId,
        impact: node.impact,
      });
    });

    return {
      title: 'Rapport d\'Analyse Blast Radius',
      generatedAt: new Date().toISOString(),
      sourceNode: {
        id: analysis.sourceNodeId,
        label: sourceNode?.label || analysis.sourceNodeId,
        type: sourceNode?.type || 'unknown',
      },
      summary: {
        totalAffectedNodes: analysis.affectedNodes.length,
        totalImpact: analysis.totalImpact,
        maxDepth: analysis.maxDepth,
        businessImpact: analysis.businessImpact,
        executionTimeMs: analysis.executionTimeMs,
      },
      impactDistribution: impactByLevel,
      nodesByType,
      topAffectedNodes: analysis.affectedNodes.slice(0, 20).map((n) => ({
        id: n.nodeId,
        label: n.node.label || n.nodeId,
        type: n.node.type,
        status: n.node.status,
        depth: n.depth,
        impact: n.impact,
        pathLength: n.path.length,
      })),
      whatIfComparison: whatIfComparison
        ? {
            impactDelta: whatIfComparison.impactDelta,
            affectedNodesDelta: whatIfComparison.affectedNodesDelta,
            newlyAffectedCount: whatIfComparison.newlyAffected.length,
            protectedCount: whatIfComparison.noLongerAffected.length,
          }
        : undefined,
    };
  }

  /**
   * Generate root cause analysis report data
   */
  static generateRootCauseReportData(
    result: RootCauseResult,
    incidentNode: VoxelNode | null
  ): RootCauseReportData {
    return {
      title: 'Rapport d\'Analyse Cause Racine',
      generatedAt: new Date().toISOString(),
      incidentNode: {
        id: result.incidentNodeId,
        label: incidentNode?.label || result.incidentNodeId,
        type: incidentNode?.type || 'unknown',
      },
      summary: {
        totalPotentialCauses: result.potentialCauses.length,
        maxDepth: result.maxDepth,
        totalPaths: result.paths.length,
        executionTimeMs: result.executionTimeMs,
      },
      topCauses: result.potentialCauses.slice(0, 10).map((cause) => ({
        id: cause.nodeId,
        label: cause.node.label || cause.nodeId,
        type: cause.node.type,
        likelihood: cause.likelihood,
        depth: cause.depth,
        pathCount: cause.paths.length,
        contributingFactors: cause.contributingFactors,
      })),
    };
  }

  /**
   * Download CSV file
   */
  static downloadCsv(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Download JSON report
   */
  static downloadJsonReport(data: BlastRadiusReportData | RootCauseReportData, filename: string): void {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// Report Data Types
// ============================================================================

export interface BlastRadiusReportData {
  title: string;
  generatedAt: string;
  sourceNode: {
    id: string;
    label: string;
    type: string;
  };
  summary: {
    totalAffectedNodes: number;
    totalImpact: number;
    maxDepth: number;
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
    executionTimeMs: number;
  };
  impactDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  nodesByType: Record<VoxelNodeType, Array<{ label: string; impact: number }>>;
  topAffectedNodes: Array<{
    id: string;
    label: string;
    type: VoxelNodeType;
    status: string;
    depth: number;
    impact: number;
    pathLength: number;
  }>;
  whatIfComparison?: {
    impactDelta: number;
    affectedNodesDelta: number;
    newlyAffectedCount: number;
    protectedCount: number;
  };
}

export interface RootCauseReportData {
  title: string;
  generatedAt: string;
  incidentNode: {
    id: string;
    label: string;
    type: string;
  };
  summary: {
    totalPotentialCauses: number;
    maxDepth: number;
    totalPaths: number;
    executionTimeMs: number;
  };
  topCauses: Array<{
    id: string;
    label: string;
    type: VoxelNodeType;
    likelihood: number;
    depth: number;
    pathCount: number;
    contributingFactors: string[];
  }>;
}

export default BlastRadiusService;
