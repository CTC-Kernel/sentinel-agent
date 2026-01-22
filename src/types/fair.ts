/**
 * FAIR Model Types
 * Epic 39: Financial Risk Quantification
 * Story 39-1: FAIR Model Configuration
 *
 * Factor Analysis of Information Risk (FAIR) model types
 * for quantitative risk assessment and financial impact calculation.
 */

import type { FirestoreTimestampLike } from './index';

// ============================================================================
// Distribution Types
// ============================================================================

/**
 * Distribution type for probabilistic modeling
 */
export type DistributionType = 'pert' | 'lognormal' | 'normal' | 'uniform' | 'triangular';

/**
 * Base distribution parameters
 */
export interface DistributionParams {
  type: DistributionType;
  min: number;
  max: number;
  mostLikely?: number; // For PERT/Triangular
  mean?: number; // For Normal/Lognormal
  standardDeviation?: number; // For Normal/Lognormal
  confidence?: number; // Confidence level (0-1)
}

/**
 * PERT distribution (most common for FAIR)
 */
export interface PERTDistribution extends DistributionParams {
  type: 'pert';
  min: number;
  mostLikely: number;
  max: number;
  lambda?: number; // Shape parameter, default 4
}

/**
 * Lognormal distribution
 */
export interface LognormalDistribution extends DistributionParams {
  type: 'lognormal';
  mean: number;
  standardDeviation: number;
}

// ============================================================================
// FAIR Primary Factors
// ============================================================================

/**
 * Loss Event Frequency (LEF)
 * How often a loss event is expected to occur
 */
export interface LossEventFrequency {
  distribution: DistributionParams;
  annualized: boolean;
  unit: 'per_year' | 'per_month' | 'per_quarter';
  contactFrequency?: number; // Threat Event Frequency component
  probabilityOfAction?: number; // Probability of Action component
}

/**
 * Primary Loss Magnitude (PLM)
 * Direct financial impact from a loss event
 */
export interface PrimaryLossMagnitude {
  distribution: DistributionParams;
  currency: 'EUR' | 'USD' | 'GBP';
  components: {
    productivity?: DistributionParams;
    response?: DistributionParams;
    replacement?: DistributionParams;
    competitiveAdvantage?: DistributionParams;
    finesAndJudgments?: DistributionParams;
    reputation?: DistributionParams;
  };
}

/**
 * Secondary Loss Event Frequency (SLEF)
 * How often secondary stakeholders act on a primary loss
 */
export interface SecondaryLossEventFrequency {
  distribution: DistributionParams;
  regulatoryNotification: boolean;
  customerNotification: boolean;
  mediaExposure: boolean;
}

/**
 * Secondary Loss Magnitude (SLM)
 * Financial impact from secondary effects
 */
export interface SecondaryLossMagnitude {
  distribution: DistributionParams;
  currency: 'EUR' | 'USD' | 'GBP';
  components: {
    regulatoryFines?: DistributionParams;
    legalCosts?: DistributionParams;
    customerCompensation?: DistributionParams;
    reputationRecovery?: DistributionParams;
  };
}

// ============================================================================
// Threat & Vulnerability
// ============================================================================

/**
 * Threat capability level
 */
export type ThreatCapabilityLevel = 'low' | 'moderate' | 'high' | 'very_high';

/**
 * Threat actor profile
 */
export interface ThreatProfile {
  actorType: 'nation_state' | 'organized_crime' | 'hacktivists' | 'insider' | 'opportunistic';
  capability: ThreatCapabilityLevel;
  capabilityScore: number; // 0-100
  motivation: 'financial' | 'espionage' | 'disruption' | 'ideology' | 'revenge';
  resources: 'unlimited' | 'significant' | 'moderate' | 'limited';
}

/**
 * Control strength assessment
 */
export interface ControlStrength {
  preventive: number; // 0-100
  detective: number; // 0-100
  corrective: number; // 0-100
  overall: number; // Calculated weighted average
  maturityLevel: 1 | 2 | 3 | 4 | 5; // CMMI-style maturity
}

/**
 * Vulnerability assessment
 */
export interface VulnerabilityAssessment {
  threatCapability: ThreatProfile;
  controlStrength: ControlStrength;
  vulnerabilityScore: number; // Calculated: capability - control strength
  exposureFactor: number; // 0-1, percentage of asset at risk
}

// ============================================================================
// FAIR Model Configuration
// ============================================================================

/**
 * Preset complexity levels for non-experts
 */
