/**
 * ComplianceService Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { ComplianceService } from '../ComplianceService';
import { Control, Document, Risk } from '../../types';

describe('ComplianceService', () => {
 const mockControls: Control[] = [
 {
 id: 'ctrl-1',
 organizationId: 'org-1',
 code: 'A.5.1',
 name: 'Policies for information security',
 description: 'Policy control',
 status: 'Implémenté',
 framework: 'ISO27001',
 // category: 'Organizational',
 // priority: 'Élevée',
 owner: 'Owner',
 evidenceIds: [],
 // linkedRiskIds: [],
 // createdAt: new Date().toISOString(),
 // updatedAt: new Date().toISOString(),
 },
 {
 id: 'ctrl-2',
 organizationId: 'org-1',
 code: 'A.8.12',
 name: 'Data leakage prevention',
 description: 'DLP control',
 status: 'Non commencé',
 framework: 'ISO27001',
 // category: 'Technical',
 // priority: 'Moyenne',
 owner: 'Owner',
 evidenceIds: [],
 // linkedRiskIds: [],
 // createdAt: new Date().toISOString(),
 // updatedAt: new Date().toISOString(),
 },
 ];

 const mockDocuments: Document[] = [
 {
 id: 'doc-1',
 organizationId: 'org-1',
 title: 'Politique de sécurité A.5.1',
 description: 'Main security policy',
 type: 'Politique',
 status: 'Approuvé',
 // category: 'Security',
 version: '1.0',
 owner: 'Owner',
 ownerId: 'user-1',
 // fileUrl: 'https://example.com/doc1.pdf',
 // fileName: 'policy.pdf',
 // fileSize: 1024,
 // mimeType: 'application/pdf',
 // relatedControlIds: [],
 // relatedRiskIds: [],
 // tags: [],
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 },
 {
 id: 'doc-2',
 organizationId: 'org-1',
 title: 'Procédure DLP fuite données',
 description: 'DLP procedure',
 type: 'Procédure',
 status: 'Brouillon',
 // category: 'Security',
 version: '1.0',
 owner: 'Owner',
 ownerId: 'user-1',
 // fileUrl: 'https://example.com/doc2.pdf',
 // fileName: 'dlp.pdf',
 // fileSize: 2048,
 // mimeType: 'application/pdf',
 // relatedControlIds: [],
 // relatedRiskIds: [],
 // tags: [],
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 },
 ];

 describe('suggestEvidenceLinks', () => {
 it('should find document matching control code', () => {
 const suggestions = ComplianceService.suggestEvidenceLinks(mockControls, mockDocuments);

 // Document 'Politique de sécurité A.5.1' should match control A.5.1
 const matchingCtrl1 = suggestions.filter(s => s.controlId === 'ctrl-1');
 expect(matchingCtrl1.length).toBeGreaterThan(0);
 expect(matchingCtrl1[0].confidence).toBe(0.9); // High confidence for code match
 });

 it('should find document matching keywords', () => {
 const suggestions = ComplianceService.suggestEvidenceLinks(mockControls, mockDocuments);

 // Document 'Procédure DLP fuite données' should match control A.8.12 (DLP, fuite)
 const matchingCtrl2 = suggestions.filter(s => s.controlId === 'ctrl-2');
 expect(matchingCtrl2.length).toBeGreaterThan(0);
 });

 it('should return empty array when no matches', () => {
 const noMatchDocuments: Document[] = [
 {
  id: 'doc-3',
  organizationId: 'org-1',
  title: 'Random unrelated document',
  description: 'Something else',
  type: 'Autre',
  status: 'Brouillon',
  // category: 'Other',
  version: '1.0',
  owner: 'Owner',
  ownerId: 'user-1',
  // fileUrl: 'https://example.com/doc3.pdf',
  // fileName: 'random.pdf',
  // fileSize: 512,
  // mimeType: 'application/pdf',
  // relatedControlIds: [],
  // relatedRiskIds: [],
  // tags: [],
  createdAt: new Date(Date.now()).toISOString(),
  updatedAt: new Date(Date.now()).toISOString(),
 },
 ];

 const suggestions = ComplianceService.suggestEvidenceLinks(mockControls, noMatchDocuments);
 expect(suggestions).toHaveLength(0);
 });

 it('should not suggest already linked documents', () => {
 const controlsWithEvidence = [
 {
  ...mockControls[0],
  evidenceIds: ['doc-1'], // Already linked
 },
 ];

 const suggestions = ComplianceService.suggestEvidenceLinks(controlsWithEvidence, mockDocuments);
 const matchingDoc1 = suggestions.filter(s => s.documentId === 'doc-1');
 expect(matchingDoc1).toHaveLength(0);
 });
 });

 describe('suggestSoAJustification', () => {
 it('should generate justification with linked risks', () => {
 const linkedRisks: Risk[] = [
 {
  id: 'risk-1',
  organizationId: 'org-1',
  threat: 'Data breach',
  vulnerability: 'Weak encryption',
  scenario: 'Test scenario',
  probability: 3,
  impact: 4,
  residualProbability: 2,
  residualImpact: 3,
  score: 12,
  residualScore: 6,
  status: 'Ouvert',
  strategy: 'Atténuer',
  framework: 'ISO27005',
  assetId: 'asset-1',
  owner: 'Owner',
  mitigationControlIds: ['ctrl-1'],
  affectedProcessIds: [],
  relatedSupplierIds: [],
  createdAt: new Date(Date.now()).toISOString(),
  updatedAt: new Date(Date.now()).toISOString(),
 },
 ];

 const justification = ComplianceService.suggestSoAJustification(mockControls[0], linkedRisks);

 expect(justification).toContain('Data breach');
 expect(justification).toContain('risques');
 });

 it('should handle empty linked risks', () => {
 const justification = ComplianceService.suggestSoAJustification(mockControls[0], []);

 expect(typeof justification).toBe('string');
 });
 });
});
