/**
 * FAIR Service
 * Epic 39: Financial Risk Quantification
 * Story 39-1: FAIR Model Configuration
 *
 * Service for FAIR model management and Monte Carlo simulation.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
  FAIRModelConfig,
  FAIRSimpleFormValues,
  FAIRStandardFormValues,
  FAIRAdvancedFormValues,
  FAIRComplexityLevel,
  FAIRPreset,
  DistributionParams,
  SimulationResults
} from '../types/fair';
import {
  DEFAULT_SIMULATION_SETTINGS,
  THREAT_CAPABILITY_SCORES,
  CONTROL_EFFECTIVENESS_SCORES,
  FAIR_PRESETS
} from '../types/fair';

// ============================================================================
// Collection Reference
// ============================================================================

const getConfigCollection = (organizationId: string) =>
  collection(db, 'organizations', organizationId, 'fairConfigs');

const getResultsCollection = (organizationId: string, configId: string) =>
  collection(db, 'organizations', organizationId, 'fairConfigs', configId, 'results');

// ============================================================================
// FAIR Configuration CRUD
// ============================================================================

export class FAIRService {
  /**
   * Get all FAIR configurations for an organization
   */
  static async getConfigurations(organizationId: string): Promise<FAIRModelConfig[]> {
    const q = query(
      getConfigCollection(organizationId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as FAIRModelConfig[];
  }

  /**
   * Get a specific FAIR configuration
   */
  static async getConfiguration(
    organizationId: string,
    configId: string
  ): Promise<FAIRModelConfig | null> {
    const docRef = doc(getConfigCollection(organizationId), configId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as FAIRModelConfig;
  }

  /**
   * Get FAIR configurations linked to a specific risk
   */
  static async getConfigurationsByRisk(
    organizationId: string,
    riskId: string
  ): Promise<FAIRModelConfig[]> {
    const q = query(
      getConfigCollection(organizationId),
      where('riskId', '==', riskId),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as FAIRModelConfig[];
  }

  /**
   * Create a new FAIR configuration from simple form values
   */
  static async createFromSimpleForm(
    organizationId: string,
    userId: string,
    values: FAIRSimpleFormValues,
    riskId?: string
  ): Promise<string> {
    const config = this.convertSimpleToConfig(values, organizationId, userId, riskId);
    const docRef = await addDoc(getConfigCollection(organizationId), sanitizeData({
      ...config,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    return docRef.id;
  }

  /**
   * Create a new FAIR configuration from standard form values
   */
  static async createFromStandardForm(
    organizationId: string,
    userId: string,
    values: FAIRStandardFormValues,
    riskId?: string
  ): Promise<string> {
    const config = this.convertStandardToConfig(values, organizationId, userId, riskId);
    const docRef = await addDoc(getConfigCollection(organizationId), sanitizeData({
      ...config,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    return docRef.id;
  }

  /**
   * Create a new FAIR configuration from advanced form values
   */
  static async createFromAdvancedForm(
    organizationId: string,
    userId: string,
    values: FAIRAdvancedFormValues,
    riskId?: string
  ): Promise<string> {
    const config = this.convertAdvancedToConfig(values, organizationId, userId, riskId);
    const docRef = await addDoc(getConfigCollection(organizationId), sanitizeData({
      ...config,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    return docRef.id;
  }

  /**
   * Update an existing FAIR configuration
   */
  static async updateConfiguration(
    organizationId: string,
    configId: string,
    userId: string,
    updates: Partial<FAIRModelConfig>
  ): Promise<void> {
    const docRef = doc(getConfigCollection(organizationId), configId);
    await updateDoc(docRef, sanitizeData({
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    }));
  }

  /**
   * Delete a FAIR configuration
   */
  static async deleteConfiguration(
    organizationId: string,
    configId: string
  ): Promise<void> {
    const docRef = doc(getConfigCollection(organizationId), configId);
    await deleteDoc(docRef);
  }

  /**
   * Duplicate a FAIR configuration
   */
  static async duplicateConfiguration(
    organizationId: string,
    configId: string,
    userId: string
  ): Promise<string> {
    const existing = await this.getConfiguration(organizationId, configId);
    if (!existing) throw new Error('Configuration not found');

    const { id: _id, lastSimulation: _sim, createdAt: _created, ...rest } = existing;
    const docRef = await addDoc(getConfigCollection(organizationId), sanitizeData({
      ...rest,
      name: `${rest.name} (Copy)`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId
    }));

    return docRef.id;
  }

  // ============================================================================
  // Preset Management
  // ============================================================================

  /**
   * Get all available presets
   */
  static getPresets(complexityLevel?: FAIRComplexityLevel): FAIRPreset[] {
    if (!complexityLevel) return FAIR_PRESETS;
    return FAIR_PRESETS.filter((p) => p.complexityLevel === complexityLevel);
  }

  /**
   * Get a specific preset by ID
   */
  static getPreset(presetId: string): FAIRPreset | undefined {
    return FAIR_PRESETS.find((p) => p.id === presetId);
  }

  /**
   * Create configuration from preset
   */
  static async createFromPreset(
    organizationId: string,
    userId: string,
    presetId: string,
    name: string,
    riskId?: string
  ): Promise<string> {
    const preset = this.getPreset(presetId);
    if (!preset) throw new Error('Preset not found');

    const baseConfig = this.getDefaultConfig(organizationId, userId, preset.complexityLevel);
    const config: Omit<FAIRModelConfig, 'id' | 'createdAt' | 'updatedAt'> = {
      ...baseConfig,
      name,
      presetId,
      riskId,
      ...preset.defaultValues
    };

    const docRef = await addDoc(getConfigCollection(organizationId), sanitizeData({
      ...config,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    return docRef.id;
  }

  // ============================================================================
  // Simulation Results
  // ============================================================================

  /**
   * Save simulation results
   */
  static async saveSimulationResults(
    organizationId: string,
    configId: string,
    results: Omit<SimulationResults, 'id' | 'runAt'>
  ): Promise<string> {
    const docRef = await addDoc(getResultsCollection(organizationId, configId), sanitizeData({
      ...results,
      runAt: serverTimestamp()
    }));

    // Update the config with latest simulation
    await updateDoc(doc(getConfigCollection(organizationId), configId), sanitizeData({
      lastSimulation: {
        ...results,
        id: docRef.id,
        runAt: Timestamp.now()
      },
      updatedAt: serverTimestamp()
    }));

    return docRef.id;
  }

  /**
   * Get simulation history for a configuration
   */
  static async getSimulationHistory(
    organizationId: string,
    configId: string
  ): Promise<SimulationResults[]> {
    const q = query(
      getResultsCollection(organizationId, configId),
      orderBy('runAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as SimulationResults[];
  }

  // ============================================================================
  // Conversion Helpers
  // ============================================================================

  /**
   * Convert simple form values to full configuration
   */
  static convertSimpleToConfig(
    values: FAIRSimpleFormValues,
    organizationId: string,
    userId: string,
    riskId?: string
  ): Omit<FAIRModelConfig, 'id' | 'createdAt' | 'updatedAt'> {
    const controlScore = CONTROL_EFFECTIVENESS_SCORES[values.controlEffectiveness] || 50;

    return {
      organizationId,
      riskId,
      name: values.name,
      complexityLevel: 'simple',

      lossEventFrequency: {
        distribution: {
          type: 'pert',
          min: values.estimatedFrequencyPerYear * 0.5,
          mostLikely: values.estimatedFrequencyPerYear,
          max: values.estimatedFrequencyPerYear * 2
        },
        annualized: true,
        unit: 'per_year'
      },

      primaryLossMagnitude: {
        distribution: {
          type: 'pert',
          min: values.estimatedLossMin,
          mostLikely: values.estimatedLossMostLikely,
          max: values.estimatedLossMax
        },
        currency: values.currency,
        components: {}
      },

      vulnerability: {
        threatCapability: {
          actorType: 'opportunistic',
          capability: 'moderate',
          capabilityScore: 50,
          motivation: 'financial',
          resources: 'moderate'
        },
        controlStrength: {
          preventive: controlScore,
          detective: controlScore,
          corrective: controlScore,
          overall: controlScore,
          maturityLevel: Math.ceil(controlScore / 20) as 1 | 2 | 3 | 4 | 5
        },
        vulnerabilityScore: Math.max(0, 50 - controlScore),
        exposureFactor: 0.5
      },

      simulationSettings: DEFAULT_SIMULATION_SETTINGS,
      createdBy: userId,
      updatedBy: userId
    };
  }

  /**
   * Convert standard form values to full configuration
   */
  static convertStandardToConfig(
    values: FAIRStandardFormValues,
    organizationId: string,
    userId: string,
    riskId?: string
  ): Omit<FAIRModelConfig, 'id' | 'createdAt' | 'updatedAt'> {
    const baseConfig = this.convertSimpleToConfig(values, organizationId, userId, riskId);
    const threatScore = THREAT_CAPABILITY_SCORES[values.threatCapability] || 50;
    const controlScore = CONTROL_EFFECTIVENESS_SCORES[values.controlEffectiveness] || 50;

    return {
      ...baseConfig,
      complexityLevel: 'standard',

      vulnerability: {
        threatCapability: {
          actorType: values.threatActorType,
          capability: values.threatCapability,
          capabilityScore: threatScore,
          motivation: 'financial',
          resources: 'moderate'
        },
        controlStrength: {
          preventive: controlScore,
          detective: controlScore,
          corrective: controlScore,
          overall: controlScore,
          maturityLevel: Math.ceil(controlScore / 20) as 1 | 2 | 3 | 4 | 5
        },
        vulnerabilityScore: Math.max(0, threatScore - controlScore),
        exposureFactor: threatScore / 100
      },

      secondaryLossEventFrequency: values.includeSecondaryLoss
        ? {
            distribution: {
              type: 'pert',
              min: 0.1,
              mostLikely: 0.5,
              max: 0.9
            },
            regulatoryNotification: true,
            customerNotification: true,
            mediaExposure: false
          }
        : undefined,

      secondaryLossMagnitude: values.includeSecondaryLoss && values.secondaryLossMultiplier
        ? {
            distribution: {
              type: 'pert',
              min: values.estimatedLossMin * (values.secondaryLossMultiplier * 0.5),
              mostLikely: values.estimatedLossMostLikely * values.secondaryLossMultiplier,
              max: values.estimatedLossMax * (values.secondaryLossMultiplier * 1.5)
            },
            currency: values.currency,
            components: {}
          }
        : undefined,

      simulationSettings: {
        ...DEFAULT_SIMULATION_SETTINGS,
        includeSecondaryLoss: values.includeSecondaryLoss
      }
    };
  }

  /**
   * Convert advanced form values to full configuration
   */
  static convertAdvancedToConfig(
    values: FAIRAdvancedFormValues,
    organizationId: string,
    userId: string,
    riskId?: string
  ): Omit<FAIRModelConfig, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      organizationId,
      riskId,
      name: values.name,
      description: values.description,
      complexityLevel: 'advanced',

      lossEventFrequency: {
        distribution: values.lef,
        annualized: true,
        unit: 'per_year'
      },

      primaryLossMagnitude: {
        distribution: values.plm,
        currency: 'EUR',
        components: {
          productivity: { type: 'pert', min: 0, mostLikely: values.lossComponents.productivity, max: values.lossComponents.productivity * 2 },
          response: { type: 'pert', min: 0, mostLikely: values.lossComponents.response, max: values.lossComponents.response * 2 },
          replacement: { type: 'pert', min: 0, mostLikely: values.lossComponents.replacement, max: values.lossComponents.replacement * 2 },
          competitiveAdvantage: { type: 'pert', min: 0, mostLikely: values.lossComponents.competitiveAdvantage, max: values.lossComponents.competitiveAdvantage * 2 },
          finesAndJudgments: { type: 'pert', min: 0, mostLikely: values.lossComponents.finesAndJudgments, max: values.lossComponents.finesAndJudgments * 2 },
          reputation: { type: 'pert', min: 0, mostLikely: values.lossComponents.reputation, max: values.lossComponents.reputation * 2 }
        }
      },

      secondaryLossEventFrequency: values.slef
        ? {
            distribution: values.slef,
            regulatoryNotification: true,
            customerNotification: true,
            mediaExposure: true
          }
        : undefined,

      secondaryLossMagnitude: values.slm && values.secondaryLossComponents
        ? {
            distribution: values.slm,
            currency: 'EUR',
            components: {
              regulatoryFines: { type: 'pert', min: 0, mostLikely: values.secondaryLossComponents.regulatoryFines, max: values.secondaryLossComponents.regulatoryFines * 3 },
              legalCosts: { type: 'pert', min: 0, mostLikely: values.secondaryLossComponents.legalCosts, max: values.secondaryLossComponents.legalCosts * 2 },
              customerCompensation: { type: 'pert', min: 0, mostLikely: values.secondaryLossComponents.customerCompensation, max: values.secondaryLossComponents.customerCompensation * 2 },
              reputationRecovery: { type: 'pert', min: 0, mostLikely: values.secondaryLossComponents.reputationRecovery, max: values.secondaryLossComponents.reputationRecovery * 2 }
            }
          }
        : undefined,

      vulnerability: {
        threatCapability: values.threatProfile,
        controlStrength: values.controlStrength,
        vulnerabilityScore: Math.max(0, values.threatProfile.capabilityScore - values.controlStrength.overall),
        exposureFactor: values.threatProfile.capabilityScore / 100
      },

      simulationSettings: {
        iterations: values.iterations,
        confidenceIntervals: [0.05, 0.25, 0.50, 0.75, 0.95, values.confidenceLevel / 100],
        timeHorizon: 'annual',
        includeSecondaryLoss: !!values.slef
      },

      createdBy: userId,
      updatedBy: userId
    };
  }

  /**
   * Get default configuration for a complexity level
   */
  static getDefaultConfig(
    organizationId: string,
    userId: string,
    complexityLevel: FAIRComplexityLevel
  ): Omit<FAIRModelConfig, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      organizationId,
      name: '',
      complexityLevel,

      lossEventFrequency: {
        distribution: { type: 'pert', min: 0.1, mostLikely: 0.5, max: 2 },
        annualized: true,
        unit: 'per_year'
      },

      primaryLossMagnitude: {
        distribution: { type: 'pert', min: 10000, mostLikely: 50000, max: 200000 },
        currency: 'EUR',
        components: {}
      },

      vulnerability: {
        threatCapability: {
          actorType: 'opportunistic',
          capability: 'moderate',
          capabilityScore: 50,
          motivation: 'financial',
          resources: 'moderate'
        },
        controlStrength: {
          preventive: 50,
          detective: 50,
          corrective: 50,
          overall: 50,
          maturityLevel: 3
        },
        vulnerabilityScore: 25,
        exposureFactor: 0.5
      },

      simulationSettings: DEFAULT_SIMULATION_SETTINGS,
      createdBy: userId,
      updatedBy: userId
    };
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate distribution parameters
   */
  static validateDistribution(params: DistributionParams): string[] {
    const errors: string[] = [];

    if (params.min < 0) {
      errors.push('Minimum value cannot be negative');
    }

    if (params.max < params.min) {
      errors.push('Maximum must be greater than minimum');
    }

    if (params.type === 'pert' || params.type === 'triangular') {
      if (params.mostLikely === undefined) {
        errors.push('Most likely value is required for PERT/Triangular distributions');
      } else if (params.mostLikely < params.min || params.mostLikely > params.max) {
        errors.push('Most likely value must be between min and max');
      }
    }

    if (params.type === 'normal' || params.type === 'lognormal') {
      if (params.mean === undefined) {
        errors.push('Mean is required for Normal/Lognormal distributions');
      }
      if (params.standardDeviation === undefined || params.standardDeviation <= 0) {
        errors.push('Standard deviation must be positive');
      }
    }

    return errors;
  }

  /**
   * Validate full configuration
   */
  static validateConfiguration(config: Partial<FAIRModelConfig>): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    if (!config.name?.trim()) {
      errors.name = ['Name is required'];
    }

    if (config.lossEventFrequency?.distribution) {
      const lefErrors = this.validateDistribution(config.lossEventFrequency.distribution);
      if (lefErrors.length > 0) {
        errors.lossEventFrequency = lefErrors;
      }
    }

    if (config.primaryLossMagnitude?.distribution) {
      const plmErrors = this.validateDistribution(config.primaryLossMagnitude.distribution);
      if (plmErrors.length > 0) {
        errors.primaryLossMagnitude = plmErrors;
      }
    }

    if (config.vulnerability) {
      if (config.vulnerability.controlStrength.overall < 0 || config.vulnerability.controlStrength.overall > 100) {
        errors.controlStrength = ['Control strength must be between 0 and 100'];
      }
    }

    return errors;
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Calculate expected ALE from configuration (quick estimate, not simulation)
   */
  static calculateExpectedALE(config: FAIRModelConfig): number {
    const lef = config.lossEventFrequency.distribution;
    const plm = config.primaryLossMagnitude.distribution;

    // Use most likely values for quick estimate
    const expectedFrequency = lef.mostLikely || (lef.min + lef.max) / 2;
    const expectedMagnitude = plm.mostLikely || (plm.min + plm.max) / 2;

    // Apply vulnerability factor
    const vulnerabilityFactor = config.vulnerability.vulnerabilityScore / 100;
    const adjustedFrequency = expectedFrequency * vulnerabilityFactor;

    return adjustedFrequency * expectedMagnitude;
  }

  /**
   * Format currency value
   */
  static formatCurrency(
    value: number,
    currency: 'EUR' | 'USD' | 'GBP' = 'EUR',
    locale: string = 'fr-FR'
  ): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(value);
  }

  /**
   * Get risk level from ALE
   */
  static getRiskLevel(ale: number): 'low' | 'medium' | 'high' | 'critical' {
    if (ale < 50000) return 'low';
    if (ale < 200000) return 'medium';
    if (ale < 1000000) return 'high';
    return 'critical';
  }
}

export default FAIRService;
