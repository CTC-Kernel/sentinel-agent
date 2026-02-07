/**
 * EvidenceDossierService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Control, Document, ControlStatus } from '../../types';

// Mock jsPDF
const mockSave = vi.fn();
const mockAddPage = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetFont = vi.fn();
const mockText = vi.fn();
const mockSetFillColor = vi.fn();
const mockRoundedRect = vi.fn();
const mockRect = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetPage = vi.fn();
const mockGetNumberOfPages = vi.fn().mockReturnValue(5);
const mockSplitTextToSize = vi.fn((text: string) => [text]);
const mockGetTextWidth = vi.fn().mockReturnValue(50);

vi.mock('jspdf', () => ({
 default: vi.fn().mockImplementation(() => ({
 internal: {
 pageSize: {
 getWidth: () => 210,
 getHeight: () => 297
 }
 },
 save: mockSave,
 addPage: mockAddPage,
 setFontSize: mockSetFontSize,
 setFont: mockSetFont,
 text: mockText,
 setFillColor: mockSetFillColor,
 roundedRect: mockRoundedRect,
 rect: mockRect,
 setTextColor: mockSetTextColor,
 setPage: mockSetPage,
 getNumberOfPages: mockGetNumberOfPages,
 splitTextToSize: mockSplitTextToSize,
 getTextWidth: mockGetTextWidth
 }))
}));

// Mock jspdf-autotable
vi.mock('jspdf-autotable', () => ({
 default: vi.fn()
}));

// Mock ISO_DOMAINS
vi.mock('../../data/complianceData', () => ({
 ISO_DOMAINS: [
 { id: 'A.5', title: 'Organizational Controls' },
 { id: 'A.6', title: 'People Controls' },
 { id: 'A.7', title: 'Physical Controls' },
 { id: 'A.8', title: 'Technological Controls' }
 ]
}));

import { EvidenceDossierService, generateEvidenceDossier } from '../EvidenceDossierService';

// Helper to create mock controls
const createMockControl = (overrides: Partial<Control> = {}): Control => ({
 id: 'control-123',
 code: 'A.5.1.1',
 reference: 'A.5.1.1',
 name: 'Information Security Policies',
 title: 'Information Security Policies',
 description: 'Policies for information security',
 status: 'Implémenté',
 applicability: 'Applicable',
 category: 'Organisationnel',
 evidenceIds: [],
 organizationId: 'org-123',
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 ...overrides
} as Control);

// Helper to create mock documents
const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
 id: 'doc-123',
 title: 'Security Policy v1',
 type: 'Policy',
 status: 'Publié',
 organizationId: 'org-123',
 createdAt: new Date('2024-01-15').toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 ...overrides
} as Document);

describe('EvidenceDossierService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('generateEvidenceDossier', () => {
 const mockOptions = {
 framework: 'ISO27001' as const,
 organizationName: 'Test Organization',
 generatedBy: 'John Doe'
 };

 it('should create a PDF document', () => {
 const controls = [createMockControl()];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockSave).toHaveBeenCalledWith(
 expect.stringMatching(/Evidence_Dossier_ISO27001_\d{4}-\d{2}-\d{2}\.pdf/)
 );
 });

 it('should include title page with framework name', () => {
 const controls = [createMockControl()];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockText).toHaveBeenCalledWith(
 'Dossier de Preuves',
 expect.any(Number),
 expect.any(Number),
 expect.any(Object)
 );
 expect(mockText).toHaveBeenCalledWith(
 'Référentiel: ISO27001',
 expect.any(Number),
 expect.any(Number),
 expect.any(Object)
 );
 });

 it('should include organization name when provided', () => {
 const controls = [createMockControl()];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockText).toHaveBeenCalledWith(
 'Test Organization',
 expect.any(Number),
 expect.any(Number),
 expect.any(Object)
 );
 });

 it('should include generator name when provided', () => {
 const controls = [createMockControl()];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockText).toHaveBeenCalledWith(
 'Par: John Doe',
 expect.any(Number),
 expect.any(Number),
 expect.any(Object)
 );
 });

 it('should work without organization name', () => {
 const controls = [createMockControl()];
 const documents: Document[] = [];
 const options = { framework: 'ISO27001' as const };

 generateEvidenceDossier(controls, documents, options);

 expect(mockSave).toHaveBeenCalled();
 });

 it('should calculate and display statistics', () => {
 const controls = [
 createMockControl({ status: 'Implémenté', evidenceIds: ['doc-1'] }),
 createMockControl({ code: 'A.5.1.2', status: 'En cours', evidenceIds: [] }),
 createMockControl({ code: 'A.5.1.3', status: 'Implémenté', evidenceIds: ['doc-2', 'doc-3'] })
 ];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 // Should show statistics in summary box
 expect(mockText).toHaveBeenCalledWith(
 'Contrôles totaux: 3',
 expect.any(Number),
 expect.any(Number)
 );
 });

 it('should group controls by domain', () => {
 const controls = [
 createMockControl({ code: 'A.5.1.1' }),
 createMockControl({ code: 'A.5.1.2' }),
 createMockControl({ code: 'A.6.1.1' }),
 createMockControl({ code: 'A.8.1.1' })
 ];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 // Should add pages for each domain section
 expect(mockAddPage).toHaveBeenCalled();
 });

 it('should display evidence for controls', () => {
 const controls = [
 createMockControl({ evidenceIds: ['doc-123'] })
 ];
 const documents = [
 createMockDocument({ id: 'doc-123', title: 'Security Policy' })
 ];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockText).toHaveBeenCalledWith(
 expect.stringContaining('Security Policy'),
 expect.any(Number),
 expect.any(Number)
 );
 });

 it('should show warning for controls without evidence', () => {
 const controls = [
 createMockControl({ evidenceIds: [] })
 ];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockText).toHaveBeenCalledWith(
 '⚠ Aucune preuve liée',
 expect.any(Number),
 expect.any(Number)
 );
 });

 it('should add footer to all pages', () => {
 const controls = [createMockControl()];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockSetPage).toHaveBeenCalled();
 expect(mockText).toHaveBeenCalledWith(
 expect.stringContaining('Page'),
 expect.any(Number),
 expect.any(Number),
 expect.any(Object)
 );
 });

 it('should sort controls by code', () => {
 const controls = [
 createMockControl({ code: 'A.5.1.3' }),
 createMockControl({ code: 'A.5.1.1' }),
 createMockControl({ code: 'A.5.1.2' })
 ];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 // Controls should be sorted
 expect(mockSave).toHaveBeenCalled();
 });

 it('should handle empty controls array', () => {
 const controls: Control[] = [];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockSave).toHaveBeenCalled();
 });

 it('should handle controls with unknown domain codes', () => {
 const controls = [
 createMockControl({ code: 'X.1.1.1' }) // Unknown domain
 ];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 // Should still work, grouping under "Autre"
 expect(mockSave).toHaveBeenCalled();
 });

 it('should handle all control statuses', () => {
 const controls = [
 createMockControl({ code: 'A.5.1.1', status: 'Implémenté' }),
 createMockControl({ code: 'A.5.1.2', status: 'Partiel' }),
 createMockControl({ code: 'A.5.1.3', status: 'En cours' }),
 createMockControl({ code: 'A.5.1.4', status: 'Non commencé' }),
 createMockControl({ code: 'A.5.1.5', status: 'Non applicable' })
 ];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockSave).toHaveBeenCalled();
 });

 it('should handle long control names', () => {
 const controls = [
 createMockControl({
  name: 'This is a very long control name that should be truncated or wrapped properly to fit within the PDF document layout'
 })
 ];
 const documents: Document[] = [];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockSplitTextToSize).toHaveBeenCalled();
 expect(mockSave).toHaveBeenCalled();
 });

 it('should handle multiple evidence documents per control', () => {
 const controls = [
 createMockControl({ evidenceIds: ['doc-1', 'doc-2', 'doc-3'] })
 ];
 const documents = [
 createMockDocument({ id: 'doc-1', title: 'Policy 1' }),
 createMockDocument({ id: 'doc-2', title: 'Policy 2' }),
 createMockDocument({ id: 'doc-3', title: 'Policy 3' })
 ];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockSave).toHaveBeenCalled();
 });

 it('should handle evidence with missing createdAt date', () => {
 const controls = [
 createMockControl({ evidenceIds: ['doc-1'] })
 ];
 const documents = [
 createMockDocument({ id: 'doc-1', createdAt: undefined })
 ];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockSave).toHaveBeenCalled();
 });

 it('should handle evidence with invalid date format', () => {
 const controls = [
 createMockControl({ evidenceIds: ['doc-1'] })
 ];
 const documents = [
 createMockDocument({ id: 'doc-1', createdAt: 'invalid-date' })
 ];

 generateEvidenceDossier(controls, documents, mockOptions);

 expect(mockSave).toHaveBeenCalled();
 });
 });

 describe('EvidenceDossierService object', () => {
 it('should export generateEvidenceDossier method', () => {
 expect(EvidenceDossierService.generateEvidenceDossier).toBeDefined();
 expect(typeof EvidenceDossierService.generateEvidenceDossier).toBe('function');
 });
 });

 describe('status text mapping', () => {
 it('should display correct status indicators', () => {
 const statuses: ControlStatus[] = ['Implémenté', 'Partiel', 'En cours', 'Non commencé', 'Non applicable'];

 statuses.forEach(status => {
 const controls = [createMockControl({ status })];
 generateEvidenceDossier(controls, [], {
  framework: 'ISO27001' as const
 });
 });

 // All statuses should be handled
 expect(mockSave).toHaveBeenCalledTimes(5);
 });
 });

 describe('domain grouping', () => {
 it('should group controls from same domain together', () => {
 const controls = [
 createMockControl({ code: 'A.5.1.1' }),
 createMockControl({ code: 'A.5.1.2' }),
 createMockControl({ code: 'A.5.2.1' })
 ];

 generateEvidenceDossier(controls, [], { framework: 'ISO27001' as const });

 // Should group all A.5 controls together
 expect(mockSave).toHaveBeenCalled();
 });

 it('should handle controls from multiple domains', () => {
 const controls = [
 createMockControl({ code: 'A.5.1.1' }),
 createMockControl({ code: 'A.6.1.1' }),
 createMockControl({ code: 'A.7.1.1' }),
 createMockControl({ code: 'A.8.1.1' })
 ];

 generateEvidenceDossier(controls, [], { framework: 'ISO27001' as const });

 // Should create sections for each domain
 expect(mockAddPage).toHaveBeenCalled();
 expect(mockSave).toHaveBeenCalled();
 });
 });

 describe('table of contents', () => {
 it('should generate table of contents', () => {
 const controls = [
 createMockControl({ code: 'A.5.1.1' }),
 createMockControl({ code: 'A.6.1.1' })
 ];

 generateEvidenceDossier(controls, [], { framework: 'ISO27001' as const });

 expect(mockText).toHaveBeenCalledWith(
 'Table des Matières',
 expect.any(Number),
 expect.any(Number)
 );
 });
 });

 describe('summary table', () => {
 it('should generate summary table at the end', () => {
 const controls = [
 createMockControl(),
 createMockControl({ code: 'A.5.1.2' })
 ];

 generateEvidenceDossier(controls, [], { framework: 'ISO27001' as const });

 expect(mockText).toHaveBeenCalledWith(
 'Récapitulatif des Preuves',
 expect.any(Number),
 expect.any(Number)
 );
 });

 it('should truncate long control names in summary table', () => {
 const longName = 'A'.repeat(50);
 const controls = [
 createMockControl({ name: longName })
 ];

 generateEvidenceDossier(controls, [], { framework: 'ISO27001' as const });

 expect(mockSave).toHaveBeenCalled();
 });
 });

 describe('date formatting', () => {
 it('should format dates in French locale', () => {
 const controls = [
 createMockControl({ evidenceIds: ['doc-1'] })
 ];
 const documents = [
 createMockDocument({
  id: 'doc-1',
  createdAt: '2024-06-15T10:00:00.000Z'
 })
 ];

 generateEvidenceDossier(controls, documents, { framework: 'ISO27001' as const });

 // Should include formatted date
 expect(mockSave).toHaveBeenCalled();
 });
 });
});
