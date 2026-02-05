/**
 * ServiceError - Unified error handling for services
 *
 * Provides consistent error handling patterns across all services.
 * Maps error codes to user-friendly French messages.
 *
 * @module ServiceError
 */

import { ErrorLogger, ERROR_MESSAGES, type ErrorMessageKey } from './errorLogger';

/**
 * Error codes for service operations
 */
export type ServiceErrorCode =
 | 'PERMISSION_DENIED'
 | 'NOT_FOUND'
 | 'VALIDATION_ERROR'
 | 'NETWORK_ERROR'
 | 'AUTH_ERROR'
 | 'RATE_LIMIT'
 | 'QUOTA_EXCEEDED'
 | 'CONFLICT'
 | 'INTERNAL_ERROR'
 | 'EXTERNAL_SERVICE_ERROR'
 | 'INVALID_STATE';

/**
 * Maps service error codes to user-facing error message keys
 */
const ERROR_CODE_TO_MESSAGE: Record<ServiceErrorCode, ErrorMessageKey> = {
 'PERMISSION_DENIED': 'PERMISSION_DENIED',
 'NOT_FOUND': 'FETCH_FAILED',
 'VALIDATION_ERROR': 'VALIDATION_FAILED',
 'NETWORK_ERROR': 'NETWORK_ERROR',
 'AUTH_ERROR': 'AUTH_EXPIRED',
 'RATE_LIMIT': 'RATE_LIMIT_EXCEEDED',
 'QUOTA_EXCEEDED': 'QUOTA_EXCEEDED',
 'CONFLICT': 'UPDATE_FAILED',
 'INTERNAL_ERROR': 'UNKNOWN_ERROR',
 'EXTERNAL_SERVICE_ERROR': 'UNKNOWN_ERROR',
 'INVALID_STATE': 'VALIDATION_FAILED'
};

/**
 * Service-specific error class with standardized handling
 */
export class ServiceError extends Error {
 public readonly code: ServiceErrorCode;
 public readonly context: string;
 public readonly originalError?: unknown;
 public readonly metadata?: Record<string, unknown>;

 constructor(
 code: ServiceErrorCode,
 message: string,
 context: string,
 options?: {
 originalError?: unknown;
 metadata?: Record<string, unknown>;
 }
 ) {
 super(message);
 this.name = 'ServiceError';
 this.code = code;
 this.context = context;
 this.originalError = options?.originalError;
 this.metadata = options?.metadata;

 // Log the error automatically
 ErrorLogger.error(this, context, {
 metadata: {
 errorCode: code,
 ...options?.metadata
 }
 });
 }

 /**
 * Get user-friendly message for this error
 */
 getUserMessage(): string {
 const messageKey = ERROR_CODE_TO_MESSAGE[this.code];
 return ERROR_MESSAGES[messageKey] || this.message;
 }

 /**
 * Get the corresponding ErrorMessageKey
 */
 getMessageKey(): ErrorMessageKey {
 return ERROR_CODE_TO_MESSAGE[this.code];
 }
}

/**
 * Convert Firebase/external errors to ServiceError
 */
export function toServiceError(
 error: unknown,
 context: string,
 defaultCode: ServiceErrorCode = 'INTERNAL_ERROR'
): ServiceError {
 // Already a ServiceError
 if (error instanceof ServiceError) {
 return error;
 }

 const anyError = error as { code?: string; message?: string };
 const errorMessage = anyError?.message || String(error);
 let code: ServiceErrorCode = defaultCode;

 // Map Firebase error codes
 if (anyError?.code) {
 switch (anyError.code) {
 case 'permission-denied':
 code = 'PERMISSION_DENIED';
 break;
 case 'not-found':
 code = 'NOT_FOUND';
 break;
 case 'unauthenticated':
 case 'auth/id-token-expired':
 case 'auth/user-disabled':
 case 'auth/user-not-found':
 code = 'AUTH_ERROR';
 break;
 case 'unavailable':
 case 'network-request-failed':
 code = 'NETWORK_ERROR';
 break;
 case 'invalid-argument':
 case 'failed-precondition':
 code = 'VALIDATION_ERROR';
 break;
 case 'resource-exhausted':
 code = 'QUOTA_EXCEEDED';
 break;
 case 'already-exists':
 case 'aborted':
 code = 'CONFLICT';
 break;
 }
 }

 // Check for network errors
 if (errorMessage.includes('network') || errorMessage.includes('Network')) {
 code = 'NETWORK_ERROR';
 }

 return new ServiceError(code, errorMessage, context, {
 originalError: error
 });
}

/**
 * Wrap an async function with error handling
 * Converts any thrown error to ServiceError
 */
export function withServiceError<T extends (...args: unknown[]) => Promise<unknown>>(
 fn: T,
 context: string,
 defaultCode: ServiceErrorCode = 'INTERNAL_ERROR'
): T {
 return (async (...args: Parameters<T>) => {
 try {
 return await fn(...args);
 } catch (error) {
 throw toServiceError(error, context, defaultCode);
 }
 }) as T;
}

/**
 * Execute a service operation with standardized error handling
 *
 * @param operation - Async operation to execute
 * @param context - Context string for error logging
 * @param options - Additional options
 * @returns Result of the operation
 * @throws ServiceError if operation fails
 *
 * @example
 * ```ts
 * const result = await executeServiceOperation(
 * () => getDocs(query(collection(db, 'assets'))),
 * 'AssetService.fetchAssets',
 * { defaultCode: 'NOT_FOUND' }
 * );
 * ```
 */
export async function executeServiceOperation<T>(
 operation: () => Promise<T>,
 context: string,
 options?: {
 defaultCode?: ServiceErrorCode;
 metadata?: Record<string, unknown>;
 }
): Promise<T> {
 try {
 return await operation();
 } catch (error) {
 throw toServiceError(error, context, options?.defaultCode || 'INTERNAL_ERROR');
 }
}

/**
 * Validate required parameters before service operation
 *
 * @throws ServiceError with VALIDATION_ERROR code if validation fails
 */
export function validateServiceParams(
 params: Record<string, unknown>,
 context: string
): void {
 const missing: string[] = [];

 for (const [key, value] of Object.entries(params)) {
 if (value === undefined || value === null || value === '') {
 missing.push(key);
 }
 }

 if (missing.length > 0) {
 throw new ServiceError(
 'VALIDATION_ERROR',
 `Paramètres manquants: ${missing.join(', ')}`,
 context,
 { metadata: { missingParams: missing } }
 );
 }
}

/**
 * Check if error is a ServiceError with specific code
 */
export function isServiceError(error: unknown, code?: ServiceErrorCode): error is ServiceError {
 if (!(error instanceof ServiceError)) {
 return false;
 }
 if (code) {
 return error.code === code;
 }
 return true;
}

/**
 * Handle service errors with toast notification
 *
 * @returns The error message key for further handling
 */
export function handleServiceError(
 error: unknown,
 context: string,
 showToast: (message: string, type: 'error' | 'success' | 'warning' | 'info') => void
): ErrorMessageKey {
 const serviceError = error instanceof ServiceError
 ? error
 : toServiceError(error, context);

 showToast(serviceError.getUserMessage(), 'error');
 return serviceError.getMessageKey();
}
