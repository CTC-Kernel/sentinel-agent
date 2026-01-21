/**
 * ANSSI Homologation Types
 * Implements ADR-011: ANSSI Homologation Templates for Public Sector
 *
 * French public sector entities must homologate their information systems
 * according to ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information)
 * guidelines under the RGS (Référentiel Général de Sécurité).
 */

// ============================================================================
// Homologation Level Types
// ============================================================================

/**
 * ANSSI-defined homologation levels
 * From simplest (étoile) to most comprehensive (renforcé)
 */
export const HOMOLOGATION_LEVELS = ['etoile', 'simple', 'standard', 'renforce'] as const;
export type HomologationLevel = (typeof HOMOLOGATION_LEVELS)[number];

/**
 * Homologation dossier status
 */
export const HOMOLOGATION_STATUSES = [
  'draft',
  'in_progress',
  'pending_decision',
  'homologated',
  'expired',
  'revoked'
] as const;
export type HomologationStatus = (typeof HOMOLOGATION_STATUSES)[number];

/**
 * Document types required for homologation
 */
export const HOMOLOGATION_DOCUMENT_TYPES = [
  'strategie',           // Stratégie d'homologation (all levels)
  'analyse_risques',     // Analyse de risques (Simple+)
  'plan_action',         // Plan d'action (Standard+)
  'decision',            // Décision d'homologation (Standard+)
  'attestation',         // Attestation (Standard+)
  'test_intrusion',      // Tests d'intrusion (Renforcé)
  'audit_technique'      // Audit technique (Renforcé)
] as const;
export type HomologationDocumentType = (typeof HOMOLOGATION_DOCUMENT_TYPES)[number];

/**
 * Document status
 */
export const DOCUMENT_STATUSES = ['not_started', 'in_progress', 'completed', 'validated'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// ============================================================================
// Level Determination Types
// ============================================================================

/**
 * Question categories for level determination
 */
export const QUESTION_CATEGORIES = [
  'classification',
  'data',
  'users',
  'interconnection',
  'incidents',
  'regulatory'
] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

/**
 * Answer types for determination questions
 */
export type AnswerType = 'single' | 'multiple' | 'scale';

/**
 * Option for a determination question
 */
export interface QuestionOption {
  value: string;
  label: string;
  labelEn?: string;
  score: number; // Points toward higher level (0-100 scale contribution)
  escalatesTo?: HomologationLevel; // Forces minimum level if selected
}

/**
 * Level determination question
 */
export interface LevelDeterminationQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  questionEn?: string;
  helpText?: string;
  helpTextEn?: string;
  answerType: AnswerType;
  options: QuestionOption[];
  weight: number; // Importance multiplier (1-3)
  required: boolean;
}

/**
 * User's answer to a determination question
 */
export interface LevelDeterminationAnswer {
  questionId: string;
  value: string | string[];
  score: number;
  escalatesTo?: HomologationLevel;
}

/**
 * Level recommendation result
 */
export interface LevelRecommendation {
  recommendedLevel: HomologationLevel;
  score: number; // 0-100
  justification: string;
  keyFactors: string[];
  escalationReason?: string;
  requiredDocuments: HomologationDocumentType[];
}

// ============================================================================
// EBIOS Link Types (Story 38-4)
// ============================================================================

/**
 * Snapshot of EBIOS analysis data at link time
 * Used for change detection and audit trail
 */
export interface EbiosLinkSnapshot {
  analysisId: string;
  analysisName: string;
  snapshotAt: string;
  workshopStatuses: Record<1 | 2 | 3 | 4 | 5, 'not_started' | 'in_progress' | 'completed' | 'validated'>;
  completionPercentage: number;
  fearedEventsCount: number;
  riskSourcesCount: number;
  strategicScenariosCount: number;
  operationalScenariosCount: number;
  treatmentItemsCount: number;
  dataHash: string; // For quick change detection
}

/**
 * History entry for EBIOS link changes
 */
