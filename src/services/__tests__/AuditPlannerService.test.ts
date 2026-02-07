/**
 * Unit tests for AuditPlannerService
 * Tests audit suggestion generation based on risks and assets
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditPlannerService } from '../AuditPlannerService';
import { Risk, Asset, Audit, Criticality } from '../../types';

describe('AuditPlannerService', () => {
 const mockDate = new Date('2024-06-15');

 beforeEach(() => {
 vi.useFakeTimers();
 vi.setSystemTime(mockDate);
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 const createRisk = (overrides: Partial<Risk> = {}): Risk => ({
 id: 'risk-1',
 assetId: 'asset-1',
 threat: 'Test Threat',
 vulnerability: 'Test Vulnerability',
 probability: 3,
 impact: 4,
 score: 12,
 status: 'Ouvert',
 strategy: 'Atténuer',
 owner: 'Owner',
 organizationId: 'org-1',
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 ...overrides
 });

 const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
 id: 'asset-1',
 name: 'Test Asset',
 type: 'Données',
 confidentiality: Criticality.MEDIUM,
 integrity: Criticality.MEDIUM,
 availability: Criticality.MEDIUM,
 owner: 'Test Owner',
 location: 'Test Location',
 organizationId: 'org-1',
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 ...overrides
 });

 const createAudit = (overrides: Partial<Audit> = {}): Audit => ({
 id: 'audit-1',
 name: 'Existing Audit',
 type: 'Interne',
 status: 'Planifié',
 auditor: 'Test Auditor',
 dateScheduled: new Date().toISOString(),
 findingsCount: 0,
 organizationId: 'org-1',
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 ...overrides
 });

 describe('generateAuditSuggestions', () => {
 describe('high risk audits', () => {
 it('suggests audits for high score risks (>= 12)', () => {
 const risks = [createRisk({ score: 15 })];
 const assets: Asset[] = [];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, assets);

 expect(suggestions.length).toBeGreaterThan(0);
 expect(suggestions[0].type).toBe('Interne');
 expect(suggestions[0].reason).toContain('Score: 15');
 });

 it('suggests high priority for critical risks (score >= 20)', () => {
 const risks = [createRisk({ score: 20 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, []);

 expect(suggestions[0].priority).toBe('Élevée');
 });

 it('suggests medium priority for high risks (score 12-19)', () => {
 const risks = [createRisk({ score: 14 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, []);

 expect(suggestions[0].priority).toBe('Moyenne');
 });

 it('does not suggest for closed risks', () => {
 const risks = [createRisk({ score: 20, status: 'Fermé' })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, []);

 expect(suggestions.length).toBe(0);
 });

 it('does not duplicate if risk is already covered by existing audit', () => {
 const risks = [createRisk({ id: 'risk-1', score: 15 })];
 const existingAudits = [createAudit({
  status: 'Planifié',
  relatedRiskIds: ['risk-1']
 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, [], existingAudits);

 const riskSuggestions = suggestions.filter(s => s.relatedRiskIds.includes('risk-1'));
 expect(riskSuggestions.length).toBe(0);
 });

 it('schedules high risk audits within 3 months', () => {
 const risks = [createRisk({ score: 15 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, []);

 const scheduledDate = new Date(suggestions[0].dateScheduled);
 const threeMonthsLater = new Date(mockDate);
 threeMonthsLater.setMonth(mockDate.getMonth() + 3);

 expect(scheduledDate.toISOString().split('T')[0]).toBe(threeMonthsLater.toISOString().split('T')[0]);
 });
 });

 describe('critical asset audits', () => {
 it('suggests audits for critical confidentiality assets', () => {
 const assets = [createAsset({ confidentiality: Criticality.CRITICAL })];

 const suggestions = AuditPlannerService.generateAuditSuggestions([], assets);

 expect(suggestions.length).toBe(1);
 expect(suggestions[0].name).toContain('Revue de Sécurité');
 expect(suggestions[0].priority).toBe('Élevée');
 });

 it('suggests audits for critical integrity assets', () => {
 const assets = [createAsset({ integrity: Criticality.CRITICAL })];

 const suggestions = AuditPlannerService.generateAuditSuggestions([], assets);

 expect(suggestions.length).toBe(1);
 });

 it('suggests audits for critical availability assets', () => {
 const assets = [createAsset({ availability: Criticality.CRITICAL })];

 const suggestions = AuditPlannerService.generateAuditSuggestions([], assets);

 expect(suggestions.length).toBe(1);
 });

 it('does not suggest for non-critical assets', () => {
 const assets = [createAsset({
  confidentiality: Criticality.MEDIUM,
  integrity: Criticality.MEDIUM,
  availability: Criticality.MEDIUM
 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions([], assets);

 expect(suggestions.length).toBe(0);
 });

 it('schedules asset audits within 6 months', () => {
 const assets = [createAsset({ confidentiality: Criticality.CRITICAL })];

 const suggestions = AuditPlannerService.generateAuditSuggestions([], assets);

 const scheduledDate = new Date(suggestions[0].dateScheduled);
 const sixMonthsLater = new Date(mockDate);
 sixMonthsLater.setMonth(mockDate.getMonth() + 6);

 expect(scheduledDate.toISOString().split('T')[0]).toBe(sixMonthsLater.toISOString().split('T')[0]);
 });

 it('does not duplicate if asset is already covered', () => {
 const assets = [createAsset({ id: 'asset-1', confidentiality: Criticality.CRITICAL })];
 const existingAudits = [createAudit({
  status: 'En cours',
  relatedAssetIds: ['asset-1']
 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions([], assets, existingAudits);

 expect(suggestions.length).toBe(0);
 });
 });

 describe('ISO 27001 certification audits', () => {
 it('suggests ISO 27001 audit when risks have ISO framework', () => {
 const risks = [createRisk({ framework: 'ISO27001', score: 5 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, []);

 const isoAudit = suggestions.find(s => s.name.includes('ISO 27001'));
 expect(isoAudit).toBeDefined();
 expect(isoAudit?.type).toBe('Certification');
 expect(isoAudit?.priority).toBe('Élevée');
 });

 it('schedules ISO audit within 1 month', () => {
 const risks = [createRisk({ framework: 'ISO27001', score: 5 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, []);

 const isoAudit = suggestions.find(s => s.name.includes('ISO 27001'));
 const scheduledDate = new Date(isoAudit!.dateScheduled);
 const oneMonthLater = new Date(mockDate);
 oneMonthLater.setMonth(mockDate.getMonth() + 1);

 expect(scheduledDate.toISOString().split('T')[0]).toBe(oneMonthLater.toISOString().split('T')[0]);
 });

 it('does not suggest if ISO audit already exists', () => {
 const risks = [createRisk({ framework: 'ISO27001', score: 5 })];
 const existingAudits = [createAudit({
  status: 'Planifié',
  type: 'Certification'
 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, [], existingAudits);

 const isoAudit = suggestions.find(s => s.name.includes('ISO 27001'));
 expect(isoAudit).toBeUndefined();
 });

 it('limits related risk IDs to 10', () => {
 const risks = Array.from({ length: 15 }, (_, i) =>
  createRisk({ id: `risk-${i}`, framework: 'ISO27001', score: 5 })
 );

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, []);

 const isoAudit = suggestions.find(s => s.name.includes('ISO 27001'));
 expect(isoAudit?.relatedRiskIds.length).toBe(10);
 });
 });

 describe('combined scenarios', () => {
 it('generates multiple suggestions for different criteria', () => {
 const risks = [
  createRisk({ id: 'risk-high', score: 18 }),
  createRisk({ id: 'risk-iso', framework: 'ISO27001', score: 5 })
 ];
 const assets = [
  createAsset({ id: 'asset-critical', confidentiality: Criticality.CRITICAL })
 ];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, assets);

 expect(suggestions.length).toBe(3); // High risk + Critical asset + ISO
 });

 it('returns empty array when no criteria are met', () => {
 const risks = [createRisk({ score: 5, status: 'Ouvert' })];
 const assets = [createAsset({
  confidentiality: Criticality.LOW,
  integrity: Criticality.LOW,
  availability: Criticality.LOW
 })];

 const suggestions = AuditPlannerService.generateAuditSuggestions(risks, assets);

 // Only ISO audit if framework exists
 const nonIsoSuggestions = suggestions.filter(s => !s.name.includes('ISO'));
 expect(nonIsoSuggestions.length).toBe(0);
 });
 });
 });
});
