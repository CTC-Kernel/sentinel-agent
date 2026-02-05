/**
 * EBIOS RM Zod Schemas
 * Validation schemas for EBIOS Risk Manager module
 */

import { z } from 'zod';
import i18n from '../i18n';
import {
 EBIOS_ANALYSIS_STATUSES,
 RISK_SOURCE_CATEGORIES,
 PDCA_PHASES,
} from '../types/ebios';

// ============================================================================
// Common Schemas
// ============================================================================

const gravitySchema = z.number().int().min(1).max(4);
const criticalitySchema = z.number().int().min(1).max(4);
const likelihoodSchema = z.number().int().min(1).max(4);
const trustLevelSchema = z.number().int().min(1).max(5);

// ============================================================================
// Workshop 1 Schemas
// ============================================================================

export const missionSchema = z.object({
 id: z.string().min(1),
 name: z.string().trim().min(2, i18n.t('validation.minLength', { min: 2 })).max(200),
 description: z.string().trim().max(2000).optional(),
 criticality: criticalitySchema,
 linkedAssetIds: z.array(z.string()).optional(),
});

export const essentialAssetSchema = z.object({
 id: z.string().min(1),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().max(2000).optional(),
 type: z.enum(['information', 'process', 'function']),
 criticality: criticalitySchema,
 linkedMissionIds: z.array(z.string()),
});

export const supportingAssetSchema = z.object({
 id: z.string().min(1),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().max(2000).optional(),
 type: z.enum(['hardware', 'software', 'network', 'personnel', 'site', 'organization']),
 linkedEssentialAssetIds: z.array(z.string()),
 linkedAssetId: z.string().optional(),
});

export const fearedEventSchema = z.object({
 id: z.string().min(1),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().max(2000).optional(),
 impactType: z.enum(['confidentiality', 'integrity', 'availability']),
 gravity: gravitySchema,
 linkedMissionIds: z.array(z.string()),
 linkedEssentialAssetIds: z.array(z.string()),
});

export const securityBaselineMeasureSchema = z.object({
 id: z.string().min(1),
 category: z.string(),
 name: z.string(),
 description: z.string().optional(),
 status: z.enum(['implemented', 'partial', 'not_implemented']),
 notes: z.string().optional(),
});

export const workshop1DataSchema = z.object({
 scope: z.object({
 description: z.string().optional(),
 missions: z.array(missionSchema),
 essentialAssets: z.array(essentialAssetSchema),
 supportingAssets: z.array(supportingAssetSchema),
 }),
 fearedEvents: z.array(fearedEventSchema),
 securityBaseline: z.object({
 totalMeasures: z.number(),
 implementedMeasures: z.number(),
 partialMeasures: z.number(),
 notImplementedMeasures: z.number(),
 maturityScore: z.number(),
 measures: z.array(securityBaselineMeasureSchema),
 }),
});

// ============================================================================
// Workshop 2 Schemas
// ============================================================================

export const srOvPairSchema = z.object({
 id: z.string().min(1),
 riskSourceId: z.string().min(1),
 targetedObjectiveId: z.string().min(1),
 relevance: z.number().int().min(1).max(4),
 justification: z.string().trim().max(2000).optional(),
 retainedForAnalysis: z.boolean(),
});

export const workshop2DataSchema = z.object({
 selectedRiskSources: z.array(z.object({
 id: z.string(),
 riskSourceId: z.string(),
 relevanceJustification: z.string().optional(),
 })),
 selectedTargetedObjectives: z.array(z.object({
 id: z.string(),
 targetedObjectiveId: z.string(),
 relevanceJustification: z.string().optional(),
 })),
 srOvPairs: z.array(srOvPairSchema),
});

// ============================================================================
// Workshop 3 Schemas
// ============================================================================

export const ecosystemPartySchema = z.object({
 id: z.string().min(1),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().max(2000).optional(),
 type: z.enum([
 'supplier',
 'partner',
 'customer',
 'regulator',
 'subcontractor',
 'cloud_provider',
 'software_vendor',
 'service_provider',
 'other',
 ]),
 category: z.enum(['internal', 'external']),
 trustLevel: trustLevelSchema,
 exposure: trustLevelSchema,
 cyberDependency: trustLevelSchema,
 penetration: trustLevelSchema,
 maturityLevel: z.number().optional(),
 position: z.object({
 x: z.number(),
 y: z.number(),
 }).optional(),
});

