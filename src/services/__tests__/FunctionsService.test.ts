/**
 * FunctionsService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FunctionsService } from '../FunctionsService';

// Mock Firebase functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
 httpsCallable: () => mockHttpsCallable,
}));

vi.mock('../../firebase', () => ({
 functions: {},
}));

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 },
}));

describe('FunctionsService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('deleteResource', () => {
 it('should return true on successful deletion', async () => {
 mockHttpsCallable.mockResolvedValue({
 data: { success: true, message: 'Deleted' },
 });

 const result = await FunctionsService.deleteResource('assets', 'asset-123');

 expect(result).toBe(true);
 });

 it('should return false when success is false', async () => {
 mockHttpsCallable.mockResolvedValue({
 data: { success: false, message: 'Failed' },
 });

 const result = await FunctionsService.deleteResource('risks', 'risk-123');

 expect(result).toBe(false);
 });

 it('should throw error with message when failed-precondition', async () => {
 mockHttpsCallable.mockRejectedValue({
 code: 'failed-precondition',
 message: 'Impossible de supprimer: dépendances existantes',
 });

 await expect(
 FunctionsService.deleteResource('projects', 'project-123')
 ).rejects.toThrow('Impossible de supprimer: dépendances existantes');
 });

 it('should throw error when message contains "Impossible de supprimer"', async () => {
 mockHttpsCallable.mockRejectedValue({
 message: 'Impossible de supprimer cet élément',
 });

 await expect(
 FunctionsService.deleteResource('controls', 'control-123')
 ).rejects.toThrow('Impossible de supprimer cet élément');
 });

 it('should throw default message when error has no message', async () => {
 mockHttpsCallable.mockRejectedValue({
 code: 'failed-precondition',
 });

 await expect(
 FunctionsService.deleteResource('suppliers', 'supplier-123')
 ).rejects.toThrow('Suppression bloquée par des dépendances.');
 });

 it('should log and rethrow other errors', async () => {
 const { ErrorLogger } = await import('../errorLogger');
 const genericError = new Error('Network error');
 mockHttpsCallable.mockRejectedValue(genericError);

 await expect(
 FunctionsService.deleteResource('incidents', 'incident-123')
 ).rejects.toThrow('Network error');

 expect(ErrorLogger.error).toHaveBeenCalledWith(
 genericError,
 'FunctionsService.deleteResource'
 );
 });

 it('should call httpsCallable with correct parameters', async () => {
 mockHttpsCallable.mockResolvedValue({
 data: { success: true },
 });

 await FunctionsService.deleteResource('documents', 'doc-123');

 expect(mockHttpsCallable).toHaveBeenCalledWith({
 collectionName: 'documents',
 docId: 'doc-123',
 });
 });
 });
});
