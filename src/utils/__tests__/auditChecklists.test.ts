/**
 * auditChecklists Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect } from 'vitest';
import {
 ISO27001_CHECKLISTS,
 generateAuditChecklist,
 calculateCompletionRate,
 getComplianceScore,
 AuditChecklistItem,
} from '../auditChecklists';

describe('ISO27001_CHECKLISTS', () => {
 it('should have A.5 domain with organizational controls', () => {
 const a5 = ISO27001_CHECKLISTS['A.5'];
 expect(a5.title).toBe('Contrôles Organisationnels');
 expect(a5.items.length).toBeGreaterThan(0);
 expect(a5.items[0].controlCode).toBe('A.5.1');
 });

 it('should have A.6 domain with people controls', () => {
 const a6 = ISO27001_CHECKLISTS['A.6'];
 expect(a6.title).toBe('Contrôles Liés aux Personnes');
 expect(a6.items.length).toBeGreaterThan(0);
 expect(a6.items[0].controlCode).toBe('A.6.1');
 });

 it('should have A.7 domain with physical controls', () => {
 const a7 = ISO27001_CHECKLISTS['A.7'];
 expect(a7.title).toBe('Contrôles Physiques');
 expect(a7.items.length).toBeGreaterThan(0);
 expect(a7.items[0].controlCode).toBe('A.7.1');
 });

 it('should have A.8 domain with technological controls', () => {
 const a8 = ISO27001_CHECKLISTS['A.8'];
 expect(a8.title).toBe('Contrôles Technologiques');
 expect(a8.items.length).toBeGreaterThan(0);
 expect(a8.items[0].controlCode).toBe('A.8.1');
 });

 it('should have all required properties for each item', () => {
 Object.values(ISO27001_CHECKLISTS).forEach((domain) => {
 domain.items.forEach((item) => {
 expect(item.controlCode).toBeTruthy();
 expect(item.controlName).toBeTruthy();
 expect(item.question).toBeTruthy();
 expect(item.guidance).toBeTruthy();
 });
 });
 });
});

describe('generateAuditChecklist', () => {
 it('should generate checklist for A.5 domain', () => {
 const checklist = generateAuditChecklist('audit-123', 'org-456', 'A.5');

 expect(checklist.auditId).toBe('audit-123');
 expect(checklist.organizationId).toBe('org-456');
 expect(checklist.domain).toBe('A.5');
 expect(checklist.items.length).toBe(ISO27001_CHECKLISTS['A.5'].items.length);
 expect(checklist.completionRate).toBe(0);
 });

 it('should generate checklist for A.6 domain', () => {
 const checklist = generateAuditChecklist('audit-123', 'org-456', 'A.6');

 expect(checklist.domain).toBe('A.6');
 expect(checklist.items.length).toBe(ISO27001_CHECKLISTS['A.6'].items.length);
 });

 it('should generate checklist for A.7 domain', () => {
 const checklist = generateAuditChecklist('audit-123', 'org-456', 'A.7');

 expect(checklist.domain).toBe('A.7');
 expect(checklist.items.length).toBe(ISO27001_CHECKLISTS['A.7'].items.length);
 });

 it('should generate checklist for A.8 domain', () => {
 const checklist = generateAuditChecklist('audit-123', 'org-456', 'A.8');

 expect(checklist.domain).toBe('A.8');
 expect(checklist.items.length).toBe(ISO27001_CHECKLISTS['A.8'].items.length);
 });

 it('should initialize items with not_started status', () => {
 const checklist = generateAuditChecklist('audit-123', 'org-456', 'A.5');

 checklist.items.forEach((item) => {
 expect(item.status).toBe('not_started');
 });
 });

 it('should generate unique IDs for items', () => {
 const checklist = generateAuditChecklist('audit-123', 'org-456', 'A.5');
 const ids = checklist.items.map((item) => item.id);
 const uniqueIds = new Set(ids);

 expect(uniqueIds.size).toBe(ids.length);
 });

 it('should include timestamps', () => {
 const checklist = generateAuditChecklist('audit-123', 'org-456', 'A.5');

 expect(checklist.createdAt).toBeTruthy();
 expect(checklist.updatedAt).toBeTruthy();
 });

 it('should initialize items with empty evidence array', () => {
 const checklist = generateAuditChecklist('audit-123', 'org-456', 'A.5');

 checklist.items.forEach((item) => {
 expect(item.evidence).toEqual([]);
 expect(item.notes).toBe('');
 });
 });
});

describe('calculateCompletionRate', () => {
 it('should return 0 for all not_started items', () => {
 const items: AuditChecklistItem[] = [
 { id: '1', controlCode: 'A.5.1', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_started' },
 { id: '2', controlCode: 'A.5.2', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_started' },
 ];

 expect(calculateCompletionRate(items)).toBe(0);
 });

 it('should return 100 for all completed items', () => {
 const items: AuditChecklistItem[] = [
 { id: '1', controlCode: 'A.5.1', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'compliant' },
 { id: '2', controlCode: 'A.5.2', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'non_compliant' },
 ];

 expect(calculateCompletionRate(items)).toBe(100);
 });

 it('should return 50 for half completed items', () => {
 const items: AuditChecklistItem[] = [
 { id: '1', controlCode: 'A.5.1', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'compliant' },
 { id: '2', controlCode: 'A.5.2', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_started' },
 ];

 expect(calculateCompletionRate(items)).toBe(50);
 });

 it('should count partial and not_applicable as completed', () => {
 const items: AuditChecklistItem[] = [
 { id: '1', controlCode: 'A.5.1', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'partial' },
 { id: '2', controlCode: 'A.5.2', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_applicable' },
 { id: '3', controlCode: 'A.5.3', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_started' },
 ];

 // 2 out of 3 are not 'not_started' = 67%
 expect(calculateCompletionRate(items)).toBe(67);
 });

 it('should round the result', () => {
 const items: AuditChecklistItem[] = [
 { id: '1', controlCode: 'A.5.1', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'compliant' },
 { id: '2', controlCode: 'A.5.2', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_started' },
 { id: '3', controlCode: 'A.5.3', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_started' },
 ];

 // 1 out of 3 = 33.33% rounded to 33
 expect(calculateCompletionRate(items)).toBe(33);
 });
});

describe('getComplianceScore', () => {
 it('should count items by status', () => {
 const items: AuditChecklistItem[] = [
 { id: '1', controlCode: 'A.5.1', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'compliant' },
 { id: '2', controlCode: 'A.5.2', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'compliant' },
 { id: '3', controlCode: 'A.5.3', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'partial' },
 { id: '4', controlCode: 'A.5.4', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'non_compliant' },
 { id: '5', controlCode: 'A.5.5', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_applicable' },
 { id: '6', controlCode: 'A.5.6', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'not_started' },
 ];

 const score = getComplianceScore(items);

 expect(score.compliant).toBe(2);
 expect(score.partial).toBe(1);
 expect(score.nonCompliant).toBe(1);
 expect(score.notApplicable).toBe(1);
 expect(score.notAssessed).toBe(1);
 });

 it('should return zeros for empty array', () => {
 const score = getComplianceScore([]);

 expect(score.compliant).toBe(0);
 expect(score.partial).toBe(0);
 expect(score.nonCompliant).toBe(0);
 expect(score.notApplicable).toBe(0);
 expect(score.notAssessed).toBe(0);
 });

 it('should handle all compliant items', () => {
 const items: AuditChecklistItem[] = [
 { id: '1', controlCode: 'A.5.1', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'compliant' },
 { id: '2', controlCode: 'A.5.2', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'compliant' },
 ];

 const score = getComplianceScore(items);

 expect(score.compliant).toBe(2);
 expect(score.partial).toBe(0);
 expect(score.nonCompliant).toBe(0);
 });

 it('should handle all non-compliant items', () => {
 const items: AuditChecklistItem[] = [
 { id: '1', controlCode: 'A.5.1', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'non_compliant' },
 { id: '2', controlCode: 'A.5.2', controlName: 'Test', question: 'Q?', guidance: 'G', status: 'non_compliant' },
 ];

 const score = getComplianceScore(items);

 expect(score.nonCompliant).toBe(2);
 expect(score.compliant).toBe(0);
 });
});