export const attackPathSchema = z.object({
 id: z.string().min(1),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().max(2000).optional(),
 sourcePartyId: z.string().min(1),
 targetAssetId: z.string().min(1),
 intermediatePartyIds: z.array(z.string()),
 likelihood: likelihoodSchema,
 complexity: likelihoodSchema,
});

export const strategicScenarioSchema = z.object({
 id: z.string().min(1),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().max(5000).optional(),
 srOvPairId: z.string().min(1),
 attackPathIds: z.array(z.string()),
 fearedEventIds: z.array(z.string()),
 gravity: gravitySchema,
 gravityJustification: z.string().trim().max(2000).optional(),
});

export const workshop3DataSchema = z.object({
 ecosystem: z.array(ecosystemPartySchema),
 attackPaths: z.array(attackPathSchema),
 strategicScenarios: z.array(strategicScenarioSchema),
});

// ============================================================================
// Workshop 4 Schemas
// ============================================================================

export const mitreReferenceSchema = z.object({
 tacticId: z.string(),
 tacticName: z.string(),
 techniqueId: z.string(),
 techniqueName: z.string(),
 subtechniqueId: z.string().optional(),
 subtechniqueName: z.string().optional(),
});

export const attackStepSchema = z.object({
 id: z.string().min(1),
 order: z.number().int().min(1),
 description: z.string().trim().min(2).max(2000),
 mitreReference: mitreReferenceSchema.optional(),
 targetAssetDescription: z.string().optional(),
 requiredCapability: z.string().optional(),
});

export const operationalScenarioSchema = z.object({
 id: z.string().min(1),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().max(5000).optional(),
 strategicScenarioId: z.string().min(1),
 attackSequence: z.array(attackStepSchema),
 likelihood: likelihoodSchema,
 likelihoodJustification: z.string().trim().max(2000).optional(),
 riskLevel: z.number(),
 linkedRiskId: z.string().optional(),
});

export const workshop4DataSchema = z.object({
 operationalScenarios: z.array(operationalScenarioSchema),
});

// ============================================================================
// Workshop 5 Schemas
// ============================================================================

export const treatmentPlanItemSchema = z.object({
 id: z.string().min(1),
 operationalScenarioId: z.string().min(1),
 strategy: z.enum(['accept', 'mitigate', 'transfer', 'avoid']),
 strategyJustification: z.string().trim().max(2000).optional(),
 selectedControlIds: z.array(z.string()),
 responsibleId: z.string().optional(),
 deadline: z.string().optional(),
 status: z.enum(['planned', 'in_progress', 'completed']),
});

export const residualRiskAssessmentSchema = z.object({
 id: z.string().min(1),
 operationalScenarioId: z.string().min(1),
 initialRiskLevel: z.number(),
 controlEffectiveness: z.number().min(0).max(100),
 residualRiskLevel: z.number(),
 acceptedBy: z.string().optional(),
 acceptanceDate: z.string().optional(),
 acceptanceJustification: z.string().optional(),
}).refine((data) => {
 // Residual risk must be <= initial risk
 return data.residualRiskLevel <= data.initialRiskLevel;
}, {
 message: i18n.t('ebios.validation.residualRiskTooHigh'),
 path: ['residualRiskLevel'],
});

export const workshop5DataSchema = z.object({
 treatmentPlan: z.array(treatmentPlanItemSchema),
 residualRisks: z.array(residualRiskAssessmentSchema),
});

// ============================================================================
// Main EBIOS Analysis Schema
// ============================================================================

export const ebiosAnalysisSchema = z.object({
 name: z.string().trim().min(3, i18n.t('validation.minLength', { min: 3 })).max(200),
 description: z.string().trim().max(5000).optional(),
 status: z.enum(EBIOS_ANALYSIS_STATUSES),
 targetCertificationDate: z.string().optional(),
 sector: z.string().optional(),
 contributesToGlobalScore: z.boolean().default(true),
});

export const createEbiosAnalysisSchema = ebiosAnalysisSchema.pick({
 name: true,
 description: true,
 targetCertificationDate: true,
 sector: true,
});

