/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HomologationService Unit Tests
 *
 * Tests for ANSSI homologation level calculation and dossier management.
 * Story 38-1: Homologation Level Selector
 */

import { describe, it, expect, vi } from 'vitest';
import {
 calculateTotalScore,
 getLevelFromScore,
 findEscalationLevel,
 getKeyFactors,
 generateJustification,
 calculateLevelRecommendation,
 processAnswer,
 getRequiredDocuments,
 initializeDocuments,
 validateLevelOverride,
 areAllDocumentsCompleted,
 canSubmitForDecision,
 calculateDaysUntilExpiration,
 getValidityState,
 // EBIOS Link functions (Story 38-4)
 createEbiosDataHash,
 countEbiosItems,
 createEbiosSnapshot
} from '../HomologationService';
import type {
 LevelDeterminationAnswer,
 HomologationDossier
} from '../../types/homologation';
import { LEVEL_THRESHOLDS, REQUIRED_DOCUMENTS } from '../../types/homologation';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {}
}));

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 doc: vi.fn(),
 getDoc: vi.fn(),
 getDocs: vi.fn(),
 setDoc: vi.fn(),
 updateDoc: vi.fn(),
 deleteDoc: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 orderBy: vi.fn(),
 Timestamp: {
 fromDate: vi.fn((date: Date) => ({ toDate: () => date }))
 },
 serverTimestamp: vi.fn(() => new Date())
}));

