import { ErrorLogger } from '../services/errorLogger';
import { toast } from '@/lib/toast';
import { useStore } from '../store';

/**
 * Types d'erreurs standardisés pour Sentinel GRC
 */
export enum ErrorType {
 NETWORK = 'network',
 VALIDATION = 'validation',
 PERMISSION = 'permission',
 NOT_FOUND = 'not_found',
 SERVER_ERROR = 'server_error',
 TIMEOUT = 'timeout',
 CONFLICT = 'conflict',
 UNKNOWN = 'unknown'
}

/**
 * Interface pour les erreurs structurées
 */
export interface StructuredError {
 type: ErrorType;
 code?: string;
 message: string;
 context?: string;
 userMessage?: string;
 technicalDetails?: Record<string, unknown>;
 timestamp: Date;
 userId?: string;
 organizationId?: string;
}

/**
 * Hook pour la gestion d'erreurs standardisée
 */
export const useErrorHandler = () => {
 const { t } = useStore();

 /**
 * Gère une erreur de manière standardisée
 */
 const handleError = (
 error: Error | unknown,
 context: string,
 options?: {
 showToast?: boolean;
 logToService?: boolean;
 customMessage?: string;
 onError?: (structuredError: StructuredError) => void;
 }
 ): StructuredError => {
 const {
 showToast = true,
 logToService = true,
 customMessage,
 onError
 } = options || {};

 // Déterminer le type d'erreur
 const errorType = determineErrorType(error);

 // Créer l'erreur structurée
 const structuredError = createStructuredError(error, context, errorType);

 // Ajouter le message utilisateur
 structuredError.userMessage = customMessage || generateUserMessage(structuredError);

 // Logger l'erreur
 if (logToService) {
 ErrorLogger.error(structuredError.message, context, {
 component: 'useErrorHandler',
 action: structuredError.type,
 metadata: {
 code: structuredError.code,
 technicalDetails: structuredError.technicalDetails
 }
 });
 }

 // Afficher un toast si demandé
 if (showToast) {
 if (structuredError.type === ErrorType.NETWORK) {
 toast.error(t('errors.checkConnection', { defaultValue: 'Veuillez vérifier votre connexion.' }), structuredError.userMessage);
 } else {
 toast.error(structuredError.userMessage);
 }
 }

 // Callback personnalisé
 onError?.(structuredError);

 return structuredError;
 };

 /**
 * Détermine le type d'erreur basé sur l'erreur brute
 */
 const determineErrorType = (error: unknown): ErrorType => {
 if (!error) return ErrorType.UNKNOWN;

 // Typage sécurisé pour l'accès aux propriétés
 const err = error as Record<string, unknown>;
 const message = typeof err.message === 'string' ? err.message : '';
 const code = typeof err.code === 'string' ? err.code : '';
 const name = typeof err.name === 'string' ? err.name : '';
 const status = typeof err.status === 'number' ? err.status : 0;

 // Erreurs réseau
 if (code === 'NETWORK_ERROR' || code === 'ECONNABORTED' ||
 message.includes('fetch') || message.includes('network')) {
 return ErrorType.NETWORK;
 }

 // Erreurs de timeout
 if (code === 'TIMEOUT' || message.includes('timeout')) {
 return ErrorType.TIMEOUT;
 }

 // Erreurs de permission
 if (code === 'PERMISSION_DENIED' || code === 'UNAUTHORIZED' ||
 message.includes('permission') || message.includes('unauthorized')) {
 return ErrorType.PERMISSION;
 }

 // Erreurs de validation
 if (code === 'VALIDATION_ERROR' || name === 'ValidationError' ||
 message.includes('validation') || message.includes('required')) {
 return ErrorType.VALIDATION;
 }

 // Erreurs 404
 if (code === 'NOT_FOUND' || status === 404) {
 return ErrorType.NOT_FOUND;
 }

 // Erreurs de conflit
 if (code === 'CONFLICT' || status === 409) {
 return ErrorType.CONFLICT;
 }

 // Erreurs serveur
 if (status >= 500 || code === 'SERVER_ERROR') {
 return ErrorType.SERVER_ERROR;
 }

 return ErrorType.UNKNOWN;
 };

 /**
 * Crée une erreur structurée à partir d'une erreur brute
 */
 const createStructuredError = (
 error: Error | unknown,
 context: string,
 type: ErrorType = ErrorType.UNKNOWN
 ): StructuredError => {
 const timestamp = new Date();

 // Tenter d'extraire des informations de l'erreur
 let message = t('errors.unexpected', { defaultValue: 'Une erreur inattendue est survenue' });
 let code: string | undefined;
 let technicalDetails: Record<string, unknown> | undefined;

 if (error instanceof Error) {
 message = error.message;
 technicalDetails = {
 errorName: error.name,
 stack: error.stack,
 ...error
 };
 } else if (typeof error === 'string') {
 message = error;
 } else if (error && typeof error === 'object') {
 const errObj = error as Record<string, unknown>;
 message = (typeof errObj.message === 'string' ? errObj.message : undefined) ||
 (typeof errObj.error === 'string' ? errObj.error : undefined) ||
 message;
 code = (typeof errObj.code === 'string' ? errObj.code : undefined) ||
 (typeof errObj.status === 'string' ? errObj.status : undefined);
 technicalDetails = errObj;
 }

 return {
 type,
 code,
 message,
 context,
 timestamp,
 technicalDetails
 };
 };

 /**
 * Generates an appropriate user-facing error message.
 */
 const generateUserMessage = (structuredError: StructuredError): string => {
 const { type, message } = structuredError;

 switch (type) {
 case ErrorType.NETWORK:
 return t('errors.networkConnection', { defaultValue: 'Erreur de connexion. Veuillez vérifier votre connexion internet et réessayer.' });

 case ErrorType.TIMEOUT:
 return t('errors.timeout', { defaultValue: 'Le serveur met trop temps à répondre. Veuillez réessayer dans un instant.' });

 case ErrorType.PERMISSION:
 return t('errors.permissionDenied', { defaultValue: 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.' });

 case ErrorType.VALIDATION:
 return t('errors.validationFailed', { defaultValue: 'Les données fournies ne sont pas valides. Veuillez vérifier les champs du formulaire.' });

 case ErrorType.NOT_FOUND:
 return t('errors.notFound', { defaultValue: 'La ressource demandée n\'existe pas ou a été supprimée.' });

 case ErrorType.CONFLICT:
 return t('errors.conflict', { defaultValue: 'Un conflit a été détecté. Les données ont peut-être été modifiées par un autre utilisateur.' });

 case ErrorType.SERVER_ERROR:
 return t('errors.serverError', { defaultValue: 'Une erreur technique est survenue. Nos équipes en ont été informées.' });

 default:
 return message || t('errors.unexpected', { defaultValue: 'Une erreur inattendue est survenue.' });
 }
 };

 return {
 handleError
 };
};
