/**
 * EBIOS RM Test Factory
 * Creates mock EBIOS objects for testing
 *
 * Story: EBIOS RM Test Coverage
 */

import type {
 EbiosAnalysis,
 EbiosWorkshops,
 Workshop1Data,
 Workshop2Data,
 Workshop3Data,
 Workshop4Data,
 Workshop5Data,
 Mission,
 EssentialAsset,
 SupportingAsset,
 FearedEvent,
 SecurityBaseline,
 SecurityBaselineMeasure,
 SelectedRiskSource,
 SelectedTargetedObjective,
 SROVPair,
 EcosystemParty,
 AttackPath,
 StrategicScenario,
 OperationalScenario,
 AttackStep,
 TreatmentPlanItem,
 ResidualRiskAssessment,
 RiskSource,
 TargetedObjective,
 SMSIProgram,
 Milestone,
 PDCAPhase,
 RiskContext,
} from '../../types/ebios';
import {
 createDefaultWorkshop1Data,
 createDefaultEbiosWorkshops,
} from '../../types/ebios';

// ============================================================================
// Counters for unique IDs
// ============================================================================

let ebiosCounter = 0;
let missionCounter = 0;
let essentialAssetCounter = 0;
let supportingAssetCounter = 0;
let fearedEventCounter = 0;
let riskSourceCounter = 0;
let targetedObjectiveCounter = 0;
let pairCounter = 0;
let ecosystemPartyCounter = 0;
let attackPathCounter = 0;
let strategicScenarioCounter = 0;
let operationalScenarioCounter = 0;
let attackStepCounter = 0;
let treatmentPlanCounter = 0;
let residualRiskCounter = 0;
let milestoneCounter = 0;

// ============================================================================
// Reset Functions
// ============================================================================

export function resetEbiosCounters(): void {
 ebiosCounter = 0;
 missionCounter = 0;
 essentialAssetCounter = 0;
 supportingAssetCounter = 0;
 fearedEventCounter = 0;
 riskSourceCounter = 0;
 targetedObjectiveCounter = 0;
 pairCounter = 0;
 ecosystemPartyCounter = 0;
 attackPathCounter = 0;
 strategicScenarioCounter = 0;
 operationalScenarioCounter = 0;
 attackStepCounter = 0;
 treatmentPlanCounter = 0;
 residualRiskCounter = 0;
 milestoneCounter = 0;
}

// ============================================================================
// Mission Factory
// ============================================================================

export interface MissionFactoryOptions {
 id?: string;
 name?: string;
 description?: string;
 criticality?: 1 | 2 | 3 | 4;
 linkedAssetIds?: string[];
}

export function createMission(options: MissionFactoryOptions = {}): Mission {
 missionCounter++;
 return {
 id: options.id || `mission-${missionCounter}`,
 name: options.name || `Test Mission ${missionCounter}`,
 description: options.description || `Description for mission ${missionCounter}`,
 criticality: options.criticality || 3,
 linkedAssetIds: options.linkedAssetIds || [],
 };
}

export function createMissionList(count: number, options: MissionFactoryOptions = {}): Mission[] {
 return Array.from({ length: count }, () => createMission(options));
}

// ============================================================================
// Essential Asset Factory
// ============================================================================

export interface EssentialAssetFactoryOptions {
 id?: string;
 name?: string;
 description?: string;
 type?: EssentialAsset['type'];
 criticality?: 1 | 2 | 3 | 4;
 linkedMissionIds?: string[];
}

export function createEssentialAsset(options: EssentialAssetFactoryOptions = {}): EssentialAsset {
 essentialAssetCounter++;
 return {
 id: options.id || `essential-asset-${essentialAssetCounter}`,
 name: options.name || `Essential Asset ${essentialAssetCounter}`,
 description: options.description || `Description for essential asset ${essentialAssetCounter}`,
 type: options.type || 'information',
 criticality: options.criticality || 3,
 linkedMissionIds: options.linkedMissionIds || [],
 };
}

