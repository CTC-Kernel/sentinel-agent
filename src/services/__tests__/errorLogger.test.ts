/**
 * ErrorLogger Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorLogger, ERROR_MESSAGES } from '../errorLogger';

// Mock Sentry
vi.mock('@sentry/react', () => ({
 captureException: vi.fn()
}));

// Mock store
vi.mock('../../store', () => ({
 useStore: {
 getState: vi.fn(() => ({
 addToast: vi.fn()
 }))
 }
}));

// Mock firebase
vi.mock('../../firebase', () => ({
 analytics: null
}));

describe('ErrorLogger', () => {
 let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
 let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
 let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
 let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
 let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
 let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;
 let consoleLogSpy: ReturnType<typeof vi.spyOn>;

 beforeEach(() => {
 vi.clearAllMocks();
 consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
 consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
 consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
 consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
 consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
 consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
 consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
 });

 afterEach(() => {
 vi.restoreAllMocks();
 });

 describe('error', () => {
 it('should log Error objects', () => {
 const error = new Error('Test error');
 ErrorLogger.error(error, 'TestContext');

 expect(consoleGroupSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
 expect(consoleErrorSpy).toHaveBeenCalledWith('Test error');
 expect(consoleGroupEndSpy).toHaveBeenCalled();
 });

 it('should log string errors', () => {
 ErrorLogger.error('String error', 'TestContext');

 expect(consoleErrorSpy).toHaveBeenCalledWith('String error');
 });

 it('should include additional context without throwing', () => {
 const error = new Error('Test error');
 const context = { component: 'TestComponent', action: 'testAction' };

 // Should not throw when additional context is provided
 expect(() => ErrorLogger.error(error, 'TestContext', context)).not.toThrow();
 });
 });

 describe('warn', () => {
 it('should log warning message without throwing', () => {
 // warn() now only logs to external, not console
 expect(() => ErrorLogger.warn('Warning message', 'TestContext')).not.toThrow();
 });

 it('should include context in warning without throwing', () => {
 expect(() => ErrorLogger.warn('Warning', 'TestContext', { metadata: { key: 'value' } })).not.toThrow();
 });
 });

 describe('info', () => {
 it('should log info message without throwing', () => {
 // info() now only logs to external, not console
 expect(() => ErrorLogger.info('Info message', 'TestContext')).not.toThrow();
 });

 it('should use General as default context without throwing', () => {
 expect(() => ErrorLogger.info('Info message')).not.toThrow();
 });
 });

 describe('debug', () => {
 it('should accept debug message without throwing', () => {
 // debug() is silent by default to keep console clean
 expect(() => ErrorLogger.debug('Debug message', 'TestContext')).not.toThrow();
 });
 });

 describe('logUserAction', () => {
 it('should log user action without throwing', () => {
 // logUserAction() logs to external monitoring
 expect(() => ErrorLogger.logUserAction('click_button', { buttonId: 'submit' })).not.toThrow();
 });
 });

 describe('logPerformance', () => {
 it('should log performance metric without throwing', () => {
 // logPerformance() logs to external monitoring
 expect(() => ErrorLogger.logPerformance('page_load', 1500, 'Dashboard')).not.toThrow();
 });
 });

 describe('handleErrorWithToast', () => {
 it('should return UNKNOWN_ERROR by default', () => {
 const result = ErrorLogger.handleErrorWithToast(new Error('test'), 'TestContext');

 expect(result).toBe('UNKNOWN_ERROR');
 });

 it('should return PERMISSION_DENIED for permission errors', () => {
 const error = { code: 'permission-denied', message: 'Permission denied' };
 const result = ErrorLogger.handleErrorWithToast(error, 'TestContext');

 expect(result).toBe('PERMISSION_DENIED');
 });

 it('should return AUTH_EXPIRED for auth errors', () => {
 const error = { code: 'unauthenticated', message: 'Not authenticated' };
 const result = ErrorLogger.handleErrorWithToast(error, 'TestContext');

 expect(result).toBe('AUTH_EXPIRED');
 });

 it('should return NETWORK_ERROR for network errors', () => {
 const error = { code: 'unavailable', message: 'Network unavailable' };
 const result = ErrorLogger.handleErrorWithToast(error, 'TestContext');

 expect(result).toBe('NETWORK_ERROR');
 });

 it('should return VALIDATION_FAILED for invalid data', () => {
 const error = new Error('Unsupported field value in data');
 const result = ErrorLogger.handleErrorWithToast(error, 'TestContext');

 expect(result).toBe('VALIDATION_FAILED');
 });

 it('should return VALIDATION_FAILED for invalid-argument code', () => {
 const error = { code: 'invalid-argument', message: 'Invalid argument' };
 const result = ErrorLogger.handleErrorWithToast(error, 'TestContext');

 expect(result).toBe('VALIDATION_FAILED');
 });
 });

 describe('clearLogs', () => {
 it('should clear logs from localStorage', () => {
 const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
 ErrorLogger.clearLogs();

 expect(removeItemSpy).toHaveBeenCalledWith('app_logs');
 removeItemSpy.mockRestore();
 });
 });
});

describe('ERROR_MESSAGES', () => {
 it('should have all required error messages', () => {
 expect(ERROR_MESSAGES.UNKNOWN_ERROR).toBeDefined();
 expect(ERROR_MESSAGES.NETWORK_ERROR).toBeDefined();
 expect(ERROR_MESSAGES.PERMISSION_DENIED).toBeDefined();
 expect(ERROR_MESSAGES.AUTH_FAILED).toBeDefined();
 expect(ERROR_MESSAGES.FETCH_FAILED).toBeDefined();
 expect(ERROR_MESSAGES.VALIDATION_FAILED).toBeDefined();
 expect(ERROR_MESSAGES.FILE_UPLOAD_FAILED).toBeDefined();
 expect(ERROR_MESSAGES.QUOTA_EXCEEDED).toBeDefined();
 });

 it('should have French messages', () => {
 // All messages should be in French (checking actual message content)
 expect(ERROR_MESSAGES.UNKNOWN_ERROR).toContain('inattendue');
 expect(ERROR_MESSAGES.NETWORK_ERROR).toContain('impossible');
 expect(ERROR_MESSAGES.PERMISSION_DENIED).toContain('refusé');
 });
});
