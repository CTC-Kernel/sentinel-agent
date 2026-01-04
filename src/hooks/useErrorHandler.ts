import { ErrorLogger } from '../services/errorLogger';
import { toast } from 'sonner';

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
  technicalDetails?: any;
  timestamp: Date;
  userId?: string;
  organizationId?: string;
}

/**
 * Hook pour la gestion d'erreurs standardisée
 */
export const useErrorHandler = () => {
  /**
   * Gère une erreur de manière standardisée
   */
  const handleError = (
    error: Error | any,
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
      ErrorLogger.handleError(structuredError.message, context, {
        type: structuredError.type,
        code: structuredError.code,
        technicalDetails: structuredError.technicalDetails
      });
    }
    
    // Afficher un toast si demandé
    if (showToast) {
      const toastType = structuredError.type === ErrorType.VALIDATION ? 'warning' : 'error';
      toast(structuredError.userMessage, {
        duration: structuredError.type === ErrorType.NETWORK ? 6000 : 4000,
        action: structuredError.type === ErrorType.NETWORK ? {
          label: 'Réessayer',
          onClick: () => window.location.reload()
        } : undefined
      });
    }
    
    // Callback personnalisé
    onError?.(structuredError);
    
    return structuredError;
  };

  /**
   * Détermine le type d'erreur basé sur l'erreur brute
   */
  const determineErrorType = (error: any): ErrorType => {
    if (!error) return ErrorType.UNKNOWN;
    
    // Erreurs réseau
    if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED' || 
        error.message?.includes('fetch') || error.message?.includes('network')) {
      return ErrorType.NETWORK;
    }
    
    // Erreurs de timeout
    if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
      return ErrorType.TIMEOUT;
    }
    
    // Erreurs de permission
    if (error.code === 'PERMISSION_DENIED' || error.code === 'UNAUTHORIZED' ||
        error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      return ErrorType.PERMISSION;
    }
    
    // Erreurs de validation
    if (error.code === 'VALIDATION_ERROR' || error.name === 'ValidationError' ||
        error.message?.includes('validation') || error.message?.includes('required')) {
      return ErrorType.VALIDATION;
    }
    
    // Erreurs 404
    if (error.code === 'NOT_FOUND' || error.status === 404) {
      return ErrorType.NOT_FOUND;
    }
    
    // Erreurs de conflit
    if (error.code === 'CONFLICT' || error.status === 409) {
      return ErrorType.CONFLICT;
    }
    
    // Erreurs serveur
    if (error.status >= 500 || error.code === 'SERVER_ERROR') {
      return ErrorType.SERVER_ERROR;
    }
    
    return ErrorType.UNKNOWN;
  };

  /**
   * Crée une erreur structurée à partir d'une erreur brute
   */
  const createStructuredError = (
    error: Error | any,
    context: string,
    type: ErrorType = ErrorType.UNKNOWN
  ): StructuredError => {
    const timestamp = new Date();
    
    // Tenter d'extraire des informations de l'erreur
    let message = 'Une erreur inattendue est survenue';
    let code: string | undefined;
    let technicalDetails: any;
    
    if (error instanceof Error) {
      message = error.message;
      technicalDetails = {
        name: error.name,
        stack: error.stack,
        ...error
      };
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      message = error.message || error.error || message;
      code = error.code || error.status;
      technicalDetails = error;
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
   * Génère un message utilisateur approprié
   */
  const generateUserMessage = (structuredError: StructuredError): string => {
    const { type, code, message, context } = structuredError;
    
    switch (type) {
      case ErrorType.NETWORK:
        return 'Erreur de connexion. Veuillez vérifier votre connexion internet et réessayer.';
      
      case ErrorType.TIMEOUT:
        return 'Le serveur met trop temps à répondre. Veuillez réessayer dans un instant.';
      
      case ErrorType.PERMISSION:
        return 'Vous n\\'avez pas les permissions nécessaires pour effectuer cette action.';
      
      case ErrorType.VALIDATION:
        return 'Les données fournies ne sont pas valides. Veuillez vérifier les champs du formulaire.';
      
      case ErrorType.NOT_FOUND:
        return 'La ressource demandée n\\'existe pas ou a été supprimée.';
      
      case ErrorType.CONFLICT:
        return 'Un conflit a été détecté. Les données ont peut-être été modifiées par un autre utilisateur.';
      
      case ErrorType.SERVER_ERROR:
        return 'Une erreur technique est survenue. Nos équipes en ont été informées.';
      
      default:
        return message || 'Une erreur inattendue est survenue.';
    }
  };

  return {
    handleError
  };
};
