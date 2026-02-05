/**
 * EBIOS Types Tests
 * Tests for EBIOS RM type functions and utilities
 *
 * Story: EBIOS RM Test Coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
 EBIOS_WORKSHOP_STATUSES,
 EBIOS_ANALYSIS_STATUSES,
 VALID_WORKSHOP_TRANSITIONS,
 isValidWorkshopTransition,
 canProceedToWorkshop,
 createDefaultWorkshop1Data,
 createDefaultWorkshop2Data,
 createDefaultWorkshop3Data,
 createDefaultWorkshop4Data,
 createDefaultWorkshop5Data,
 createDefaultEbiosWorkshops,
 WORKSHOP_WEIGHTS,
 calculateWorkshopProgress,
 calculateEbiosCompletionPercentage,
 type EbiosWorkshops,
 type EbiosWorkshopNumber,
 type EbiosWorkshopStatus,
} from '../ebios';
import {
 resetEbiosCounters,
} from '../../tests/factories/ebiosFactory';

describe('EBIOS Types', () => {
 beforeEach(() => {
 resetEbiosCounters();
 });

 // ============================================================================
 // Workshop Status Constants Tests
 // ============================================================================

 describe('EBIOS_WORKSHOP_STATUSES', () => {
 it('should contain all 4 workshop statuses', () => {
 expect(EBIOS_WORKSHOP_STATUSES).toHaveLength(4);
 });

 it('should include not_started, in_progress, completed, validated', () => {
 expect(EBIOS_WORKSHOP_STATUSES).toContain('not_started');
 expect(EBIOS_WORKSHOP_STATUSES).toContain('in_progress');
 expect(EBIOS_WORKSHOP_STATUSES).toContain('completed');
 expect(EBIOS_WORKSHOP_STATUSES).toContain('validated');
 });
 });

 describe('EBIOS_ANALYSIS_STATUSES', () => {
 it('should contain all 4 analysis statuses', () => {
 expect(EBIOS_ANALYSIS_STATUSES).toHaveLength(4);
 });

 it('should include draft, in_progress, completed, archived', () => {
 expect(EBIOS_ANALYSIS_STATUSES).toContain('draft');
 expect(EBIOS_ANALYSIS_STATUSES).toContain('in_progress');
 expect(EBIOS_ANALYSIS_STATUSES).toContain('completed');
 expect(EBIOS_ANALYSIS_STATUSES).toContain('archived');
 });
 });

 // ============================================================================
 // Workshop Transitions Tests
 // ============================================================================

 describe('VALID_WORKSHOP_TRANSITIONS', () => {
 it('should define transitions for all 5 workshops', () => {
 expect(VALID_WORKSHOP_TRANSITIONS[1]).toBeDefined();
 expect(VALID_WORKSHOP_TRANSITIONS[2]).toBeDefined();
 expect(VALID_WORKSHOP_TRANSITIONS[3]).toBeDefined();
 expect(VALID_WORKSHOP_TRANSITIONS[4]).toBeDefined();
 expect(VALID_WORKSHOP_TRANSITIONS[5]).toBeDefined();
 });

 it('should allow workshop 1 to go only to 2', () => {
 expect(VALID_WORKSHOP_TRANSITIONS[1]).toEqual([2]);
 });

 it('should allow workshop 2 to go to 1 or 3', () => {
 expect(VALID_WORKSHOP_TRANSITIONS[2]).toContain(1);
 expect(VALID_WORKSHOP_TRANSITIONS[2]).toContain(3);
 });

 it('should allow workshop 3 to go to 2 or 4', () => {
 expect(VALID_WORKSHOP_TRANSITIONS[3]).toContain(2);
 expect(VALID_WORKSHOP_TRANSITIONS[3]).toContain(4);
 });

 it('should allow workshop 4 to go to 3 or 5', () => {
 expect(VALID_WORKSHOP_TRANSITIONS[4]).toContain(3);
 expect(VALID_WORKSHOP_TRANSITIONS[4]).toContain(5);
 });

 it('should allow workshop 5 to go only to 4', () => {
 expect(VALID_WORKSHOP_TRANSITIONS[5]).toEqual([4]);
 });
 });

 describe('isValidWorkshopTransition', () => {
 it('should return true for valid forward transition from workshop 1', () => {
 expect(isValidWorkshopTransition(1, 2)).toBe(true);
 });

 it('should return true for valid backward transition from workshop 2', () => {
 expect(isValidWorkshopTransition(2, 1)).toBe(true);
 });

 it('should return true for valid forward transition from workshop 2', () => {
 expect(isValidWorkshopTransition(2, 3)).toBe(true);
 });

 it('should return false for skipping workshops', () => {
 expect(isValidWorkshopTransition(1, 3)).toBe(false);
 expect(isValidWorkshopTransition(1, 4)).toBe(false);
 expect(isValidWorkshopTransition(1, 5)).toBe(false);
 expect(isValidWorkshopTransition(2, 4)).toBe(false);
 });

 it('should return false for same workshop transition', () => {
 expect(isValidWorkshopTransition(1, 1)).toBe(false);
 expect(isValidWorkshopTransition(3, 3)).toBe(false);
 });

 it('should return false for workshop 5 going forward', () => {
 expect(isValidWorkshopTransition(5, 4)).toBe(true);
 // @ts-expect-error - Testing invalid workshop number
 expect(isValidWorkshopTransition(5, 6)).toBe(false);
 });

 it('should return false for workshop 1 going backward', () => {
 // @ts-expect-error - Testing invalid workshop number
 expect(isValidWorkshopTransition(1, 0)).toBe(false);
 });
 });

 describe('canProceedToWorkshop', () => {
 const createWorkshopsWithStatus = (
 statuses: Record<EbiosWorkshopNumber, EbiosWorkshopStatus>
 ): EbiosWorkshops => {
 const workshops = createDefaultEbiosWorkshops();
 (Object.entries(statuses) as [string, EbiosWorkshopStatus][]).forEach(
 ([num, status]) => {
 workshops[Number(num) as EbiosWorkshopNumber].status = status;
 }
 );
 return workshops;
 };

 it('should always allow proceeding to workshop 1', () => {
 const workshops = createWorkshopsWithStatus({
 1: 'not_started',
 2: 'not_started',
 3: 'not_started',
 4: 'not_started',
 5: 'not_started',
 });
 expect(canProceedToWorkshop(workshops, 1)).toBe(true);
 });

 it('should allow proceeding to workshop 2 when workshop 1 is completed', () => {
 const workshops = createWorkshopsWithStatus({
 1: 'completed',
 2: 'not_started',
 3: 'not_started',
 4: 'not_started',
 5: 'not_started',
 });
 expect(canProceedToWorkshop(workshops, 2)).toBe(true);
 });

 it('should allow proceeding to workshop 2 when workshop 1 is validated', () => {
 const workshops = createWorkshopsWithStatus({
 1: 'validated',
 2: 'not_started',
 3: 'not_started',
 4: 'not_started',
 5: 'not_started',
 });
 expect(canProceedToWorkshop(workshops, 2)).toBe(true);
 });

 it('should not allow proceeding to workshop 2 when workshop 1 is in_progress', () => {
 const workshops = createWorkshopsWithStatus({
 1: 'in_progress',
 2: 'not_started',
 3: 'not_started',
 4: 'not_started',
 5: 'not_started',
 });
 expect(canProceedToWorkshop(workshops, 2)).toBe(false);
 });

 it('should not allow proceeding to workshop 2 when workshop 1 is not_started', () => {
 const workshops = createWorkshopsWithStatus({
 1: 'not_started',
 2: 'not_started',
 3: 'not_started',
 4: 'not_started',
 5: 'not_started',
 });
 expect(canProceedToWorkshop(workshops, 2)).toBe(false);
 });

 it('should allow proceeding to workshop 5 when workshop 4 is completed', () => {
 const workshops = createWorkshopsWithStatus({
 1: 'validated',
 2: 'validated',
 3: 'validated',
 4: 'completed',
 5: 'not_started',
 });
 expect(canProceedToWorkshop(workshops, 5)).toBe(true);
 });

 it('should not allow skipping workshops', () => {
 const workshops = createWorkshopsWithStatus({
 1: 'completed',
 2: 'not_started',
 3: 'not_started',
 4: 'not_started',
 5: 'not_started',
 });
 expect(canProceedToWorkshop(workshops, 3)).toBe(false);
 expect(canProceedToWorkshop(workshops, 4)).toBe(false);
 expect(canProceedToWorkshop(workshops, 5)).toBe(false);
 });
 });

 // ============================================================================
 // Default Data Factories Tests
 // ============================================================================

 describe('createDefaultWorkshop1Data', () => {
 it('should create workshop 1 data with empty collections', () => {
 const data = createDefaultWorkshop1Data();

 expect(data.scope.missions).toEqual([]);
 expect(data.scope.essentialAssets).toEqual([]);
 expect(data.scope.supportingAssets).toEqual([]);
 expect(data.fearedEvents).toEqual([]);
 });

 it('should create workshop 1 data with initialized security baseline', () => {
 const data = createDefaultWorkshop1Data();

 expect(data.securityBaseline).toBeDefined();
 expect(data.securityBaseline.totalMeasures).toBe(0);
 expect(data.securityBaseline.implementedMeasures).toBe(0);
 expect(data.securityBaseline.partialMeasures).toBe(0);
 expect(data.securityBaseline.notImplementedMeasures).toBe(0);
 expect(data.securityBaseline.maturityScore).toBe(0);
 expect(data.securityBaseline.measures).toEqual([]);
 });
 });

 describe('createDefaultWorkshop2Data', () => {
 it('should create workshop 2 data with empty collections', () => {
 const data = createDefaultWorkshop2Data();

 expect(data.selectedRiskSources).toEqual([]);
 expect(data.selectedTargetedObjectives).toEqual([]);
 expect(data.srOvPairs).toEqual([]);
 });
 });

 describe('createDefaultWorkshop3Data', () => {
 it('should create workshop 3 data with empty collections', () => {
 const data = createDefaultWorkshop3Data();

 expect(data.ecosystem).toEqual([]);
 expect(data.attackPaths).toEqual([]);
 expect(data.strategicScenarios).toEqual([]);
 });
 });

 describe('createDefaultWorkshop4Data', () => {
 it('should create workshop 4 data with empty collections', () => {
 const data = createDefaultWorkshop4Data();

 expect(data.operationalScenarios).toEqual([]);
 });
 });

 describe('createDefaultWorkshop5Data', () => {
 it('should create workshop 5 data with empty collections', () => {
 const data = createDefaultWorkshop5Data();

 expect(data.treatmentPlan).toEqual([]);
 expect(data.residualRisks).toEqual([]);
 });
 });

 describe('createDefaultEbiosWorkshops', () => {
 it('should create all 5 workshops', () => {
 const workshops = createDefaultEbiosWorkshops();

 expect(workshops[1]).toBeDefined();
 expect(workshops[2]).toBeDefined();
 expect(workshops[3]).toBeDefined();
 expect(workshops[4]).toBeDefined();
 expect(workshops[5]).toBeDefined();
 });

 it('should set all workshops to not_started', () => {
 const workshops = createDefaultEbiosWorkshops();

 expect(workshops[1].status).toBe('not_started');
 expect(workshops[2].status).toBe('not_started');
 expect(workshops[3].status).toBe('not_started');
 expect(workshops[4].status).toBe('not_started');
 expect(workshops[5].status).toBe('not_started');
 });

 it('should create with correct default data types', () => {
 const workshops = createDefaultEbiosWorkshops();

 expect(workshops[1].data.scope).toBeDefined();
 expect(workshops[2].data.selectedRiskSources).toBeDefined();
 expect(workshops[3].data.ecosystem).toBeDefined();
 expect(workshops[4].data.operationalScenarios).toBeDefined();
 expect(workshops[5].data.treatmentPlan).toBeDefined();
 });
 });

 // ============================================================================
 // Workshop Weights Tests
 // ============================================================================

 describe('WORKSHOP_WEIGHTS', () => {
 it('should define weights for all 5 workshops', () => {
 expect(WORKSHOP_WEIGHTS[1]).toBeDefined();
 expect(WORKSHOP_WEIGHTS[2]).toBeDefined();
 expect(WORKSHOP_WEIGHTS[3]).toBeDefined();
 expect(WORKSHOP_WEIGHTS[4]).toBeDefined();
 expect(WORKSHOP_WEIGHTS[5]).toBeDefined();
 });

 it('should have weights summing to 1', () => {
 const totalWeight =
 WORKSHOP_WEIGHTS[1] +
 WORKSHOP_WEIGHTS[2] +
 WORKSHOP_WEIGHTS[3] +
 WORKSHOP_WEIGHTS[4] +
 WORKSHOP_WEIGHTS[5];
 expect(totalWeight).toBeCloseTo(1, 10);
 });

 it('should have heavier weights for later workshops', () => {
 expect(WORKSHOP_WEIGHTS[4]).toBeGreaterThan(WORKSHOP_WEIGHTS[1]);
 expect(WORKSHOP_WEIGHTS[5]).toBeGreaterThan(WORKSHOP_WEIGHTS[2]);
 });
 });

 // ============================================================================
 // Progress Calculation Tests
 // ============================================================================

 describe('calculateWorkshopProgress', () => {
 it('should return 0 for not_started', () => {
 const workshop = { status: 'not_started' as const, data: {} };
 expect(calculateWorkshopProgress(workshop)).toBe(0);
 });

 it('should return 50 for in_progress', () => {
 const workshop = { status: 'in_progress' as const, data: {} };
 expect(calculateWorkshopProgress(workshop)).toBe(50);
 });

 it('should return 90 for completed', () => {
 const workshop = { status: 'completed' as const, data: {} };
 expect(calculateWorkshopProgress(workshop)).toBe(90);
 });

 it('should return 100 for validated', () => {
 const workshop = { status: 'validated' as const, data: {} };
 expect(calculateWorkshopProgress(workshop)).toBe(100);
 });
 });

 describe('calculateEbiosCompletionPercentage', () => {
 it('should return 0 for all workshops not_started', () => {
 const workshops = createDefaultEbiosWorkshops();
 expect(calculateEbiosCompletionPercentage(workshops)).toBe(0);
 });

 it('should return 100 for all workshops validated', () => {
 const workshops = createDefaultEbiosWorkshops();
 workshops[1].status = 'validated';
 workshops[2].status = 'validated';
 workshops[3].status = 'validated';
 workshops[4].status = 'validated';
 workshops[5].status = 'validated';

 expect(calculateEbiosCompletionPercentage(workshops)).toBe(100);
 });

 it('should return weighted percentage for mixed statuses', () => {
 const workshops = createDefaultEbiosWorkshops();
 workshops[1].status = 'validated'; // 100 * 0.15 = 15
 workshops[2].status = 'completed'; // 90 * 0.15 = 13.5
 workshops[3].status = 'in_progress'; // 50 * 0.20 = 10
 workshops[4].status = 'not_started'; // 0
 workshops[5].status = 'not_started'; // 0

 const result = calculateEbiosCompletionPercentage(workshops);
 // 15 + 13.5 + 10 = 38.5, rounded = 39
 expect(result).toBeGreaterThan(30);
 expect(result).toBeLessThan(50);
 });

 it('should return 90 for all workshops completed but not validated', () => {
 const workshops = createDefaultEbiosWorkshops();
 workshops[1].status = 'completed';
 workshops[2].status = 'completed';
 workshops[3].status = 'completed';
 workshops[4].status = 'completed';
 workshops[5].status = 'completed';

 expect(calculateEbiosCompletionPercentage(workshops)).toBe(90);
 });

 it('should respect workshop weights in calculation', () => {
 const workshops1 = createDefaultEbiosWorkshops();
 workshops1[1].status = 'validated'; // Weight: 0.15

 const workshops4 = createDefaultEbiosWorkshops();
 workshops4[4].status = 'validated'; // Weight: 0.25

 const result1 = calculateEbiosCompletionPercentage(workshops1);
 const result4 = calculateEbiosCompletionPercentage(workshops4);

 // Workshop 4 has higher weight, so completing it should give higher percentage
 expect(result4).toBeGreaterThan(result1);
 });

 it('should round the result', () => {
 const workshops = createDefaultEbiosWorkshops();
 workshops[1].status = 'in_progress'; // 50 * 0.15 = 7.5

 const result = calculateEbiosCompletionPercentage(workshops);
 expect(Number.isInteger(result)).toBe(true);
 });
 });
});