// ============================================================================
// Risk Source Library Schemas
// ============================================================================

export const riskSourceSchema = z.object({
 code: z.string().trim().min(1).max(20),
 category: z.enum(RISK_SOURCE_CATEGORIES),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().min(10).max(2000),
 motivation: z.string().trim().max(1000).optional(),
 resources: z.string().trim().max(500).optional(),
 isANSSIStandard: z.boolean().default(false),
});

export const targetedObjectiveSchema = z.object({
 code: z.string().trim().min(1).max(20),
 name: z.string().trim().min(2).max(200),
 description: z.string().trim().min(10).max(2000),
 impactType: z.enum(['confidentiality', 'integrity', 'availability']),
 isANSSIStandard: z.boolean().default(false),
});

// ============================================================================
// SMSI Program Schemas (ISO 27003)
// ============================================================================

export const smsiProgramSchema = z.object({
 name: z.string().trim().min(3).max(200),
 description: z.string().trim().max(5000).optional(),
 targetCertificationDate: z.string().optional(),
});

export const milestoneSchema = z.object({
 name: z.string().trim().min(3).max(200),
 description: z.string().trim().max(2000).optional(),
 phase: z.enum(PDCA_PHASES),
 dueDate: z.string(),
 responsibleId: z.string().optional(),
 linkedItems: z.array(z.object({
 type: z.enum(['ebios_analysis', 'risk', 'control', 'document', 'audit']),
 id: z.string(),
 name: z.string().optional(),
 })).optional(),
});

// ============================================================================
// Risk Context Schemas (ISO 27005)
// ============================================================================

export const riskContextSchema = z.object({
 businessContext: z.object({
 description: z.string().optional(),
 activities: z.array(z.string()),
 objectives: z.array(z.string()),
 criticalProcesses: z.array(z.string()),
 }),
 regulatoryContext: z.object({
 description: z.string().optional(),
 applicableRegulations: z.array(z.object({
 id: z.string(),
 name: z.string(),
 framework: z.string().optional(),
 obligations: z.string().optional(),
 deadline: z.string().optional(),
 })),
 }),
 riskAppetite: z.object({
 description: z.string().optional(),
 acceptableRiskLevels: z.object({
 low: z.number(),
 medium: z.number(),
 high: z.number(),
 critical: z.number(),
 }),
 escalationThresholds: z.object({
 automatic: z.number(),
 management: z.number(),
 board: z.number(),
 }),
 }),
 evaluationCriteria: z.object({
 impactScale: z.array(z.object({
 level: z.number(),
 name: z.string(),
 description: z.string(),
 criteria: z.array(z.string()).optional(),
 })),
 probabilityScale: z.array(z.object({
 level: z.number(),
 name: z.string(),
 description: z.string(),
 criteria: z.array(z.string()).optional(),
 })),
 }),
});

// ============================================================================
// Export Types
// ============================================================================

export type MissionFormData = z.infer<typeof missionSchema>;
export type EssentialAssetFormData = z.infer<typeof essentialAssetSchema>;
export type SupportingAssetFormData = z.infer<typeof supportingAssetSchema>;
export type FearedEventFormData = z.infer<typeof fearedEventSchema>;
export type SROVPairFormData = z.infer<typeof srOvPairSchema>;
export type EcosystemPartyFormData = z.infer<typeof ecosystemPartySchema>;
export type AttackPathFormData = z.infer<typeof attackPathSchema>;
export type StrategicScenarioFormData = z.infer<typeof strategicScenarioSchema>;
export type OperationalScenarioFormData = z.infer<typeof operationalScenarioSchema>;
export type TreatmentPlanItemFormData = z.infer<typeof treatmentPlanItemSchema>;
export type CreateEbiosAnalysisFormData = z.infer<typeof createEbiosAnalysisSchema>;
export type RiskSourceFormData = z.infer<typeof riskSourceSchema>;
export type TargetedObjectiveFormData = z.infer<typeof targetedObjectiveSchema>;
export type SMSIProgramFormData = z.infer<typeof smsiProgramSchema>;
export type MilestoneFormData = z.infer<typeof milestoneSchema>;
export type RiskContextFormData = z.infer<typeof riskContextSchema>;
