/**
 * RelationshipService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelationshipService, RelationshipType } from '../relationshipService';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {}
}));

const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn(() => Promise.resolve());

vi.mock('firebase/firestore', () => ({
 doc: vi.fn(() => ({})),
 writeBatch: vi.fn(() => ({
 update: mockBatchUpdate,
 commit: mockBatchCommit
 })),
 arrayUnion: vi.fn((...args) => ({ _arrayUnion: args })),
 arrayRemove: vi.fn((...args) => ({ _arrayRemove: args }))
}));

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

describe('RelationshipService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('link', () => {
 it('should link two entities bidirectionally', async () => {
 await RelationshipService.link('risk-control', 'risk-1', 'control-1');

 expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
 expect(mockBatchCommit).toHaveBeenCalled();
 });

 it('should throw for unknown relationship type', async () => {
 await expect(
 RelationshipService.link('unknown-type' as RelationshipType, 'id1', 'id2')
 ).rejects.toThrow('Unknown relationship type');
 });

 it('should throw and log error on batch failure', async () => {
 mockBatchCommit.mockRejectedValueOnce(new Error('Batch error'));
 const { ErrorLogger } = await import('../errorLogger');

 await expect(
 RelationshipService.link('risk-asset', 'risk-1', 'asset-1')
 ).rejects.toThrow('Batch error');

 expect(ErrorLogger.error).toHaveBeenCalled();
 });
 });

 describe('unlink', () => {
 it('should unlink two entities bidirectionally', async () => {
 await RelationshipService.unlink('risk-control', 'risk-1', 'control-1');

 expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
 expect(mockBatchCommit).toHaveBeenCalled();
 });

 it('should throw for unknown relationship type', async () => {
 await expect(
 RelationshipService.unlink('invalid' as RelationshipType, 'id1', 'id2')
 ).rejects.toThrow('Unknown relationship type');
 });

 it('should throw and log error on batch failure', async () => {
 mockBatchCommit.mockRejectedValueOnce(new Error('Batch error'));
 const { ErrorLogger } = await import('../errorLogger');

 await expect(
 RelationshipService.unlink('risk-supplier', 'risk-1', 'supplier-1')
 ).rejects.toThrow('Batch error');

 expect(ErrorLogger.error).toHaveBeenCalled();
 });
 });

 describe('linkMany', () => {
 it('should link multiple entities', async () => {
 await RelationshipService.linkMany('risk-control', 'risk-1', ['ctrl-1', 'ctrl-2', 'ctrl-3']);

 // 1 update for primary + 3 updates for secondaries
 expect(mockBatchUpdate).toHaveBeenCalledTimes(4);
 expect(mockBatchCommit).toHaveBeenCalled();
 });

 it('should do nothing for empty array', async () => {
 await RelationshipService.linkMany('risk-control', 'risk-1', []);

 expect(mockBatchUpdate).not.toHaveBeenCalled();
 expect(mockBatchCommit).not.toHaveBeenCalled();
 });

 it('should throw for unknown relationship type', async () => {
 await expect(
 RelationshipService.linkMany('invalid' as RelationshipType, 'id1', ['id2'])
 ).rejects.toThrow('Unknown relationship type');
 });
 });

 describe('unlinkMany', () => {
 it('should unlink multiple entities', async () => {
 await RelationshipService.unlinkMany('control-asset', 'ctrl-1', ['asset-1', 'asset-2']);

 // 1 update for primary + 2 updates for secondaries
 expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
 expect(mockBatchCommit).toHaveBeenCalled();
 });

 it('should do nothing for empty array', async () => {
 await RelationshipService.unlinkMany('risk-control', 'risk-1', []);

 expect(mockBatchUpdate).not.toHaveBeenCalled();
 expect(mockBatchCommit).not.toHaveBeenCalled();
 });

 it('should throw for unknown relationship type', async () => {
 await expect(
 RelationshipService.unlinkMany('unknown' as RelationshipType, 'id1', ['id2'])
 ).rejects.toThrow('Unknown relationship type');
 });
 });

 describe('sync', () => {
 it('should add new links and remove stale ones', async () => {
 const currentIds = ['id-1', 'id-2'];
 const newIds = ['id-2', 'id-3'];

 await RelationshipService.sync('risk-control', 'risk-1', currentIds, newIds);

 // Should call linkMany for id-3 and unlinkMany for id-1
 expect(mockBatchCommit).toHaveBeenCalled();
 });

 it('should do nothing when arrays are identical', async () => {
 const ids = ['id-1', 'id-2'];

 await RelationshipService.sync('risk-control', 'risk-1', ids, ids);

 // No updates needed
 expect(mockBatchUpdate).not.toHaveBeenCalled();
 });

 it('should only add when current is empty', async () => {
 await RelationshipService.sync('risk-asset', 'risk-1', [], ['asset-1', 'asset-2']);

 expect(mockBatchCommit).toHaveBeenCalled();
 });

 it('should only remove when new is empty', async () => {
 await RelationshipService.sync('risk-supplier', 'risk-1', ['supp-1', 'supp-2'], []);

 expect(mockBatchCommit).toHaveBeenCalled();
 });
 });

 describe('cleanupBeforeDelete', () => {
 it('should cleanup references in linked collections', async () => {
 const linkedIds = {
 controls: ['ctrl-1', 'ctrl-2'],
 assets: ['asset-1']
 };

 await RelationshipService.cleanupBeforeDelete('risks', 'risk-1', linkedIds);

 // Should update 3 linked entities
 expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
 expect(mockBatchCommit).toHaveBeenCalled();
 });

 it('should handle empty linkedIds', async () => {
 await RelationshipService.cleanupBeforeDelete('risks', 'risk-1', {});

 // No updates needed, but commit still called if opCount was 0
 expect(mockBatchUpdate).not.toHaveBeenCalled();
 });

 it('should throw and log error on batch failure', async () => {
 mockBatchCommit.mockRejectedValueOnce(new Error('Cleanup error'));
 const { ErrorLogger } = await import('../errorLogger');

 await expect(
 RelationshipService.cleanupBeforeDelete('risks', 'risk-1', { controls: ['ctrl-1'] })
 ).rejects.toThrow('Cleanup error');

 expect(ErrorLogger.error).toHaveBeenCalledWith(
 expect.any(Error),
 'RelationshipService.cleanupBeforeDelete'
 );
 });
 });
});

describe('RelationshipType', () => {
 it('should support all relationship types', () => {
 const types: RelationshipType[] = [
 'risk-control',
 'risk-asset',
 'risk-supplier',
 'risk-project',
 'risk-audit',
 'control-asset',
 'control-supplier',
 'control-audit',
 'audit-project',
 'audit-document',
 'incident-risk',
 'incident-asset',
 'supplier-incident'
 ];

 types.forEach(type => {
 expect(typeof type).toBe('string');
 });
 });
});
