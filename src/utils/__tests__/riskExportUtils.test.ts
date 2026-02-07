/**
 * Risk Export Utilities Tests
 * Story 3.5: Risk Register View - Export functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRiskSummaryStats } from '../riskExportUtils';
import { Risk } from '../../types';
import { RISK_COLORS } from '../../constants/colors';

// Mock ExcelExportService
vi.mock('../../services/excelExportService', () => ({
 ExcelExportService: {
 exportToExcel: vi.fn().mockResolvedValue(undefined),
 },
}));

// Mock PdfService
vi.mock('../../services/PdfService', () => ({
 PdfService: {
 generateRiskExecutiveReport: vi.fn().mockReturnValue({
 save: vi.fn(),
 }),
 },
}));

describe('riskExportUtils', () => {
 describe('getRiskSummaryStats', () => {
 const createMockRisk = (score: number, status: string): Risk => ({
 id: `risk-${Math.random()}`,
 organizationId: 'test-org',
 assetId: 'test-asset',
 owner: 'test-owner',
 threat: 'Test Threat',
 vulnerability: 'Test Vulnerability',
 probability: Math.ceil(score / 5) as Risk['probability'],
 impact: (score % 5 || 5) as Risk['impact'],
 score,
 status: status as Risk['status'],
 strategy: 'Atténuer',
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString(),
 });

 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should return correct total count', () => {
 const risks = [
 createMockRisk(5, 'Ouvert'),
 createMockRisk(10, 'En cours'),
 createMockRisk(15, 'Fermé'),
 ];

 const result = getRiskSummaryStats(risks);

 expect(result.total).toBe(3);
 });

 it('should return empty arrays for empty risks', () => {
 const result = getRiskSummaryStats([]);

 expect(result.total).toBe(0);
 expect(result.byCriticality.every(c => c.count === 0)).toBe(true);
 expect(result.byStatus.every(s => s.count === 0)).toBe(true);
 });

 it('should categorize risks by criticality levels', () => {
 const risks = [
 createMockRisk(2, 'Ouvert'), // Faible (< 5)
 createMockRisk(4, 'Ouvert'), // Faible (< 5)
 createMockRisk(7, 'Ouvert'), // Moyen (5-9)
 createMockRisk(12, 'Ouvert'), // Élevé (10-14)
 createMockRisk(15, 'Ouvert'), // Critique (>= 15)
 createMockRisk(20, 'Ouvert'), // Critique (>= 15)
 ];

 const result = getRiskSummaryStats(risks);

 const critical = result.byCriticality.find(c => c.label === 'Critique');
 const elevated = result.byCriticality.find(c => c.label === 'Élevé');
 const medium = result.byCriticality.find(c => c.label === 'Moyen');
 const low = result.byCriticality.find(c => c.label === 'Faible');

 expect(critical?.count).toBe(2);
 expect(elevated?.count).toBe(1);
 expect(medium?.count).toBe(1);
 expect(low?.count).toBe(2);
 });

 it('should include correct colors for criticality levels', () => {
 const risks = [createMockRisk(20, 'Ouvert')]; // 20 is Critique

 const result = getRiskSummaryStats(risks);

 const critical = result.byCriticality.find(c => c.label === 'Critique');

 expect(critical?.color).toBe(RISK_COLORS.critical);
 });

 it('should categorize risks by status', () => {
 const risks = [
 createMockRisk(5, 'Ouvert'),
 createMockRisk(5, 'Ouvert'),
 createMockRisk(5, 'En cours'),
 createMockRisk(5, 'En attente de validation'),
 createMockRisk(5, 'Fermé'),
 createMockRisk(5, 'Fermé'),
 createMockRisk(5, 'Fermé'),
 ];

 const result = getRiskSummaryStats(risks);

 const open = result.byStatus.find(s => s.label === 'Ouvert');
 const inProgress = result.byStatus.find(s => s.label === 'En cours');
 const pending = result.byStatus.find(s => s.label === 'En attente');
 const closed = result.byStatus.find(s => s.label === 'Fermé');

 expect(open?.count).toBe(2);
 expect(inProgress?.count).toBe(1);
 expect(pending?.count).toBe(1);
 expect(closed?.count).toBe(3);
 });

 it('should handle boundary score values correctly', () => {
 const risks = [
 createMockRisk(1, 'Ouvert'), // Faible boundary (< 5)
 createMockRisk(4, 'Ouvert'), // Faible boundary (< 5)
 createMockRisk(5, 'Ouvert'), // Moyen boundary (>= 5)
 createMockRisk(9, 'Ouvert'), // Moyen boundary (< 10)
 createMockRisk(10, 'Ouvert'), // Élevé boundary (>= 10)
 createMockRisk(14, 'Ouvert'), // Élevé boundary (< 15)
 createMockRisk(15, 'Ouvert'), // Critique boundary (>= 15)
 createMockRisk(25, 'Ouvert'), // Critique boundary (>= 15)
 ];

 const result = getRiskSummaryStats(risks);

 const critical = result.byCriticality.find(c => c.label === 'Critique');
 const elevated = result.byCriticality.find(c => c.label === 'Élevé');
 const medium = result.byCriticality.find(c => c.label === 'Moyen');
 const low = result.byCriticality.find(c => c.label === 'Faible');

 expect(critical?.count).toBe(2);
 expect(elevated?.count).toBe(2);
 expect(medium?.count).toBe(2);
 expect(low?.count).toBe(2);
 });

 it('should handle zero score as Faible', () => {
 const risks = [createMockRisk(0, 'Ouvert')];

 const result = getRiskSummaryStats(risks);

 const low = result.byCriticality.find(c => c.label === 'Faible');
 expect(low?.count).toBe(1);
 });

 it('should handle all statuses being the same', () => {
 const risks = [
 createMockRisk(5, 'En cours'),
 createMockRisk(10, 'En cours'),
 createMockRisk(15, 'En cours'),
 ];

 const result = getRiskSummaryStats(risks);

 const inProgress = result.byStatus.find(s => s.label === 'En cours');
 const open = result.byStatus.find(s => s.label === 'Ouvert');

 expect(inProgress?.count).toBe(3);
 expect(open?.count).toBe(0);
 });
 });
});
