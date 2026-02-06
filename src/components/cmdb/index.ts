/**
 * CMDB Components Index
 *
 * Premium AAA-quality Configuration Management Database module.
 *
 * @module components/cmdb
 */

// Main components
export { CIInspector } from './CIInspector';
export { DiscoveryDashboard } from './DiscoveryDashboard';
export { ValidationQueue } from './ValidationQueue';

// Inspector sub-components
export {
  CIInspectorDetails,
  CIInspectorRelations,
  CIInspectorHistory,
  CIInspectorImpact,
} from './inspector';

// Premium Dashboard
export { CMDBPremiumDashboard } from './dashboard';

// Premium Visualizations
export {
  CMDBDependencyGraph,
  CIHealthGauge,
  ImpactBlastRadius,
  CMDBTopologyMap,
} from './visualizations';
