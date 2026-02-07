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
import { toast } from '@/lib/toast';

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
/**
 * Function type for i18n translation
 */
export type TranslatorFunction = (key: string, options?: { defaultValue?: string }) => string;

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
 /** Optional translator function for i18n support */
 translator?: TranslatorFunction;
}

/**
 * i18n error message keys mapping
 */
const ERROR_MESSAGES = {
 unknown: { key: 'errors.unknown', defaultValue: 'Une erreur inconnue est survenue' },
 retryOrContact: { key: 'errors.retryOrContact', defaultValue: 'Veuillez réessayer ou contacter le support si le problème persiste.' },
 networkConnection: { key: 'errors.networkConnection', defaultValue: 'Erreur de connexion. Vérifiez votre connexion internet.' },
 permissionDenied: { key: 'errors.permissionDenied', defaultValue: 'Vous n\'avez pas les permissions nécessaires pour cette action.' },
 notFound: { key: 'errors.notFound', defaultValue: 'La ressource demandée n\'existe pas.' },
 alreadyExists: { key: 'errors.alreadyExists', defaultValue: 'Cette ressource existe déjà.' },
 authError: { key: 'errors.authError', defaultValue: 'Erreur d\'authentification. Veuillez vous reconnecter.' },
 invalidData: { key: 'errors.invalidData', defaultValue: 'Les données fournies sont invalides. Veuillez vérifier votre saisie.' },
 generic: { key: 'errors.generic', defaultValue: 'Une erreur est survenue. Veuillez réessayer.' },
} as const;

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
 * await createAsset(data);
 * } catch (error) { // handleError
 * ErrorHandler.handle(error, 'AssetService.create', {
 * showToast: true,
 * logToSentry: true,
 * severity: ErrorSeverity.HIGH,
 * category: ErrorCategory.BUSINESS_LOGIC
 * });
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
 this.showUserNotification(enrichedError, userMessage, severity, options.translator);
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

 return new Error(ERROR_MESSAGES.unknown.defaultValue);
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
 severity?: ErrorSeverity,
 translator?: TranslatorFunction
 ): void {
 const message = customMessage || this.getUserFriendlyMessage(error, translator);

 const retryMessage = translator
 ? translator(ERROR_MESSAGES.retryOrContact.key, { defaultValue: ERROR_MESSAGES.retryOrContact.defaultValue })
 : ERROR_MESSAGES.retryOrContact.defaultValue;

 switch (severity) {
 case ErrorSeverity.CRITICAL:
 case ErrorSeverity.HIGH:
 toast.error(message, retryMessage);
 break;
 case ErrorSeverity.MEDIUM:
 toast.error(message);
 break;
 case ErrorSeverity.LOW:
 toast.warning(message);
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
 *
 * @param error - The error object
 * @param translator - Optional i18n translator function
 * @returns User-friendly error message (translated if translator provided)
 */
 private static getUserFriendlyMessage(error: Error, translator?: TranslatorFunction): string {
 const errorMessage = error.message.toLowerCase();

 const t = (msg: { key: string; defaultValue: string }) =>
 translator ? translator(msg.key, { defaultValue: msg.defaultValue }) : msg.defaultValue;

 // Erreurs réseau
 if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
 return t(ERROR_MESSAGES.networkConnection);
 }

 // Erreurs Firebase
 if (errorMessage.includes('permission-denied')) {
 return t(ERROR_MESSAGES.permissionDenied);
 }

 if (errorMessage.includes('not-found')) {
 return t(ERROR_MESSAGES.notFound);
 }

 if (errorMessage.includes('already-exists')) {
 return t(ERROR_MESSAGES.alreadyExists);
 }

 // Erreurs d'authentification
 if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
 return t(ERROR_MESSAGES.authError);
 }

 // Erreurs de validation
 if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
 return t(ERROR_MESSAGES.invalidData);
 }

 // Message générique
 return t(ERROR_MESSAGES.generic);
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
   ErrorLogger.handleErrorWithToast(error, 'errorHandler');
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
   ErrorLogger.handleErrorWithToast(error, 'errorHandler');
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
 * try {
 * await deleteAsset(id);
 * } catch (error) { // handleError
 * handleError(error, {
 * userMessage: 'Impossible de supprimer l\'actif',
 * logToSentry: true
 * });
 * }
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