describe('HomologationService', () => {
 // ============================================================================
 // Score Calculation Tests
 // ============================================================================
 describe('calculateTotalScore', () => {
 it('should return 0 for empty answers', () => {
 const answers: LevelDeterminationAnswer[] = [];
 expect(calculateTotalScore(answers)).toBe(0);
 });

 it('should calculate score correctly for single answer', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'public', score: 0 }
 ];
 // With weight 3, score 0, result should be 0
 const result = calculateTotalScore(answers);
 expect(result).toBe(0);
 });

 it('should calculate weighted average correctly', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'interne', score: 15 }, // weight 3
 { questionId: 'personal_data', value: 'basic', score: 20 } // weight 2
 ];
 // Weighted: (15*3 + 20*2) / (3*100 + 2*100) = (45 + 40) / 500 = 85/500 = 17%
 const result = calculateTotalScore(answers);
 expect(result).toBeGreaterThan(0);
 expect(result).toBeLessThanOrEqual(100);
 });

 it('should handle high score answers', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'secret', score: 100 },
 { questionId: 'critical_infrastructure', value: 'oiv', score: 80 }
 ];
 const result = calculateTotalScore(answers);
 expect(result).toBeGreaterThan(50);
 });
 });

 // ============================================================================
 // Level From Score Tests
 // ============================================================================
 describe('getLevelFromScore', () => {
 it('should return etoile for score 0-25', () => {
 expect(getLevelFromScore(0)).toBe('etoile');
 expect(getLevelFromScore(15)).toBe('etoile');
 expect(getLevelFromScore(25)).toBe('etoile');
 });

 it('should return simple for score 26-50', () => {
 expect(getLevelFromScore(26)).toBe('simple');
 expect(getLevelFromScore(38)).toBe('simple');
 expect(getLevelFromScore(50)).toBe('simple');
 });

 it('should return standard for score 51-75', () => {
 expect(getLevelFromScore(51)).toBe('standard');
 expect(getLevelFromScore(63)).toBe('standard');
 expect(getLevelFromScore(75)).toBe('standard');
 });

 it('should return renforce for score 76-100', () => {
 expect(getLevelFromScore(76)).toBe('renforce');
 expect(getLevelFromScore(88)).toBe('renforce');
 expect(getLevelFromScore(100)).toBe('renforce');
 });
 });

 // ============================================================================
 // Escalation Level Tests
 // ============================================================================
 describe('findEscalationLevel', () => {
 it('should return null when no escalation', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'q1', value: 'low', score: 10 },
 { questionId: 'q2', value: 'medium', score: 25 }
 ];
 expect(findEscalationLevel(answers)).toBeNull();
 });

 it('should return escalation level when present', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'q1', value: 'low', score: 10 },
 { questionId: 'q2', value: 'secret', score: 100, escalatesTo: 'renforce' }
 ];
 expect(findEscalationLevel(answers)).toBe('renforce');
 });

 it('should return highest escalation when multiple', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'q1', value: 'dr', score: 60, escalatesTo: 'standard' },
 { questionId: 'q2', value: 'secret', score: 100, escalatesTo: 'renforce' }
 ];
 expect(findEscalationLevel(answers)).toBe('renforce');
 });

 it('should handle single escalation level', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'q1', value: 'ose', score: 50, escalatesTo: 'standard' }
 ];
 expect(findEscalationLevel(answers)).toBe('standard');
 });
 });

 // ============================================================================
 // Key Factors Tests
 // ============================================================================
 describe('getKeyFactors', () => {
 it('should return empty array for low score answers', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'public', score: 0 }
 ];
 const factors = getKeyFactors(answers);
 expect(factors).toEqual([]);
 });

 it('should include high score answers', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'diffusion_restreinte', score: 60, escalatesTo: 'standard' }
 ];
 const factors = getKeyFactors(answers);
 expect(factors.length).toBeGreaterThan(0);
 });

 it('should limit to 5 factors', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'q1', value: 'high', score: 50 },
 { questionId: 'q2', value: 'high', score: 60 },
 { questionId: 'q3', value: 'high', score: 70 },
 { questionId: 'q4', value: 'high', score: 80 },
 { questionId: 'q5', value: 'high', score: 90 },
 { questionId: 'q6', value: 'high', score: 100 }
 ];
 const factors = getKeyFactors(answers);
 expect(factors.length).toBeLessThanOrEqual(5);
 });
 });

 // ============================================================================
 // Justification Generation Tests
 // ============================================================================
 describe('generateJustification', () => {
 it('should generate justification with score', () => {
 const justification = generateJustification('simple', 35, null, []);
 expect(justification).toContain('Simple');
 expect(justification).toContain('35');
 });

 it('should mention escalation when present', () => {
 const justification = generateJustification('renforce', 40, 'renforce', []);
 expect(justification).toContain('Renforcé');
 expect(justification).toContain('escalade');
 });

 it('should include key factors', () => {
 const factors = ['Données sensibles', 'Infrastructure critique'];
 const justification = generateJustification('standard', 60, null, factors);
 expect(justification).toContain('Facteurs clés');
 });
 });

 // ============================================================================
 // Full Recommendation Calculation Tests
 // ============================================================================
 describe('calculateLevelRecommendation', () => {
 it('should return etoile for minimal risk answers', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'public', score: 0 },
 { questionId: 'personal_data', value: 'none', score: 0 },
 { questionId: 'user_count', value: 'small', score: 0 }
 ];
 const recommendation = calculateLevelRecommendation(answers);
 expect(recommendation.recommendedLevel).toBe('etoile');
 expect(recommendation.score).toBeLessThanOrEqual(25);
 });

 it('should escalate to renforce for secret classification', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'secret', score: 100, escalatesTo: 'renforce' }
 ];
 const recommendation = calculateLevelRecommendation(answers);
 expect(recommendation.recommendedLevel).toBe('renforce');
 // Note: escalationReason is only set when the score-based level is lower than the escalation level
 // With score 100, the score-based level is already renforce, so escalationReason may be undefined
 });

 it('should set escalation reason when score-based level is lower', () => {
 // Low score (10) would normally give etoile, but escalatesTo: 'standard' forces upgrade
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'public', score: 0 },
 { questionId: 'personal_data', value: 'sensitive', score: 50, escalatesTo: 'standard' }
 ];
 const recommendation = calculateLevelRecommendation(answers);
 expect(recommendation.recommendedLevel).toBe('standard');
 expect(recommendation.escalationReason).toBeDefined();
 });

 it('should include required documents', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'interne', score: 15 }
 ];
 const recommendation = calculateLevelRecommendation(answers);
 expect(recommendation.requiredDocuments).toBeDefined();
 expect(recommendation.requiredDocuments.length).toBeGreaterThan(0);
 });

 it('should generate justification', () => {
 const answers: LevelDeterminationAnswer[] = [
 { questionId: 'classification_level', value: 'interne', score: 15 }
 ];
 const recommendation = calculateLevelRecommendation(answers);
 expect(recommendation.justification).toBeDefined();
 expect(recommendation.justification.length).toBeGreaterThan(0);
 });
 });

 // ============================================================================
 // Process Answer Tests
 // ============================================================================
 describe('processAnswer', () => {
 it('should process single value answer', () => {
 const answer = processAnswer('classification_level', 'public');
 expect(answer.questionId).toBe('classification_level');
 expect(answer.value).toBe('public');
 expect(answer.score).toBe(0);
 });

 it('should process answer with escalation', () => {
 const answer = processAnswer('classification_level', 'secret');
 expect(answer.escalatesTo).toBe('renforce');
 expect(answer.score).toBe(100);
 });

 it('should handle unknown question gracefully', () => {
 const answer = processAnswer('unknown_question', 'value');
 expect(answer.score).toBe(0);
 });

 it('should process multiple value answer', () => {
 const answer = processAnswer('sectoral_regulations', ['hds', 'dora']);
 expect(Array.isArray(answer.value)).toBe(true);
 expect((answer.value as string[]).length).toBe(2);
 });
 });

 // ============================================================================
 // Required Documents Tests
 // ============================================================================
 describe('getRequiredDocuments', () => {
 it('should return only strategie for etoile', () => {
 const docs = getRequiredDocuments('etoile');
 expect(docs).toEqual(['strategie']);
 });

 it('should return strategie and analyse_risques for simple', () => {
 const docs = getRequiredDocuments('simple');
 expect(docs).toContain('strategie');
 expect(docs).toContain('analyse_risques');
 expect(docs.length).toBe(2);
 });

 it('should return 5 documents for standard', () => {
 const docs = getRequiredDocuments('standard');
 expect(docs.length).toBe(5);
 expect(docs).toContain('decision');
 expect(docs).toContain('attestation');
 });

 it('should return 7 documents for renforce', () => {
 const docs = getRequiredDocuments('renforce');
 expect(docs.length).toBe(7);
 expect(docs).toContain('test_intrusion');
 expect(docs).toContain('audit_technique');
 });
 });

 // ============================================================================
 // Initialize Documents Tests
 // ============================================================================
 describe('initializeDocuments', () => {
 it('should initialize documents with not_started status', () => {
 const docs = initializeDocuments('simple');
 expect(docs.length).toBe(2);
 docs.forEach((doc) => {
 expect(doc.status).toBe('not_started');
 });
 });

 it('should match required documents for level', () => {
 const docs = initializeDocuments('standard');
 const types = docs.map((d) => d.type);
 expect(types).toEqual(REQUIRED_DOCUMENTS.standard);
 });
 });

 // ============================================================================
 // Validation Tests
 // ============================================================================
 describe('validateLevelOverride', () => {
 it('should return null for same level', () => {
 const error = validateLevelOverride('standard', 'standard', '');
 expect(error).toBeNull();
 });

 it('should require justification for level change', () => {
 const error = validateLevelOverride('standard', 'simple', 'short');
 expect(error).toBeDefined();
 expect(error).toContain('20 caractères');
 });

 it('should accept valid justification', () => {
 const justification = 'Après analyse approfondie, le niveau Simple est suffisant car...';
 const error = validateLevelOverride('standard', 'simple', justification);
 expect(error).toBeNull();
 });
 });

 describe('areAllDocumentsCompleted', () => {
 it('should return true when all documents completed', () => {
 const dossier = {
 documents: [
 { type: 'strategie', status: 'completed' },
 { type: 'analyse_risques', status: 'validated' }
 ]
 } as HomologationDossier;
 expect(areAllDocumentsCompleted(dossier)).toBe(true);
 });

 it('should return false when some documents pending', () => {
 const dossier = {
 documents: [
 { type: 'strategie', status: 'completed' },
 { type: 'analyse_risques', status: 'in_progress' }
 ]
 } as HomologationDossier;
 expect(areAllDocumentsCompleted(dossier)).toBe(false);
 });

 it('should return false for not_started documents', () => {
 const dossier = {
 documents: [{ type: 'strategie', status: 'not_started' }]
 } as HomologationDossier;
 expect(areAllDocumentsCompleted(dossier)).toBe(false);
 });
 });

 describe('canSubmitForDecision', () => {
 it('should allow submission when all conditions met', () => {
 const dossier = {
 status: 'in_progress',
 authorityId: 'authority-123',
 documents: [
 { type: 'strategie', status: 'completed' },
 { type: 'analyse_risques', status: 'validated' }
 ]
 } as HomologationDossier;
 const result = canSubmitForDecision(dossier);
 expect(result.valid).toBe(true);
 });

 it('should reject when status is homologated', () => {
 const dossier = {
 status: 'homologated',
 authorityId: 'authority-123',
 documents: [{ type: 'strategie', status: 'completed' }]
 } as HomologationDossier;
 const result = canSubmitForDecision(dossier);
 expect(result.valid).toBe(false);
 expect(result.reason).toContain('en cours de rédaction');
 });

 it('should reject when documents incomplete', () => {
 const dossier = {
 status: 'in_progress',
 authorityId: 'authority-123',
 documents: [{ type: 'strategie', status: 'in_progress' }]
 } as HomologationDossier;
 const result = canSubmitForDecision(dossier);
 expect(result.valid).toBe(false);
 expect(result.reason).toContain('documents');
 });

 it('should reject when no authority assigned', () => {
 const dossier = {
 status: 'in_progress',
 documents: [{ type: 'strategie', status: 'completed' }]
 } as HomologationDossier;
 const result = canSubmitForDecision(dossier);
 expect(result.valid).toBe(false);
 expect(result.reason).toContain('autorité');
 });
 });

 // ============================================================================
 // Level Threshold Tests
 // ============================================================================
 describe('Level Thresholds', () => {
 it('should have non-overlapping thresholds', () => {
 expect(LEVEL_THRESHOLDS.etoile.max).toBeLessThan(LEVEL_THRESHOLDS.simple.min);
 expect(LEVEL_THRESHOLDS.simple.max).toBeLessThan(LEVEL_THRESHOLDS.standard.min);
 expect(LEVEL_THRESHOLDS.standard.max).toBeLessThan(LEVEL_THRESHOLDS.renforce.min);
 });

 it('should cover 0-100 range', () => {
 expect(LEVEL_THRESHOLDS.etoile.min).toBe(0);
 expect(LEVEL_THRESHOLDS.renforce.max).toBe(100);
 });
 });

 // ============================================================================
 // Required Documents Constants Tests
 // ============================================================================
 describe('Required Documents Constants', () => {
 it('should have increasing document requirements', () => {
 expect(REQUIRED_DOCUMENTS.etoile.length).toBeLessThan(REQUIRED_DOCUMENTS.simple.length);
 expect(REQUIRED_DOCUMENTS.simple.length).toBeLessThan(REQUIRED_DOCUMENTS.standard.length);
 expect(REQUIRED_DOCUMENTS.standard.length).toBeLessThan(REQUIRED_DOCUMENTS.renforce.length);
 });

 it('should include all previous level documents', () => {
 // Simple should include all etoile docs
 REQUIRED_DOCUMENTS.etoile.forEach((doc) => {
 expect(REQUIRED_DOCUMENTS.simple).toContain(doc);
 });

 // Standard should include all simple docs
 REQUIRED_DOCUMENTS.simple.forEach((doc) => {
 expect(REQUIRED_DOCUMENTS.standard).toContain(doc);
 });

 // Renforce should include all standard docs
 REQUIRED_DOCUMENTS.standard.forEach((doc) => {
 expect(REQUIRED_DOCUMENTS.renforce).toContain(doc);
 });
 });
 });

 // ============================================================================
 // Validity Tracking Tests (Story 38-3)
 // ============================================================================
 describe('Validity Tracking', () => {
 describe('calculateDaysUntilExpiration', () => {
 it('should return null for undefined date', () => {
 expect(calculateDaysUntilExpiration(undefined)).toBeNull();
 });

 it('should return positive days for future date', () => {
 const futureDate = new Date();
 futureDate.setDate(futureDate.getDate() + 30);
 const result = calculateDaysUntilExpiration(futureDate.toISOString());
 expect(result).toBeGreaterThanOrEqual(29);
 expect(result).toBeLessThanOrEqual(31);
 });

 it('should return negative days for past date', () => {
 const pastDate = new Date();
 pastDate.setDate(pastDate.getDate() - 10);
 const result = calculateDaysUntilExpiration(pastDate.toISOString());
 expect(result).toBeLessThan(0);
 expect(result).toBeGreaterThanOrEqual(-11);
 });

 it('should return 0 or 1 for today', () => {
 const today = new Date();
 const result = calculateDaysUntilExpiration(today.toISOString());
 expect(result).toBeGreaterThanOrEqual(0);
 expect(result).toBeLessThanOrEqual(1);
 });
 });

 describe('getValidityState', () => {
 it('should return "not_set" for null', () => {
 expect(getValidityState(null)).toBe('not_set');
 });

 it('should return "expired" for negative days', () => {
 expect(getValidityState(-1)).toBe('expired');
 expect(getValidityState(-30)).toBe('expired');
 expect(getValidityState(-100)).toBe('expired');
 });

 it('should return "critical" for 0-30 days', () => {
 expect(getValidityState(0)).toBe('critical');
 expect(getValidityState(15)).toBe('critical');
 expect(getValidityState(30)).toBe('critical');
 });

 it('should return "expiring_soon" for 31-90 days', () => {
 expect(getValidityState(31)).toBe('expiring_soon');
 expect(getValidityState(60)).toBe('expiring_soon');
 expect(getValidityState(90)).toBe('expiring_soon');
 });

 it('should return "active" for more than 90 days', () => {
 expect(getValidityState(91)).toBe('active');
 expect(getValidityState(180)).toBe('active');
 expect(getValidityState(365)).toBe('active');
 });
 });

 describe('Validity state transitions', () => {
 it('should correctly transition through states as date approaches', () => {
 // 100 days from now - active
 const date100 = new Date();
 date100.setDate(date100.getDate() + 100);
 expect(getValidityState(calculateDaysUntilExpiration(date100.toISOString()))).toBe('active');

 // 60 days from now - expiring_soon
 const date60 = new Date();
 date60.setDate(date60.getDate() + 60);
 expect(getValidityState(calculateDaysUntilExpiration(date60.toISOString()))).toBe('expiring_soon');

 // 20 days from now - critical
 const date20 = new Date();
 date20.setDate(date20.getDate() + 20);
 expect(getValidityState(calculateDaysUntilExpiration(date20.toISOString()))).toBe('critical');

 // 10 days ago - expired
 const datePast = new Date();
 datePast.setDate(datePast.getDate() - 10);
 expect(getValidityState(calculateDaysUntilExpiration(datePast.toISOString()))).toBe('expired');
 });
 });

 describe('Edge cases', () => {
 it('should handle boundary at exactly 30 days', () => {
 const date30 = new Date();
 date30.setDate(date30.getDate() + 30);
 const days = calculateDaysUntilExpiration(date30.toISOString());
 expect(getValidityState(days)).toBe('critical');
 });

 it('should handle boundary at exactly 90 days', () => {
 const date90 = new Date();
 date90.setDate(date90.getDate() + 90);
 const days = calculateDaysUntilExpiration(date90.toISOString());
 expect(getValidityState(days)).toBe('expiring_soon');
 });

 it('should handle date at end of day', () => {
 const endOfDay = new Date();
 endOfDay.setHours(23, 59, 59, 999);
 endOfDay.setDate(endOfDay.getDate() + 45);
 const result = calculateDaysUntilExpiration(endOfDay.toISOString());
 expect(result).toBeGreaterThanOrEqual(45);
 expect(result).toBeLessThanOrEqual(46);
 });
 });
 });

 // ============================================================================
 // EBIOS Link Tests (Story 38-4)
 // ============================================================================
 describe('EBIOS Link Management', () => {
 // Mock EBIOS analysis for testing
 const createMockAnalysis = (overrides = {}) => ({
 id: 'ebios-123',
 organizationId: 'org-123',
 name: 'Test EBIOS Analysis',
 description: 'Test description',
 status: 'in_progress',
 currentWorkshop: 2,
 completionPercentage: 40,
 createdAt: '2026-01-01T00:00:00Z',
 createdBy: 'user-123',
 updatedAt: '2026-01-15T00:00:00Z',
 updatedBy: 'user-123',
 workshops: {
 1: {
 status: 'completed',
 data: {
 fearedEvents: [
 { id: '1', name: 'Data breach', impactType: 'confidentiality', gravity: 3 },
 { id: '2', name: 'Service outage', impactType: 'availability', gravity: 2 }
 ]
 }
 },
 2: {
 status: 'in_progress',
 data: {
 selectedRiskSources: [
 { id: '1', name: 'Cybercriminals', type: 'malicious' },
 { id: '2', name: 'Insider threat', type: 'malicious' }
 ]
 }
 },
 3: {
 status: 'not_started',
 data: {
 strategicScenarios: [
 { id: '1', name: 'Ransomware attack', gravity: 4 }
 ]
 }
 },
 4: {
 status: 'not_started',
 data: {
 operationalScenarios: []
 }
 },
 5: {
 status: 'not_started',
 data: {
 treatmentPlan: []
 }
 }
 },
 ...overrides
 });

 describe('createEbiosDataHash', () => {
 it('should create consistent hash for same data', () => {
 const analysis = createMockAnalysis();
 const hash1 = createEbiosDataHash(analysis as any);
 const hash2 = createEbiosDataHash(analysis as any);
 expect(hash1).toBe(hash2);
 });

 it('should create different hash for different data', () => {
 const analysis1 = createMockAnalysis();
 const analysis2 = createMockAnalysis({ completionPercentage: 50 });
 const hash1 = createEbiosDataHash(analysis1 as any);
 const hash2 = createEbiosDataHash(analysis2 as any);
 expect(hash1).not.toBe(hash2);
 });

 it('should detect changes in workshop status', () => {
 const analysis1 = createMockAnalysis();
 const analysis2 = createMockAnalysis();
 (analysis2 as any).workshops[2].status = 'completed';
 const hash1 = createEbiosDataHash(analysis1 as any);
 const hash2 = createEbiosDataHash(analysis2 as any);
 expect(hash1).not.toBe(hash2);
 });
 });

 describe('countEbiosItems', () => {
 it('should count items from all workshops', () => {
 const analysis = createMockAnalysis();
 const counts = countEbiosItems(analysis as any);

 expect(counts.fearedEventsCount).toBe(2);
 expect(counts.riskSourcesCount).toBe(2);
 expect(counts.strategicScenariosCount).toBe(1);
 expect(counts.operationalScenariosCount).toBe(0);
 expect(counts.treatmentItemsCount).toBe(0);
 });

 it('should handle missing workshop data', () => {
 const analysis = {
 workshops: {
 1: { status: 'not_started', data: {} },
 2: { status: 'not_started', data: {} },
 3: { status: 'not_started', data: {} },
 4: { status: 'not_started', data: {} },
 5: { status: 'not_started', data: {} }
 }
 };
 const counts = countEbiosItems(analysis as any);

 expect(counts.fearedEventsCount).toBe(0);
 expect(counts.riskSourcesCount).toBe(0);
 expect(counts.strategicScenariosCount).toBe(0);
 expect(counts.operationalScenariosCount).toBe(0);
 expect(counts.treatmentItemsCount).toBe(0);
 });

 it('should handle null workshop data', () => {
 const analysis = {
 workshops: {
 1: { status: 'not_started', data: null },
 2: { status: 'not_started', data: null },
 3: { status: 'not_started', data: null },
 4: { status: 'not_started', data: null },
 5: { status: 'not_started', data: null }
 }
 };
 const counts = countEbiosItems(analysis as any);

 expect(counts.fearedEventsCount).toBe(0);
 expect(counts.riskSourcesCount).toBe(0);
 });
 });

 describe('createEbiosSnapshot', () => {
 it('should create snapshot with all required fields', () => {
 const analysis = createMockAnalysis();
 const snapshot = createEbiosSnapshot(analysis as any);

 expect(snapshot.analysisId).toBe('ebios-123');
 expect(snapshot.analysisName).toBe('Test EBIOS Analysis');
 expect(snapshot.snapshotAt).toBeDefined();
 expect(snapshot.completionPercentage).toBe(40);
 expect(snapshot.dataHash).toBeDefined();
 });

 it('should capture workshop statuses correctly', () => {
 const analysis = createMockAnalysis();
 const snapshot = createEbiosSnapshot(analysis as any);

 expect(snapshot.workshopStatuses[1]).toBe('completed');
 expect(snapshot.workshopStatuses[2]).toBe('in_progress');
 expect(snapshot.workshopStatuses[3]).toBe('not_started');
 expect(snapshot.workshopStatuses[4]).toBe('not_started');
 expect(snapshot.workshopStatuses[5]).toBe('not_started');
 });

 it('should capture item counts correctly', () => {
 const analysis = createMockAnalysis();
 const snapshot = createEbiosSnapshot(analysis as any);

 expect(snapshot.fearedEventsCount).toBe(2);
 expect(snapshot.riskSourcesCount).toBe(2);
 expect(snapshot.strategicScenariosCount).toBe(1);
 expect(snapshot.operationalScenariosCount).toBe(0);
 expect(snapshot.treatmentItemsCount).toBe(0);
 });

 it('should generate unique hash when data differs', () => {
 const analysis1 = createMockAnalysis();
 const analysis2 = createMockAnalysis({ status: 'completed', completionPercentage: 100 });

 const snapshot1 = createEbiosSnapshot(analysis1 as any);
 const snapshot2 = createEbiosSnapshot(analysis2 as any);

 // Hash differs because status and completion percentage changed
 expect(snapshot1.dataHash).not.toBe(snapshot2.dataHash);
 });

 it('should handle missing workshops gracefully', () => {
 const analysis = {
 id: 'ebios-partial',
 name: 'Partial Analysis',
 completionPercentage: 0,
 workshops: {}
 };
 const snapshot = createEbiosSnapshot(analysis as any);

 expect(snapshot.workshopStatuses[1]).toBe('not_started');
 expect(snapshot.fearedEventsCount).toBe(0);
 });
 });

 describe('Snapshot comparison for change detection', () => {
 it('should detect when completion percentage changes', () => {
 const analysis1 = createMockAnalysis({ completionPercentage: 40 });
 const analysis2 = createMockAnalysis({ completionPercentage: 60 });

 const snapshot1 = createEbiosSnapshot(analysis1 as any);
 const snapshot2 = createEbiosSnapshot(analysis2 as any);

 expect(snapshot1.completionPercentage).not.toBe(snapshot2.completionPercentage);
 expect(snapshot1.dataHash).not.toBe(snapshot2.dataHash);
 });

 it('should detect when items are added', () => {
 const analysis1 = createMockAnalysis();
 const analysis2 = createMockAnalysis();
 (analysis2 as any).workshops[1].data.fearedEvents.push({
 id: '3',
 name: 'New event',
 impactType: 'integrity',
 gravity: 2
 });

 const snapshot1 = createEbiosSnapshot(analysis1 as any);
 const snapshot2 = createEbiosSnapshot(analysis2 as any);

 expect(snapshot1.fearedEventsCount).toBe(2);
 expect(snapshot2.fearedEventsCount).toBe(3);
 expect(snapshot1.dataHash).not.toBe(snapshot2.dataHash);
 });
 });
 });
});