export interface EbiosLinkHistoryEntry {
  action: 'linked' | 'unlinked' | 'synced';
  analysisId: string;
  analysisName: string;
  timestamp: string;
  userId: string;
  snapshot?: EbiosLinkSnapshot;
  note?: string;
}

// ============================================================================
// Homologation Dossier Types
// ============================================================================

/**
 * Reference to a homologation document
 */
export interface HomologationDocumentRef {
  type: HomologationDocumentType;
  status: DocumentStatus;
  documentId?: string; // Reference to documents collection
  generatedAt?: string;
  validatedAt?: string;
  validatedBy?: string;
}

/**
 * Main Homologation Dossier entity
 */
export interface HomologationDossier {
  id: string;
  organizationId: string;

  // Basic info
  name: string;
  description?: string;
  systemScope: string; // What system/scope is being homologated

  // Level determination
  level: HomologationLevel;
  levelJustification: string;
  levelOverridden: boolean;
  originalRecommendation?: HomologationLevel;
  determinationAnswers: LevelDeterminationAnswer[];
  recommendationScore: number; // 0-100

  // Status
  status: HomologationStatus;

  // Validity period
  validityStartDate?: string; // ISO date
  validityEndDate?: string; // ISO date
  validityYears: number; // Typically 3-5

  // Linked entities
  linkedEbiosAnalysisId?: string; // For Story 38-4
  linkedSystemId?: string; // Reference to an asset/system if applicable

  // EBIOS Link Tracking (Story 38-4)
  ebiosSnapshot?: EbiosLinkSnapshot; // Data snapshot at link time
  ebiosLastSyncedAt?: string; // Last time EBIOS data was synced
  ebiosReviewRequired?: boolean; // Flag when EBIOS changed since link
  ebiosLinkHistory?: EbiosLinkHistoryEntry[]; // Audit trail of link changes

  // Responsible parties
  responsibleId: string; // User ID of responsible person (RSSI)
  authorityId?: string; // Homologation authority (decision maker)
  authorityName?: string; // Name/title of authority

  // Documents
  documents: HomologationDocumentRef[];

  // Decision tracking
  decisionDate?: string;
  decisionReference?: string; // Official decision reference number
  decisionNotes?: string;

