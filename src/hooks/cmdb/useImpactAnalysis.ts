/**
 * CMDB Impact Analysis Hook
 *
 * React Query hook for impact analysis operations.
 * Provides BFS-based dependency traversal and blast radius calculation.
 *
 * @module hooks/cmdb/useImpactAnalysis
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/store';
import { ErrorLogger } from '@/services/errorLogger';
import {
  ConfigurationItem,
  CMDBRelationship,
  ImpactAssessment,
  ImpactScenario,
  ImpactNode,
  ImpactLevel,
  AffectedService,
  BlastRadius,
  ImpactGraphNode,
  ImpactGraphEdge,
} from '@/types/cmdb';
import { CMDBService } from '@/services/CMDBService';
import { CMDBRelationshipService } from '@/services/CMDBRelationshipService';
import { Timestamp } from 'firebase/firestore';

// Query keys
export const impactKeys = {
  all: ['cmdb-impact'] as const,
  analysis: (orgId: string, ciId: string, scenario: ImpactScenario, depth: number) =>
    [...impactKeys.all, 'analysis', orgId, ciId, scenario, depth] as const,
  blastRadius: (orgId: string, ciId: string) =>
    [...impactKeys.all, 'blast-radius', orgId, ciId] as const,
};

/**
 * Calculate impact level based on CI criticality and hop distance
 */
