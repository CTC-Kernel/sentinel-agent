/**
 * Tests for riskUtils.ts utilities
 * Story 3.2: Risk Evaluation Matrix
 *
 * Tests:
 * - getRiskLevel function
 * - getSLAStatus function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
 getRiskLevel,
 getSLAStatus,
 calculateMitigationPercentage,
 calculateSuggestedResidualRisk,
 CONTROL_STATUS_WEIGHTS
} from '../riskUtils';
import { Risk, Control } from '../../types';

describe('getRiskLevel', () => {
 describe('Low risk (< 5)', () => {
 it('should return Faible for scores < 5', () => {
 expect(getRiskLevel(1).label).toBe('Faible');
 expect(getRiskLevel(4).label).toBe('Faible');
 });

 it('should have success status', () => {
 expect(getRiskLevel(4).status).toBe('success');
 });
 });

 describe('Medium risk (5-9)', () => {
 it('should return Moyen for scores 5-9', () => {
 expect(getRiskLevel(5).label).toBe('Moyen');
 expect(getRiskLevel(7).label).toBe('Moyen');
 expect(getRiskLevel(9).label).toBe('Moyen');
 });

 it('should have info status', () => {
 expect(getRiskLevel(7).status).toBe('info');
 });
 });

 describe('High risk (10-14)', () => {
 it('should return Élevé for scores 10-14', () => {
 expect(getRiskLevel(10).label).toBe('Élevé');
 expect(getRiskLevel(12).label).toBe('Élevé');
 expect(getRiskLevel(14).label).toBe('Élevé');
 });

 it('should have warning status', () => {
 expect(getRiskLevel(10).status).toBe('warning');
 });
 });

 describe('Critical risk (>= 15)', () => {
 it('should return Critique for scores >= 15', () => {
 expect(getRiskLevel(15).label).toBe('Critique');
 expect(getRiskLevel(20).label).toBe('Critique');
 expect(getRiskLevel(25).label).toBe('Critique');
 });

 it('should have error status', () => {
 expect(getRiskLevel(20).status).toBe('error');
 });
 });

 describe('boundary values', () => {
 it('should correctly classify at boundaries', () => {
 expect(getRiskLevel(4).label).toBe('Faible');
 expect(getRiskLevel(5).label).toBe('Moyen');
 expect(getRiskLevel(9).label).toBe('Moyen');
 expect(getRiskLevel(10).label).toBe('Élevé');
 expect(getRiskLevel(14).label).toBe('Élevé');
 expect(getRiskLevel(15).label).toBe('Critique');
 });
 });
});

describe('getSLAStatus', () => {
 const createRisk = (overrides: Partial<Risk> = {}): Risk => ({
 id: 'risk-1',
 organizationId: 'org-1',
 assetId: 'asset-1',
 threat: 'Test threat',
 vulnerability: 'Test vulnerability',
 impact: 3,
 probability: 3,
 score: 9,
 status: 'Ouvert' as const,
 strategy: 'Atténuer' as const,
 owner: 'owner-1',
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 ...overrides
 });

 beforeEach(() => {
 vi.useFakeTimers();
 vi.setSystemTime(new Date('2026-01-11'));
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 describe('null cases', () => {
 it('should return null if strategy is Accepter', () => {
 const risk = createRisk({ strategy: 'Accepter' as const, treatmentDeadline: '2026-01-15' });
 expect(getSLAStatus(risk)).toBeNull();
 });

 it('should return null if no treatment deadline', () => {
 const risk = createRisk({ treatmentDeadline: undefined });
 expect(getSLAStatus(risk)).toBeNull();
 });

 it('should return null if risk is closed', () => {
 const risk = createRisk({ status: 'Fermé' as const, treatmentDeadline: '2026-01-15' });
 expect(getSLAStatus(risk)).toBeNull();
 });
 });

 describe('overdue status', () => {
 it('should return overdue when deadline has passed', () => {
 const risk = createRisk({ treatmentDeadline: '2026-01-08' }); // 3 days ago
 const result = getSLAStatus(risk);

 expect(result).not.toBeNull();
 expect(result!.status).toBe('overdue');
 expect(result!.days).toBe(3);
 expect(result!.label).toBe('Retard 3j');
 });

 it('should have red color styling', () => {
 const risk = createRisk({ treatmentDeadline: '2026-01-08' });
 const result = getSLAStatus(risk);

 expect(result!.color).toContain('text-red');
 });
 });

 describe('warning status', () => {
 it('should return warning when deadline is within 7 days', () => {
 const risk = createRisk({ treatmentDeadline: '2026-01-15' }); // 4 days from now
 const result = getSLAStatus(risk);

 expect(result).not.toBeNull();
 expect(result!.status).toBe('warning');
 expect(result!.days).toBe(4);
 expect(result!.label).toBe('J-4');
 });

 it('should include 7 days as warning', () => {
 const risk = createRisk({ treatmentDeadline: '2026-01-18' }); // 7 days from now
 const result = getSLAStatus(risk);

 expect(result!.status).toBe('warning');
 });

 it('should have orange color styling', () => {
 const risk = createRisk({ treatmentDeadline: '2026-01-15' });
 const result = getSLAStatus(risk);

 expect(result!.color).toContain('text-orange');
 });
 });

 describe('ok status', () => {
 it('should return ok when deadline is more than 7 days away', () => {
 const risk = createRisk({ treatmentDeadline: '2026-01-25' }); // 14 days from now
 const result = getSLAStatus(risk);

 expect(result).not.toBeNull();
 expect(result!.status).toBe('ok');
 expect(result!.days).toBe(14);
 expect(result!.label).toBe('14j');
 });

 it('should have muted color styling for ok status', () => {
 const risk = createRisk({ treatmentDeadline: '2026-01-25' });
 const result = getSLAStatus(risk);

 expect(result!.color).toContain('text-muted-foreground');
 });
 });
});

describe('CONTROL_STATUS_WEIGHTS', () => {
 it('should have correct weights for implemented statuses', () => {
 expect(CONTROL_STATUS_WEIGHTS['Implémenté']).toBe(1.0);
 expect(CONTROL_STATUS_WEIGHTS['Actif']).toBe(1.0);
 });

 it('should have correct weights for partial statuses', () => {
 expect(CONTROL_STATUS_WEIGHTS['Partiel']).toBe(0.5);
 expect(CONTROL_STATUS_WEIGHTS['En cours']).toBe(0.3);
 expect(CONTROL_STATUS_WEIGHTS['En revue']).toBe(0.2);
 });

 it('should have zero weight for non-implemented statuses', () => {
 expect(CONTROL_STATUS_WEIGHTS['Non applicable']).toBe(0);
 expect(CONTROL_STATUS_WEIGHTS['Exclu']).toBe(0);
 expect(CONTROL_STATUS_WEIGHTS['Inactif']).toBe(0);
 // expect(CONTROL_STATUS_WEIGHTS['Non appliqué']).toBe(0);
 });
});

describe('calculateMitigationPercentage', () => {
 const createControl = (overrides: Partial<Control> = {}): Control => ({
 id: 'ctrl-1',
 organizationId: 'org-1',
 code: 'CTR-001',
 name: 'Test Control',
 status: 'Implémenté',
 ...overrides
 });

 it('should return 0 for empty controls array', () => {
 expect(calculateMitigationPercentage([])).toBe(0);
 });

 it('should return max 15% per fully implemented control', () => {
 const controls = [createControl({ status: 'Implémenté' })];
 expect(calculateMitigationPercentage(controls)).toBe(15);
 });

 it('should calculate based on status weights', () => {
 const controls = [
 createControl({ id: '1', status: 'Implémenté' }),
 createControl({ id: '2', status: 'Partiel' })
 ];
 // 2 controls = max 30% mitigation
 // Average weight: (1.0 + 0.5) / 2 = 0.75
 // Result: 0.75 * 30 = 22.5 -> 23%
 expect(calculateMitigationPercentage(controls)).toBe(23);
 });

 it('should cap at 80% maximum', () => {
 const controls = Array(10).fill(null).map((_, i) =>
 createControl({ id: String(i), status: 'Implémenté' })
 );
 // 10 controls * 15% = 150% cap, but max is 80%
 expect(calculateMitigationPercentage(controls)).toBe(80);
 });

 it('should return 0 for non-implemented controls', () => {
 const controls = [createControl({ status: 'Non commencé' })];
 // Weight is 0.1, max mitigation is 15%
 // Result: 0.1 * 15 = 1.5 -> 2%
 expect(calculateMitigationPercentage(controls)).toBe(2);
 });
});

describe('calculateSuggestedResidualRisk', () => {
 const createControl = (overrides: Partial<Control> = {}): Control => ({
 id: 'ctrl-1',
 organizationId: 'org-1',
 code: 'CTR-001',
 name: 'Test Control',
 status: 'Implémenté',
 ...overrides
 });

 it('should return original values for no controls', () => {
 const result = calculateSuggestedResidualRisk(4, 5, []);

 expect(result.suggestedProbability).toBe(4);
 expect(result.suggestedImpact).toBe(5);
 expect(result.mitigationPercentage).toBe(0);
 expect(result.explanation).toContain('Aucun contrôle implémenté');
 });

 it('should reduce probability more than impact', () => {
 const controls = [createControl({ status: 'Implémenté' })];
 const result = calculateSuggestedResidualRisk(5, 5, controls);

 // With 15% mitigation:
 // Probability: 5 * 0.85 = 4.25 -> 4
 // Impact: 5 * (1 - 0.15*0.3) = 5 * 0.955 = 4.775 -> 5
 expect(result.suggestedProbability).toBeLessThan(5);
 expect(result.suggestedImpact).toBeLessThanOrEqual(5);
 expect(result.mitigationPercentage).toBe(15);
 });

 it('should never reduce below 1', () => {
 const controls = Array(6).fill(null).map((_, i) =>
 createControl({ id: String(i), status: 'Implémenté' })
 );
 const result = calculateSuggestedResidualRisk(1, 1, controls);

 expect(result.suggestedProbability).toBeGreaterThanOrEqual(1);
 expect(result.suggestedImpact).toBeGreaterThanOrEqual(1);
 });

 it('should include explanation with control counts', () => {
 const controls = [
 createControl({ id: '1', status: 'Implémenté' }),
 createControl({ id: '2', status: 'Partiel' })
 ];
 const result = calculateSuggestedResidualRisk(4, 4, controls);

 expect(result.explanation).toContain('2 contrôle(s)');
 expect(result.explanation).toContain('1 implémenté');
 expect(result.explanation).toContain('1 partiellement');
 });
});
