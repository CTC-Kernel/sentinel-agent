
/**
 * SupplierService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupplierService } from '../SupplierService';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {},
}));

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(() => ({ id: 'mock-collection' })),
 doc: vi.fn(() => ({ id: 'mock-doc-id' })),
 addDoc: vi.fn(() => Promise.resolve({ id: 'new-assessment-id' })),
 updateDoc: vi.fn(() => Promise.resolve()),
 getDocs: vi.fn(),
 getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({ name: 'Test Supplier', riskLevel: 'Medium', organizationId: 'org-1' }), id: 'supplier-1' })),
 deleteDoc: vi.fn(() => Promise.resolve()),
 query: vi.fn(),
 where: vi.fn(),
 writeBatch: vi.fn(() => ({
 set: vi.fn(),
 commit: vi.fn().mockResolvedValue(undefined),
 })),
 serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 warn: vi.fn(),
 info: vi.fn(),
 },
}));

vi.mock('../FunctionsService', () => ({
 FunctionsService: {
 deleteResource: vi.fn().mockResolvedValue(undefined),
 },
}));

vi.mock('../../utils/dataSanitizer', () => ({
 sanitizeData: vi.fn((data: unknown) => data),
}));

vi.mock('../auditLogService', () => ({
 AuditLogService: {
 logDelete: vi.fn().mockResolvedValue(undefined),
 logCreate: vi.fn().mockResolvedValue(undefined),
 logStatusChange: vi.fn().mockResolvedValue(undefined),
 logImport: vi.fn().mockResolvedValue(undefined),
 },
}));

vi.mock('../SupplierDoraSyncService', () => ({
 SupplierDoraSyncService: {
 syncToICTProvider: vi.fn().mockResolvedValue(true),
 },
}));

import { addDoc, updateDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { FunctionsService } from '../FunctionsService';
import type { SupplierQuestionnaireResponse, QuestionnaireTemplate } from '../../types';

const mockServiceUser = {
 uid: 'user-1',
 email: 'user@test.com',
 displayName: 'John Doe',
 organizationId: 'org-1',
};

describe('SupplierService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('calculateScore', () => {
 const createTemplate = (sections: QuestionnaireTemplate['sections']): QuestionnaireTemplate => ({
 id: 'template-1',
 organizationId: 'org-1',
 title: 'Test Template',
 description: 'Test Description',
 createdBy: 'user-1',
 sections,
 createdAt: '',
 updatedAt: '',
 });

 it('should calculate score for yes/no questions', () => {
 const template = createTemplate([
 {
  id: 'section-1',
  title: 'Security',
  weight: 1,
  questions: [
  { id: 'q1', text: 'Has ISO 27001?', type: 'yes_no', weight: 1, required: true },
  { id: 'q2', text: 'Has GDPR policy?', type: 'yes_no', weight: 1, required: true },
  ],
 },
 ]);

 const response: SupplierQuestionnaireResponse = {
 id: 'response-1',
 organizationId: 'org-1',
 supplierId: 'supplier-1',
 supplierName: 'Test Supplier',
 templateId: 'template-1',
 status: 'Submitted',
 answers: {
  q1: { value: true },
  q2: { value: false },
 },
 overallScore: 0,
 sentDate: '',
 };

 const result = SupplierService.calculateScore(response, template);

 expect(result.overallScore).toBe(50); // 1 out of 2 yes
 expect(result.sectionScores['section-1']).toBe(50);
 });

 it('should calculate score for rating questions', () => {
 const template = createTemplate([
 {
  id: 'section-1',
  title: 'Security',
  weight: 1,
  questions: [
  { id: 'q1', text: 'Rate security', type: 'rating', weight: 1, required: true },
  ],
 },
 ]);

 const response: SupplierQuestionnaireResponse = {
 id: 'response-1',
 organizationId: 'org-1',
 supplierId: 'supplier-1',
 supplierName: 'Test Supplier',
 templateId: 'template-1',
 status: 'Submitted',
 answers: {
  q1: { value: 4 }, // 4 out of 5
 },
 overallScore: 0,
 sentDate: '',
 };

 const result = SupplierService.calculateScore(response, template);

 expect(result.overallScore).toBe(80); // 4/5 * 100 = 80
 });

 it('should handle weighted sections', () => {
 const template = createTemplate([
 {
  id: 'section-1',
  title: 'Security',
  weight: 3, // High weight
  questions: [
  { id: 'q1', text: 'Q1', type: 'yes_no', weight: 1, required: true },
  ],
 },
 {
  id: 'section-2',
  title: 'Operations',
  weight: 1, // Low weight
  questions: [
  { id: 'q2', text: 'Q2', type: 'yes_no', weight: 1, required: true },
  ],
 },
 ]);

 const response: SupplierQuestionnaireResponse = {
 id: 'response-1',
 organizationId: 'org-1',
 supplierId: 'supplier-1',
 supplierName: 'Test Supplier',
 templateId: 'template-1',
 status: 'Submitted',
 answers: {
  q1: { value: true }, // Section 1: 100%
  q2: { value: false }, // Section 2: 0%
 },
 overallScore: 0,
 sentDate: '',
 };

 const result = SupplierService.calculateScore(response, template);

 // Weighted average: (100*3 + 0*1) / 4 = 75
 expect(result.overallScore).toBe(75);
 });

 it('should handle missing answers', () => {
 const template = createTemplate([
 {
  id: 'section-1',
  title: 'Security',
  weight: 1,
  questions: [
  { id: 'q1', text: 'Q1', type: 'yes_no', weight: 1, required: true },
  { id: 'q2', text: 'Q2', type: 'yes_no', weight: 1, required: true },
  ],
 },
 ]);

 const response: SupplierQuestionnaireResponse = {
 id: 'response-1',
 organizationId: 'org-1',
 supplierId: 'supplier-1',
 supplierName: 'Test Supplier',
 templateId: 'template-1',
 status: 'Draft',
 answers: {
  q1: { value: true },
  // q2 not answered - skipped in calculation
 },
 overallScore: 0,
 sentDate: '',
 };

 const result = SupplierService.calculateScore(response, template);

 // q1 answered with yes (100 * 1), q2 skipped - only counts answered questions
 // sectionMaxScore only increments for answered questions in this implementation
 expect(result.overallScore).toBe(100); // Only answered question is 100%
 });

 it('should handle multiple choice questions', () => {
 const template = createTemplate([
 {
  id: 'section-1',
  title: 'Security',
  weight: 1,
  questions: [
  { id: 'q1', text: 'Select options', type: 'multiple_choice', weight: 1, required: true },
  ],
 },
 ]);

 const response: SupplierQuestionnaireResponse = {
 id: 'response-1',
 organizationId: 'org-1',
 supplierId: 'supplier-1',
 supplierName: 'Test Supplier',
 templateId: 'template-1',
 status: 'Submitted',
 answers: {
  q1: { value: ['option1', 'option2'] },
 },
 overallScore: 0,
 sentDate: '',
 };

 const result = SupplierService.calculateScore(response, template);

 expect(result.overallScore).toBe(100); // Any selection = 100%
 });
 });

 describe('updateSupplierRiskFromAssessment', () => {
 it('should set risk level to Critical for score < 50', async () => {
 await SupplierService.updateSupplierRiskFromAssessment('supplier-1', 30, mockServiceUser);

 expect(updateDoc).toHaveBeenCalledWith(
 expect.anything(),
 expect.objectContaining({
  securityScore: 30,
  riskLevel: 'Critical',
 })
 );
 });

 it('should set risk level to High for score 50-69', async () => {
 await SupplierService.updateSupplierRiskFromAssessment('supplier-1', 60, mockServiceUser);

 expect(updateDoc).toHaveBeenCalledWith(
 expect.anything(),
 expect.objectContaining({
  riskLevel: 'High',
 })
 );
 });

 it('should set risk level to Medium for score 70-84', async () => {
 await SupplierService.updateSupplierRiskFromAssessment('supplier-1', 75, mockServiceUser);

 expect(updateDoc).toHaveBeenCalledWith(
 expect.anything(),
 expect.objectContaining({
  riskLevel: 'Medium',
 })
 );
 });

 it('should set risk level to Low for score >= 85', async () => {
 await SupplierService.updateSupplierRiskFromAssessment('supplier-1', 90, mockServiceUser);

 expect(updateDoc).toHaveBeenCalledWith(
 expect.anything(),
 expect.objectContaining({
  riskLevel: 'Low',
 })
 );
 });

 it('should handle update errors', async () => {
 vi.mocked(updateDoc).mockRejectedValue(new Error('Update failed'));

 await expect(
 SupplierService.updateSupplierRiskFromAssessment('supplier-1', 50, mockServiceUser)
 ).rejects.toThrow('Update failed');
 });
 });

 describe('createAssessment', () => {
 it('should create a new assessment', async () => {
 const template: QuestionnaireTemplate = {
 id: 'template-1',
 organizationId: 'org-1',
 title: 'Test Template',
 description: 'Test Description',
 createdBy: 'user-1',
 sections: [],
 createdAt: '',
 updatedAt: '',
 };

 const result = await SupplierService.createAssessment(
 'org-1',
 'supplier-1',
 'Test Supplier',
 template,
 mockServiceUser
 );

 expect(result).toBe('new-assessment-id');
 expect(addDoc).toHaveBeenCalledWith(
 expect.anything(),
 expect.objectContaining({
  organizationId: 'org-1',
  supplierId: 'supplier-1',
  supplierName: 'Test Supplier',
  templateId: 'template-1',
  status: 'Draft',
 })
 );
 });

 it('should handle creation errors', async () => {
 vi.mocked(addDoc).mockRejectedValue(new Error('Create failed'));

 await expect(
 SupplierService.createAssessment('org-1', 'supplier-1', 'Test', {} as QuestionnaireTemplate, mockServiceUser)
 ).rejects.toThrow('Create failed');
 });
 });

 describe('checkDependencies', () => {
 it('should return no dependencies when none exist', async () => {
 vi.mocked(getDocs)
 .mockResolvedValueOnce({ size: 0, docs: [], empty: true } as never)
 .mockResolvedValueOnce({ size: 0, docs: [], empty: true } as never);

 const result = await SupplierService.checkDependencies('supplier-1', 'org-1');

 expect(result.controls).toBe(0);
 expect(result.risks).toBe(0);
 expect(result.details).toBe('');
 });

 it('should return control dependencies', async () => {
 vi.mocked(getDocs)
 .mockResolvedValueOnce({
  size: 2,
  empty: false,
  docs: [
  { id: 'ctrl-1', data: () => ({ code: 'CTRL-001' }) },
  { id: 'ctrl-2', data: () => ({ code: 'CTRL-002' }) },
  ],
 } as never)
 .mockResolvedValueOnce({ size: 0, docs: [], empty: true } as never);

 const result = await SupplierService.checkDependencies('supplier-1', 'org-1');

 expect(result.controls).toBe(2);
 expect(result.details).toContain('contrôle');
 });

 it('should return risk dependencies', async () => {
 vi.mocked(getDocs)
 .mockResolvedValueOnce({ size: 0, docs: [], empty: true } as never)
 .mockResolvedValueOnce({
  size: 3,
  empty: false,
  docs: [
  { id: 'risk-1', data: () => ({ threat: 'Risk 1' }) },
  { id: 'risk-2', data: () => ({ threat: 'Risk 2' }) },
  { id: 'risk-3', data: () => ({ threat: 'Risk 3' }) },
  ],
 } as never);

 const result = await SupplierService.checkDependencies('supplier-1', 'org-1');

 expect(result.risks).toBe(3);
 expect(result.details).toContain('risque');
 });
 });

 describe('deleteSupplierWithCascade', () => {
 it('should delete supplier and clean up child resources', async () => {
 vi.mocked(getDocs)
 .mockResolvedValueOnce({
  docs: [{ id: 'assessment-1', ref: { id: 'assessment-1' } }],
 } as never)
 .mockResolvedValueOnce({
  docs: [{ id: 'incident-1', ref: { id: 'incident-1' } }],
 } as never);

 await SupplierService.deleteSupplierWithCascade('supplier-1', mockServiceUser);

 expect(FunctionsService.deleteResource).toHaveBeenCalledWith('suppliers', 'supplier-1');
 expect(deleteDoc).toHaveBeenCalledTimes(2); // 1 assessment + 1 incident
 });

 it('should handle deletion errors', async () => {
 vi.mocked(FunctionsService.deleteResource).mockRejectedValue(new Error('Delete blocked'));

 await expect(
 SupplierService.deleteSupplierWithCascade('supplier-1', mockServiceUser)
 ).rejects.toThrow('Delete blocked');
 });
 });

 describe('importSuppliersFromCSV', () => {
 it('should import suppliers from CSV with French headers', async () => {
 const csvData = [
 { Nom: 'Supplier 1', Catégorie: 'Cloud', Criticité: 'Haute' },
 { Nom: 'Supplier 2', Catégorie: 'SaaS', Criticité: 'Moyenne' },
 ];

 const result = await SupplierService.importSuppliersFromCSV(
 csvData,
 'org-1',
 'user-1',
 'John Doe'
 );

 expect(result).toBe(2);
 expect(writeBatch).toHaveBeenCalled();
 });

 it('should import suppliers with English headers', async () => {
 const csvData = [
 { Name: 'Supplier EN', Category: 'Cloud', Criticality: 'High' },
 ];

 const result = await SupplierService.importSuppliersFromCSV(
 csvData,
 'org-1',
 'user-1',
 'John Doe'
 );

 expect(result).toBe(1);
 });

 it('should handle empty names with positional values', async () => {
 const csvData = [
 { 0: 'Positional Name', 1: 'Category', 2: 'High' },
 ];

 const result = await SupplierService.importSuppliersFromCSV(
 csvData,
 'org-1',
 'user-1',
 'John Doe'
 );

 expect(result).toBe(1);
 });

 it('should handle import errors', async () => {
 const mockBatch = {
 set: vi.fn(),
 commit: vi.fn().mockRejectedValue(new Error('Batch failed')),
 };
 vi.mocked(writeBatch).mockReturnValue(mockBatch as never);

 const csvData = [{ Nom: 'Supplier 1' }];

 await expect(
 SupplierService.importSuppliersFromCSV(csvData, 'org-1', 'user-1', 'John')
 ).rejects.toThrow('Batch failed');
 });
 });
});
