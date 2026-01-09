/**
 * Service de gestion centralisée des erreurs
 *
 * Standardise la gestion des erreurs dans toute l'application avec:
 * - Logging centralisé
 * - Intégration Sentry optionnelle
 * - Notifications utilisateur
 * - Catégorisation des erreurs
 *
 * @module errorHandler
 */

import { ErrorLogger } from '../services/errorLogger';
import * as Sentry from '@sentry/react';
import { toast } from 'sonner';

/**
 * Catégories d'erreurs pour une meilleure classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS_LOGIC = 'business_logic',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  UNKNOWN = 'unknown'
}

/**
 * Niveau de sévérité de l'erreur
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Options de gestion d'erreur
 */
export interface ErrorHandlerOptions {
  /** Afficher un toast à l'utilisateur */
  showToast?: boolean;
  /** Message personnalisé pour l'utilisateur */
  userMessage?: string;
  /** Logger dans Sentry */
  logToSentry?: boolean;
  /** Niveau de sévérité */
  severity?: ErrorSeverity;
  /** Catégorie de l'erreur */
  category?: ErrorCategory;
  /** Relancer l'erreur après traitement */
  rethrow?: boolean;
  /** Métadonnées additionnelles */
  metadata?: Record<string, unknown>;
}

/**
 * Classe principale de gestion des erreurs
 */
export class ErrorHandler {
  /**
   * Traite une erreur de manière standardisée
   *
   * @param error - L'erreur à traiter
   * @param context - Contexte de l'erreur (nom du composant/service)
   * @param options - Options de traitement
   *
   * @example
   * ```typescript
   * try {
   *   await createAsset(data);
   * } catch (error) {
   *   ErrorHandler.handle(error, 'AssetService.create', {
   *     showToast: true,
   *     logToSentry: true,
   *     severity: ErrorSeverity.HIGH,
   *     category: ErrorCategory.BUSINESS_LOGIC
   *   });
   * }
   * ```
   */
  static handle(
    error: unknown,
    context: string,
    options: ErrorHandlerOptions = {}
  ): void {
    const {
      showToast = true,
      userMessage,
      logToSentry = false,
      severity = ErrorSeverity.MEDIUM,
      category = ErrorCategory.UNKNOWN,
      rethrow = false,
      metadata = {}
    } = options;

    // Convertir en Error si ce n'en est pas déjà un
    const err = this.normalizeError(error);

    // Enrichir avec le contexte
    const enrichedError = this.enrichError(err, context, category, severity, metadata);

    // 1. Logging centralisé (toujours)
    this.logError(enrichedError, context);

    // 2. Sentry si critique ou demandé
    if (logToSentry || severity === ErrorSeverity.CRITICAL) {
      this.logToSentry(enrichedError, context, severity, metadata);
    }

    // 3. Notification utilisateur
    if (showToast) {
      this.showUserNotification(enrichedError, userMessage, severity);
    }

    // 4. Relancer si nécessaire
    if (rethrow) {
      throw enrichedError;
    }
  }

  /**
   * Normalise une erreur inconnue en objet Error
   */
  private static normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (typeof error === 'object' && error !== null) {
      return new Error(JSON.stringify(error));
    }

