/**
 * Unit tests for dependencyService
 * Tests dependency checking for risks, assets, and controls
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => ({
 collection: (...args: unknown[]) => mockCollection(...args),
 query: (...args: unknown[]) => mockQuery(...args),
 where: (...args: unknown[]) => mockWhere(...args),
 limit: (...args: unknown[]) => mockLimit(...args),
 getDocs: (...args: unknown[]) => mockGetDocs(...args)
}));

vi.mock('../../firebase', () => ({
 db: {}
}));

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

import { DependencyService } from '../dependencyService';
import { ErrorLogger } from '../errorLogger';

describe('DependencyService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockCollection.mockReturnValue('collection');
 mockQuery.mockReturnValue('query');
 mockWhere.mockReturnValue('where');
 mockLimit.mockReturnValue('limit');
 });

 describe('checkRiskDependencies', () => {
 it('returns no dependencies for empty riskId', async () => {
 const result = await DependencyService.checkRiskDependencies('', 'org-1');

 expect(result.hasDependencies).toBe(false);
 expect(result.dependencies).toEqual([]);
 expect(result.canDelete).toBe(true);
 });

 it('returns no dependencies for empty organizationId', async () => {
 const result = await DependencyService.checkRiskDependencies('risk-1', '');

 expect(result.hasDependencies).toBe(false);
 expect(result.canDelete).toBe(true);
 });

 it('returns true and dependencies when linked to controls', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: [{ id: 'ctrl-1', data: () => ({ code: 'A.1.1' }) }]
 }).mockResolvedValueOnce({
 docs: []
 }).mockResolvedValueOnce({
 docs: []
 });

 const result = await DependencyService.checkRiskDependencies('risk-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.dependencies.length).toBe(1);
 expect(result.dependencies[0].type).toBe('Contrôle');
 expect(result.canDelete).toBe(false);
 });

 it('returns true and dependencies when linked to projects', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: []
 }).mockResolvedValueOnce({
 docs: [{ id: 'proj-1', data: () => ({ name: 'Project A' }) }]
 }).mockResolvedValueOnce({
 docs: []
 });

 const result = await DependencyService.checkRiskDependencies('risk-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.dependencies[0].type).toBe('Projet');
 });

 it('returns true and dependencies when linked to audits', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: []
 }).mockResolvedValueOnce({
 docs: []
 }).mockResolvedValueOnce({
 docs: [{ id: 'audit-1', data: () => ({ name: 'Audit Q1' }) }]
 });

 const result = await DependencyService.checkRiskDependencies('risk-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.dependencies[0].type).toBe('Audit');
 });

 it('aggregates multiple dependencies', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: [{ id: 'ctrl-1', data: () => ({ code: 'A.1.1' }) }]
 }).mockResolvedValueOnce({
 docs: [{ id: 'proj-1', data: () => ({ name: 'Project A' }) }]
 }).mockResolvedValueOnce({
 docs: [{ id: 'audit-1', data: () => ({ name: 'Audit Q1' }) }]
 });

 const result = await DependencyService.checkRiskDependencies('risk-1', 'org-1');

 expect(result.dependencies.length).toBe(3);
 expect(result.blockingReasons[0]).toContain('3 élément');
 });

 it('handles errors safely', async () => {
 mockGetDocs.mockRejectedValue(new Error('Firebase error'));

 const result = await DependencyService.checkRiskDependencies('risk-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.canDelete).toBe(false);
 expect(result.blockingReasons[0]).toContain('Erreur');
 expect(ErrorLogger.error).toHaveBeenCalled();
 });

 it('uses fallback name for control without code or name', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: [{ id: 'ctrl-1', data: () => ({}) }]
 }).mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });

 const result = await DependencyService.checkRiskDependencies('risk-1', 'org-1');

 expect(result.dependencies[0].name).toBe('Contrôle sans nom');
 });
 });

 describe('checkAssetDependencies', () => {
 it('returns no dependencies for empty assetId', async () => {
 const result = await DependencyService.checkAssetDependencies('', 'org-1');

 expect(result.hasDependencies).toBe(false);
 expect(result.canDelete).toBe(true);
 });

 it('returns true when linked to risks', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: [{ id: 'risk-1', data: () => ({ threat: 'SQL Injection' }) }]
 });

 const result = await DependencyService.checkAssetDependencies('asset-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.dependencies[0].type).toBe('Risque');
 expect(result.dependencies[0].name).toBe('SQL Injection');
 expect(result.canDelete).toBe(false);
 });

 it('blocks deletion when risks exist', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: [
  { id: 'risk-1', data: () => ({ threat: 'Risk 1' }) },
  { id: 'risk-2', data: () => ({ threat: 'Risk 2' }) }
 ]
 });

 const result = await DependencyService.checkAssetDependencies('asset-1', 'org-1');

 expect(result.canDelete).toBe(false);
 expect(result.blockingReasons[0]).toContain('2 risque');
 });

 it('handles errors safely', async () => {
 mockGetDocs.mockRejectedValue(new Error('Firebase error'));

 const result = await DependencyService.checkAssetDependencies('asset-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.canDelete).toBe(false);
 expect(ErrorLogger.error).toHaveBeenCalled();
 });
 });

 describe('checkControlDependencies', () => {
 it('returns no dependencies for empty controlId', async () => {
 const result = await DependencyService.checkControlDependencies('', 'org-1');

 expect(result.hasDependencies).toBe(false);
 expect(result.canDelete).toBe(true);
 });

 it('returns true when linked to risks', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: [{ id: 'risk-1', data: () => ({ threat: 'XSS Attack' }) }]
 }).mockResolvedValueOnce({ docs: [] });

 const result = await DependencyService.checkControlDependencies('ctrl-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.dependencies[0].type).toBe('Risque');
 });

 it('returns true when linked to audits', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: []
 }).mockResolvedValueOnce({
 docs: [{ id: 'audit-1', data: () => ({ name: 'Q2 Audit' }) }]
 });

 const result = await DependencyService.checkControlDependencies('ctrl-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.dependencies[0].type).toBe('Audit');
 });

 it('aggregates risks and audits dependencies', async () => {
 mockGetDocs.mockResolvedValueOnce({
 docs: [{ id: 'risk-1', data: () => ({ threat: 'Risk A' }) }]
 }).mockResolvedValueOnce({
 docs: [{ id: 'audit-1', data: () => ({ name: 'Audit X' }) }]
 });

 const result = await DependencyService.checkControlDependencies('ctrl-1', 'org-1');

 expect(result.dependencies.length).toBe(2);
 expect(result.blockingReasons[0]).toContain('2 élément');
 });

 it('handles errors safely', async () => {
 mockGetDocs.mockRejectedValue(new Error('Firebase error'));

 const result = await DependencyService.checkControlDependencies('ctrl-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.canDelete).toBe(false);
 expect(ErrorLogger.error).toHaveBeenCalled();
 });
 });
});
