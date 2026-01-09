/**
 * Tests unitaires pour ErrorHandler
 *
 * Teste la gestion centralisée des erreurs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorHandler,
  ErrorCategory,
  ErrorSeverity,
  BusinessError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} from '../errorHandler';
import { ErrorLogger } from '../../services/errorLogger';
import * as Sentry from '@sentry/react';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('../../services/errorLogger', () => ({
  ErrorLogger: {
    error: vi.fn()
  }
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn()
  }
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handle', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');

      ErrorHandler.handle(error, 'TestContext', {
        showToast: false
      });

      expect(ErrorLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error'
        }),
        'TestContext'
      );
    });

    it('should convert string to Error', () => {
      ErrorHandler.handle('String error', 'TestContext', {
        showToast: false
      });

      expect(ErrorLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'String error'
        }),
        'TestContext'
      );
    });

    it('should convert unknown types to Error', () => {
      ErrorHandler.handle(12345, 'TestContext', {
        showToast: false
      });

      expect(ErrorLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'TestContext'
      );
    });

    it('should show toast by default', () => {
      ErrorHandler.handle(new Error('Test'), 'TestContext');

      expect(toast.error).toHaveBeenCalled();
    });

    it('should not show toast when showToast is false', () => {
      ErrorHandler.handle(new Error('Test'), 'TestContext', {
        showToast: false
      });

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should log to Sentry when logToSentry is true', () => {
      const error = new Error('Test error');

      ErrorHandler.handle(error, 'TestContext', {
        logToSentry: true,
        showToast: false
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        expect.objectContaining({
          tags: expect.objectContaining({
            context: 'TestContext'
          })
        })
      );
    });

    it('should always log critical errors to Sentry', () => {
      const error = new Error('Critical error');

      ErrorHandler.handle(error, 'TestContext', {
        severity: ErrorSeverity.CRITICAL,
        logToSentry: false, // Even if false
        showToast: false
      });

      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should enrich error with metadata', () => {
      const error = new Error('Test');
      const metadata = { userId: '123', action: 'create' };

      ErrorHandler.handle(error, 'TestContext', {
        metadata,
        showToast: false
      });

      expect(ErrorLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'TestContext',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          metadata
        }),
        'TestContext'
      );
    });

    it('should use custom user message in toast', () => {
      ErrorHandler.handle(new Error('Technical error'), 'TestContext', {
        userMessage: 'Opération échouée',
        showToast: true
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Opération échouée',
        expect.any(Object)
      );
    });

    it('should generate user-friendly message for network errors', () => {
      const networkError = new Error('fetch failed: network timeout');

      ErrorHandler.handle(networkError, 'TestContext', {
        showToast: true
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Erreur de connexion. Vérifiez votre connexion internet.',
        expect.any(Object)
      );
    });

    it('should generate user-friendly message for permission errors', () => {
      const permissionError = new Error('permission-denied');

      ErrorHandler.handle(permissionError, 'TestContext', {
        showToast: true
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Vous n\'avez pas les permissions nécessaires pour cette action.',
        expect.any(Object)
      );
    });

    it('should rethrow error when rethrow is true', () => {
      const error = new Error('Test');

      expect(() => {
        ErrorHandler.handle(error, 'TestContext', {
          rethrow: true,
          showToast: false
        });
      }).toThrow('Test');
    });

    it('should not rethrow by default', () => {
      const error = new Error('Test');

      expect(() => {
        ErrorHandler.handle(error, 'TestContext', {
          showToast: false
        });
      }).not.toThrow();
    });

    it('should show warning toast for LOW severity', () => {
      ErrorHandler.handle(new Error('Low severity'), 'TestContext', {
        severity: ErrorSeverity.LOW
      });

      expect(toast.warning).toHaveBeenCalled();
    });

    it('should show error toast with description for HIGH severity', () => {
      ErrorHandler.handle(new Error('High severity'), 'TestContext', {
        severity: ErrorSeverity.HIGH
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          duration: 5000,
          description: expect.stringContaining('support')
        })
      );
    });
  });

  describe('handleAsync', () => {
    it('should return value on success', async () => {
      const promise = Promise.resolve('success');

      const result = await ErrorHandler.handleAsync(promise, 'TestContext', {
        showToast: false
      });

      expect(result).toBe('success');
    });

    it('should return null on error', async () => {
      const promise = Promise.reject(new Error('Failed'));

      const result = await ErrorHandler.handleAsync(promise, 'TestContext', {
        showToast: false
      });

      expect(result).toBeNull();
      expect(ErrorLogger.error).toHaveBeenCalled();
    });

    it('should handle error with options', async () => {
      const promise = Promise.reject(new Error('Failed'));

      await ErrorHandler.handleAsync(promise, 'TestContext', {
        severity: ErrorSeverity.HIGH,
        logToSentry: true,
        showToast: false
      });

      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('wrap', () => {
    it('should wrap synchronous function', () => {
      const fn = (x: number) => x * 2;
      const wrapped = ErrorHandler.wrap(fn, 'TestContext', {
        showToast: false
      });

      expect(wrapped(5)).toBe(10);
    });

    it('should catch synchronous errors', () => {
      const fn = () => {
        throw new Error('Sync error');
      };

      const wrapped = ErrorHandler.wrap(fn, 'TestContext', {
        showToast: false
      });

      expect(() => wrapped()).toThrow('Sync error');
      expect(ErrorLogger.error).toHaveBeenCalled();
    });

    it('should wrap async function', async () => {
      const fn = async (x: number) => x * 2;
      const wrapped = ErrorHandler.wrap(fn, 'TestContext', {
        showToast: false
      });

      await expect(wrapped(5)).resolves.toBe(10);
    });

    it('should catch async errors', async () => {
      const fn = async () => {
        throw new Error('Async error');
      };

      const wrapped = ErrorHandler.wrap(fn, 'TestContext', {
        showToast: false
      });

      await expect(wrapped()).rejects.toThrow('Async error');
      expect(ErrorLogger.error).toHaveBeenCalled();
    });
  });

  describe('Custom Error Classes', () => {
    describe('BusinessError', () => {
      it('should create BusinessError with default values', () => {
        const error = new BusinessError('Business logic failed');

        expect(error.message).toBe('Business logic failed');
        expect(error.name).toBe('BusinessError');
        expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });

      it('should create BusinessError with custom values', () => {
        const error = new BusinessError(
          'Invalid operation',
          ErrorCategory.VALIDATION,
          ErrorSeverity.HIGH
        );

        expect(error.category).toBe(ErrorCategory.VALIDATION);
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      });
    });

    describe('ValidationError', () => {
      it('should create ValidationError', () => {
        const error = new ValidationError('Validation failed', {
          email: 'Email invalide',
          password: 'Mot de passe trop court'
        });

        expect(error.name).toBe('ValidationError');
        expect(error.fields).toEqual({
          email: 'Email invalide',
          password: 'Mot de passe trop court'
        });
      });
    });

    describe('AuthenticationError', () => {
      it('should create AuthenticationError with default message', () => {
        const error = new AuthenticationError();

        expect(error.name).toBe('AuthenticationError');
        expect(error.message).toBe('Authentification requise');
      });

      it('should create AuthenticationError with custom message', () => {
        const error = new AuthenticationError('Session expirée');

        expect(error.message).toBe('Session expirée');
      });
    });

    describe('AuthorizationError', () => {
      it('should create AuthorizationError with default message', () => {
        const error = new AuthorizationError();

        expect(error.name).toBe('AuthorizationError');
        expect(error.message).toBe('Permissions insuffisantes');
      });

      it('should create AuthorizationError with custom message', () => {
        const error = new AuthorizationError('Accès refusé à cette ressource');

        expect(error.message).toBe('Accès refusé à cette ressource');
      });
    });
  });

  describe('Error categorization', () => {
    it('should recognize network errors', () => {
      const error = new Error('Failed to fetch');
      ErrorHandler.handle(error, 'TestContext', {
        category: ErrorCategory.NETWORK
      });

      expect(ErrorLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          category: ErrorCategory.NETWORK
        }),
        'TestContext'
      );
    });

    it('should recognize validation errors', () => {
      const error = new ValidationError('Invalid input');
      ErrorHandler.handle(error, 'TestContext', {
        category: ErrorCategory.VALIDATION
      });

      expect(ErrorLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          category: ErrorCategory.VALIDATION
        }),
        'TestContext'
      );
    });

    it('should recognize authentication errors', () => {
      const error = new AuthenticationError();
      ErrorHandler.handle(error, 'TestContext', {
        category: ErrorCategory.AUTHENTICATION
      });

      expect(ErrorLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          category: ErrorCategory.AUTHENTICATION
        }),
        'TestContext'
      );
    });
  });

  describe('Sentry severity mapping', () => {
    it('should map CRITICAL to fatal', () => {
      ErrorHandler.handle(new Error('Critical'), 'TestContext', {
        severity: ErrorSeverity.CRITICAL,
        logToSentry: true,
        showToast: false
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'fatal'
        })
      );
    });

    it('should map HIGH to error', () => {
      ErrorHandler.handle(new Error('High'), 'TestContext', {
        severity: ErrorSeverity.HIGH,
        logToSentry: true,
        showToast: false
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'error'
        })
      );
    });

    it('should map MEDIUM to warning', () => {
      ErrorHandler.handle(new Error('Medium'), 'TestContext', {
        severity: ErrorSeverity.MEDIUM,
        logToSentry: true,
        showToast: false
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'warning'
        })
      );
    });

    it('should map LOW to info', () => {
      ErrorHandler.handle(new Error('Low'), 'TestContext', {
        severity: ErrorSeverity.LOW,
        logToSentry: true,
        showToast: false
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'info'
        })
      );
    });
  });
});
