/**
 * useErrorHandler Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useErrorHandler, ErrorType } from '../useErrorHandler';

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

// Mock toast
vi.mock('@/lib/toast', () => ({
 toast: {
 error: vi.fn(),
 success: vi.fn()
 }
}));

describe('useErrorHandler', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('ErrorType enum', () => {
 it('should have all error types', () => {
 expect(ErrorType.NETWORK).toBe('network');
 expect(ErrorType.VALIDATION).toBe('validation');
 expect(ErrorType.PERMISSION).toBe('permission');
 expect(ErrorType.NOT_FOUND).toBe('not_found');
 expect(ErrorType.SERVER_ERROR).toBe('server_error');
 expect(ErrorType.TIMEOUT).toBe('timeout');
 expect(ErrorType.CONFLICT).toBe('conflict');
 expect(ErrorType.UNKNOWN).toBe('unknown');
 });
 });

 describe('handleError', () => {
 it('should return handleError function', () => {
 const { result } = renderHook(() => useErrorHandler());
 expect(typeof result.current.handleError).toBe('function');
 });

 it('should handle standard Error', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = new Error('Test error');

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.message).toBe('Test error');
 expect(structuredError.context).toBe('TestContext');
 expect(structuredError.timestamp).toBeDefined();
 });

 it('should determine NETWORK error type', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = { code: 'NETWORK_ERROR', message: 'Network failed' };

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.NETWORK);
 });

 it('should determine TIMEOUT error type', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = { code: 'TIMEOUT', message: 'Request timeout' };

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.TIMEOUT);
 });

 it('should determine PERMISSION error type', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = { code: 'PERMISSION_DENIED', message: 'No access' };

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.PERMISSION);
 });

 it('should determine VALIDATION error type', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = { code: 'VALIDATION_ERROR', message: 'Invalid data' };

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.VALIDATION);
 });

 it('should determine NOT_FOUND error type', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = { code: 'NOT_FOUND', message: 'Resource not found' };

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.NOT_FOUND);
 });

 it('should determine CONFLICT error type', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = { code: 'CONFLICT', message: 'Conflict detected' };

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.CONFLICT);
 });

 it('should determine SERVER_ERROR type from status', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = { status: 500, message: 'Internal server error' };

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.SERVER_ERROR);
 });

 it('should default to UNKNOWN type', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = { message: 'Some random error' };

 const structuredError = result.current.handleError(error, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.UNKNOWN);
 });

 it('should use custom message when provided', () => {
 const { result } = renderHook(() => useErrorHandler());
 const error = new Error('Technical error');

 const structuredError = result.current.handleError(error, 'TestContext', {
 customMessage: 'Something went wrong!'
 });

 expect(structuredError.userMessage).toBe('Something went wrong!');
 });

 it('should call onError callback when provided', () => {
 const onError = vi.fn();
 const { result } = renderHook(() => useErrorHandler());
 const error = new Error('Test');

 result.current.handleError(error, 'TestContext', { onError });

 expect(onError).toHaveBeenCalledWith(expect.objectContaining({
 message: 'Test'
 }));
 });

 it('should not show toast when showToast is false', async () => {
 const { toast } = await import('@/lib/toast');
 const { result } = renderHook(() => useErrorHandler());
 const error = new Error('Test');

 result.current.handleError(error, 'TestContext', { showToast: false });

 expect(toast.error).not.toHaveBeenCalled();
 });

 it('should not log when logToService is false', async () => {
 const { ErrorLogger } = await import('../../services/errorLogger');
 const { result } = renderHook(() => useErrorHandler());
 const error = new Error('Test');

 result.current.handleError(error, 'TestContext', { logToService: false });

 expect(ErrorLogger.error).not.toHaveBeenCalled();
 });

 it('should handle string error', () => {
 const { result } = renderHook(() => useErrorHandler());

 const structuredError = result.current.handleError('String error', 'TestContext');

 expect(structuredError.message).toBe('String error');
 });

 it('should handle null error', () => {
 const { result } = renderHook(() => useErrorHandler());

 const structuredError = result.current.handleError(null, 'TestContext');

 expect(structuredError.type).toBe(ErrorType.UNKNOWN);
 });
 });
});
