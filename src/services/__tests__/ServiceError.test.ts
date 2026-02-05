/**
 * ServiceError Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi } from 'vitest';
import {
 ServiceError,
 toServiceError,
 executeServiceOperation,
 validateServiceParams,
 isServiceError,
 handleServiceError,
 withServiceError
} from '../ServiceError';

// Mock ErrorLogger to prevent actual logging during tests
vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 },
 ERROR_MESSAGES: {
 PERMISSION_DENIED: 'Accès refusé',
 FETCH_FAILED: 'Erreur de récupération',
 VALIDATION_FAILED: 'Validation échouée',
 NETWORK_ERROR: 'Erreur réseau',
 AUTH_EXPIRED: 'Session expirée',
 RATE_LIMIT_EXCEEDED: 'Limite dépassée',
 QUOTA_EXCEEDED: 'Quota dépassé',
 UPDATE_FAILED: 'Mise à jour échouée',
 UNKNOWN_ERROR: 'Erreur inconnue'
 }
}));

describe('ServiceError', () => {
 describe('ServiceError class', () => {
 it('should create error with code and message', () => {
 const error = new ServiceError(
 'PERMISSION_DENIED',
 'Access denied',
 'TestContext'
 );

 expect(error.code).toBe('PERMISSION_DENIED');
 expect(error.message).toBe('Access denied');
 expect(error.context).toBe('TestContext');
 expect(error.name).toBe('ServiceError');
 });

 it('should store original error', () => {
 const originalError = new Error('Original');
 const error = new ServiceError(
 'INTERNAL_ERROR',
 'Internal error',
 'TestContext',
 { originalError }
 );

 expect(error.originalError).toBe(originalError);
 });

 it('should store metadata', () => {
 const metadata = { userId: 'user-1', action: 'create' };
 const error = new ServiceError(
 'VALIDATION_ERROR',
 'Validation failed',
 'TestContext',
 { metadata }
 );

 expect(error.metadata).toEqual(metadata);
 });

 it('should get user-friendly message', () => {
 const error = new ServiceError(
 'PERMISSION_DENIED',
 'Technical error',
 'TestContext'
 );

 expect(error.getUserMessage()).toBe('Accès refusé');
 });

 it('should get message key', () => {
 const error = new ServiceError(
 'NETWORK_ERROR',
 'Connection failed',
 'TestContext'
 );

 expect(error.getMessageKey()).toBe('NETWORK_ERROR');
 });
 });

 describe('toServiceError', () => {
 it('should return same error if already ServiceError', () => {
 const error = new ServiceError('NOT_FOUND', 'Not found', 'Test');
 const result = toServiceError(error, 'Context');

 expect(result).toBe(error);
 });

 it('should convert regular Error to ServiceError', () => {
 const error = new Error('Something went wrong');
 const result = toServiceError(error, 'TestContext');

 expect(result).toBeInstanceOf(ServiceError);
 expect(result.message).toBe('Something went wrong');
 expect(result.context).toBe('TestContext');
 });

 it('should map Firebase permission-denied error', () => {
 const error = { code: 'permission-denied', message: 'No access' };
 const result = toServiceError(error, 'Firebase');

 expect(result.code).toBe('PERMISSION_DENIED');
 });

 it('should map Firebase not-found error', () => {
 const error = { code: 'not-found', message: 'Document not found' };
 const result = toServiceError(error, 'Firebase');

 expect(result.code).toBe('NOT_FOUND');
 });

 it('should map Firebase auth errors', () => {
 const errors = [
 { code: 'unauthenticated', message: 'Not auth' },
 { code: 'auth/id-token-expired', message: 'Token expired' },
 { code: 'auth/user-disabled', message: 'User disabled' },
 { code: 'auth/user-not-found', message: 'User not found' }
 ];

 errors.forEach(error => {
 const result = toServiceError(error, 'Auth');
 expect(result.code).toBe('AUTH_ERROR');
 });
 });

 it('should map Firebase network errors', () => {
 const errors = [
 { code: 'unavailable', message: 'Service unavailable' },
 { code: 'network-request-failed', message: 'Network failed' }
 ];

 errors.forEach(error => {
 const result = toServiceError(error, 'Network');
 expect(result.code).toBe('NETWORK_ERROR');
 });
 });

 it('should map Firebase validation errors', () => {
 const errors = [
 { code: 'invalid-argument', message: 'Invalid arg' },
 { code: 'failed-precondition', message: 'Precondition failed' }
 ];

 errors.forEach(error => {
 const result = toServiceError(error, 'Validation');
 expect(result.code).toBe('VALIDATION_ERROR');
 });
 });

 it('should map Firebase quota error', () => {
 const error = { code: 'resource-exhausted', message: 'Quota reached' };
 const result = toServiceError(error, 'Quota');

 expect(result.code).toBe('QUOTA_EXCEEDED');
 });

 it('should map Firebase conflict errors', () => {
 const errors = [
 { code: 'already-exists', message: 'Already exists' },
 { code: 'aborted', message: 'Aborted' }
 ];

 errors.forEach(error => {
 const result = toServiceError(error, 'Conflict');
 expect(result.code).toBe('CONFLICT');
 });
 });

 it('should detect network errors from message', () => {
 const error = new Error('A network error occurred');
 const result = toServiceError(error, 'Request');

 expect(result.code).toBe('NETWORK_ERROR');
 });

 it('should use default code for unknown errors', () => {
 const error = new Error('Unknown error');
 const result = toServiceError(error, 'Unknown', 'EXTERNAL_SERVICE_ERROR');

 expect(result.code).toBe('EXTERNAL_SERVICE_ERROR');
 });
 });

 describe('executeServiceOperation', () => {
 it('should return result on success', async () => {
 const operation = async () => 'success';
 const result = await executeServiceOperation(operation, 'TestOp');

 expect(result).toBe('success');
 });

 it('should throw ServiceError on failure', async () => {
 const operation = async () => {
 throw new Error('Operation failed');
 };

 await expect(executeServiceOperation(operation, 'FailOp'))
 .rejects.toBeInstanceOf(ServiceError);
 });

 it('should use custom default code', async () => {
 const operation = async () => {
 throw new Error('Not found');
 };

 try {
 await executeServiceOperation(operation, 'Search', { defaultCode: 'NOT_FOUND' });
 } catch (error) {
 expect((error as ServiceError).code).toBe('NOT_FOUND');
 }
 });
 });

 describe('validateServiceParams', () => {
 it('should pass for valid params', () => {
 expect(() => validateServiceParams(
 { name: 'Test', id: '123' },
 'TestValidation'
 )).not.toThrow();
 });

 it('should throw for undefined params', () => {
 expect(() => validateServiceParams(
 { name: undefined, id: '123' },
 'TestValidation'
 )).toThrow(ServiceError);
 });

 it('should throw for null params', () => {
 expect(() => validateServiceParams(
 { name: null, id: '123' },
 'TestValidation'
 )).toThrow(ServiceError);
 });

 it('should throw for empty string params', () => {
 expect(() => validateServiceParams(
 { name: '', id: '123' },
 'TestValidation'
 )).toThrow(ServiceError);
 });

 it('should include missing params in error metadata', () => {
 try {
 validateServiceParams(
  { name: undefined, email: null, id: '123' },
  'TestValidation'
 );
 } catch (error) {
 const serviceError = error as ServiceError;
 expect(serviceError.metadata?.missingParams).toContain('name');
 expect(serviceError.metadata?.missingParams).toContain('email');
 }
 });

 it('should throw VALIDATION_ERROR code', () => {
 try {
 validateServiceParams({ name: undefined }, 'Test');
 } catch (error) {
 expect((error as ServiceError).code).toBe('VALIDATION_ERROR');
 }
 });
 });

 describe('isServiceError', () => {
 it('should return true for ServiceError', () => {
 const error = new ServiceError('NOT_FOUND', 'Not found', 'Test');
 expect(isServiceError(error)).toBe(true);
 });

 it('should return false for regular Error', () => {
 const error = new Error('Regular error');
 expect(isServiceError(error)).toBe(false);
 });

 it('should check specific code', () => {
 const error = new ServiceError('NOT_FOUND', 'Not found', 'Test');

 expect(isServiceError(error, 'NOT_FOUND')).toBe(true);
 expect(isServiceError(error, 'AUTH_ERROR')).toBe(false);
 });

 it('should return false for null', () => {
 expect(isServiceError(null)).toBe(false);
 });

 it('should return false for undefined', () => {
 expect(isServiceError(undefined)).toBe(false);
 });
 });

 describe('handleServiceError', () => {
 it('should call showToast with error message', () => {
 const showToast = vi.fn();
 const error = new ServiceError('PERMISSION_DENIED', 'Access denied', 'Test');

 handleServiceError(error, 'TestContext', showToast);

 expect(showToast).toHaveBeenCalledWith('Accès refusé', 'error');
 });

 it('should return message key', () => {
 const showToast = vi.fn();
 const error = new ServiceError('NETWORK_ERROR', 'Network failed', 'Test');

 const result = handleServiceError(error, 'TestContext', showToast);

 expect(result).toBe('NETWORK_ERROR');
 });

 it('should convert non-ServiceError to ServiceError', () => {
 const showToast = vi.fn();
 const error = new Error('Regular error');

 handleServiceError(error, 'TestContext', showToast);

 expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error');
 });
 });

 describe('withServiceError', () => {
 it('should return result on success', async () => {
 const fn = async (x: number) => x * 2;
 const wrapped = withServiceError(fn as (...args: unknown[]) => Promise<unknown>, 'MultiplyOp');

 const result = await wrapped(5);
 expect(result).toBe(10);
 });

 it('should convert error to ServiceError', async () => {
 const fn = async () => {
 throw new Error('Failed');
 };
 const wrapped = withServiceError(fn, 'FailOp');

 await expect(wrapped()).rejects.toBeInstanceOf(ServiceError);
 });

 it('should use provided default code', async () => {
 const fn = async () => {
 throw new Error('Not found');
 };
 const wrapped = withServiceError(fn, 'SearchOp', 'NOT_FOUND');

 try {
 await wrapped();
 } catch (error) {
 expect((error as ServiceError).code).toBe('NOT_FOUND');
 }
 });
 });
});
