/**
 * CMDB Hooks Index
 *
 * @module hooks/cmdb
 */

// CI hooks
export {
  useCMDBCIs,
  useCMDBCIsInfinite,
  useCMDBCI,
  useCMDBSearch,
  useDiscoveryStats,
  useCMDBMutations,
  useCMDB,
  cmdbKeys,
} from './useCMDBCIs';

// Relationship hooks
export {
  useCMDBRelationships,
  useUpstreamDependencies,
  useDownstreamDependents,
  useRelationshipGraph,
  useCMDBRelationshipMutations,
  useCMDBRelationshipsForCI,
  relationshipKeys,
} from './useCMDBRelationships';

// Impact analysis hooks
export {
  useImpactAnalysis,
  useBlastRadius,
  useSaveImpactReport,
  useCMDBImpact,
  impactKeys,
} from './useImpactAnalysis';