export function createEssentialAssetList(count: number, options: EssentialAssetFactoryOptions = {}): EssentialAsset[] {
 return Array.from({ length: count }, () => createEssentialAsset(options));
}

// ============================================================================
// Supporting Asset Factory
// ============================================================================

export interface SupportingAssetFactoryOptions {
 id?: string;
 name?: string;
 description?: string;
 type?: SupportingAsset['type'];
 linkedEssentialAssetIds?: string[];
 linkedAssetId?: string;
}

export function createSupportingAsset(options: SupportingAssetFactoryOptions = {}): SupportingAsset {
 supportingAssetCounter++;
 return {
 id: options.id || `supporting-asset-${supportingAssetCounter}`,
 name: options.name || `Supporting Asset ${supportingAssetCounter}`,
 description: options.description || `Description for supporting asset ${supportingAssetCounter}`,
 type: options.type || 'software',
 linkedEssentialAssetIds: options.linkedEssentialAssetIds || [],
 linkedAssetId: options.linkedAssetId,
 };
}

export function createSupportingAssetList(count: number, options: SupportingAssetFactoryOptions = {}): SupportingAsset[] {
 return Array.from({ length: count }, () => createSupportingAsset(options));
}

// ============================================================================
// Feared Event Factory
// ============================================================================

export interface FearedEventFactoryOptions {
 id?: string;
 name?: string;
 description?: string;
 impactType?: FearedEvent['impactType'];
 gravity?: 1 | 2 | 3 | 4;
 linkedMissionIds?: string[];
 linkedEssentialAssetIds?: string[];
}

export function createFearedEvent(options: FearedEventFactoryOptions = {}): FearedEvent {
 fearedEventCounter++;
 return {
 id: options.id || `feared-event-${fearedEventCounter}`,
 name: options.name || `Feared Event ${fearedEventCounter}`,
 description: options.description || `Description for feared event ${fearedEventCounter}`,
 impactType: options.impactType || 'confidentiality',
 gravity: options.gravity || 3,
 linkedMissionIds: options.linkedMissionIds || [],
 linkedEssentialAssetIds: options.linkedEssentialAssetIds || [],
 };
}

export function createFearedEventList(count: number, options: FearedEventFactoryOptions = {}): FearedEvent[] {
 return Array.from({ length: count }, () => createFearedEvent(options));
}

// ============================================================================
// Security Baseline Factory
// ============================================================================

export interface SecurityBaselineMeasureFactoryOptions {
 id?: string;
 category?: string;
 name?: string;
 description?: string;
 status?: SecurityBaselineMeasure['status'];
 notes?: string;
}

export function createSecurityBaselineMeasure(options: SecurityBaselineMeasureFactoryOptions = {}): SecurityBaselineMeasure {
 return {
 id: options.id || `measure-${Date.now()}-${Math.random().toString(36).substring(7)}`,
 category: options.category || 'Access Control',
 name: options.name || 'Test Security Measure',
 description: options.description || 'Test measure description',
 status: options.status || 'implemented',
 notes: options.notes,
 };
}

export function createSecurityBaseline(options: {
 totalMeasures?: number;
 implementedMeasures?: number;
 partialMeasures?: number;
 notImplementedMeasures?: number;
 maturityScore?: number;
 measures?: SecurityBaselineMeasure[];
} = {}): SecurityBaseline {
 const total = options.totalMeasures ?? 10;
 const implemented = options.implementedMeasures ?? 5;
 const partial = options.partialMeasures ?? 3;
 const notImplemented = options.notImplementedMeasures ?? 2;

 return {
 totalMeasures: total,
 implementedMeasures: implemented,
 partialMeasures: partial,
 notImplementedMeasures: notImplemented,
 maturityScore: options.maturityScore ?? Math.round((implemented / total) * 100),
 measures: options.measures || [],
 };
}

// ============================================================================
// Workshop 1 Data Factory
// ============================================================================

