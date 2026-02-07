/**
 * CMDB Query Keys
 * 
 * React Query key factories for CMDB-related queries.
 * Extracted from hook files to satisfy the convention that
 * only hooks (use*) are exported from /hooks/ directory.
 * 
 * @module constants/cmdbQueryKeys
 */

import type { CMDBFilters } from '@/types/cmdb';
import type { ImpactScenario } from '@/types/cmdb';

// ============================================================================
// CI Query Keys (from useCMDBCIs)
// ============================================================================

export const cmdbKeys = {
 all: ['cmdb'] as const,
 cis: () => [...cmdbKeys.all, 'cis'] as const,
 ciList: (orgId: string, filters: CMDBFilters) =>
 [...cmdbKeys.cis(), 'list', orgId, filters] as const,
 ciDetail: (orgId: string, ciId: string) =>
 [...cmdbKeys.cis(), 'detail', orgId, ciId] as const,
 ciSearch: (orgId: string, query: string) =>
 [...cmdbKeys.cis(), 'search', orgId, query] as const,
 stats: (orgId: string) => [...cmdbKeys.all, 'stats', orgId] as const,
 relationships: (orgId: string, ciId: string) =>
 [...cmdbKeys.all, 'relationships', orgId, ciId] as const,
 activity: (orgId: string) => [...cmdbKeys.all, 'activity', orgId] as const,
 dailyStats: (orgId: string) => [...cmdbKeys.all, 'dailyStats', orgId] as const,
};

// ============================================================================
// Relationship Query Keys (from useCMDBRelationships)
// ============================================================================

export const relationshipKeys = {
 all: ['cmdb-relationships'] as const,
 forCI: (orgId: string, ciId: string) =>
 [...relationshipKeys.all, 'ci', orgId, ciId] as const,
 detail: (orgId: string, relId: string) =>
 [...relationshipKeys.all, 'detail', orgId, relId] as const,
 graph: (orgId: string, ciId: string, depth: number) =>
 [...relationshipKeys.all, 'graph', orgId, ciId, depth] as const,
};

// ============================================================================
// Validation Query Keys (from useCMDBValidation)
// ============================================================================

export const validationKeys = {
 all: ['cmdb', 'validation'] as const,
 pending: (orgId: string) => [...validationKeys.all, 'pending', orgId] as const,
 count: (orgId: string) => [...validationKeys.all, 'count', orgId] as const,
 item: (orgId: string, itemId: string) => [...validationKeys.all, 'item', orgId, itemId] as const,
};

// ============================================================================
// Impact Analysis Query Keys (from useImpactAnalysis)
// ============================================================================

export const impactKeys = {
 all: ['cmdb-impact'] as const,
 analysis: (orgId: string, ciId: string, scenario: ImpactScenario, depth: number) =>
 [...impactKeys.all, 'analysis', orgId, ciId, scenario, depth] as const,
 blastRadius: (orgId: string, ciId: string) =>
 [...impactKeys.all, 'blast-radius', orgId, ciId] as const,
};

// ============================================================================
// Framework Query Keys (from useFrameworks)
// ============================================================================

export const frameworkQueryKeys = {
 all: ['frameworks'] as const,
 list: () => [...frameworkQueryKeys.all, 'list'] as const,
 detail: (id: string) => [...frameworkQueryKeys.all, 'detail', id] as const,
 requirements: (frameworkId: string) => [...frameworkQueryKeys.all, 'requirements', frameworkId] as const,
 requirementsByCategory: (frameworkId: string, locale: string) =>
 [...frameworkQueryKeys.all, 'requirements', frameworkId, 'byCategory', locale] as const,
 mappings: (organizationId: string, controlId: string) =>
 [...frameworkQueryKeys.all, 'mappings', organizationId, controlId] as const,
 mappingsByFramework: (organizationId: string, frameworkId: string) =>
 [...frameworkQueryKeys.all, 'mappings', organizationId, 'framework', frameworkId] as const,
 activeFrameworks: (organizationId: string) =>
 [...frameworkQueryKeys.all, 'active', organizationId] as const,
 controlWithMappings: (organizationId: string, controlId: string) =>
 [...frameworkQueryKeys.all, 'controlMappings', organizationId, controlId] as const,
};