export type FAIRComplexityLevel = 'simple' | 'standard' | 'advanced';

/**
 * FAIR model preset for quick configuration
 */
export interface FAIRPreset {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  complexityLevel: FAIRComplexityLevel;
  scenarioType: 'data_breach' | 'ransomware' | 'ddos' | 'insider_threat' | 'business_email_compromise' | 'supply_chain' | 'custom';
  defaultValues: Partial<FAIRModelConfig>;
}

/**
 * Complete FAIR model configuration
 */
export interface FAIRModelConfig {
  id: string;
  organizationId: string;
  riskId?: string; // Link to EBIOS risk if applicable

  // Metadata
  name: string;
  description?: string;
  complexityLevel: FAIRComplexityLevel;
  presetId?: string;

  // Primary FAIR factors
  lossEventFrequency: LossEventFrequency;
  primaryLossMagnitude: PrimaryLossMagnitude;

  // Secondary factors (optional, for advanced analysis)
  secondaryLossEventFrequency?: SecondaryLossEventFrequency;
  secondaryLossMagnitude?: SecondaryLossMagnitude;

  // Threat & Vulnerability
  vulnerability: VulnerabilityAssessment;

  // Simulation settings
  simulationSettings: SimulationSettings;

  // Results (populated after simulation)
  lastSimulation?: SimulationResults;

  // Audit
  createdAt: string | FirestoreTimestampLike;
  createdBy: string;
  updatedAt: string | FirestoreTimestampLike;
  updatedBy: string;
}

// ============================================================================
// Simulation Configuration
// ============================================================================

/**
 * Monte Carlo simulation settings
 */
export interface SimulationSettings {
  iterations: number; // Default 10000
  seed?: number; // For reproducibility
  confidenceIntervals: number[]; // e.g., [0.05, 0.50, 0.95]
  timeHorizon: 'annual' | 'quarterly' | 'monthly';
  includeSecondaryLoss: boolean;
}

/**
 * Value at Risk (VaR) results
 */
export interface VaRResults {
  var95: number; // 95th percentile
  var99: number; // 99th percentile
  cvar95: number; // Conditional VaR at 95%
  cvar99: number; // Conditional VaR at 99%
}

/**
 * Annual Loss Expectancy breakdown
 */
export interface ALEBreakdown {
  primary: number;
  secondary: number;
  total: number;
  byComponent: Record<string, number>;
}

/**
 * Simulation results
 */
export interface SimulationResults {
  id: string;
  configId: string;
  runAt: string | FirestoreTimestampLike;

  // Core metrics
  annualLossExpectancy: ALEBreakdown;
  lossEventFrequencyMean: number;
  lossMagnitudeMean: number;

  // VaR metrics
  valueAtRisk: VaRResults;

  // Distribution statistics
  statistics: {
    mean: number;
    median: number;
    mode: number;
    standardDeviation: number;
    skewness: number;
    kurtosis: number;
    min: number;
    max: number;
    percentiles: Record<number, number>; // e.g., { 5: 1000, 50: 5000, 95: 50000 }
  };

  // Raw data for visualization (sampled)
  histogram: {
    bins: number[];
    frequencies: number[];
  };

  // Simulation metadata
  iterations: number;
  executionTimeMs: number;
  warnings?: string[];
}

// ============================================================================
// Form Types
// ============================================================================

/**
 * Simplified form values for basic users
 */
export interface FAIRSimpleFormValues {
  name: string;
  scenarioType: FAIRPreset['scenarioType'];
  estimatedFrequencyPerYear: number;
  estimatedLossMin: number;
  estimatedLossMostLikely: number;
  estimatedLossMax: number;
  currency: 'EUR' | 'USD' | 'GBP';
  controlEffectiveness: 'weak' | 'moderate' | 'strong' | 'very_strong';
}

/**
 * Standard form values
 */
export interface FAIRStandardFormValues extends FAIRSimpleFormValues {
  threatActorType: ThreatProfile['actorType'];
  threatCapability: ThreatCapabilityLevel;
  includeSecondaryLoss: boolean;
  secondaryLossMultiplier?: number;
}

/**
 * Advanced form values (full FAIR)
 */
export interface FAIRAdvancedFormValues {
  name: string;
  description?: string;

  // Full distribution parameters
  lef: DistributionParams;
  plm: DistributionParams;
  slef?: DistributionParams;
  slm?: DistributionParams;

  // Detailed threat profile
  threatProfile: ThreatProfile;