export interface Workshop1DataFactoryOptions {
 missionsCount?: number;
 essentialAssetsCount?: number;
 supportingAssetsCount?: number;
 fearedEventsCount?: number;
 includeBaseline?: boolean;
 scopeDescription?: string;
}

export function createWorkshop1Data(options: Workshop1DataFactoryOptions = {}): Workshop1Data {
 const missions = createMissionList(options.missionsCount ?? 2);
 const essentialAssets = createEssentialAssetList(options.essentialAssetsCount ?? 2);
 const supportingAssets = createSupportingAssetList(options.supportingAssetsCount ?? 3);
 const fearedEvents = createFearedEventList(options.fearedEventsCount ?? 2);

 return {
 scope: {
 description: options.scopeDescription || 'Test scope description',
 missions,
 essentialAssets,
 supportingAssets,
 },
 fearedEvents,
 securityBaseline: options.includeBaseline !== false
 ? createSecurityBaseline()
 : createDefaultWorkshop1Data().securityBaseline,
 };
}

// ============================================================================
// Risk Source Factory (Workshop 2)
// ============================================================================

export interface SelectedRiskSourceFactoryOptions {
 id?: string;
 riskSourceId?: string;
 relevanceJustification?: string;
}

export function createSelectedRiskSource(options: SelectedRiskSourceFactoryOptions = {}): SelectedRiskSource {
 riskSourceCounter++;
 return {
 id: options.id || `selected-rs-${riskSourceCounter}`,
 riskSourceId: options.riskSourceId || `SR-0${riskSourceCounter}`,
 relevanceJustification: options.relevanceJustification || `Justification for risk source ${riskSourceCounter}`,
 };
}

// ============================================================================
// Targeted Objective Factory (Workshop 2)
// ============================================================================

export interface SelectedTargetedObjectiveFactoryOptions {
 id?: string;
 targetedObjectiveId?: string;
 relevanceJustification?: string;
}

export function createSelectedTargetedObjective(options: SelectedTargetedObjectiveFactoryOptions = {}): SelectedTargetedObjective {
 targetedObjectiveCounter++;
 return {
 id: options.id || `selected-to-${targetedObjectiveCounter}`,
 targetedObjectiveId: options.targetedObjectiveId || `OV-C0${targetedObjectiveCounter}`,
 relevanceJustification: options.relevanceJustification || `Justification for objective ${targetedObjectiveCounter}`,
 };
}

// ============================================================================
// SR/OV Pair Factory (Workshop 2)
// ============================================================================

export interface SROVPairFactoryOptions {
 id?: string;
 riskSourceId?: string;
 targetedObjectiveId?: string;
 relevance?: 1 | 2 | 3 | 4;
 justification?: string;
 retainedForAnalysis?: boolean;
}

export function createSROVPair(options: SROVPairFactoryOptions = {}): SROVPair {
 pairCounter++;
 return {
 id: options.id || `srov-pair-${pairCounter}`,
 riskSourceId: options.riskSourceId || `SR-01`,
 targetedObjectiveId: options.targetedObjectiveId || `OV-C01`,
 relevance: options.relevance || 3,
 justification: options.justification || `Pair justification ${pairCounter}`,
 retainedForAnalysis: options.retainedForAnalysis ?? true,
 };
}

// ============================================================================
// Workshop 2 Data Factory
// ============================================================================

export interface Workshop2DataFactoryOptions {
 riskSourcesCount?: number;
 objectivesCount?: number;
 pairsCount?: number;
}

export function createWorkshop2Data(options: Workshop2DataFactoryOptions = {}): Workshop2Data {
 const riskSourcesCount = options.riskSourcesCount ?? 3;
 const objectivesCount = options.objectivesCount ?? 3;
 const pairsCount = options.pairsCount ?? 2;

 return {
 selectedRiskSources: Array.from({ length: riskSourcesCount }, () => createSelectedRiskSource()),
 selectedTargetedObjectives: Array.from({ length: objectivesCount }, () => createSelectedTargetedObjective()),
 srOvPairs: Array.from({ length: pairsCount }, () => createSROVPair()),
 };
}

