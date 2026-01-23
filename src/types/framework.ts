/**
 * Multi-Framework Engine Types
 *
 * These types support the European Leader Strategy for managing multiple
 * regulatory frameworks (NIS2, DORA, RGPD, AI Act) with cross-framework mapping.
 *
 * @see ADR-001 in architecture-european-leader-2026-01-22.md
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// Framework Code Enum
// ============================================================================

/**
 * Supported regulatory framework codes
 * Extends the existing FRAMEWORKS constant with EU-specific frameworks
 */
export const REGULATORY_FRAMEWORK_CODES = [
  'NIS2',
  'DORA',
  'RGPD',
  'AI_ACT',
  'ISO27001',
  'ISO22301',
  'SOC2',
  'PCI_DSS',
  'NIST_CSF',
  'HDS',
  'SECNUMCLOUD',
] as const;

export type RegulatoryFrameworkCode = (typeof REGULATORY_FRAMEWORK_CODES)[number];

// ============================================================================
// Jurisdiction & Categories
// ============================================================================

/**
 * Jurisdiction where the framework applies
 */
export const JURISDICTIONS = ['EU', 'FR', 'DE', 'US', 'GLOBAL'] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

/**
 * Requirement categories for organizing regulatory requirements
 */
export const REQUIREMENT_CATEGORIES = [
  'governance',
  'risk_management',
  'incident_management',
  'business_continuity',
  'supply_chain',
  'technical_measures',
  'awareness_training',
  'reporting',
  'audit',
  'data_protection',
  'access_control',
  'cryptography',
  'physical_security',
  'operations_security',
  'communications_security',
  'system_acquisition',
  'supplier_relationships',
  'compliance',
] as const;

export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

/**
 * Criticality levels for requirements (used in weighted scoring)
 */
export const CRITICALITY_LEVELS = ['high', 'medium', 'low'] as const;
export type CriticalityLevel = (typeof CRITICALITY_LEVELS)[number];

/**
 * Criticality weights for score calculation
 * high = 3x, medium = 2x, low = 1x
 */
export const CRITICALITY_WEIGHTS: Record<CriticalityLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// ============================================================================
// Framework Entity
// ============================================================================

/**
 * Regulatory Framework definition
 * Stored in Firestore: `frameworks/{frameworkId}`
 */
export interface RegulatoryFramework {
  /** Firestore document ID */
  id: string;

  /** Framework code (e.g., 'NIS2', 'DORA') */
  code: RegulatoryFrameworkCode;

  /** Full framework name */
  name: string;

  /** Localized names */
  localizedNames?: {
    en: string;
    fr: string;
    de?: string;
  };

  /** Framework version (e.g., '2022/2555' for NIS2) */
  version: string;

  /** Jurisdiction where framework applies */
  jurisdiction: Jurisdiction;

  /** Date when framework becomes effective */
  effectiveDate: Timestamp | string;

  /** Brief description of the framework */
  description?: string;

  /** Localized descriptions */
  localizedDescriptions?: {
    en: string;
    fr: string;
    de?: string;
  };

  /** Official source URL */
  sourceUrl?: string;

  /** Whether this framework is active for selection */
  isActive: boolean;

  /** Display order in UI */
  displayOrder?: number;

  /** Number of requirements in this framework */
  requirementCount?: number;

  /** Last updated timestamp */
  updatedAt?: Timestamp | string;

  /** Created timestamp */
  createdAt?: Timestamp | string;
}

// ============================================================================
// Requirement Entity
// ============================================================================

/**
 * Regulatory Requirement (article/clause)
 * Stored in Firestore: `frameworks/{frameworkId}/requirements/{requirementId}`
 * Or as top-level collection: `requirements/{requirementId}`
 */
export interface Requirement {
  /** Firestore document ID */
  id: string;

  /** Parent framework ID */
  frameworkId: string;

  /** Article/clause reference (e.g., 'Article 21' for NIS2) */
  articleRef: string;

  /** Short title */
  title: string;

  /** Localized titles */
  localizedTitles?: {
    en: string;
    fr: string;
    de?: string;
  };

  /** Full requirement description */
  description: string;

  /** Localized descriptions */
  localizedDescriptions?: {
    en: string;
    fr: string;
    de?: string;
  };

  /** Category for grouping */
  category: RequirementCategory;

  /** Criticality level (affects score weighting) */
  criticality: CriticalityLevel;

  /** Parent requirement ID (for nested requirements) */
  parentId?: string;

  /** Requirement order within parent or framework */
  order?: number;

  /** Keywords for search and AI matching */
  keywords?: string[];

  /** Whether this is a mandatory requirement */
  isMandatory?: boolean;

  /** Suggested control templates for this requirement */
  suggestedControlTemplates?: string[];

  /** Last updated timestamp */
  updatedAt?: Timestamp | string;

  /** Created timestamp */
  createdAt?: Timestamp | string;
}

// ============================================================================
// Control Mapping Entity
// ============================================================================

/**
 * Coverage status for a control-requirement mapping
 */
export const COVERAGE_STATUSES = ['full', 'partial', 'none', 'not_assessed'] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

/**
 * Control to Requirement Mapping (n:n relationship)
 * Stored in Firestore: `controlMappings/{mappingId}`
 *
 * This enables cross-framework compliance where one control
 * can satisfy requirements from multiple frameworks.
 */
export interface ControlMapping {
  /** Firestore document ID */
  id: string;

  /** Organization ID (for multi-tenant isolation) */
  organizationId: string;

  /** Control ID being mapped */
  controlId: string;

  /** Requirement ID being satisfied */
  requirementId: string;