  // Renewal tracking
  renewalAlertDays: number[]; // Days before expiry to alert (e.g., [90, 60, 30])
  lastRenewalAlertSent?: string;

  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Input for creating a new dossier
 */
export interface CreateHomologationDossierInput {
  name: string;
  description?: string;
  systemScope: string;
  level: HomologationLevel;
  levelJustification: string;
  levelOverridden: boolean;
  originalRecommendation?: HomologationLevel;
  determinationAnswers: LevelDeterminationAnswer[];
  recommendationScore: number;
  responsibleId: string;
  validityYears?: number;
  linkedEbiosAnalysisId?: string;
  linkedSystemId?: string;
  // Organization and user context
  organizationId: string;
  userId: string;
}

/**
 * Input for updating a dossier
 */
export interface UpdateHomologationDossierInput {
  name?: string;
  description?: string;
  systemScope?: string;
  status?: HomologationStatus;
  validityStartDate?: string;
  validityEndDate?: string;
  authorityId?: string;
  authorityName?: string;
  decisionDate?: string;
  decisionReference?: string;
  decisionNotes?: string;
  linkedEbiosAnalysisId?: string;
  renewalAlertDays?: number[];
  // EBIOS Link fields (Story 38-4)
  ebiosSnapshot?: EbiosLinkSnapshot;
  ebiosLastSyncedAt?: string;
  ebiosReviewRequired?: boolean;
  ebiosLinkHistory?: EbiosLinkHistoryEntry[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Level thresholds for score-based determination
 */
export const LEVEL_THRESHOLDS: Record<HomologationLevel, { min: number; max: number }> = {
  etoile: { min: 0, max: 25 },
  simple: { min: 26, max: 50 },
  standard: { min: 51, max: 75 },
  renforce: { min: 76, max: 100 }
};

/**
 * Required documents per level
 */
export const REQUIRED_DOCUMENTS: Record<HomologationLevel, HomologationDocumentType[]> = {
  etoile: ['strategie'],
  simple: ['strategie', 'analyse_risques'],
  standard: ['strategie', 'analyse_risques', 'plan_action', 'decision', 'attestation'],
  renforce: [
    'strategie',
    'analyse_risques',
    'plan_action',
    'decision',
    'attestation',
    'test_intrusion',
    'audit_technique'
  ]
};

/**
 * Default validity years per level
 */
export const DEFAULT_VALIDITY_YEARS: Record<HomologationLevel, number> = {
  etoile: 5,
  simple: 5,
  standard: 3,
  renforce: 3
};

/**
 * Level display info
 */
export const LEVEL_INFO: Record<
  HomologationLevel,
  {
    label: string;
    labelEn: string;
    description: string;
    descriptionEn: string;
    color: string;
    icon: string;
  }
> = {
  etoile: {
    label: 'Étoile',
    labelEn: 'Star',
    description: 'Processus minimal pour systèmes non sensibles',
    descriptionEn: 'Minimal process for non-sensitive systems',
    color: '#10B981', // Green
    icon: 'Star'
  },
  simple: {
    label: 'Simple',
    labelEn: 'Simple',
    description: 'Processus allégé pour sensibilité limitée',
    descriptionEn: 'Lightweight process for limited sensitivity',
    color: '#3B82F6', // Blue
    icon: 'FileText'
  },
  standard: {
    label: 'Standard',
    labelEn: 'Standard',
    description: 'Processus complet pour systèmes sensibles',
    descriptionEn: 'Full process for sensitive systems',
    color: '#F59E0B', // Amber
    icon: 'Shield'
  },
  renforce: {
    label: 'Renforcé',
    labelEn: 'Enhanced',
    description: 'Processus renforcé pour systèmes critiques',
    descriptionEn: 'Enhanced process for critical systems',
    color: '#EF4444', // Red
    icon: 'ShieldAlert'
  }
};

/**
 * Document type display info
 */
export const DOCUMENT_TYPE_INFO: Record<
  HomologationDocumentType,
  {
    label: string;
    labelEn: string;
    description: string;
    descriptionEn: string;
  }
> = {
  strategie: {
    label: "Stratégie d'homologation",
    labelEn: 'Homologation Strategy',
    description: 'Document définissant le périmètre et les objectifs',
    descriptionEn: 'Document defining scope and objectives'
  },
  analyse_risques: {
    label: 'Analyse de risques',
    labelEn: 'Risk Analysis',
    description: 'Identification et évaluation des risques de sécurité',
    descriptionEn: 'Identification and assessment of security risks'
  },
  plan_action: {
    label: "Plan d'action",
    labelEn: 'Action Plan',
    description: 'Mesures de sécurité et calendrier de mise en œuvre',
    descriptionEn: 'Security measures and implementation timeline'
  },
  decision: {
    label: "Décision d'homologation",
    labelEn: 'Homologation Decision',
    description: "Acte officiel de l'autorité d'homologation",
    descriptionEn: 'Official act of the homologation authority'
  },
  attestation: {
    label: 'Attestation',
    labelEn: 'Certificate',
    description: "Attestation formelle de l'homologation",
    descriptionEn: 'Formal certificate of homologation'
  },
  test_intrusion: {
    label: "Tests d'intrusion",
    labelEn: 'Penetration Tests',
    description: "Rapport des tests d'intrusion réalisés",
    descriptionEn: 'Report of penetration tests performed'
  },
  audit_technique: {
    label: 'Audit technique',
    labelEn: 'Technical Audit',
    description: 'Audit technique approfondi du système',
    descriptionEn: 'In-depth technical audit of the system'
  }
};