// ============================================================================
// Ecosystem Party Factory (Workshop 3)
// ============================================================================

export interface EcosystemPartyFactoryOptions {
 id?: string;
 name?: string;
 description?: string;
 type?: EcosystemParty['type'];
 category?: 'internal' | 'external';
 trustLevel?: 1 | 2 | 3 | 4 | 5;
 exposure?: 1 | 2 | 3 | 4 | 5;
 cyberDependency?: 1 | 2 | 3 | 4 | 5;
 penetration?: 1 | 2 | 3 | 4 | 5;
 maturityLevel?: number;
 position?: { x: number; y: number };
}

export function createEcosystemParty(options: EcosystemPartyFactoryOptions = {}): EcosystemParty {
 ecosystemPartyCounter++;
 return {
 id: options.id || `eco-party-${ecosystemPartyCounter}`,
 name: options.name || `Ecosystem Party ${ecosystemPartyCounter}`,
 description: options.description || `Description for party ${ecosystemPartyCounter}`,
 type: options.type || 'supplier',
 category: options.category || 'external',
 trustLevel: options.trustLevel || 3,
 exposure: options.exposure || 3,
 cyberDependency: options.cyberDependency || 3,
 penetration: options.penetration || 2,
 maturityLevel: options.maturityLevel || 3,
 position: options.position,
 };
}

// ============================================================================
// Attack Path Factory (Workshop 3)
// ============================================================================

export interface AttackPathFactoryOptions {
 id?: string;
 name?: string;
 description?: string;
 sourcePartyId?: string;
 targetAssetId?: string;
 intermediatePartyIds?: string[];
 likelihood?: 1 | 2 | 3 | 4;
 complexity?: 1 | 2 | 3 | 4;
}

export function createAttackPath(options: AttackPathFactoryOptions = {}): AttackPath {
 attackPathCounter++;
 return {
 id: options.id || `attack-path-${attackPathCounter}`,
 name: options.name || `Attack Path ${attackPathCounter}`,
 description: options.description || `Description for attack path ${attackPathCounter}`,
 sourcePartyId: options.sourcePartyId || 'eco-party-1',
 targetAssetId: options.targetAssetId || 'supporting-asset-1',
 intermediatePartyIds: options.intermediatePartyIds || [],
 likelihood: options.likelihood || 3,
 complexity: options.complexity || 2,
 };
}

// ============================================================================
// Strategic Scenario Factory (Workshop 3)
// ============================================================================

export interface StrategicScenarioFactoryOptions {
 id?: string;
 name?: string;
 description?: string;
 srOvPairId?: string;
 attackPathIds?: string[];
 fearedEventIds?: string[];
 gravity?: 1 | 2 | 3 | 4;
 gravityJustification?: string;
}

export function createStrategicScenario(options: StrategicScenarioFactoryOptions = {}): StrategicScenario {
 strategicScenarioCounter++;
 return {
 id: options.id || `strategic-scenario-${strategicScenarioCounter}`,
 name: options.name || `Strategic Scenario ${strategicScenarioCounter}`,
 description: options.description || `Description for strategic scenario ${strategicScenarioCounter}`,
 srOvPairId: options.srOvPairId || 'srov-pair-1',
 attackPathIds: options.attackPathIds || [],
 fearedEventIds: options.fearedEventIds || [],
 gravity: options.gravity || 3,
 gravityJustification: options.gravityJustification || `Gravity justification ${strategicScenarioCounter}`,
 };
}

// ============================================================================
// Workshop 3 Data Factory
// ============================================================================

export interface Workshop3DataFactoryOptions {
 ecosystemCount?: number;
 attackPathsCount?: number;
 scenariosCount?: number;
}

