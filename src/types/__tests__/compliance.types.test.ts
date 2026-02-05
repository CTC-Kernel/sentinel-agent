import { describe, it, expect } from 'vitest';
import {
 SCORE_STATUSES,
 SCORE_THRESHOLDS,
 ASSESSMENT_STATUSES,
 ASSESSMENT_SCORES,
 ACTION_IMPACTS,
 getScoreStatus,
 isScoreStatus,
 isAssessmentStatus,
 type ComplianceScore,
 type ComplianceAction,
 type ControlAssessment,
 type ScoreCalculationResult,
} from '../compliance';

describe('Compliance Types', () => {
 describe('Constants', () => {
 it('should have all score statuses', () => {
 expect(SCORE_STATUSES).toEqual(['green', 'orange', 'red']);
 });

 it('should have correct score thresholds', () => {
 expect(SCORE_THRESHOLDS.green).toBe(75);
 expect(SCORE_THRESHOLDS.orange).toBe(50);
 });

 it('should have all assessment statuses', () => {
 expect(ASSESSMENT_STATUSES).toContain('not_started');
 expect(ASSESSMENT_STATUSES).toContain('in_progress');
 expect(ASSESSMENT_STATUSES).toContain('compliant');
 expect(ASSESSMENT_STATUSES).toContain('partially_compliant');
 expect(ASSESSMENT_STATUSES).toContain('non_compliant');
 expect(ASSESSMENT_STATUSES).toContain('not_applicable');
 });

 it('should have correct assessment scores', () => {
 expect(ASSESSMENT_SCORES.not_started).toBe(0);
 expect(ASSESSMENT_SCORES.in_progress).toBe(25);
 expect(ASSESSMENT_SCORES.partially_compliant).toBe(50);
 expect(ASSESSMENT_SCORES.compliant).toBe(100);
 expect(ASSESSMENT_SCORES.non_compliant).toBe(0);
 expect(ASSESSMENT_SCORES.not_applicable).toBe(-1);
 });

 it('should have all action impacts', () => {
 expect(ACTION_IMPACTS).toEqual(['high', 'medium', 'low']);
 });
 });

 describe('getScoreStatus', () => {
 it('should return green for scores >= 75', () => {
 expect(getScoreStatus(100)).toBe('green');
 expect(getScoreStatus(75)).toBe('green');
 expect(getScoreStatus(85)).toBe('green');
 });

 it('should return orange for scores between 50 and 74', () => {
 expect(getScoreStatus(74)).toBe('orange');
 expect(getScoreStatus(50)).toBe('orange');
 expect(getScoreStatus(60)).toBe('orange');
 });

 it('should return red for scores < 50', () => {
 expect(getScoreStatus(49)).toBe('red');
 expect(getScoreStatus(0)).toBe('red');
 expect(getScoreStatus(25)).toBe('red');
 });
 });

 describe('Type Guards', () => {
 describe('isScoreStatus', () => {
 it('should return true for valid score statuses', () => {
 expect(isScoreStatus('green')).toBe(true);
 expect(isScoreStatus('orange')).toBe(true);
 expect(isScoreStatus('red')).toBe(true);
 });

 it('should return false for invalid score statuses', () => {
 expect(isScoreStatus('yellow')).toBe(false);
 expect(isScoreStatus('')).toBe(false);
 expect(isScoreStatus(null)).toBe(false);
 expect(isScoreStatus(undefined)).toBe(false);
 expect(isScoreStatus(100)).toBe(false);
 });
 });

 describe('isAssessmentStatus', () => {
 it('should return true for valid assessment statuses', () => {
 expect(isAssessmentStatus('compliant')).toBe(true);
 expect(isAssessmentStatus('partially_compliant')).toBe(true);
 expect(isAssessmentStatus('not_started')).toBe(true);
 expect(isAssessmentStatus('in_progress')).toBe(true);
 expect(isAssessmentStatus('non_compliant')).toBe(true);
 expect(isAssessmentStatus('not_applicable')).toBe(true);
 });

 it('should return false for invalid assessment statuses', () => {
 expect(isAssessmentStatus('complete')).toBe(false);
 expect(isAssessmentStatus('pending')).toBe(false);
 expect(isAssessmentStatus('')).toBe(false);
 expect(isAssessmentStatus(null)).toBe(false);
 expect(isAssessmentStatus(undefined)).toBe(false);
 });
 });
 });

 describe('Interface Shapes', () => {
 it('should accept valid ComplianceScore objects', () => {
 const score: ComplianceScore = {
 id: 'org123_nis2',
 organizationId: 'org123',
 frameworkId: 'nis2-v1',
 frameworkCode: 'NIS2',
 score: 72,
 status: 'orange',
 categoryBreakdown: [
 {
 category: 'governance',
 categoryLabel: 'Gouvernance',
 score: 85,
 status: 'green',
 requirementCount: 5,
 compliantCount: 4,
 },
 ],
 criticalityBreakdown: {
 high: { total: 10, compliant: 7, score: 70 },
 medium: { total: 15, compliant: 12, score: 80 },
 low: { total: 8, compliant: 6, score: 75 },
 },
 totalRequirements: 33,
 fullyCompliant: 20,
 partiallyCompliant: 5,
 nonCompliant: 5,
 notAssessed: 3,
 calculatedAt: '2026-01-23T10:00:00Z',
 };

 expect(score.score).toBe(72);
 expect(score.status).toBe('orange');
 expect(score.categoryBreakdown).toHaveLength(1);
 });

 it('should accept valid ControlAssessment objects', () => {
 const assessment: ControlAssessment = {
 id: 'assess-1',
 organizationId: 'org123',
 controlId: 'ctrl-001',
 requirementId: 'nis2-art21',
 frameworkId: 'nis2-v1',
 status: 'partially_compliant',
 score: 50,
 criticality: 'high',
 evidenceIds: ['ev-1', 'ev-2'],
 notes: 'In progress, need more evidence',
 assessedBy: 'user-123',
 assessedAt: '2026-01-23T10:00:00Z',
 };

 expect(assessment.status).toBe('partially_compliant');
 expect(assessment.score).toBe(50);
 expect(assessment.criticality).toBe('high');
 });

 it('should accept valid ComplianceAction objects', () => {
 const action: ComplianceAction = {
 id: 'action-1',
 title: 'Complete risk assessment',
 description: 'Complete the risk assessment for NIS2 Article 21',
 frameworkId: 'nis2-v1',
 frameworkCode: 'NIS2',
 requirementId: 'nis2-art21',
 controlId: 'ctrl-001',
 impact: 'high',
 scoreImprovement: 5,
 priority: 1,
 actionType: 'update_assessment',
 link: '/controls/ctrl-001',
 criticality: 'high',
 };

 expect(action.impact).toBe('high');
 expect(action.scoreImprovement).toBe(5);
 expect(action.actionType).toBe('update_assessment');
 });

 it('should accept valid ScoreCalculationResult objects', () => {
 const result: ScoreCalculationResult = {
 score: 75,
 status: 'green',
 categoryBreakdown: [],
 criticalityBreakdown: {
 high: { total: 10, compliant: 8, score: 80 },
 medium: { total: 15, compliant: 11, score: 73 },
 low: { total: 5, compliant: 4, score: 80 },
 },
 counts: {
 total: 30,
 fullyCompliant: 20,
 partiallyCompliant: 5,
 nonCompliant: 3,
 notAssessed: 2,
 notApplicable: 0,
 },
 calculatedAt: '2026-01-23T10:00:00Z',
 };

 expect(result.score).toBe(75);
 expect(result.status).toBe('green');
 expect(result.counts.total).toBe(30);
 });
 });
});
