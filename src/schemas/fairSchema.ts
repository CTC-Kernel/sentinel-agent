/**
 * FAIR Model Schemas
 * Epic 39: Financial Risk Quantification
 * Story 39-1: FAIR Model Configuration
 *
 * Zod schemas for FAIR form validation.
 */

import { z } from 'zod';

// ============================================================================
// Distribution Schema
// ============================================================================

export const distributionSchema = z.object({
  type: z.enum(['pert', 'lognormal', 'normal', 'uniform', 'triangular']),
  min: z.number().min(0, 'Minimum must be non-negative'),
  max: z.number().min(0, 'Maximum must be non-negative'),
  mostLikely: z.number().min(0).optional(),
  mean: z.number().optional(),
  standardDeviation: z.number().positive().optional(),
  confidence: z.number().min(0).max(1).optional()
}).refine(
  (data) => data.max >= data.min,
  { message: 'Maximum must be greater than or equal to minimum', path: ['max'] }
).refine(
  (data) => {
    if (data.mostLikely === undefined) return true;
    return data.mostLikely >= data.min && data.mostLikely <= data.max;
  },
  { message: 'Most likely must be between min and max', path: ['mostLikely'] }
);

// ============================================================================
// Simple Form Schema
// ============================================================================

// Base schema without refinements (used for extension)
export const fairSimpleFormBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  scenarioType: z.enum([
    'data_breach',
    'ransomware',
    'ddos',
    'insider_threat',
    'business_email_compromise',
    'supply_chain',
    'custom'
  ]),
  estimatedFrequencyPerYear: z.number()
    .min(0.01, 'Frequency must be at least 0.01')
    .max(365, 'Frequency cannot exceed 365 per year'),
  estimatedLossMin: z.number()
    .min(0, 'Minimum loss cannot be negative')
    .max(1000000000, 'Value too large'),
  estimatedLossMostLikely: z.number()
    .min(0, 'Most likely loss cannot be negative')
    .max(1000000000, 'Value too large'),
  estimatedLossMax: z.number()
    .min(0, 'Maximum loss cannot be negative')
    .max(10000000000, 'Value too large'),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  controlEffectiveness: z.enum(['weak', 'moderate', 'strong', 'very_strong'])
});

// Refined schema for direct use
export const fairSimpleFormSchema = fairSimpleFormBaseSchema.refine(
  (data) => data.estimatedLossMax >= data.estimatedLossMostLikely,
  { message: 'Maximum must be greater than most likely', path: ['estimatedLossMax'] }
).refine(
  (data) => data.estimatedLossMostLikely >= data.estimatedLossMin,
  { message: 'Most likely must be greater than minimum', path: ['estimatedLossMostLikely'] }
);

export type FAIRSimpleFormData = z.infer<typeof fairSimpleFormSchema>;

// ============================================================================
// Standard Form Schema
// ============================================================================

// Extend from the BASE schema (without refinements), then add refinements
export const fairStandardFormSchema = fairSimpleFormBaseSchema.extend({
  threatActorType: z.enum([
    'nation_state',
    'organized_crime',
    'hacktivists',
    'insider',
    'opportunistic'
  ]),
  threatCapability: z.enum(['low', 'moderate', 'high', 'very_high']),
  includeSecondaryLoss: z.boolean(),
  secondaryLossMultiplier: z.number().min(0).max(10).optional()
}).refine(
  (data) => data.estimatedLossMax >= data.estimatedLossMostLikely,
  { message: 'Maximum must be greater than most likely', path: ['estimatedLossMax'] }
).refine(
  (data) => data.estimatedLossMostLikely >= data.estimatedLossMin,
  { message: 'Most likely must be greater than minimum', path: ['estimatedLossMostLikely'] }
).refine(
  (data) => {
    if (data.includeSecondaryLoss && !data.secondaryLossMultiplier) {
      return false;
    }
    return true;
  },
  { message: 'Secondary loss multiplier required when secondary loss is enabled', path: ['secondaryLossMultiplier'] }
);

export type FAIRStandardFormData = z.infer<typeof fairStandardFormSchema>;

// ============================================================================
// Advanced Form Schema
// ============================================================================

export const threatProfileSchema = z.object({
  actorType: z.enum(['nation_state', 'organized_crime', 'hacktivists', 'insider', 'opportunistic']),
  capability: z.enum(['low', 'moderate', 'high', 'very_high']),
  capabilityScore: z.number().min(0).max(100),
  motivation: z.enum(['financial', 'espionage', 'disruption', 'ideology', 'revenge']),
  resources: z.enum(['unlimited', 'significant', 'moderate', 'limited'])
});

export const controlStrengthSchema = z.object({
  preventive: z.number().min(0).max(100),
  detective: z.number().min(0).max(100),
  corrective: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
  maturityLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
});

export const lossComponentsSchema = z.object({
  productivity: z.number().min(0),
  response: z.number().min(0),
  replacement: z.number().min(0),
  competitiveAdvantage: z.number().min(0),
  finesAndJudgments: z.number().min(0),
  reputation: z.number().min(0)
});

export const secondaryLossComponentsSchema = z.object({
  regulatoryFines: z.number().min(0),
  legalCosts: z.number().min(0),
  customerCompensation: z.number().min(0),
  reputationRecovery: z.number().min(0)
});

export const fairAdvancedFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500).optional(),

  // Full distribution parameters
  lef: distributionSchema,
  plm: distributionSchema,
  slef: distributionSchema.optional(),
  slm: distributionSchema.optional(),

  // Detailed threat profile
  threatProfile: threatProfileSchema,

  // Detailed control assessment
  controlStrength: controlStrengthSchema,

  // Loss components
  lossComponents: lossComponentsSchema,

  // Secondary loss components
  secondaryLossComponents: secondaryLossComponentsSchema.optional(),

  // Simulation settings
  iterations: z.number().min(1000).max(100000),
  confidenceLevel: z.number().min(80).max(99)
});

export type FAIRAdvancedFormData = z.infer<typeof fairAdvancedFormSchema>;

// ============================================================================
// Preset Form Schema
// ============================================================================

export const fairPresetFormSchema = z.object({
  presetId: z.string().min(1, 'Please select a preset'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  riskId: z.string().optional()
});

export type FAIRPresetFormData = z.infer<typeof fairPresetFormSchema>;

// ============================================================================
// Default Values
// ============================================================================

export const defaultSimpleFormValues: FAIRSimpleFormData = {
  name: '',
  scenarioType: 'data_breach',
  estimatedFrequencyPerYear: 0.5,
  estimatedLossMin: 10000,
  estimatedLossMostLikely: 50000,
  estimatedLossMax: 200000,
  currency: 'EUR',
  controlEffectiveness: 'moderate'
};

export const defaultStandardFormValues: FAIRStandardFormData = {
  ...defaultSimpleFormValues,
  threatActorType: 'opportunistic',
  threatCapability: 'moderate',
  includeSecondaryLoss: true,
  secondaryLossMultiplier: 1.5
};

export const defaultAdvancedFormValues: FAIRAdvancedFormData = {
  name: '',
  description: '',
  lef: { type: 'pert', min: 0.1, mostLikely: 0.5, max: 2 },
  plm: { type: 'pert', min: 10000, mostLikely: 50000, max: 200000 },
  threatProfile: {
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
  lossComponents: {
    productivity: 20000,
    response: 15000,
    replacement: 10000,
    competitiveAdvantage: 5000,
    finesAndJudgments: 0,
    reputation: 0
  },
  iterations: 10000,
  confidenceLevel: 95
};