export function createWorkshop3Data(options: Workshop3DataFactoryOptions = {}): Workshop3Data {
 return {
 ecosystem: Array.from({ length: options.ecosystemCount ?? 3 }, () => createEcosystemParty()),
 attackPaths: Array.from({ length: options.attackPathsCount ?? 2 }, () => createAttackPath()),
 strategicScenarios: Array.from({ length: options.scenariosCount ?? 2 }, () => createStrategicScenario()),
 };
}

// ============================================================================
// Attack Step Factory (Workshop 4)
// ============================================================================

export interface AttackStepFactoryOptions {
 id?: string;
 order?: number;
 description?: string;
 mitreReference?: {
 tacticId: string;
 tacticName: string;
 techniqueId: string;
 techniqueName: string;
 subtechniqueId?: string;
 subtechniqueName?: string;
 };
 targetAssetDescription?: string;
 requiredCapability?: string;
}

export function createAttackStep(options: AttackStepFactoryOptions = {}): AttackStep {
 attackStepCounter++;
 return {
 id: options.id || `attack-step-${attackStepCounter}`,
 order: options.order ?? attackStepCounter,
 description: options.description || `Attack step description ${attackStepCounter}`,
 mitreReference: options.mitreReference,
 targetAssetDescription: options.targetAssetDescription,
 requiredCapability: options.requiredCapability,
 };
}

// ============================================================================
// Operational Scenario Factory (Workshop 4)
// ============================================================================

export interface OperationalScenarioFactoryOptions {
 id?: string;
 code?: string;
 name?: string;
 description?: string;
 strategicScenarioId?: string;
 attackSequence?: AttackStep[];
 likelihood?: 1 | 2 | 3 | 4;
 likelihoodJustification?: string;
 riskLevel?: number;
 linkedRiskId?: string;
}

export function createOperationalScenario(options: OperationalScenarioFactoryOptions = {}): OperationalScenario {
 operationalScenarioCounter++;
 const likelihood = options.likelihood ?? 3;
 const gravity = 3; // Default gravity

 return {
 id: options.id || `op-scenario-${operationalScenarioCounter}`,
 code: options.code || `SO-${String(operationalScenarioCounter).padStart(3, '0')}`,
 name: options.name || `Operational Scenario ${operationalScenarioCounter}`,
 description: options.description || `Description for operational scenario ${operationalScenarioCounter}`,
 strategicScenarioId: options.strategicScenarioId || 'strategic-scenario-1',
 attackSequence: options.attackSequence || [createAttackStep()],
 likelihood,
 likelihoodJustification: options.likelihoodJustification || `Likelihood justification ${operationalScenarioCounter}`,
 riskLevel: options.riskLevel ?? (gravity * likelihood),
 linkedRiskId: options.linkedRiskId,
 };
}

// ============================================================================
// Workshop 4 Data Factory
// ============================================================================

export interface Workshop4DataFactoryOptions {
 scenariosCount?: number;
}

export function createWorkshop4Data(options: Workshop4DataFactoryOptions = {}): Workshop4Data {
 return {
 operationalScenarios: Array.from(
 { length: options.scenariosCount ?? 2 },
 () => createOperationalScenario()
 ),
 };
}

// ============================================================================
// Treatment Plan Factory (Workshop 5)
// ============================================================================

export interface TreatmentPlanFactoryOptions {
 id?: string;
 operationalScenarioId?: string;
 strategy?: TreatmentPlanItem['strategy'];
 strategyJustification?: string;
 selectedControlIds?: string[];
 responsibleId?: string;
 deadline?: string;
 status?: TreatmentPlanItem['status'];
}

export function createTreatmentPlanItem(options: TreatmentPlanFactoryOptions = {}): TreatmentPlanItem {
 treatmentPlanCounter++;
 return {
 id: options.id || `treatment-${treatmentPlanCounter}`,
 operationalScenarioId: options.operationalScenarioId || 'op-scenario-1',
 strategy: options.strategy || 'mitigate',
 strategyJustification: options.strategyJustification || `Treatment justification ${treatmentPlanCounter}`,
 selectedControlIds: options.selectedControlIds || ['5.1', '5.2', '5.3'],
 responsibleId: options.responsibleId || 'user-1',
 deadline: options.deadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
 status: options.status || 'planned',
 };
}

