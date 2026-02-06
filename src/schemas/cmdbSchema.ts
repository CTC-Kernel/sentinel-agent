/**
 * CMDB Zod Validation Schemas
 *
 * Validation schemas for CMDB module data.
 * Used for form validation and API input validation.
 *
 * @module schemas/cmdbSchema
 */

import { z } from 'zod';

// =============================================================================
// ENUM SCHEMAS
// =============================================================================

export const ciClassSchema = z.enum([
  'Hardware',
  'Software',
  'Service',
  'Document',
  'Network',
  'Cloud',
  'Container',
]);

export const ciStatusSchema = z.enum([
  'In_Stock',
  'In_Use',
  'In_Maintenance',
  'Retired',
  'Missing',
]);

export const ciEnvironmentSchema = z.enum([
  'Production',
  'Staging',
  'Development',
  'Test',
  'DR',
]);

export const ciCriticalitySchema = z.enum(['Critical', 'High', 'Medium', 'Low']);

export const discoverySourceSchema = z.enum([
  'Agent',
  'Manual',
  'Import',
  'Cloud',
  'Network_Scan',
]);

export const relationshipTypeSchema = z.enum([
  'depends_on',
  'uses',
  'runs_on',
  'hosted_on',
  'installed_on',
  'connects_to',
  'interfaces_with',
  'contains',
  'member_of',
  'instance_of',
  'provides',
  'consumes',
  'owned_by',
  'supported_by',
  // Inverse relationship types
  'hosts',
  'has_installed',
  'contained_in',
  'has_member',
  'owns',
  'supports',
]);

export const relationshipDirectionSchema = z.enum(['unidirectional', 'bidirectional']);

export const relationshipStatusSchema = z.enum(['Active', 'Inactive', 'Pending_Validation']);

export const relationshipDiscoveryMethodSchema = z.enum(['Agent', 'Manual', 'Inference']);

export const impactLevelSchema = z.enum(['Critical', 'High', 'Medium', 'Low']);

export const impactScenarioSchema = z.enum(['down', 'maintenance', 'decommission']);

// =============================================================================
// FINGERPRINT SCHEMA
// =============================================================================

export const ciFingerprintSchema = z.object({
  serialNumber: z.string().optional(),
  primaryMacAddress: z
    .string()
    .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i, 'Invalid MAC address format')
    .transform((val) => val.toLowerCase())
    .optional(),
  hostname: z
    .string()
    .transform((val) => val.toLowerCase().split('.')[0])
    .optional(),
  fqdn: z.string().toLowerCase().optional(),
  osFingerprint: z.string().optional(),
  cloudInstanceId: z.string().optional(),
});

// =============================================================================
// CONFIGURATION ITEM SCHEMAS
// =============================================================================

/**
 * Schema for creating a new CI
 */
