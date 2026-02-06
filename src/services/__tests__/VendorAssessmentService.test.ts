/**
 * Story 37-1: Vendor Assessment Service Tests
 *
 * Tests for assessment types, utility functions, and service logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
 calculateNextReviewDate,
 isAssessmentExpired,
 getDaysUntil,
 getReviewCycleLabel,
 getVendorAssessmentStatusColor,
 calculateCompletionPercentage,
 EnhancedAssessmentResponse,
} from '../../types/vendorAssessment';
import {
 QUESTIONNAIRE_TEMPLATES,
 getTemplateById,
 getTemplatesForServiceType,
 getFrameworkColor,
} from '../../data/questionnaireTemplates';

// ============================================================================
// Review Cycle Calculation Tests
// ============================================================================

describe('calculateNextReviewDate', () => {
 const baseDate = '2026-01-15T00:00:00.000Z';

 it('calculates quarterly review date (3 months)', () => {
 const result = calculateNextReviewDate(baseDate, 'quarterly');
 const expected = new Date('2026-04-15');
 expect(new Date(result).getMonth()).toBe(expected.getMonth());
 });

 it('calculates bi-annual review date (6 months)', () => {
 const result = calculateNextReviewDate(baseDate, 'bi-annual');
 const expected = new Date('2026-07-15');
 expect(new Date(result).getMonth()).toBe(expected.getMonth());
 });

 it('calculates annual review date (12 months)', () => {
 const result = calculateNextReviewDate(baseDate, 'annual');
 const expected = new Date('2027-01-15');
 expect(new Date(result).getFullYear()).toBe(expected.getFullYear());
 });

 it('calculates custom review date with specified days', () => {
 const result = calculateNextReviewDate(baseDate, 'custom', 45);
 const resultDate = new Date(result);
 const baseDateTime = new Date(baseDate);
 const diffDays = Math.round((resultDate.getTime() - baseDateTime.getTime()) / (1000 * 60 * 60 * 24));
 expect(diffDays).toBe(45);
 });

 it('defaults to annual when custom cycle has no days specified', () => {
 const result = calculateNextReviewDate(baseDate, 'custom');
 const resultDate = new Date(result);
 expect(resultDate.getFullYear()).toBe(2027);
 });
});

// ============================================================================
// Assessment Expiration Tests
// ============================================================================

describe('isAssessmentExpired', () => {
 beforeEach(() => {
 vi.useFakeTimers();
 vi.setSystemTime(new Date('2026-01-21'));
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 it('returns true for assessments with Expired status', () => {
 const assessment = { status: 'Expired' as const, dueDate: '2026-02-01' };
 expect(isAssessmentExpired(assessment)).toBe(true);
 });

 it('returns false for Reviewed assessments regardless of date', () => {
 const assessment = { status: 'Reviewed' as const, dueDate: '2025-01-01' };
 expect(isAssessmentExpired(assessment)).toBe(false);
 });

 it('returns false for Archived assessments regardless of date', () => {
 const assessment = { status: 'Archived' as const, dueDate: '2025-01-01' };
 expect(isAssessmentExpired(assessment)).toBe(false);
 });

 it('returns true for Draft assessment past due date', () => {
 const assessment = { status: 'Draft' as const, dueDate: '2026-01-15' };
 expect(isAssessmentExpired(assessment)).toBe(true);
 });

 it('returns false for Draft assessment with future due date', () => {
 const assessment = { status: 'Draft' as const, dueDate: '2026-02-01' };
 expect(isAssessmentExpired(assessment)).toBe(false);
 });

 it('returns false when no due date is set', () => {
 const assessment = { status: 'In Progress' as const };
 expect(isAssessmentExpired(assessment)).toBe(false);
 });

 it('uses expirationDate over dueDate when both are present', () => {
 const assessment = {
 status: 'In Progress' as const,
 dueDate: '2026-02-01',
 expirationDate: '2026-01-15',
 };
 expect(isAssessmentExpired(assessment)).toBe(true);
 });
});

// ============================================================================
// Days Until Calculation Tests
// ============================================================================

describe('getDaysUntil', () => {
 beforeEach(() => {
 vi.useFakeTimers();
 vi.setSystemTime(new Date('2026-01-21T12:00:00.000Z'));
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 it('returns positive days for future dates', () => {
 expect(getDaysUntil('2026-01-31')).toBeGreaterThan(0);
 expect(getDaysUntil('2026-01-28')).toBe(7);
 });

 it('returns negative days for past dates', () => {
 expect(getDaysUntil('2026-01-14')).toBeLessThan(0);
 expect(getDaysUntil('2026-01-14')).toBe(-7);
 });

 it('returns 0 for today', () => {
 expect(getDaysUntil('2026-01-21')).toBeLessThanOrEqual(1);
 expect(getDaysUntil('2026-01-21')).toBeGreaterThanOrEqual(0);
 });
});

// ============================================================================
// Review Cycle Label Tests
// ============================================================================

describe('getReviewCycleLabel', () => {
 it('returns correct label for quarterly', () => {
 expect(getReviewCycleLabel('quarterly')).toBe('Quarterly (3 months)');
 });

 it('returns correct label for bi-annual', () => {
 expect(getReviewCycleLabel('bi-annual')).toBe('Bi-annual (6 months)');
 });

 it('returns correct label for annual', () => {
 expect(getReviewCycleLabel('annual')).toBe('Annual (12 months)');
 });

 it('returns custom label with days when provided', () => {
 expect(getReviewCycleLabel('custom', 90)).toBe('Custom (90 days)');
 });

 it('returns generic custom label when no days provided', () => {
 expect(getReviewCycleLabel('custom')).toBe('Custom');
 });
});

// ============================================================================
// Status Color Tests
// ============================================================================

describe('getVendorAssessmentStatusColor', () => {
 it('returns correct color for each status', () => {
 expect(getVendorAssessmentStatusColor('Draft')).toBe('gray');
 expect(getVendorAssessmentStatusColor('Sent')).toBe('blue');
 expect(getVendorAssessmentStatusColor('In Progress')).toBe('indigo');
 expect(getVendorAssessmentStatusColor('Submitted')).toBe('purple');
 expect(getVendorAssessmentStatusColor('Reviewed')).toBe('green');
 expect(getVendorAssessmentStatusColor('Archived')).toBe('gray');
 expect(getVendorAssessmentStatusColor('Expired')).toBe('red');
 });
});

// ============================================================================
// Completion Percentage Tests
// ============================================================================

describe('calculateCompletionPercentage', () => {
 it('returns 0 when no questions', () => {
 expect(calculateCompletionPercentage({}, 0)).toBe(0);
 });

 it('returns 0 when no answers', () => {
 expect(calculateCompletionPercentage({}, 10)).toBe(0);
 });

 it('calculates correct percentage for partial completion', () => {
 const answers = {
 q1: { value: 'yes' },
 q2: { value: 'no' },
 q3: { value: true },
 };
 expect(calculateCompletionPercentage(answers, 10)).toBe(30);
 });

 it('returns 100 for fully completed', () => {
 const answers = {
 q1: { value: 'yes' },
 q2: { value: 'no' },
 };
 expect(calculateCompletionPercentage(answers, 2)).toBe(100);
 });

 it('rounds to nearest integer', () => {
 const answers = {
 q1: { value: 'yes' },
 };
 expect(calculateCompletionPercentage(answers, 3)).toBe(33);
 });
});

// ============================================================================
// Questionnaire Templates Tests
// ============================================================================

describe('QUESTIONNAIRE_TEMPLATES', () => {
 it('contains all 5 required templates', () => {
 expect(QUESTIONNAIRE_TEMPLATES).toHaveLength(5);
 });

 it('has DORA template', () => {
 const dora = QUESTIONNAIRE_TEMPLATES.find(t => t.metadata.framework === 'DORA');
 expect(dora).toBeDefined();
 expect(dora?.metadata.title).toContain('DORA');
 });

 it('has ISO 27001 template', () => {
 const iso = QUESTIONNAIRE_TEMPLATES.find(t => t.metadata.framework === 'ISO 27001:2022');
 expect(iso).toBeDefined();
 expect(iso?.metadata.title).toContain('ISO');
 });

 it('has NIS2 template', () => {
 const nis2 = QUESTIONNAIRE_TEMPLATES.find(t => t.metadata.framework === 'NIS2');
 expect(nis2).toBeDefined();
 expect(nis2?.metadata.title).toContain('NIS2');
 });

 it('has HDS template', () => {
 const hds = QUESTIONNAIRE_TEMPLATES.find(t => t.metadata.framework === 'HDS');
 expect(hds).toBeDefined();
 expect(hds?.metadata.title).toContain('HDS');
 });

 it('has Best Practices template', () => {
 const general = QUESTIONNAIRE_TEMPLATES.find(t => t.metadata.framework === 'Best Practices');
 expect(general).toBeDefined();
 });

 it('each template has valid metadata', () => {
 QUESTIONNAIRE_TEMPLATES.forEach(template => {
 expect(template.metadata.id).toBeTruthy();
 expect(template.metadata.title).toBeTruthy();
 expect(template.metadata.description).toBeTruthy();
 expect(template.metadata.framework).toBeTruthy();
 expect(template.metadata.sectionCount).toBeGreaterThan(0);
 expect(template.metadata.questionCount).toBeGreaterThan(0);
 });
 });

 it('each template has sections matching metadata count', () => {
 QUESTIONNAIRE_TEMPLATES.forEach(template => {
 expect(template.sections.length).toBe(template.metadata.sectionCount);
 });
 });

 it('each template has questions matching metadata count', () => {
 QUESTIONNAIRE_TEMPLATES.forEach(template => {
 const actualQuestions = template.sections.reduce(
 (sum, s) => sum + s.questions.length,
 0
 );
 expect(actualQuestions).toBe(template.metadata.questionCount);
 });
 });

 it('section weights sum to 100 for each template', () => {
 QUESTIONNAIRE_TEMPLATES.forEach(template => {
 const totalWeight = template.sections.reduce((sum, s) => sum + s.weight, 0);
 expect(totalWeight).toBe(100);
 });
 });
});

describe('getTemplateById', () => {
 it('returns template for valid id', () => {
 const result = getTemplateById('tpl_dora_v1');
 expect(result).toBeDefined();
 expect(result?.metadata.framework).toBe('DORA');
 });

 it('returns undefined for invalid id', () => {
 const result = getTemplateById('nonexistent-template');
 expect(result).toBeUndefined();
 });
});

describe('getTemplatesForServiceType', () => {
 it('returns templates applicable to SaaS', () => {
 const result = getTemplatesForServiceType('SaaS');
 expect(result.length).toBeGreaterThan(0);
 result.forEach(template => {
 // Template should have either 'All' or 'SaaS' in applicableTo
 const applicableTo = template.metadata.applicableTo;
 expect(applicableTo.includes('All') || applicableTo.includes('SaaS')).toBe(true);
 });
 });

 it('returns templates applicable to Cloud', () => {
 const result = getTemplatesForServiceType('Cloud');
 expect(result.length).toBeGreaterThan(0);
 result.forEach(template => {
 // Template should have either 'All' or 'Cloud' in applicableTo
 const applicableTo = template.metadata.applicableTo;
 expect(applicableTo.includes('All') || applicableTo.includes('Cloud')).toBe(true);
 });
 });

 it('returns templates for unknown service type', () => {
 const result = getTemplatesForServiceType('UnknownType');
 // Best Practices template should always be included (has 'All' in applicableTo)
 expect(result.some(t => t.metadata.framework === 'Best Practices')).toBe(true);
 });
});

describe('getFrameworkColor', () => {
 it('returns blue for DORA', () => {
 const result = getFrameworkColor('DORA');
 expect(result.text).toContain('blue');
 });

 it('returns green for ISO 27001', () => {
 const result = getFrameworkColor('ISO 27001:2022');
 expect(result.text).toContain('green');
 });

 it('returns purple for NIS2', () => {
 const result = getFrameworkColor('NIS2');
 expect(result.text).toContain('purple');
 });

 it('returns red for HDS', () => {
 const result = getFrameworkColor('HDS');
 expect(result.text).toContain('red');
 });

 it('returns muted foreground for unknown frameworks', () => {
 const result = getFrameworkColor('Unknown');
 expect(result.text).toContain('muted-foreground');
 });
});

// ============================================================================
// Assessment Status Flow Tests
// ============================================================================

describe('Assessment Status Flow', () => {
 it('defines valid status flow', () => {
 // Just ensure the types compile correctly
 const statuses: EnhancedAssessmentResponse['status'][] = [
 'Draft',
 'Sent',
 'In Progress',
 'Submitted',
 'Reviewed',
 'Archived',
 'Expired',
 ];
 expect(statuses).toHaveLength(7);
 });
});

// ============================================================================
// Template Question Types Tests
// ============================================================================

describe('Template Question Types', () => {
 it('all questions have valid types', () => {
 const validTypes = ['yes_no', 'multiple_choice', 'text', 'rating'];

 QUESTIONNAIRE_TEMPLATES.forEach(template => {
 template.sections.forEach(section => {
 section.questions.forEach(question => {
 expect(validTypes).toContain(question.type);
 });
 });
 });
 });

 it('all questions have positive weights', () => {
 QUESTIONNAIRE_TEMPLATES.forEach(template => {
 template.sections.forEach(section => {
 section.questions.forEach(question => {
 expect(question.weight).toBeGreaterThan(0);
 });
 });
 });
 });

 it('required questions are marked correctly', () => {
 QUESTIONNAIRE_TEMPLATES.forEach(template => {
 template.sections.forEach(section => {
 section.questions.forEach(question => {
 expect(typeof question.required).toBe('boolean');
 });
 });
 });
 });

 it('multiple choice questions have options', () => {
 QUESTIONNAIRE_TEMPLATES.forEach(template => {
 template.sections.forEach(section => {
 section.questions.forEach(question => {
 if (question.type === 'multiple_choice') {
 expect(question.options).toBeDefined();
 expect(question.options!.length).toBeGreaterThan(0);
 }
 });
 });
 });
 });
});