// ============================================================================
// Residual Risk Factory (Workshop 5)
// ============================================================================

export interface ResidualRiskFactoryOptions {
 id?: string;
 operationalScenarioId?: string;
 initialRiskLevel?: number;
 controlEffectiveness?: number;
 residualRiskLevel?: number;
 acceptedBy?: string;
 acceptanceDate?: string;
 acceptanceJustification?: string;
}

export function createResidualRisk(options: ResidualRiskFactoryOptions = {}): ResidualRiskAssessment {
 residualRiskCounter++;
 const initialRiskLevel = options.initialRiskLevel ?? 9;
 const effectiveness = options.controlEffectiveness ?? 60;
 const residual = options.residualRiskLevel ?? Math.round(initialRiskLevel * (1 - effectiveness / 100));

 return {
 id: options.id || `residual-risk-${residualRiskCounter}`,
 operationalScenarioId: options.operationalScenarioId || 'op-scenario-1',
 initialRiskLevel,
 controlEffectiveness: effectiveness,
 residualRiskLevel: residual,
 acceptedBy: options.acceptedBy,
 acceptanceDate: options.acceptanceDate,
 acceptanceJustification: options.acceptanceJustification,
 };
}

// ============================================================================
// Workshop 5 Data Factory
// ============================================================================

export interface Workshop5DataFactoryOptions {
 treatmentCount?: number;
 residualRisksCount?: number;
}

export function createWorkshop5Data(options: Workshop5DataFactoryOptions = {}): Workshop5Data {
 return {
 treatmentPlan: Array.from(
 { length: options.treatmentCount ?? 2 },
 () => createTreatmentPlanItem()
 ),
 residualRisks: Array.from(
 { length: options.residualRisksCount ?? 2 },
 () => createResidualRisk()
 ),
 };
}

// ============================================================================
// EBIOS Analysis Factory
// ============================================================================

export interface EbiosAnalysisFactoryOptions {
 id?: string;
 organizationId?: string;
 name?: string;
 description?: string;
 status?: EbiosAnalysis['status'];
 currentWorkshop?: 1 | 2 | 3 | 4 | 5;
 workshops?: Partial<EbiosWorkshops>;
 completionPercentage?: number;
 createdBy?: string;
 updatedBy?: string;
 targetCertificationDate?: string;
 sector?: string;
 contributesToGlobalScore?: boolean;
}

export function createEbiosAnalysis(options: EbiosAnalysisFactoryOptions = {}): EbiosAnalysis {
 ebiosCounter++;
 const now = new Date().toISOString();

 const defaultWorkshops = createDefaultEbiosWorkshops();

 return {
 id: options.id || `ebios-${ebiosCounter}`,
 organizationId: options.organizationId || 'org-test',
 name: options.name || `EBIOS Analysis ${ebiosCounter}`,
 description: options.description || `Test EBIOS analysis ${ebiosCounter}`,
 status: options.status || 'draft',
 currentWorkshop: options.currentWorkshop || 1,
 workshops: options.workshops
 ? { ...defaultWorkshops, ...options.workshops }
 : defaultWorkshops,
 completionPercentage: options.completionPercentage || 0,
 createdAt: now,
 createdBy: options.createdBy || 'user-test',
 updatedAt: now,
 updatedBy: options.updatedBy || 'user-test',
 targetCertificationDate: options.targetCertificationDate,
 sector: options.sector,
 contributesToGlobalScore: options.contributesToGlobalScore ?? true,
 };
}

