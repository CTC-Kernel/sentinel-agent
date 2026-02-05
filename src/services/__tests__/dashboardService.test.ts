/**
 * DashboardService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardService, DashboardCounts, OrganizationDetails } from '../dashboardService';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {}
}));

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(() => ({})),
 query: vi.fn(() => ({})),
 where: vi.fn(() => ({})),
 doc: vi.fn(() => ({})),
 getDoc: vi.fn(() => Promise.resolve({
 exists: () => true,
 data: () => ({
 name: 'Test Organization',
 logoUrl: 'https://example.com/logo.png',
 summary: 'Test summary',
 generatedAt: '2024-01-01T00:00:00Z',
 metricsSnapshot: { compliance: 85 }
 })
 })),
 setDoc: vi.fn(() => Promise.resolve()),
 getCountFromServer: vi.fn(() => Promise.resolve({
 data: () => ({ count: 10 })
 }))
}));

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 warn: vi.fn()
 }
}));

describe('DashboardService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 // Suppress console.error/warn for cleaner test output
 vi.spyOn(console, 'error').mockImplementation(() => { });
 vi.spyOn(console, 'warn').mockImplementation(() => { });
 });

 afterEach(() => {
 vi.restoreAllMocks();
 });

 describe('getOrganizationDetails', () => {
 it('should return organization details', async () => {
 const details = await DashboardService.getOrganizationDetails('org-1');

 expect(details).not.toBeNull();
 expect(details?.name).toBe('Test Organization');
 expect(details?.logoUrl).toBe('https://example.com/logo.png');
 });

 it('should return null if organization does not exist', async () => {
 const { getDoc } = await import('firebase/firestore');
 vi.mocked(getDoc).mockResolvedValueOnce({
 exists: () => false,
 data: () => null
 } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never);

 const details = await DashboardService.getOrganizationDetails('non-existent');

 expect(details).toBeNull();
 });

 it('should throw on error', async () => {
 const { getDoc } = await import('firebase/firestore');
 vi.mocked(getDoc).mockRejectedValueOnce(new Error('Firestore error'));

 await expect(DashboardService.getOrganizationDetails('org-1')).rejects.toThrow();
 });
 });

 describe('getDashboardCounts', () => {
 it('should return dashboard counts', async () => {
 const counts = await DashboardService.getDashboardCounts('org-1');

 expect(counts).toHaveProperty('activeIncidentsCount');
 expect(counts).toHaveProperty('openAuditsCount');
 expect(typeof counts.activeIncidentsCount).toBe('number');
 expect(typeof counts.openAuditsCount).toBe('number');
 });

 it('should handle incident count errors gracefully', async () => {
 const { getCountFromServer } = await import('firebase/firestore');
 vi.mocked(getCountFromServer)
 .mockRejectedValueOnce(new Error('Incident error'))
 .mockResolvedValueOnce({ data: () => ({ count: 5 }) } as ReturnType<typeof getCountFromServer> extends Promise<infer T> ? T : never);

 const counts = await DashboardService.getDashboardCounts('org-1');

 expect(counts.activeIncidentsCount).toBe(0);
 expect(counts.openAuditsCount).toBe(5);
 });

 it('should return zeros on complete failure', async () => {
 const { getCountFromServer } = await import('firebase/firestore');
 vi.mocked(getCountFromServer).mockRejectedValue(new Error('All queries failed'));

 const counts = await DashboardService.getDashboardCounts('org-1');

 expect(counts.activeIncidentsCount).toBe(0);
 expect(counts.openAuditsCount).toBe(0);
 });
 });

 describe('getAggregatedStats', () => {
 it('should return aggregated statistics', async () => {
 const stats = await DashboardService.getAggregatedStats('org-1');

 expect(stats).toHaveProperty('totalRisks');
 expect(stats).toHaveProperty('highRisks');
 expect(stats).toHaveProperty('mediumRisks');
 expect(stats).toHaveProperty('lowRisks');
 expect(stats).toHaveProperty('totalAssets');
 expect(stats).toHaveProperty('controlsStats');
 });

 it('should return controls stats with all fields', async () => {
 const stats = await DashboardService.getAggregatedStats('org-1');

 expect(stats.controlsStats).toHaveProperty('implemented');
 expect(stats.controlsStats).toHaveProperty('actionable');
 expect(stats.controlsStats).toHaveProperty('total');
 });

 it('should handle partial failures gracefully', async () => {
 const { getCountFromServer } = await import('firebase/firestore');
 let callCount = 0;
 vi.mocked(getCountFromServer).mockImplementation(() => {
 callCount++;
 if (callCount === 1) {
  return Promise.reject(new Error('Query failed'));
 }
 return Promise.resolve({ data: () => ({ count: 5 }) } as ReturnType<typeof getCountFromServer> extends Promise<infer T> ? T : never);
 });

 const stats = await DashboardService.getAggregatedStats('org-1');

 // First query fails, returns 0
 expect(stats.totalRisks).toBe(0);
 // Other queries succeed
 expect(stats.highRisks).toBe(5);
 });

 it('should return all zeros on complete failure', async () => {
 const { query } = await import('firebase/firestore');
 vi.mocked(query).mockImplementation(() => {
 throw new Error('Query construction failed');
 });

 const stats = await DashboardService.getAggregatedStats('org-1');

 expect(stats.totalRisks).toBe(0);
 expect(stats.highRisks).toBe(0);
 expect(stats.mediumRisks).toBe(0);
 expect(stats.lowRisks).toBe(0);
 expect(stats.totalAssets).toBe(0);
 expect(stats.controlsStats.implemented).toBe(0);
 });
 });

 describe('getExecutiveSummary', () => {
 it('should return executive summary if exists', async () => {
 const summary = await DashboardService.getExecutiveSummary('org-1');

 expect(summary).not.toBeNull();
 expect(summary?.summary).toBe('Test summary');
 expect(summary?.generatedAt).toBe('2024-01-01T00:00:00Z');
 });

 it('should return null if summary does not exist', async () => {
 const { getDoc } = await import('firebase/firestore');
 vi.mocked(getDoc).mockResolvedValueOnce({
 exists: () => false,
 data: () => null
 } as ReturnType<typeof getDoc> extends Promise<infer T> ? T : never);

 const summary = await DashboardService.getExecutiveSummary('org-1');

 expect(summary).toBeNull();
 });

 it('should return null on error', async () => {
 const { getDoc } = await import('firebase/firestore');
 vi.mocked(getDoc).mockRejectedValueOnce(new Error('Firestore error'));

 const summary = await DashboardService.getExecutiveSummary('org-1');

 expect(summary).toBeNull();
 });

 it('should include metrics snapshot if available', async () => {
 const summary = await DashboardService.getExecutiveSummary('org-1');

 expect(summary?.metricsSnapshot).toBeDefined();
 expect(summary?.metricsSnapshot?.compliance).toBe(85);
 });
 });

 describe('saveExecutiveSummary', () => {
 it('should save summary with timestamp', async () => {
 const { setDoc } = await import('firebase/firestore');

 await DashboardService.saveExecutiveSummary(
 'org-1',
 'New summary',
 '2024-02-01T00:00:00Z',
 { compliance: 90 }
 );

 expect(setDoc).toHaveBeenCalledWith(
 expect.anything(),
 expect.objectContaining({
  summary: 'New summary',
  generatedAt: '2024-02-01T00:00:00Z',
  metricsSnapshot: { compliance: 90 }
 }),
 { merge: true }
 );
 });

 it('should handle save without metrics snapshot', async () => {
 const { setDoc } = await import('firebase/firestore');

 await DashboardService.saveExecutiveSummary(
 'org-1',
 'Summary without metrics',
 '2024-02-01T00:00:00Z'
 );

 expect(setDoc).toHaveBeenCalledWith(
 expect.anything(),
 expect.objectContaining({
  summary: 'Summary without metrics',
  metricsSnapshot: null,
  updatedAt: expect.any(String)
 }),
 { merge: true }
 );
 });

 it('should log error on failure', async () => {
 const { setDoc } = await import('firebase/firestore');
 vi.mocked(setDoc).mockRejectedValueOnce(new Error('Save failed'));
 const { ErrorLogger } = await import('../errorLogger');

 await DashboardService.saveExecutiveSummary('org-1', 'Summary', '2024-01-01');

 expect(ErrorLogger.error).toHaveBeenCalledWith(
 expect.any(Error),
 'DashboardService.saveExecutiveSummary'
 );
 });
 });
});

describe('DashboardCounts interface', () => {
 it('should have correct structure', () => {
 const counts: DashboardCounts = {
 activeIncidentsCount: 5,
 openAuditsCount: 3
 };

 expect(counts.activeIncidentsCount).toBe(5);
 expect(counts.openAuditsCount).toBe(3);
 });
});

describe('OrganizationDetails interface', () => {
 it('should have correct structure', () => {
 const details: OrganizationDetails = {
 name: 'Test Org',
 logoUrl: 'https://example.com/logo.png'
 };

 expect(details.name).toBe('Test Org');
 expect(details.logoUrl).toBe('https://example.com/logo.png');
 });

 it('should allow optional logoUrl', () => {
 const details: OrganizationDetails = {
 name: 'Test Org'
 };

 expect(details.name).toBe('Test Org');
 expect(details.logoUrl).toBeUndefined();
 });
});
