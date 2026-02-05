/**
 * AuditService Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from '../auditService';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {},
}));

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 getDocs: vi.fn(),
 deleteDoc: vi.fn(),
 doc: vi.fn(),
 writeBatch: vi.fn(() => ({
 delete: vi.fn(),
 update: vi.fn(),
 commit: vi.fn().mockResolvedValue(undefined),
 })),
 arrayRemove: vi.fn(),
 updateDoc: vi.fn(),
 serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 warn: vi.fn(),
 info: vi.fn(),
 },
}));

import { getDocs } from 'firebase/firestore';

describe('AuditService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('getAuditDetails', () => {
 it('should return findings and checklist for an audit', async () => {
 const mockFindings = [
 { id: 'finding-1', title: 'Finding 1', severity: 'High' },
 { id: 'finding-2', title: 'Finding 2', severity: 'Medium' },
 ];

 const mockChecklist = {
 id: 'checklist-1',
 title: 'Audit Checklist',
 items: [],
 };

 vi.mocked(getDocs)
 .mockResolvedValueOnce({
  docs: mockFindings.map(f => ({
  id: f.id,
  data: () => f,
  })),
 } as never)
 .mockResolvedValueOnce({
  empty: false,
  docs: [{
  id: mockChecklist.id,
  data: () => mockChecklist,
  }],
 } as never);

 const result = await AuditService.getAuditDetails('audit-1', 'org-1');

 expect(result.findings).toHaveLength(2);
 expect(result.findings[0].id).toBe('finding-1');
 expect(result.checklist).not.toBeNull();
 expect(result.checklist?.id).toBe('checklist-1');
 });

 it('should return null checklist when no checklist exists', async () => {
 vi.mocked(getDocs)
 .mockResolvedValueOnce({
  docs: [],
 } as never)
 .mockResolvedValueOnce({
  empty: true,
  docs: [],
 } as never);

 const result = await AuditService.getAuditDetails('audit-1', 'org-1');

 expect(result.findings).toHaveLength(0);
 expect(result.checklist).toBeNull();
 });

 it('should throw error when Firebase fails', async () => {
 vi.mocked(getDocs).mockRejectedValue(new Error('Firebase error'));

 await expect(
 AuditService.getAuditDetails('audit-1', 'org-1')
 ).rejects.toThrow('Firebase error');
 });
 });

 describe('checkDependencies', () => {
 it('should return no dependencies when audit has none', async () => {
 vi.mocked(getDocs).mockResolvedValue({
 empty: true,
 docs: [],
 } as never);

 const result = await AuditService.checkDependencies('audit-1', 'org-1');

 expect(result.hasDependencies).toBe(false);
 expect(result.dependencies).toHaveLength(0);
 });

 it('should return dependencies when audit has linked entities', async () => {
 // Mock projects with dependencies
 vi.mocked(getDocs)
 .mockResolvedValueOnce({
  empty: false,
  docs: [{
  id: 'project-1',
  data: () => ({ name: 'Test Project' }),
  }],
 } as never)
 .mockResolvedValueOnce({ empty: true, docs: [] } as never)
 .mockResolvedValueOnce({ empty: true, docs: [] } as never)
 .mockResolvedValueOnce({ empty: true, docs: [] } as never);

 const result = await AuditService.checkDependencies('audit-1', 'org-1');

 expect(result.hasDependencies).toBe(true);
 expect(result.dependencies.length).toBeGreaterThan(0);
 });
 });
});