export function createCompletedEbiosAnalysis(options: EbiosAnalysisFactoryOptions = {}): EbiosAnalysis {
 return createEbiosAnalysis({
 ...options,
 status: 'completed',
 currentWorkshop: 5,
 completionPercentage: 100,
 workshops: {
 1: { status: 'validated', data: createWorkshop1Data(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
 2: { status: 'validated', data: createWorkshop2Data(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
 3: { status: 'validated', data: createWorkshop3Data(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
 4: { status: 'validated', data: createWorkshop4Data(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
 5: { status: 'validated', data: createWorkshop5Data(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
 },
 });
}

export function createInProgressEbiosAnalysis(
 currentWorkshop: 1 | 2 | 3 | 4 | 5,
 options: EbiosAnalysisFactoryOptions = {}
): EbiosAnalysis {
 const workshops = createDefaultEbiosWorkshops();

 // Mark previous workshops as completed
 for (let i = 1; i < currentWorkshop; i++) {
 const workshopNum = i as 1 | 2 | 3 | 4 | 5;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 (workshops[workshopNum] as any) = {
 ...workshops[workshopNum],
 status: 'completed',
 startedAt: new Date().toISOString(),
 completedAt: new Date().toISOString(),
 };
 }

 // Mark current workshop as in progress
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 (workshops[currentWorkshop] as any) = {
 ...workshops[currentWorkshop],
 status: 'in_progress',
 startedAt: new Date().toISOString(),
 };

 return createEbiosAnalysis({
 ...options,
 status: 'in_progress',
 currentWorkshop,
 workshops,
 });
}

// ============================================================================
// Risk Source Library Factory
// ============================================================================

export interface RiskSourceFactoryOptions {
 id?: string;
 code?: string;
 category?: RiskSource['category'];
 name?: string;
 description?: string;
 motivation?: string;
 resources?: string;
 isANSSIStandard?: boolean;
 organizationId?: string | null;
}

export function createRiskSource(options: RiskSourceFactoryOptions = {}): RiskSource {
 riskSourceCounter++;
 return {
 id: options.id || `rs-${riskSourceCounter}`,
 code: options.code || `SR-${String(riskSourceCounter).padStart(2, '0')}`,
 category: options.category || 'organized_crime',
 name: options.name || `Risk Source ${riskSourceCounter}`,
 description: options.description || `Description for risk source ${riskSourceCounter}`,
 motivation: options.motivation || `Motivation ${riskSourceCounter}`,
 resources: options.resources || 'Medium resources',
 isANSSIStandard: options.isANSSIStandard ?? true,
 organizationId: options.organizationId ?? null,
 createdAt: new Date().toISOString(),
 };
}

// ============================================================================
// Targeted Objective Library Factory
// ============================================================================

export interface TargetedObjectiveFactoryOptions {
 id?: string;
 code?: string;
 name?: string;
 description?: string;
 impactType?: TargetedObjective['impactType'];
 isANSSIStandard?: boolean;
 organizationId?: string | null;
}

export function createTargetedObjective(options: TargetedObjectiveFactoryOptions = {}): TargetedObjective {
 targetedObjectiveCounter++;
 return {
 id: options.id || `to-${targetedObjectiveCounter}`,
 code: options.code || `OV-C${String(targetedObjectiveCounter).padStart(2, '0')}`,
 name: options.name || `Targeted Objective ${targetedObjectiveCounter}`,
 description: options.description || `Description for targeted objective ${targetedObjectiveCounter}`,
 impactType: options.impactType || 'confidentiality',
 isANSSIStandard: options.isANSSIStandard ?? true,
 organizationId: options.organizationId ?? null,
 createdAt: new Date().toISOString(),
 };
}

// ============================================================================
// SMSI Program Factory
// ============================================================================

export interface SMSIProgramFactoryOptions {
 id?: string;
 organizationId?: string;
 name?: string;
 description?: string;
 targetCertificationDate?: string;
 currentPhase?: PDCAPhase;
 overallProgress?: number;
 status?: SMSIProgram['status'];
 createdBy?: string;
}

export function createSMSIProgram(options: SMSIProgramFactoryOptions = {}): SMSIProgram {
 const now = new Date().toISOString();

 return {
 id: options.id || 'current',
 organizationId: options.organizationId || 'org-test',
 name: options.name || 'Test SMSI Program',
 description: options.description || 'Test SMSI program description',
 targetCertificationDate: options.targetCertificationDate,
 currentPhase: options.currentPhase || 'plan',
 phases: {
 plan: { status: 'in_progress', progress: 50 },
 do: { status: 'not_started', progress: 0 },
 check: { status: 'not_started', progress: 0 },
 act: { status: 'not_started', progress: 0 },
 },
 overallProgress: options.overallProgress || 25,
 status: options.status || 'active',
 createdAt: now,
 updatedAt: now,
 createdBy: options.createdBy || 'user-test',
 };
}

// ============================================================================
// Milestone Factory
// ============================================================================

export interface MilestoneFactoryOptions {
 id?: string;
 programId?: string;
 organizationId?: string;
 name?: string;
 description?: string;
 phase?: PDCAPhase;
 dueDate?: string;
 completedAt?: string;
 status?: Milestone['status'];
 responsibleId?: string;
 linkedItems?: Milestone['linkedItems'];
}

export function createMilestone(options: MilestoneFactoryOptions = {}): Milestone {
 milestoneCounter++;
 const now = new Date();
 const dueDate = options.dueDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

 return {
 id: options.id || `milestone-${milestoneCounter}`,
 programId: options.programId || 'current',
 organizationId: options.organizationId || 'org-test',
 name: options.name || `Milestone ${milestoneCounter}`,
 description: options.description || `Description for milestone ${milestoneCounter}`,
 phase: options.phase || 'plan',
 dueDate,
 completedAt: options.completedAt,
 status: options.status || 'pending',
 responsibleId: options.responsibleId || 'user-1',
 linkedItems: options.linkedItems || [],
 createdAt: now.toISOString(),
 };
}

export function createMilestoneList(count: number, options: MilestoneFactoryOptions = {}): Milestone[] {
 return Array.from({ length: count }, () => createMilestone(options));
}

// ============================================================================
// Risk Context Factory
// ============================================================================

export interface RiskContextFactoryOptions {
 id?: string;
 organizationId?: string;
 businessContext?: RiskContext['businessContext'];
 regulatoryContext?: RiskContext['regulatoryContext'];
 riskAppetite?: RiskContext['riskAppetite'];
 evaluationCriteria?: RiskContext['evaluationCriteria'];
}

export function createRiskContext(options: RiskContextFactoryOptions = {}): RiskContext {
 const now = new Date().toISOString();

 return {
 id: options.id || 'current',
 organizationId: options.organizationId || 'org-test',
 businessContext: options.businessContext || {
 description: 'Test business context',
 activities: ['Activity 1', 'Activity 2'],
 objectives: ['Objective 1', 'Objective 2'],
 criticalProcesses: ['Process 1', 'Process 2'],
 },
 regulatoryContext: options.regulatoryContext || {
 description: 'Test regulatory context',
 applicableRegulations: [
 { id: 'reg-1', name: 'GDPR', framework: 'EU' },
 { id: 'reg-2', name: 'NIS2', framework: 'EU' },
 ],
 },
 riskAppetite: options.riskAppetite || {
 description: 'Test risk appetite',
 acceptableRiskLevels: { low: 4, medium: 8, high: 12, critical: 16 },
 escalationThresholds: { automatic: 4, management: 8, board: 12 },
 },
 evaluationCriteria: options.evaluationCriteria || {
 impactScale: [
 { level: 1, name: 'Negligible', description: 'Minor impact' },
 { level: 2, name: 'Limited', description: 'Limited impact' },
 { level: 3, name: 'Important', description: 'Significant impact' },
 { level: 4, name: 'Critical', description: 'Critical impact' },
 ],
 probabilityScale: [
 { level: 1, name: 'Minimal', description: 'Very unlikely' },
 { level: 2, name: 'Significant', description: 'Unlikely' },
 { level: 3, name: 'High', description: 'Likely' },
 { level: 4, name: 'Maximum', description: 'Very likely' },
 ],
 },
 createdAt: now,
 updatedAt: now,
 };
}
