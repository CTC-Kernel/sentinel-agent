import { useStore } from '../store';

/**
 * Service centralisé de gestion des erreurs
 * Gère les logs en développement et envoie vers Sentry en production
 */

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

class ErrorLoggerService {
  private isDevelopment = import.meta.env.DEV;
  private isProduction = import.meta.env.PROD;

  /**
   * Log une erreur avec contexte
   */
  error(error: Error | unknown, context: string, additionalContext?: ErrorContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // En développement : console détaillé
    if (this.isDevelopment) {
      console.group(`🔴 ERROR [${context}]`);
      console.error('Message:', errorMessage);
      if (errorStack) console.error('Stack:', errorStack);
      if (additionalContext) console.error('Context:', additionalContext);
      console.groupEnd();
    }

    // En production : envoyer à Sentry (si configuré)
    if (this.isProduction && typeof window !== 'undefined') {
      try {
        // @ts-expect-error - Sentry will be added later
        if (window.Sentry) {
          // @ts-expect-error - Sentry type not defined on window
          window.Sentry.captureException(error, {
            tags: {
              context,
              component: additionalContext?.component,
              action: additionalContext?.action
            },
            extra: additionalContext
          });
        }
      } catch (sentryError) {
        // Fail silently si Sentry n'est pas disponible
      }
    }

    // Log structuré pour monitoring externe
    this.logToExternal('error', {
      timestamp: new Date().toISOString(),
      context,
      message: errorMessage,
      stack: errorStack,
      ...additionalContext
    });
  }

  /**
   * Log un warning
   */
  warn(message: string, context?: string, additionalContext?: ErrorContext): void {
    if (this.isDevelopment) {
      console.warn(`⚠️ WARNING [${context || 'General'}]:`, message, additionalContext);
    }

    this.logToExternal('warning', {
      timestamp: new Date().toISOString(),
      context,
      message,
      ...additionalContext
    });
  }

  /**
   * Log une info (développement uniquement)
   */
  info(message: string, context?: string): void {
    if (this.isDevelopment) {
      console.log(`ℹ️ INFO [${context || 'General'}]:`, message);
    }
  }

  /**
   * Log une action utilisateur importante
   */
  logUserAction(action: string, details?: Record<string, any>): void {
    if (this.isDevelopment) {
      console.log(`👤 USER ACTION [${action}]:`, details);
    }

    // Analytics tracking
    this.logToExternal('user_action', {
      timestamp: new Date().toISOString(),
      action,
      ...details
    });
  }

  handleErrorWithToast(error: Error | unknown, context: string, defaultMessageKey: ErrorMessageKey = 'UNKNOWN_ERROR'): ErrorMessageKey {
    let messageKey: ErrorMessageKey = defaultMessageKey;
    const anyError = error as { code?: unknown };
    const code = typeof anyError?.code === 'string' ? anyError.code : undefined;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (code === 'permission-denied') {
      messageKey = 'PERMISSION_DENIED';
    } else if (code === 'failed-precondition') {
      // Often means Missing Index
      messageKey = 'MISSING_INDEX' as ErrorMessageKey;

    } else if (
      code === 'unauthenticated' ||
      code === 'auth/id-token-expired' ||
      code === 'auth/user-disabled' ||
      code === 'auth/user-not-found'
    ) {
      messageKey = 'AUTH_EXPIRED';
    } else if (code === 'unavailable' || code === 'network-request-failed') {
      messageKey = 'NETWORK_ERROR';
    } else if (
      errorMessage.includes('invalid data') ||
      errorMessage.includes('Unsupported field value') ||
      code === 'invalid-argument'
    ) {
      messageKey = 'VALIDATION_FAILED';
    }

    try {
      const { addToast } = useStore.getState();
      if (addToast) {
        addToast(ERROR_MESSAGES[messageKey], 'error');
      }
    } catch (_e) {
      // Ignore toast errors if store is not ready
    }

    this.error(error, context, {
      metadata: {
        firebaseCode: code
      }
    });

    return messageKey;
  }

  /**
   * Log une performance metric
   */
  logPerformance(metric: string, duration: number, context?: string): void {
    if (this.isDevelopment) {
      console.log(`⚡ PERFORMANCE [${metric}]:`, `${duration}ms`, context);
    }

    this.logToExternal('performance', {
      timestamp: new Date().toISOString(),
      metric,
      duration,
      context
    });
  }

  /**
   * Envoyer vers système externe (Firebase Analytics, Mixpanel, etc.)
   */
  private logToExternal(type: string, data: any): void {
    // TODO: Implémenter envoi vers Firebase Analytics ou autre
    // Pour l'instant, stockage local en développement
    if (this.isDevelopment && typeof window !== 'undefined') {
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      logs.push({ type, ...data });
      // Garder seulement les 100 derniers logs
      if (logs.length > 100) logs.shift();
      localStorage.setItem('app_logs', JSON.stringify(logs));
    }
  }

  /**
   * Nettoyer les logs (appelé au logout)
   */
  clearLogs(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app_logs');
    }
  }
}

// Export singleton
export const ErrorLogger = new ErrorLoggerService();

// Messages d'erreur standardisés
export const ERROR_MESSAGES = {
  // Général
  UNKNOWN_ERROR: "Une erreur inattendue s'est produite",
  NETWORK_ERROR: "Erreur de connexion réseau",
  PERMISSION_DENIED: "Vous n'avez pas les permissions nécessaires",
  MISSING_INDEX: "Index Firestore manquant (vérifiez la console)",

  // Authentification
  AUTH_FAILED: "Échec de l'authentification",
  AUTH_EXPIRED: "Session expirée, veuillez vous reconnecter",
  AUTH_INVALID_EMAIL: "Adresse email invalide",
  AUTH_INVALID_PASSWORD: "Mot de passe invalide",

  // Données
  FETCH_FAILED: "Impossible de charger les données",
  CREATE_FAILED: "Erreur lors de la création",
  UPDATE_FAILED: "Erreur lors de la mise à jour",
  DELETE_FAILED: "Erreur lors de la suppression",

  // Validation
  VALIDATION_FAILED: "Données invalides",
  REQUIRED_FIELD: "Ce champ est obligatoire",
  INVALID_FORMAT: "Format invalide",

  // Fichiers
  FILE_UPLOAD_FAILED: "Échec du téléversement du fichier",
  FILE_TOO_LARGE: "Fichier trop volumineux",
  FILE_INVALID_TYPE: "Type de fichier non supporté",

  // Limites
  QUOTA_EXCEEDED: "Quota dépassé",
  RATE_LIMIT_EXCEEDED: "Trop de requêtes, veuillez patienter",

  // Métier
  ASSET_NOT_FOUND: "Actif introuvable",
  RISK_NOT_FOUND: "Risque introuvable",
  PROJECT_NOT_FOUND: "Projet introuvable",
  DOCUMENT_NOT_FOUND: "Document introuvable",
  AUDIT_NOT_FOUND: "Audit introuvable",

  // IA
  AI_ERROR: "Erreur lors de l'analyse IA"
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