    return new Error('Une erreur inconnue est survenue');
  }

  /**
   * Enrichit l'erreur avec des métadonnées
   */
  private static enrichError(
    error: Error,
    context: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    metadata: Record<string, unknown>
  ): Error & {
    context: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    timestamp: string;
    metadata: Record<string, unknown>;
  } {
    return Object.assign(error, {
      context,
      category,
      severity,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  /**
   * Log l'erreur via ErrorLogger
   */
  private static logError(error: Error, context: string): void {
    ErrorLogger.error(error, context);
  }

  /**
   * Envoie l'erreur à Sentry
   */
  private static logToSentry(
    error: Error,
    context: string,
    severity: ErrorSeverity,
    metadata: Record<string, unknown>
  ): void {
    Sentry.captureException(error, {
      tags: {
        context,
        severity
      },
      extra: metadata,
      level: this.mapSeverityToSentryLevel(severity)
    });
  }

  /**
   * Affiche une notification à l'utilisateur
   */
  private static showUserNotification(
    error: Error,
    customMessage?: string,
    severity?: ErrorSeverity
  ): void {
    const message = customMessage || this.getUserFriendlyMessage(error);

    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        toast.error(message, {
          duration: 5000,
          description: 'Veuillez réessayer ou contacter le support si le problème persiste.'
        });
        break;
      case ErrorSeverity.MEDIUM:
        toast.error(message, { duration: 4000 });
        break;
      case ErrorSeverity.LOW:
        toast.warning(message, { duration: 3000 });
        break;
      default:
        toast.error(message);
    }
  }

  /**
   * Convertit le niveau de sévérité en niveau Sentry
   */
  private static mapSeverityToSentryLevel(
    severity: ErrorSeverity
  ): Sentry.SeverityLevel {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'fatal';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'error';
    }
  }

  /**
   * Génère un message utilisateur compréhensible
   */
  private static getUserFriendlyMessage(error: Error): string {
    const message = error.message.toLowerCase();

    // Erreurs réseau
    if (message.includes('network') || message.includes('fetch')) {
      return 'Erreur de connexion. Vérifiez votre connexion internet.';
    }

    // Erreurs Firebase
    if (message.includes('permission-denied')) {
      return 'Vous n\'avez pas les permissions nécessaires pour cette action.';
    }

    if (message.includes('not-found')) {
      return 'La ressource demandée n\'existe pas.';
    }

    if (message.includes('already-exists')) {
      return 'Cette ressource existe déjà.';
    }

    // Erreurs d'authentification
    if (message.includes('auth') || message.includes('unauthorized')) {
      return 'Erreur d\'authentification. Veuillez vous reconnecter.';
    }

    // Erreurs de validation
    if (message.includes('invalid') || message.includes('validation')) {
      return 'Les données fournies sont invalides. Veuillez vérifier votre saisie.';
    }

    // Message générique
    return 'Une erreur est survenue. Veuillez réessayer.';
  }

  /**
   * Utilitaire pour les erreurs asynchrones
   */
  static async handleAsync<T>(
    promise: Promise<T>,
    context: string,
    options?: ErrorHandlerOptions
  ): Promise<T | null> {
    try {
      return await promise;
    } catch (error) {
      this.handle(error, context, options);
      return null;
    }
  }

  /**
   * Wrapper pour les fonctions avec gestion d'erreur automatique
   */
  static wrap<T extends (...args: never[]) => unknown>(
    fn: T,
    context: string,
    options?: ErrorHandlerOptions
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);

        // Si c'est une Promise, gérer les erreurs async
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.handle(error, context, options);
            throw error;
          });
        }

        return result;
      } catch (error) {
        this.handle(error, context, options);
        throw error;
      }
    }) as T;
  }
}

/**
 * Hook React pour la gestion d'erreurs
 *
 * @example
 * ```typescript
 * const { handleError } = useErrorHandler('AssetList');
 *
 * const handleDelete = async (id: string) => {
 *   try {
 *     await deleteAsset(id);
 *   } catch (error) {
 *     handleError(error, {
 *       userMessage: 'Impossible de supprimer l\'actif',
 *       logToSentry: true
 *     });
 *   }
 * };
 * ```
 */
export function useErrorHandler(componentName: string) {
  const handleError = (error: unknown, options?: ErrorHandlerOptions) => {
    ErrorHandler.handle(error, componentName, options);
  };

  const handleAsyncError = async <T,>(
    promise: Promise<T>,
    options?: ErrorHandlerOptions
  ): Promise<T | null> => {
    return ErrorHandler.handleAsync(promise, componentName, options);
  };

  return {
    handleError,
    handleAsyncError
  };
}

/**
 * Erreurs métier personnalisées
 */
export class BusinessError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory = ErrorCategory.BUSINESS_LOGIC,
    public severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentification requise') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Permissions insuffisantes') {
    super(message);
    this.name = 'AuthorizationError';
  }
}