  /** Framework ID (denormalized for query efficiency) */
  frameworkId: string;

  /** How much of the requirement this control covers (0-100) */
  coveragePercentage: number;

  /** Coverage status */
  coverageStatus: CoverageStatus;

  /** Notes explaining the mapping */
  notes?: string;

  /** Who created/approved this mapping */
  createdBy?: string;

  /** Whether this mapping was auto-suggested by AI */
  isAutoSuggested?: boolean;

  /** Confidence score for auto-suggested mappings (0-1) */
  suggestionConfidence?: number;

  /** Whether user has validated the mapping */
  isValidated?: boolean;

  /** Last updated timestamp */
  updatedAt?: Timestamp | string;

  /** Created timestamp */
  createdAt?: Timestamp | string;
}

// ============================================================================
// Active Framework Configuration
// ============================================================================

/**
 * Organization's active framework configuration
 * Stored in Firestore: `organizations/{orgId}/activeFrameworks/{frameworkId}`
 */
export interface ActiveFramework {
  /** Framework ID */
  frameworkId: string;

  /** Framework code (denormalized) */
  frameworkCode: RegulatoryFrameworkCode;

  /** When this framework was activated */
  activatedAt: Timestamp | string;

  /** Who activated it */
  activatedBy: string;

  /** Target compliance date */
  targetComplianceDate?: Timestamp | string;

  /** Notes about activation */
  notes?: string;
}

// ============================================================================
// View Models & DTOs
// ============================================================================

/**
 * Framework with requirement count for listing
 */
export interface FrameworkListItem {
  id: string;
  code: RegulatoryFrameworkCode;
  name: string;
  description?: string;
  jurisdiction: Jurisdiction;
  effectiveDate: string;
  requirementCount: number;
  isActive: boolean;
}

/**
 * Requirement grouped by category for display
 */
export interface RequirementsByCategory {
  category: RequirementCategory;
  categoryLabel: string;
  requirements: Requirement[];
  count: number;
}

/**
 * Cross-framework mapping matrix cell
 */
export interface MappingMatrixCell {
  controlId: string;
  frameworkId: string;
  coverageStatus: CoverageStatus;
  coveragePercentage: number;
  requirementIds: string[];
}

/**
 * Control with all its framework mappings
 */
export interface ControlWithMappings {
  controlId: string;
  controlCode: string;
  controlName: string;
  mappings: {
    frameworkId: string;
    frameworkCode: RegulatoryFrameworkCode;
    coveragePercentage: number;
    requirementCount: number;
  }[];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid regulatory framework code
 */
export function isRegulatoryFrameworkCode(
  value: unknown
): value is RegulatoryFrameworkCode {
  return (
    typeof value === 'string' &&
    REGULATORY_FRAMEWORK_CODES.includes(value as RegulatoryFrameworkCode)
  );
}

/**
 * Check if a string is a valid requirement category
 */
export function isRequirementCategory(
  value: unknown
): value is RequirementCategory {
  return (
    typeof value === 'string' &&
    REQUIREMENT_CATEGORIES.includes(value as RequirementCategory)
  );
}

/**
 * Check if a string is a valid criticality level
 */
export function isCriticalityLevel(value: unknown): value is CriticalityLevel {
  return (
    typeof value === 'string' &&
    CRITICALITY_LEVELS.includes(value as CriticalityLevel)
  );
}

// ============================================================================
// Localization Helpers
// ============================================================================

/**
 * Get localized category label
 */
export const CATEGORY_LABELS: Record<RequirementCategory, { en: string; fr: string; de: string }> = {
  governance: { en: 'Governance', fr: 'Gouvernance', de: 'Governance' },
  risk_management: { en: 'Risk Management', fr: 'Gestion des risques', de: 'Risikomanagement' },
  incident_management: { en: 'Incident Management', fr: 'Gestion des incidents', de: 'Vorfallmanagement' },
  business_continuity: { en: 'Business Continuity', fr: 'Continuité d\'activité', de: 'Geschäftskontinuität' },
  supply_chain: { en: 'Supply Chain', fr: 'Chaîne d\'approvisionnement', de: 'Lieferkette' },
  technical_measures: { en: 'Technical Measures', fr: 'Mesures techniques', de: 'Technische Maßnahmen' },
  awareness_training: { en: 'Awareness & Training', fr: 'Sensibilisation et formation', de: 'Bewusstsein & Schulung' },
  reporting: { en: 'Reporting', fr: 'Reporting', de: 'Berichterstattung' },
  audit: { en: 'Audit', fr: 'Audit', de: 'Audit' },
  data_protection: { en: 'Data Protection', fr: 'Protection des données', de: 'Datenschutz' },
  access_control: { en: 'Access Control', fr: 'Contrôle d\'accès', de: 'Zugriffskontrolle' },
  cryptography: { en: 'Cryptography', fr: 'Cryptographie', de: 'Kryptographie' },
  physical_security: { en: 'Physical Security', fr: 'Sécurité physique', de: 'Physische Sicherheit' },
  operations_security: { en: 'Operations Security', fr: 'Sécurité des opérations', de: 'Betriebssicherheit' },
  communications_security: { en: 'Communications Security', fr: 'Sécurité des communications', de: 'Kommunikationssicherheit' },
  system_acquisition: { en: 'System Acquisition', fr: 'Acquisition de systèmes', de: 'Systembeschaffung' },
  supplier_relationships: { en: 'Supplier Relationships', fr: 'Relations fournisseurs', de: 'Lieferantenbeziehungen' },
  compliance: { en: 'Compliance', fr: 'Conformité', de: 'Compliance' },
};