function calculateImpactLevel(
  ci: ConfigurationItem,
  hop: number,
  relationship: CMDBRelationship | null,
  scenario: ImpactScenario
): ImpactLevel {
  // Base impact from CI criticality
  const criticalityWeight: Record<string, number> = {
    Critical: 100,
    High: 75,
    Medium: 50,
    Low: 25,
  };

  let score = criticalityWeight[ci.criticality] || 50;

  // Reduce by hop distance
  score = score * Math.pow(0.7, hop - 1);

  // Boost for critical relationships
  if (relationship?.criticality === 'Critical') {
    score *= 1.5;
  }

  // Adjust for scenario
  if (scenario === 'down') {
    score *= 1.2;
  } else if (scenario === 'maintenance') {
    score *= 0.8;
  }

  // Convert to impact level
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

/**
 * BFS traversal for impact analysis
 */
async function performImpactAnalysis(
  organizationId: string,
  sourceCI: ConfigurationItem,
  scenario: ImpactScenario,
  maxDepth: number
): Promise<ImpactAssessment> {
  const visited = new Set<string>();
  const directImpact: ImpactNode[] = [];
  const indirectImpact: ImpactNode[] = [];
  const affectedServices: AffectedService[] = [];
  const graphNodes: ImpactGraphNode[] = [];
  const graphEdges: ImpactGraphEdge[] = [];

  // Add source node to graph
  graphNodes.push({
    id: sourceCI.id,
    label: sourceCI.name,
    ciClass: sourceCI.ciClass,
    impactLevel: 'Critical',
    hop: 0,
  });

  // BFS queue: [ciId, hop, path, lastRelationship]
  const queue: [string, number, string[], CMDBRelationship | null][] = [
    [sourceCI.id, 0, [sourceCI.id], null],
  ];
  visited.add(sourceCI.id);

  while (queue.length > 0) {
    const [currentId, hop, path, _lastRelationship] = queue.shift()!;

    if (hop >= maxDepth) continue;

    // Get downstream dependents (CIs that depend on current)
    const dependents = await CMDBRelationshipService.getDownstreamDependents(
      organizationId,
      currentId
    );

    for (const rel of dependents) {
      const targetId = rel.sourceId === currentId ? rel.targetId : rel.sourceId;

      if (visited.has(targetId)) continue;
      visited.add(targetId);

      // Fetch target CI
      const targetCI = await CMDBService.getCI(organizationId, targetId);
      if (!targetCI) continue;

      const newPath = [...path, targetId];
      const impactLevel = calculateImpactLevel(targetCI, hop + 1, rel, scenario);

      const impactNode: ImpactNode = {
        ciId: targetId,
        ci: targetCI,
        hop: hop + 1,
        impactLevel,
        path: newPath,
        relationship: rel,
      };

      // Categorize as direct or indirect
      if (hop === 0) {
        directImpact.push(impactNode);
      } else {
        indirectImpact.push(impactNode);
      }

      // Add to graph
      graphNodes.push({
        id: targetCI.id,
        label: targetCI.name,
        ciClass: targetCI.ciClass,
        impactLevel,
        hop: hop + 1,
      });

      graphEdges.push({
        source: currentId,
        target: targetId,
        relationshipType: rel.relationshipType,
        criticality: rel.criticality,
      });

      // Check if it's a service
      if (targetCI.ciClass === 'Service') {
        affectedServices.push({
          service: targetCI,
          criticality: targetCI.criticality,
          estimatedUsers: (targetCI.attributes as { currentUsers?: number })?.currentUsers,
          hopDistance: hop + 1,
        });
      }

      // Add to queue for further traversal
      queue.push([targetId, hop + 1, newPath, rel]);
    }
  }

  // Calculate summary
  const allNodes = [...directImpact, ...indirectImpact];
  const summary = {
    totalAffectedCIs: allNodes.length,
    criticalCount: allNodes.filter((n) => n.impactLevel === 'Critical').length,
    highCount: allNodes.filter((n) => n.impactLevel === 'High').length,
    mediumCount: allNodes.filter((n) => n.impactLevel === 'Medium').length,
    lowCount: allNodes.filter((n) => n.impactLevel === 'Low').length,
    estimatedAffectedUsers: affectedServices.reduce(
      (sum, s) => sum + (s.estimatedUsers || 0),
      0
    ),
    estimatedDowntimeMinutes: scenario === 'down' ? estimateDowntime(allNodes) : undefined,
  };

  return {
    sourceCI,
    scenario,
    maxDepth,
    analyzedAt: Timestamp.now(),
    directImpact,
    indirectImpact,
    affectedServices,
    summary,
    visualization: {
      nodes: graphNodes,
      edges: graphEdges,
    },
  };
}

/**
 * Estimate downtime based on affected CIs
 */
function estimateDowntime(nodes: ImpactNode[]): number {
  let maxDowntime = 0;

  for (const node of nodes) {
    const attributes = node.ci.attributes as { rtoMinutes?: number };
    const rto = attributes?.rtoMinutes || 0;

    // Critical CIs add their full RTO
    if (node.impactLevel === 'Critical' || node.impactLevel === 'High') {
      maxDowntime = Math.max(maxDowntime, rto);
    }
  }

  return maxDowntime;
}

/**
 * Hook to perform impact analysis
 */
export function useImpactAnalysis(
  ciId: string,
  scenario: ImpactScenario = 'down',
  depth: number = 3
) {
  const { user } = useStore();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: impactKeys.analysis(organizationId, ciId, scenario, depth),
    queryFn: async () => {
      const sourceCI = await CMDBService.getCI(organizationId, ciId);
      if (!sourceCI) {
        throw new Error('CI not found');
      }
      return performImpactAnalysis(organizationId, sourceCI, scenario, depth);
    },
    enabled: !!organizationId && !!ciId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to calculate blast radius
 */
export function useBlastRadius(ciId: string) {
  const { user } = useStore();
  const organizationId = user?.organizationId || '';

  return useQuery({
    queryKey: impactKeys.blastRadius(organizationId, ciId),
    queryFn: async () => {
      const sourceCI = await CMDBService.getCI(organizationId, ciId);
      if (!sourceCI) {
        throw new Error('CI not found');
      }

      // Perform shallow analysis to get blast radius
      const assessment = await performImpactAnalysis(
        organizationId,
        sourceCI,
        'down',
        3
      );

      // Group by hop distance
      const ringMap = new Map<number, ConfigurationItem[]>();
      for (const node of [...assessment.directImpact, ...assessment.indirectImpact]) {
        const ring = ringMap.get(node.hop) || [];
        ring.push(node.ci);
        ringMap.set(node.hop, ring);
      }

      const rings = Array.from(ringMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([hop, cis]) => ({
          hop,
          cis,
          totalImpactScore: cis.reduce((sum, ci) => {
            const weight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
            return sum + (weight[ci.criticality] || 1);
          }, 0),
        }));

      const blastRadius: BlastRadius = {
        center: sourceCI,
        rings,
      };

      return blastRadius;
    },
    enabled: !!organizationId && !!ciId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to save impact analysis report
 */
export function useSaveImpactReport() {
  const { user, addToast } = useStore();
  const _queryClient = useQueryClient();
  const _organizationId = user?.organizationId || '';
  const _userId = user?.uid || '';

  return useMutation({
    mutationFn: async (assessment: ImpactAssessment) => {
      // In production, this would save to Firestore
      // For now, just log it
      console.log('Saving impact report:', assessment);
      return assessment;
    },
    onSuccess: () => {
      addToast('Rapport d\'impact enregistré', 'success');
    },
    onError: (error) => {
      ErrorLogger.handleErrorWithToast(error, 'cmdb.impact.saveError');
    },
  });
}

/**
 * Combined hook for impact analysis operations
 */
export function useCMDBImpact(ciId: string, scenario: ImpactScenario = 'down', depth: number = 3) {
  const analysisQuery = useImpactAnalysis(ciId, scenario, depth);
  const blastRadiusQuery = useBlastRadius(ciId);
  const saveReport = useSaveImpactReport();

  return {
    // Data
    assessment: analysisQuery.data,
    blastRadius: blastRadiusQuery.data,

    // Loading states
    isLoading: analysisQuery.isLoading,
    isBlastRadiusLoading: blastRadiusQuery.isLoading,

    // Errors
    error: analysisQuery.error,
    blastRadiusError: blastRadiusQuery.error,

    // Refetch
    refetch: analysisQuery.refetch,
    refetchBlastRadius: blastRadiusQuery.refetch,

    // Actions
    saveReport,
  };
}