export const createCISchema = z.object({
  ciClass: ciClassSchema,
  ciType: z.string().min(1, 'CI type is required').max(100),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  status: ciStatusSchema.default('In_Use'),
  environment: ciEnvironmentSchema.default('Production'),
  criticality: ciCriticalitySchema.default('Medium'),
  ownerId: z.string().min(1, 'Owner is required'),
  supportGroupId: z.string().optional(),
  fingerprint: ciFingerprintSchema.default({}),
  discoverySource: discoverySourceSchema.default('Manual'),
  sourceAgentId: z.string().optional(),
  legacyAssetId: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Schema for updating a CI
 */
export const updateCISchema = createCISchema.partial().extend({
  // These fields cannot be changed after creation
  ciClass: z.never().optional(),
  organizationId: z.never().optional(),
});

/**
 * Full CI schema (includes system-generated fields)
 */
export const configurationItemSchema = createCISchema.extend({
  id: z.string(),
  organizationId: z.string(),
  dataQualityScore: z.number().min(0).max(100),
  lastDiscoveredAt: z.any().optional(), // Firestore Timestamp
  lastReconciliationAt: z.any().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

// =============================================================================
// CLASS-SPECIFIC ATTRIBUTE SCHEMAS
// =============================================================================

export const hardwareCIAttributesSchema = z.object({
  hardwareType: z.enum([
    'Server',
    'Workstation',
    'Laptop',
    'Network_Device',
    'Storage',
    'IoT',
    'OT_Device',
  ]),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  cpuModel: z.string().optional(),
  cpuCores: z.number().int().positive().optional(),
  cpuFrequencyMhz: z.number().int().positive().optional(),
  ramGB: z.number().positive().optional(),
  ramType: z.enum(['DDR4', 'DDR5', 'DDR3']).optional(),
  storageGB: z.number().positive().optional(),
  storageType: z.enum(['SSD', 'HDD', 'NVMe', 'Hybrid']).optional(),
  storageHealth: z.enum(['Good', 'Warning', 'Critical']).optional(),
  primaryIpAddress: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address').optional(),
  primaryMacAddress: z
    .string()
    .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i)
    .optional(),
  hostname: z.string().optional(),
  fqdn: z.string().optional(),
  location: z.string().optional(),
  rackUnit: z.string().optional(),
  datacenter: z.string().optional(),
  purchaseDate: z.any().optional(),
  warrantyEndDate: z.any().optional(),
  endOfSupportDate: z.any().optional(),
  biosVendor: z.string().optional(),
  biosVersion: z.string().optional(),
  firmwareVersion: z.string().optional(),
});

export const softwareCIAttributesSchema = z.object({
  softwareType: z.enum([
    'Application',
    'Operating_System',
    'Middleware',
    'Database',
    'Security_Tool',
  ]),
  vendor: z.string().optional(),
  product: z.string().min(1, 'Product name is required'),
  version: z.string().min(1, 'Version is required'),
  edition: z.string().optional(),
  cpe: z.string().optional(),
  swid: z.string().optional(),
  licenseType: z.enum(['Perpetual', 'Subscription', 'Open_Source', 'Freeware']).optional(),
  licenseId: z.string().optional(),
  endOfLifeDate: z.any().optional(),
  knownVulnerabilities: z.number().int().min(0).optional(),
  lastPatchDate: z.any().optional(),
  lastCVECheck: z.any().optional(),
});

export const serviceCIAttributesSchema = z.object({
  serviceType: z.enum(['Business_Service', 'IT_Service', 'Infrastructure_Service']),
  serviceLevel: z.enum(['Platinum', 'Gold', 'Silver', 'Bronze']).optional(),
  availabilityTarget: z.number().min(0).max(100).optional(),
  rtoMinutes: z.number().int().min(0).optional(),
  rpoMinutes: z.number().int().min(0).optional(),
  serviceOwnerId: z.string().min(1, 'Service owner is required'),
  supportTeamId: z.string().optional(),
  escalationPath: z.array(z.string()).optional(),
  primaryUrl: z.string().url().optional(),
  healthCheckUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  maxUsers: z.number().int().positive().optional(),
  currentUsers: z.number().int().min(0).optional(),
});

// =============================================================================
// RELATIONSHIP SCHEMAS
// =============================================================================

/**
 * Base schema for relationship (without refinement, for extension)
 */
const relationshipBaseSchema = z.object({
  sourceId: z.string().min(1, 'Source CI is required'),
  sourceCIClass: ciClassSchema,
  targetId: z.string().min(1, 'Target CI is required'),
  targetCIClass: ciClassSchema,
  relationshipType: relationshipTypeSchema,
  direction: relationshipDirectionSchema.default('unidirectional'),
  inverseType: relationshipTypeSchema.optional(),
  criticality: ciCriticalitySchema.default('Medium'),
  status: relationshipStatusSchema.default('Active'),
  discoveredBy: relationshipDiscoveryMethodSchema.default('Manual'),
  confidence: z.number().min(0).max(100).default(100),
});

/**
 * Refinement for relationship validation
 */
const relationshipRefinement = (data: { sourceId: string; targetId: string }) =>
  data.sourceId !== data.targetId;

const relationshipRefinementMessage = {
  message: 'Source and target CI cannot be the same',
  path: ['targetId'],
};

/**
 * Schema for creating a relationship
 */
export const createRelationshipSchema = relationshipBaseSchema.refine(
  relationshipRefinement,
  relationshipRefinementMessage
);

/**
 * Schema for updating a relationship
 */
export const updateRelationshipSchema = z.object({
  criticality: ciCriticalitySchema.optional(),
  status: relationshipStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Full relationship schema (extends base, then applies refinement)
 */
export const cmdbRelationshipSchema = relationshipBaseSchema
  .extend({
    id: z.string(),
    organizationId: z.string(),
    createdAt: z.any(),
    updatedAt: z.any(),
    createdBy: z.string(),
    validatedBy: z.string().optional(),
    validatedAt: z.any().optional(),
  })
  .refine(relationshipRefinement, relationshipRefinementMessage);

// =============================================================================
// RECONCILIATION SCHEMAS
// =============================================================================

export const reconciliationConfigSchema = z.object({
  autoCreateCI: z.boolean().default(false),
  autoMatchThreshold: z.number().min(0).max(100).default(80),
  requireValidation: z.boolean().default(true),
  validationThreshold: z.number().min(0).max(100).default(70),
});

export const matchCriterionSchema = z.object({
  field: z.string().min(1),
  matchType: z.enum(['exact', 'fuzzy', 'regex', 'normalized']),
  weight: z.number().min(0).max(100),
  required: z.boolean(),
});

export const identificationRuleSchema = z.object({
  priority: z.number().int().min(1),
  name: z.string().min(1).max(100),
  ciClass: ciClassSchema,
  enabled: z.boolean().default(true),
  matchCriteria: z.array(matchCriterionSchema).min(1),
});

export const validationQueueActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'merge']),
  mergeTargetId: z.string().optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => data.action !== 'merge' || data.mergeTargetId,
  { message: 'Merge target CI is required for merge action', path: ['mergeTargetId'] }
);

// =============================================================================
// IMPACT ANALYSIS SCHEMAS
// =============================================================================

export const impactAnalysisRequestSchema = z.object({
  ciId: z.string().min(1, 'CI ID is required'),
  scenario: impactScenarioSchema.default('down'),
  depth: z.number().int().min(1).max(5).default(3),
});

// =============================================================================
// FILTER SCHEMAS
// =============================================================================

export const cmdbFiltersSchema = z.object({
  ciClass: ciClassSchema.nullable().optional(),
  status: ciStatusSchema.nullable().optional(),
  environment: ciEnvironmentSchema.nullable().optional(),
  criticality: ciCriticalitySchema.nullable().optional(),
  ownerId: z.string().nullable().optional(),
  discoverySource: discoverySourceSchema.nullable().optional(),
  search: z.string().optional(),
  lowQuality: z.boolean().optional(),
  stale: z.boolean().optional(),
});

export const cmdbPaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'dataQualityScore']).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

// =============================================================================
// FORM DATA TYPES (inferred from schemas)
// =============================================================================

export type CreateCIFormData = z.infer<typeof createCISchema>;
export type UpdateCIFormData = z.infer<typeof updateCISchema>;
export type CreateRelationshipFormData = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationshipFormData = z.infer<typeof updateRelationshipSchema>;
export type ReconciliationConfigFormData = z.infer<typeof reconciliationConfigSchema>;
export type IdentificationRuleFormData = z.infer<typeof identificationRuleSchema>;
export type ValidationQueueActionFormData = z.infer<typeof validationQueueActionSchema>;
export type ImpactAnalysisRequestFormData = z.infer<typeof impactAnalysisRequestSchema>;
export type CMDBFiltersFormData = z.infer<typeof cmdbFiltersSchema>;
