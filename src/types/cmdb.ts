/**
 * CMDB Module Types
 *
 * Configuration Management Database types for Sentinel GRC v2.
 * Implements ITIL 4 Service Configuration Management patterns.
 *
 * @module types/cmdb
 * @see ADR-009 for architecture decisions
 */

import { Timestamp } from 'firebase/firestore';

// =============================================================================
// ENUMS & LITERALS
// =============================================================================

/**
 * CI Classification - Top-level categorization of Configuration Items
 */
export type CIClass =
  | 'Hardware'    // Physical devices: servers, workstations, network equipment
  | 'Software'    // Applications, OS, middleware, databases
  | 'Service'     // Business services, IT services, infrastructure services
  | 'Document'    // Configuration files, policies, procedures
  | 'Network'     // Subnets, VLANs, DNS zones
  | 'Cloud'       // Cloud resources (AWS, Azure, GCP)
  | 'Container';  // Containers, pods, namespaces

/**
 * CI Lifecycle Status
 */
export type CIStatus =
  | 'In_Stock'        // Inventoried but not deployed
  | 'In_Use'          // Active in production
  | 'In_Maintenance'  // Under maintenance or repair
  | 'Retired'         // Decommissioned
  | 'Missing';        // Not discovered for extended period

/**
 * Environment classification
 */
export type CIEnvironment =
  | 'Production'
  | 'Staging'
  | 'Development'
  | 'Test'
  | 'DR';  // Disaster Recovery

/**
 * Criticality levels for CIs and relationships
 */
export type CICriticality = 'Critical' | 'High' | 'Medium' | 'Low';

/**
 * Source of CI discovery
 */
export type DiscoverySource =
  | 'Agent'         // Discovered by Sentinel Agent
  | 'Manual'        // Manually created
  | 'Import'        // Imported from CSV/API
  | 'Cloud'         // Synced from cloud provider
  | 'Network_Scan'; // Network discovery scan

/**
 * CMDB Relationship types - ITIL standard relationships
 */
export type RelationshipType =
  // Dependency relationships
  | 'depends_on'      // A depends on B (A cannot function without B)
  | 'uses'            // A uses B (A can function without B)
  // Hosting relationships
  | 'runs_on'         // A runs on B (Application runs on Server)
  | 'hosted_on'       // A is hosted on B (VM hosted on Hypervisor)
  | 'installed_on'    // A is installed on B (Software on Hardware)
  // Connectivity relationships
  | 'connects_to'     // A connects to B (network)
  | 'interfaces_with' // A interfaces with B (API)
  // Composition relationships
  | 'contains'        // A contains B (Server contains CPU)
  | 'member_of'       // A is member of B (Server member of Cluster)
  | 'instance_of'     // A is instance of B (VM instance of Template)
  // Business relationships
  | 'provides'        // A provides B (Service provides Capability)
  | 'consumes'        // A consumes B (Team consumes Service)
  | 'owned_by'        // A is owned by B
  | 'supported_by'    // A is supported by B (Team)
  // Inverse relationship types
  | 'hosts'           // Inverse of runs_on/hosted_on
  | 'has_installed'   // Inverse of installed_on
  | 'contained_in'    // Inverse of contains
  | 'has_member'      // Inverse of member_of
  | 'owns'            // Inverse of owned_by
  | 'supports';       // Inverse of supported_by

/**
 * Relationship direction
 */
export type RelationshipDirection = 'unidirectional' | 'bidirectional';

/**
 * Relationship status
 */
export type RelationshipStatus = 'Active' | 'Inactive' | 'Pending_Validation';

/**
 * How relationship was discovered
 */
export type RelationshipDiscoveryMethod = 'Agent' | 'Manual' | 'Inference';

/**
 * Impact levels for analysis
 */
export type ImpactLevel = 'Critical' | 'High' | 'Medium' | 'Low';

/**
 * Impact analysis scenarios
 */
export type ImpactScenario = 'down' | 'maintenance' | 'decommission';

// =============================================================================
// CORE INTERFACES
// =============================================================================