  // Detailed control assessment
  controlStrength: ControlStrength;

  // Loss components
  lossComponents: {
    productivity: number;
    response: number;
    replacement: number;
    competitiveAdvantage: number;
    finesAndJudgments: number;
    reputation: number;
  };

  // Secondary loss components
  secondaryLossComponents?: {
    regulatoryFines: number;
    legalCosts: number;
    customerCompensation: number;
    reputationRecovery: number;
  };

  // Simulation settings
  iterations: number;
  confidenceLevel: number;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Wizard step tracking
 */
export type FAIRWizardStep =
  | 'complexity'
  | 'scenario'
  | 'frequency'
  | 'magnitude'
  | 'threat'
  | 'controls'
  | 'secondary'
  | 'review';

/**
 * Wizard state
 */
export interface FAIRWizardState {
  currentStep: FAIRWizardStep;
  completedSteps: FAIRWizardStep[];
  complexityLevel: FAIRComplexityLevel;
  formValues: Partial<FAIRAdvancedFormValues>;
  validationErrors: Record<string, string>;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  iterations: 10000,
  confidenceIntervals: [0.05, 0.25, 0.50, 0.75, 0.95, 0.99],
  timeHorizon: 'annual',
  includeSecondaryLoss: true
};

export const THREAT_CAPABILITY_SCORES: Record<ThreatCapabilityLevel, number> = {
  low: 25,
  moderate: 50,
  high: 75,
  very_high: 95
};

export const CONTROL_EFFECTIVENESS_SCORES: Record<string, number> = {
  weak: 25,
  moderate: 50,
  strong: 75,
  very_strong: 90
};

export const FAIR_PRESETS: FAIRPreset[] = [
  {
    id: 'data-breach-standard',
    name: 'Data Breach',
    nameFr: 'Violation de données',
    description: 'Standard data breach scenario with regulatory implications',
    descriptionFr: 'Scénario standard de violation de données avec implications réglementaires',
    complexityLevel: 'standard',
    scenarioType: 'data_breach',
    defaultValues: {
      lossEventFrequency: {
        distribution: { type: 'pert', min: 0.1, mostLikely: 0.5, max: 2 },
        annualized: true,
        unit: 'per_year'
      }
    }
  },
  {
    id: 'ransomware-standard',
    name: 'Ransomware Attack',
    nameFr: 'Attaque par rançongiciel',
    description: 'Ransomware scenario with business disruption',
    descriptionFr: 'Scénario de rançongiciel avec interruption d\'activité',
    complexityLevel: 'standard',
    scenarioType: 'ransomware',
    defaultValues: {
      lossEventFrequency: {
        distribution: { type: 'pert', min: 0.05, mostLikely: 0.2, max: 1 },
        annualized: true,
        unit: 'per_year'
      }
    }
  },
  {
    id: 'insider-threat-advanced',
    name: 'Insider Threat',
    nameFr: 'Menace interne',
    description: 'Malicious or negligent insider scenario',
    descriptionFr: 'Scénario de menace interne malveillante ou négligente',
    complexityLevel: 'advanced',
    scenarioType: 'insider_threat',
    defaultValues: {
      lossEventFrequency: {
        distribution: { type: 'pert', min: 0.2, mostLikely: 1, max: 5 },
        annualized: true,
        unit: 'per_year'
      }
    }
  },
  {
    id: 'bec-simple',
    name: 'Business Email Compromise',
    nameFr: 'Compromission de messagerie',
    description: 'Email-based fraud targeting financial transfers',
    descriptionFr: 'Fraude par email ciblant les transferts financiers',
    complexityLevel: 'simple',
    scenarioType: 'business_email_compromise',
    defaultValues: {
      lossEventFrequency: {
        distribution: { type: 'pert', min: 1, mostLikely: 3, max: 12 },
        annualized: true,
        unit: 'per_year'
      }
    }
  },
  {
    id: 'supply-chain-advanced',
    name: 'Supply Chain Attack',
    nameFr: 'Attaque chaîne d\'approvisionnement',
    description: 'Third-party compromise affecting operations',
    descriptionFr: 'Compromission de tiers affectant les opérations',
    complexityLevel: 'advanced',
    scenarioType: 'supply_chain',
    defaultValues: {
      lossEventFrequency: {
        distribution: { type: 'pert', min: 0.01, mostLikely: 0.1, max: 0.5 },
        annualized: true,
        unit: 'per_year'
      }
    }
  }
];
