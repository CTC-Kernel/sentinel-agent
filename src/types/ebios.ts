/**
 * EBIOS RM Types - Extension Module
 * Implements ADR-E001: EBIOS RM State Machine
 *
 * EBIOS Risk Manager (EBIOS RM) is the French ANSSI methodology
 * for cybersecurity risk analysis, aligned with ISO 27005.
 */

// ============================================================================
// EBIOS Analysis Core Types
// ============================================================================

/**
 * Workshop status enumeration
 */
export const EBIOS_WORKSHOP_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'validated'
] as const;

export type EbiosWorkshopStatus = typeof EBIOS_WORKSHOP_STATUSES[number];

/**
 * Analysis status enumeration
 */
export const EBIOS_ANALYSIS_STATUSES = [
  'draft',
  'in_progress',
  'completed',
  'archived'
] as const;

export type EbiosAnalysisStatus = typeof EBIOS_ANALYSIS_STATUSES[number];

/**
 * Workshop number type (1-5)
 */
export type EbiosWorkshopNumber = 1 | 2 | 3 | 4 | 5;

/**
 * Valid workshop transitions (state machine)
 * Enforces sequential progression with ability to go back
 */
export const VALID_WORKSHOP_TRANSITIONS: Record<EbiosWorkshopNumber, EbiosWorkshopNumber[]> = {
  1: [2],      // Workshop 1 can only go to 2
  2: [1, 3],   // Workshop 2 can go back to 1 or forward to 3
  3: [2, 4],   // Workshop 3 can go back to 2 or forward to 4
  4: [3, 5],   // Workshop 4 can go back to 3 or forward to 5
  5: [4],      // Workshop 5 can only go back to 4
};

/**
 * Check if a workshop transition is valid
 */