/**
 * CI Fingerprint - Unique identification attributes for reconciliation
 */
export interface CIFingerprint {
  /** Hardware serial number */
  serialNumber?: string;
  /** Primary network interface MAC address (normalized: lowercase, colons) */
  primaryMacAddress?: string;
  /** Hostname (lowercase, without domain) */
  hostname?: string;
  /** Fully qualified domain name */
  fqdn?: string;
  /** OS fingerprint: "type-version-arch" (e.g., "windows-10.0.19045-x64") */
  osFingerprint?: string;
  /** Cloud instance ID (AWS/Azure/GCP) */
  cloudInstanceId?: string;
}

/**
 * Configuration Item - Core CMDB entity
 */
export interface ConfigurationItem {
  /** Firestore document ID */
  id: string;
  /** Organization ID for multi-tenant isolation */
  organizationId: string;

  // Classification
  /** Top-level CI class */
  ciClass: CIClass;
  /** Specific type within class (e.g., "Server", "Database", "Web_Application") */
  ciType: string;

  // Identification
  /** Fingerprint for reconciliation matching */
  fingerprint: CIFingerprint;

  // Core attributes
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Lifecycle status */
  status: CIStatus;
  /** Deployment environment */
  environment: CIEnvironment;
  /** Business criticality */
  criticality: CICriticality;

  // Ownership
  /** Owner user ID */
  ownerId: string;
  /** Support team/group ID */
  supportGroupId?: string;

  // Quality & Discovery
  /** Data quality score (0-100) */
  dataQualityScore: number;
  /** How this CI was discovered/created */
  discoverySource: DiscoverySource;
  /** Source agent ID if discovered by agent */
  sourceAgentId?: string;
  /** Last time agent discovered this CI */
  lastDiscoveredAt?: Timestamp;
  /** Last reconciliation timestamp */
  lastReconciliationAt?: Timestamp;

  // Migration
  /** Link to legacy Asset ID for migration */
  legacyAssetId?: string;

  // Class-specific attributes (polymorphic)
  /** Additional attributes specific to CI class */
  attributes: Record<string, unknown>;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

/**
 * CMDB Relationship - Connection between two CIs
 */
export interface CMDBRelationship {
  /** Firestore document ID */
  id: string;
  /** Organization ID for multi-tenant isolation */
  organizationId: string;

  // Endpoints
  /** Source CI ID */
  sourceId: string;
  /** Source CI class (denormalized for queries) */
  sourceCIClass: CIClass;
  /** Target CI ID */
  targetId: string;
  /** Target CI class (denormalized for queries) */
  targetCIClass: CIClass;

  // Relationship definition
  /** Type of relationship */
  relationshipType: RelationshipType;
  /** Direction */
  direction: RelationshipDirection;
  /** Inverse relationship type for bidirectional */
  inverseType?: RelationshipType;

  // Metadata
  /** Criticality of this relationship */
  criticality: CICriticality;
  /** Current status */
  status: RelationshipStatus;

  // Discovery
  /** How this relationship was discovered */
  discoveredBy: RelationshipDiscoveryMethod;
  /** Confidence score for inferred relationships (0-100) */
  confidence: number;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  /** User who validated (for Pending_Validation) */
  validatedBy?: string;
  validatedAt?: Timestamp;
}

// =============================================================================
// CLASS-SPECIFIC ATTRIBUTES
// =============================================================================

/**
 * Hardware CI specific attributes
 */
export interface HardwareCIAttributes {
  hardwareType: 'Server' | 'Workstation' | 'Laptop' | 'Network_Device' | 'Storage' | 'IoT' | 'OT_Device';
  manufacturer?: string;
  model?: string;
  serialNumber?: string;

  // Specifications
  cpuModel?: string;
  cpuCores?: number;
  cpuFrequencyMhz?: number;
  ramGB?: number;
  ramType?: 'DDR4' | 'DDR5' | 'DDR3';
  storageGB?: number;
  storageType?: 'SSD' | 'HDD' | 'NVMe' | 'Hybrid';
  storageHealth?: 'Good' | 'Warning' | 'Critical';

  // Network
  primaryIpAddress?: string;
  primaryMacAddress?: string;
  hostname?: string;
  fqdn?: string;

  // Location
  location?: string;
  rackUnit?: string;
  datacenter?: string;

  // Lifecycle
  purchaseDate?: Timestamp;
  warrantyEndDate?: Timestamp;
  endOfSupportDate?: Timestamp;

  // BIOS/Firmware
  biosVendor?: string;
  biosVersion?: string;
  firmwareVersion?: string;
}

/**
 * Software CI specific attributes
 */
export interface SoftwareCIAttributes {
  softwareType: 'Application' | 'Operating_System' | 'Middleware' | 'Database' | 'Security_Tool';
  vendor?: string;
  product: string;
  version: string;
  edition?: string;

  // Identification
  /** Common Platform Enumeration */
  cpe?: string;
  /** Software Identification Tag */
  swid?: string;

  // Licensing
  licenseType?: 'Perpetual' | 'Subscription' | 'Open_Source' | 'Freeware';
  licenseId?: string;

  // Security
  endOfLifeDate?: Timestamp;
  knownVulnerabilities?: number;
  lastPatchDate?: Timestamp;
  lastCVECheck?: Timestamp;
}

/**
 * Service CI specific attributes
 */
export interface ServiceCIAttributes {
  serviceType: 'Business_Service' | 'IT_Service' | 'Infrastructure_Service';
  serviceLevel?: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';

  // SLA
  availabilityTarget?: number;
  rtoMinutes?: number;
  rpoMinutes?: number;

  // Contacts
  serviceOwnerId: string;
  supportTeamId?: string;
  escalationPath?: string[];

  // Endpoints
  primaryUrl?: string;
  healthCheckUrl?: string;
  documentationUrl?: string;

  // Capacity
  maxUsers?: number;
  currentUsers?: number;
}

/**
 * Network CI specific attributes
 */
export interface NetworkCIAttributes {
  networkType: 'Subnet' | 'VLAN' | 'VPN' | 'DNS_Zone' | 'Firewall_Rule';
  cidr?: string;
  vlanId?: number;
  gateway?: string;
  dnsServers?: string[];
}

/**
 * Cloud CI specific attributes
 */
export interface CloudCIAttributes {
  cloudProvider: 'AWS' | 'Azure' | 'GCP' | 'Other';
  resourceType: string;
  resourceId: string;
  region?: string;
  availabilityZone?: string;
  instanceType?: string;
  tags?: Record<string, string>;
}

// =============================================================================
// RECONCILIATION TYPES
// =============================================================================

/**
 * Match result from reconciliation engine
 */
export interface ReconciliationMatchResult {
  /** Matched CI ID (null if no match) */
  ciId: string | null;
  /** Confidence score (0-100) */
  confidence: number;
  /** Rule that produced the match */
  matchRule: string;
  /** All potential matches with scores */
  candidates?: {
    ciId: string;
    confidence: number;
    rule: string;
  }[];
}

/**
 * Reconciliation configuration per organization
 */
export interface ReconciliationConfig {
  /** Automatically create CI if no match found */
  autoCreateCI: boolean;
  /** Minimum confidence for auto-match (0-100) */
  autoMatchThreshold: number;
  /** Require manual validation for low confidence matches */
  requireValidation: boolean;
  /** Threshold below which validation is required */
  validationThreshold: number;
}

/**
 * Identification rule for matching
 */
export interface IdentificationRule {
  /** Priority (1 = highest) */
  priority: number;
  /** Rule name */
  name: string;
  /** CI class this rule applies to */
  ciClass: CIClass;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Match criteria */
  matchCriteria: MatchCriterion[];
}

/**
 * Single match criterion within a rule
 */
export interface MatchCriterion {
  /** Field path (e.g., "fingerprint.serialNumber") */
  field: string;
  /** Type of matching */
  matchType: 'exact' | 'fuzzy' | 'regex' | 'normalized';
  /** Weight for scoring (0-100) */
  weight: number;
  /** Whether this criterion is required */
  required: boolean;
}

/**
 * Item in validation queue
 */
export interface CMDBValidationItem {
  id: string;
  organizationId: string;
  /** Agent ID that discovered this */
  agentId: string;
  /** Raw agent data */
  agentData: Record<string, unknown>;
  /** Generated fingerprint */
  fingerprint: CIFingerprint;
  /** Match result from reconciliation */
  matchResult: ReconciliationMatchResult;
  /** Queue status */
  status: 'Pending' | 'Approved' | 'Rejected' | 'Merged' | 'Expired';
  /** Assigned reviewer */
  assignedTo?: string;
  /** When added to queue */
  createdAt: Timestamp;
  /** When processed */
  processedAt?: Timestamp;
  /** Who processed */
  processedBy?: string;
  /** Processing notes */
  notes?: string;
}

// =============================================================================
// IMPACT ANALYSIS TYPES
// =============================================================================

/**
 * Single node in impact analysis result
 */
export interface ImpactNode {
  /** CI ID */
  ciId: string;
  /** CI data (denormalized) */
  ci: ConfigurationItem;
  /** Hops from source CI */
  hop: number;
  /** Calculated impact level */
  impactLevel: ImpactLevel;
  /** Path of CI IDs from source */
  path: string[];
  /** Relationship that connects to previous node */
  relationship?: CMDBRelationship;
}

/**
 * Affected service in impact analysis
 */
export interface AffectedService {
  /** Service CI */
  service: ConfigurationItem;
  /** Service criticality */
  criticality: CICriticality;
  /** Estimated affected users */
  estimatedUsers?: number;
  /** Hop distance from source */
  hopDistance: number;
}

/**
 * Complete impact assessment result
 */
export interface ImpactAssessment {
  /** Source CI that was analyzed */
  sourceCI: ConfigurationItem;
  /** Analysis scenario */
  scenario: ImpactScenario;
  /** Max depth analyzed */
  maxDepth: number;
  /** When analysis was performed */
  analyzedAt: Timestamp;