export function isValidWorkshopTransition(
  from: EbiosWorkshopNumber,
  to: EbiosWorkshopNumber
): boolean {
  return VALID_WORKSHOP_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if user can proceed to a workshop
 * Requires previous workshop to be completed or validated
 */
export function canProceedToWorkshop(
  workshops: EbiosWorkshops,
  targetWorkshop: EbiosWorkshopNumber
): boolean {
  if (targetWorkshop === 1) return true;
  const previousWorkshop = (targetWorkshop - 1) as EbiosWorkshopNumber;
  const previousStatus = workshops[previousWorkshop].status;
  return previousStatus === 'completed' || previousStatus === 'validated';
}

// ============================================================================
// Workshop Data Types
// ============================================================================

/**
 * Workshop 1: Cadrage et Socle de Sécurité
 */
export interface Workshop1Data {
  scope: {
    description?: string;
    missions: Mission[];
    essentialAssets: EssentialAsset[];
    supportingAssets: SupportingAsset[];
  };
  fearedEvents: FearedEvent[];
  securityBaseline: SecurityBaseline;
}

export interface Mission {
  id: string;
  name: string;
  description?: string;
  criticality: 1 | 2 | 3 | 4;
  linkedAssetIds?: string[];
}

export interface EssentialAsset {
  id: string;
  name: string;
  description?: string;
  type: 'information' | 'process' | 'function';
  criticality: 1 | 2 | 3 | 4;
  linkedMissionIds: string[];
}

export interface SupportingAsset {
  id: string;
  name: string;
  description?: string;
  type: 'hardware' | 'software' | 'network' | 'personnel' | 'site' | 'organization';
  linkedEssentialAssetIds: string[];
  linkedAssetId?: string; // Link to existing asset inventory
}

export interface FearedEvent {
  id: string;
  name: string;
  description?: string;
  impactType: 'confidentiality' | 'integrity' | 'availability';
  gravity: 1 | 2 | 3 | 4;
  linkedMissionIds: string[];
  linkedEssentialAssetIds: string[];
}

export interface SecurityBaseline {
  totalMeasures: number;
  implementedMeasures: number;
  partialMeasures: number;
  notImplementedMeasures: number;
  maturityScore: number;
  measures: SecurityBaselineMeasure[];
}

export interface SecurityBaselineMeasure {
  id: string;
  category: string;
  name: string;
  description?: string;
  status: 'implemented' | 'partial' | 'not_implemented';
  notes?: string;
}

/**
 * Workshop 2: Sources de Risque
 */
export interface Workshop2Data {
  selectedRiskSources: SelectedRiskSource[];
  selectedTargetedObjectives: SelectedTargetedObjective[];
  srOvPairs: SROVPair[];
}

export interface SelectedRiskSource {
  id: string;
  riskSourceId: string; // Reference to library
  relevanceJustification?: string;
}

export interface SelectedTargetedObjective {
  id: string;
  targetedObjectiveId: string; // Reference to library
  relevanceJustification?: string;
}

export interface SROVPair {
  id: string;
  riskSourceId: string;
  targetedObjectiveId: string;
  relevance: 1 | 2 | 3 | 4;
  justification?: string;
  retainedForAnalysis: boolean;
}

/**
 * Workshop 3: Scénarios Stratégiques
 */
export interface Workshop3Data {
  ecosystem: EcosystemParty[];
  attackPaths: AttackPath[];
  strategicScenarios: StrategicScenario[];
}

export interface EcosystemParty {
  id: string;
  name: string;
  description?: string;
  type: EcosystemPartyType;
  category: 'internal' | 'external';
  trustLevel: 1 | 2 | 3 | 4 | 5;
  exposure: 1 | 2 | 3 | 4 | 5;
  cyberDependency: 1 | 2 | 3 | 4 | 5;
  penetration: 1 | 2 | 3 | 4 | 5;
  maturityLevel?: number;
  position?: { x: number; y: number }; // For visualization
}

export type EcosystemPartyType =
  | 'supplier'
  | 'partner'
  | 'customer'
  | 'regulator'
  | 'subcontractor'
  | 'cloud_provider'
  | 'software_vendor'
  | 'service_provider'
  | 'other';

export interface AttackPath {
  id: string;
  name: string;
  description?: string;
  sourcePartyId: string;
  targetAssetId: string;
  intermediatePartyIds: string[];
  likelihood: 1 | 2 | 3 | 4;
  complexity: 1 | 2 | 3 | 4;
}

export interface StrategicScenario {
  id: string;
  name: string;
  description?: string;
  srOvPairId: string;
  attackPathIds: string[];
  fearedEventIds: string[];
  gravity: 1 | 2 | 3 | 4;
  gravityJustification?: string;
}

/**
 * Workshop 4: Scénarios Opérationnels
 */
export interface Workshop4Data {
  operationalScenarios: OperationalScenario[];
}

export interface OperationalScenario {
  id: string;
  code?: string; // Auto-generated: SO-001, SO-002, etc.
  name: string;
  description?: string;
  strategicScenarioId: string;
  attackSequence: AttackStep[];
  likelihood: 1 | 2 | 3 | 4;
  likelihoodJustification?: string;
  riskLevel: number; // Calculated: gravity * likelihood
  linkedRiskId?: string; // Link to risk registry
}

export interface AttackStep {
  id: string;
  order: number;
  description: string;
  mitreReference?: MitreReference;
  targetAssetDescription?: string;
  requiredCapability?: string;
}

export interface MitreReference {
  tacticId: string;
  tacticName: string;
  techniqueId: string;
  techniqueName: string;
  subtechniqueId?: string;
  subtechniqueName?: string;
}

/**
 * Workshop 5: Traitement du Risque
 */
export interface Workshop5Data {
  treatmentPlan: TreatmentPlanItem[];
  residualRisks: ResidualRiskAssessment[];
}

export interface TreatmentPlanItem {
  id: string;
  operationalScenarioId: string;
  strategy: 'accept' | 'mitigate' | 'transfer' | 'avoid';
  strategyJustification?: string;
  selectedControlIds: string[]; // Link to ISO 27002 controls
  responsibleId?: string;
  deadline?: string;
  status: 'planned' | 'in_progress' | 'completed';
}

export interface ResidualRiskAssessment {
  id: string;
  operationalScenarioId: string;
  initialRiskLevel: number;
  controlEffectiveness: number; // 0-100%
  residualRiskLevel: number;
  acceptedBy?: string;
  acceptanceDate?: string;
  acceptanceJustification?: string;
}

// ============================================================================
// Workshop Container Type
// ============================================================================

export interface WorkshopState<T> {
  status: EbiosWorkshopStatus;
  startedAt?: string;
  completedAt?: string;
  validatedBy?: string;
  validatedAt?: string;
  data: T;
}

export interface EbiosWorkshops {
  1: WorkshopState<Workshop1Data>;
  2: WorkshopState<Workshop2Data>;
  3: WorkshopState<Workshop3Data>;
  4: WorkshopState<Workshop4Data>;
  5: WorkshopState<Workshop5Data>;
}

// ============================================================================
// Main EBIOS Analysis Type
// ============================================================================

export interface EbiosAnalysis {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: EbiosAnalysisStatus;
  currentWorkshop: EbiosWorkshopNumber;
  workshops: EbiosWorkshops;
  completionPercentage: number;

  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;

  // Optional settings
  targetCertificationDate?: string;
  sector?: string;

  // Score integration
  lastScoreUpdate?: string;
  contributesToGlobalScore: boolean;
}

// ============================================================================
// Risk Source Library Types
// ============================================================================

export const RISK_SOURCE_CATEGORIES = [
  'state_sponsored',
  'organized_crime',
  'terrorist',
  'activist',
  'competitor',
  'insider_malicious',
  'insider_negligent',
  'opportunist'
] as const;

export type RiskSourceCategory = typeof RISK_SOURCE_CATEGORIES[number];

export interface RiskSource {
  id: string;
  code: string;
  category: RiskSourceCategory;
  name: string;
  description: string;
  motivation?: string;
  resources?: string;
  isANSSIStandard: boolean;
  organizationId?: string | null; // null = global library
  createdAt: string;
  updatedAt?: string;
}

export interface TargetedObjective {
  id: string;
  code: string;
  name: string;
  description: string;
  impactType: 'confidentiality' | 'integrity' | 'availability';
  isANSSIStandard: boolean;
  organizationId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// ============================================================================
// SMSI Program Types (ISO 27003)
// ============================================================================

export const PDCA_PHASES = ['plan', 'do', 'check', 'act'] as const;
export type PDCAPhase = typeof PDCA_PHASES[number];

export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'overdue'
] as const;
export type MilestoneStatus = typeof MILESTONE_STATUSES[number];

export interface SMSIProgram {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  targetCertificationDate?: string;
  currentPhase: PDCAPhase;
  phases: {
    plan: PDCAPhaseData;
    do: PDCAPhaseData;
    check: PDCAPhaseData;
    act: PDCAPhaseData;
  };
  overallProgress: number;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface PDCAPhaseData {
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
  progress: number;
  responsibleId?: string;
}

export interface Milestone {
  id: string;
  programId: string;
  organizationId: string;
  name: string;
  description?: string;
  phase: PDCAPhase;
  dueDate: string;
  completedAt?: string;
  status: MilestoneStatus;
  responsibleId?: string;
  linkedItems?: MilestoneLinkedItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface MilestoneLinkedItem {
  type: 'ebios_analysis' | 'risk' | 'control' | 'document' | 'audit';
  id: string;
  name?: string;
}

// ============================================================================
// Risk Context Types (ISO 27005)
// ============================================================================

export interface RiskContext {
  id: string;
  organizationId: string;

  businessContext: {
    description?: string;
    activities: string[];
    objectives: string[];
    criticalProcesses: string[];
  };

  regulatoryContext: {
    description?: string;
    applicableRegulations: ApplicableRegulation[];
  };

  riskAppetite: {
    description?: string;
    acceptableRiskLevels: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
    escalationThresholds: {
      automatic: number;
      management: number;
      board: number;
    };
  };

  evaluationCriteria: {
    impactScale: ScaleDefinition[];
    probabilityScale: ScaleDefinition[];
  };

  createdAt: string;
  updatedAt: string;
}

export interface ApplicableRegulation {
  id: string;
  name: string;
  framework?: string;
  obligations?: string;
  deadline?: string;
}

export interface ScaleDefinition {
  level: number;
  name: string;
  description: string;
  criteria?: string[];
}

// ============================================================================
// Control Effectiveness Types (ISO 27002)
// ============================================================================

export interface ControlEffectivenessAssessment {
  id: string;
  controlId: string;
  organizationId: string;
  effectivenessScore: number; // 0-100
  assessmentDate: string;
  assessmentMethod: string;
  assessedBy: string;
  evidence?: string[];
  notes?: string;
  nextAssessmentDate?: string;
}

export interface DomainMaturityScore {
  domain: string;
  domainName: string;
  controlCount: number;
  assessedCount: number;
  averageEffectiveness: number;
  maturityLevel: 1 | 2 | 3 | 4 | 5;
}

// ============================================================================
// Default Workshop Data Factories
// ============================================================================

export function createDefaultWorkshop1Data(): Workshop1Data {
  return {
    scope: {
      missions: [],
      essentialAssets: [],
      supportingAssets: [],
    },
    fearedEvents: [],
    securityBaseline: {
      totalMeasures: 0,
      implementedMeasures: 0,
      partialMeasures: 0,
      notImplementedMeasures: 0,
      maturityScore: 0,
      measures: [],
    },
  };
}

export function createDefaultWorkshop2Data(): Workshop2Data {
  return {
    selectedRiskSources: [],
    selectedTargetedObjectives: [],
    srOvPairs: [],
  };
}

export function createDefaultWorkshop3Data(): Workshop3Data {
  return {
    ecosystem: [],
    attackPaths: [],
    strategicScenarios: [],
  };
}

export function createDefaultWorkshop4Data(): Workshop4Data {
  return {
    operationalScenarios: [],
  };
}

export function createDefaultWorkshop5Data(): Workshop5Data {
  return {
    treatmentPlan: [],
    residualRisks: [],
  };
}

export function createDefaultEbiosWorkshops(): EbiosWorkshops {
  return {
    1: { status: 'not_started', data: createDefaultWorkshop1Data() },
    2: { status: 'not_started', data: createDefaultWorkshop2Data() },
    3: { status: 'not_started', data: createDefaultWorkshop3Data() },
    4: { status: 'not_started', data: createDefaultWorkshop4Data() },
    5: { status: 'not_started', data: createDefaultWorkshop5Data() },
  };
}

// ============================================================================
// EBIOS Score Calculation
// ============================================================================

export const WORKSHOP_WEIGHTS: Record<EbiosWorkshopNumber, number> = {
  1: 0.15,
  2: 0.15,
  3: 0.20,
  4: 0.25,
  5: 0.25,
};

export function calculateWorkshopProgress(workshop: WorkshopState<unknown>): number {
  switch (workshop.status) {
    case 'not_started':
      return 0;
    case 'in_progress':
      return 50;
    case 'completed':
      return 90;
    case 'validated':
      return 100;
    default:
      return 0;
  }
}

export function calculateEbiosCompletionPercentage(workshops: EbiosWorkshops): number {
  let total = 0;
  for (const [num, weight] of Object.entries(WORKSHOP_WEIGHTS)) {
    const workshopNum = Number(num) as EbiosWorkshopNumber;
    const progress = calculateWorkshopProgress(workshops[workshopNum]);
    total += progress * weight;
  }
  return Math.round(total);
}