  // Direct impact (1 hop)
  directImpact: ImpactNode[];

  // Indirect impact (2+ hops)
  indirectImpact: ImpactNode[];

  // Affected services
  affectedServices: AffectedService[];

  // Summary metrics
  summary: {
    totalAffectedCIs: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    estimatedAffectedUsers: number;
    estimatedDowntimeMinutes?: number;
  };

  // Visualization data
  visualization: {
    nodes: ImpactGraphNode[];
    edges: ImpactGraphEdge[];
  };
}

/**
 * Graph node for visualization
 */
export interface ImpactGraphNode {
  id: string;
  label: string;
  ciClass: CIClass;
  impactLevel: ImpactLevel;
  hop: number;
}

/**
 * Graph edge for visualization
 */
export interface ImpactGraphEdge {
  source: string;
  target: string;
  relationshipType: RelationshipType;
  criticality: CICriticality;
}

/**
 * Blast radius - concentric rings of impact
 */
export interface BlastRadius {
  /** Center CI */
  center: ConfigurationItem;
  /** Rings by hop distance */
  rings: {
    hop: number;
    cis: ConfigurationItem[];
    totalImpactScore: number;
  }[];
}

// =============================================================================
// FILTER & QUERY TYPES
// =============================================================================

/**
 * Filters for CI listing
 */
export interface CMDBFilters {
  ciClass?: CIClass | null;
  status?: CIStatus | null;
  environment?: CIEnvironment | null;
  criticality?: CICriticality | null;
  ownerId?: string | null;
  discoverySource?: DiscoverySource | null;
  search?: string;
  /** Filter CIs with DQS below threshold */
  lowQuality?: boolean;
  /** Filter CIs not discovered recently */
  stale?: boolean;
}

/**
 * Pagination options
 */
export interface CMDBPagination {
  limit: number;
  cursor?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'dataQualityScore';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedCIs {
  items: ConfigurationItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

// =============================================================================
// DISCOVERY STATISTICS
// =============================================================================

/**
 * Discovery statistics for dashboard
 */
export interface DiscoveryStats {
  /** Total CIs in CMDB */
  total: number;
  /** CIs pending validation */
  pending: number;
  /** CIs matched automatically */
  matched: number;
  /** CIs not discovered recently (>30 days) */
  missing: number;
  /** CIs created today */
  createdToday: number;
  /** CIs updated today */
  updatedToday: number;
  /** Average data quality score */
  avgDataQualityScore: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for Hardware CI
 */
export function isHardwareCI(ci: ConfigurationItem): ci is ConfigurationItem & { attributes: HardwareCIAttributes } {
  return ci.ciClass === 'Hardware';
}

/**
 * Type guard for Software CI
 */
export function isSoftwareCI(ci: ConfigurationItem): ci is ConfigurationItem & { attributes: SoftwareCIAttributes } {
  return ci.ciClass === 'Software';
}

/**
 * Type guard for Service CI
 */
export function isServiceCI(ci: ConfigurationItem): ci is ConfigurationItem & { attributes: ServiceCIAttributes } {
  return ci.ciClass === 'Service';
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default reconciliation configuration
 */
export const DEFAULT_RECONCILIATION_CONFIG: ReconciliationConfig = {
  autoCreateCI: false,
  autoMatchThreshold: 80,
  requireValidation: true,
  validationThreshold: 70,
};

/**
 * Default identification rules
 */
export const DEFAULT_IDENTIFICATION_RULES: IdentificationRule[] = [
  {
    priority: 1,
    name: 'Serial Number Match',
    ciClass: 'Hardware',
    enabled: true,
    matchCriteria: [
      { field: 'fingerprint.serialNumber', matchType: 'exact', weight: 100, required: true },
    ],
  },
  {
    priority: 2,
    name: 'MAC Address Match',
    ciClass: 'Hardware',
    enabled: true,
    matchCriteria: [
      { field: 'fingerprint.primaryMacAddress', matchType: 'exact', weight: 90, required: true },
    ],
  },
  {
    priority: 3,
    name: 'Hostname + OS Match',
    ciClass: 'Hardware',
    enabled: true,
    matchCriteria: [
      { field: 'fingerprint.hostname', matchType: 'normalized', weight: 50, required: true },
      { field: 'fingerprint.osFingerprint', matchType: 'exact', weight: 40, required: true },
    ],
  },
  {
    priority: 4,
    name: 'IP Address Fallback',
    ciClass: 'Hardware',
    enabled: true,
    matchCriteria: [
      { field: 'attributes.primaryIpAddress', matchType: 'exact', weight: 30, required: true },
    ],
  },
];

/**
 * Relationship type inverse mapping for bidirectional relationships
 */
export const RELATIONSHIP_INVERSES: Partial<Record<RelationshipType, RelationshipType>> = {
  'depends_on': 'provides',
  'provides': 'depends_on',
  'runs_on': 'hosts',
  'hosted_on': 'hosts',
  'installed_on': 'has_installed',
  'contains': 'contained_in',
  'member_of': 'has_member',
  'owned_by': 'owns',
  'supported_by': 'supports',
} as const;

/**
 * Valid relationship matrix - which CI classes can have which relationships
 */
export const VALID_RELATIONSHIPS: Record<CIClass, RelationshipType[]> = {
  Hardware: ['contains', 'connects_to', 'member_of', 'owned_by', 'supported_by'],
  Software: ['depends_on', 'uses', 'runs_on', 'installed_on', 'provides', 'owned_by'],
  Service: ['depends_on', 'uses', 'hosted_on', 'provides', 'consumes', 'owned_by', 'supported_by'],
  Document: ['owned_by', 'supported_by'],
  Network: ['contains', 'connects_to', 'member_of'],
  Cloud: ['contains', 'hosted_on', 'connects_to', 'owned_by'],
  Container: ['runs_on', 'contains', 'member_of', 'depends_on'],
};
