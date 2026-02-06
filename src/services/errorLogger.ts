import * as Sentry from '@sentry/react';
import i18n from '../i18n';
import { useStore } from '../store';

/**
 * Service centralisé de gestion des erreurs
 * Gère les logs en développement et envoie vers Sentry en production
 *
 * Error messages are internationalized via i18n (errorLogger.* keys).
 * Falls back to hardcoded French messages if i18n is not ready.
 */

interface ErrorContext {
    component?: string;
    action?: string;
    userId?: string;
    organizationId?: string;
    metadata?: Record<string, unknown>;
    error?: unknown;
    // Allow additional context properties
    [key: string]: unknown;
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

        // En développement : on garde les logs groupés pour le debug local
        if (this.isDevelopment) {
            // console.error and console.group are kept for local DX, but cleared of noisy log()
            console.group(`🔴 ERROR [${context}]`);
            console.error(errorMessage);
            if (errorStack) console.error(errorStack);
            console.groupEnd();
        }

        // En production : envoyer à Sentry (si configuré)
        if (this.isProduction) {
            try {
                Sentry.captureException(error, {
                    tags: {
                        context,
                        component: additionalContext?.component,
                        action: additionalContext?.action
                    },
                    extra: additionalContext as Record<string, unknown> | undefined
                });
            } catch {
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
        // No console.warn in dev by default, only external logging
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
    info(message: string, context?: string, additionalContext?: ErrorContext): void {
        // No console.info in dev by default, only external logging
        this.logToExternal('info', {
            timestamp: new Date().toISOString(),
            context,
            message,
            ...additionalContext
        });
    }

    /**
    * Log de debug (développement uniquement)
    */
    debug(_message: string, _context?: string, _additionalContext?: ErrorContext): void {
        // Silent in production and default dev to keep console clean
    }

    /**
    * Log une action utilisateur importante
    */
    logUserAction(action: string, details?: Record<string, unknown>): void {
        if (this.isDevelopment) {
            console.info(`👤 USER ACTION [${action}]:`, details);
        }
        // Could expand to send to analytics here
        this.logToExternal('user_action', {
            timestamp: new Date().toISOString(),
            action,
            ...details
        });
    }

    /**
    * Get translated error message with fallback to hardcoded messages
    * Uses i18n if available, otherwise falls back to ENRICHED_ERROR_MESSAGES
    */
    private getTranslatedErrorMessage(messageKey: ErrorMessageKey): EnrichedErrorMessage {
        const fallback = ENRICHED_ERROR_MESSAGES[messageKey];

        // Check if i18n is ready
        if (!i18n.isInitialized) {
            return fallback;
        }

        const messageI18nKey = `errorLogger.${messageKey}.message`;
        const hintI18nKey = `errorLogger.${messageKey}.hint`;
        const actionI18nKey = `errorLogger.${messageKey}.action`;

        // Try to get translated message
        const translatedMessage = i18n.exists(messageI18nKey)
            ? i18n.t(messageI18nKey)
            : fallback.message;

        const translatedHint = i18n.exists(hintI18nKey)
            ? i18n.t(hintI18nKey)
            : fallback.hint;

        const translatedActionLabel = i18n.exists(actionI18nKey)
            ? i18n.t(actionI18nKey)
            : fallback.action?.label;

        return {
            message: translatedMessage,
            hint: translatedHint,
            action: fallback.action
                ? {
                    ...fallback.action,
                    label: translatedActionLabel || fallback.action.label
                }
                : undefined
        };
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

        // Use translated enriched error message with hint and optional action
        const enrichedMessage = this.getTranslatedErrorMessage(messageKey);
        const fullMessage = enrichedMessage.hint
            ? `${enrichedMessage.message}. ${enrichedMessage.hint}`
            : enrichedMessage.message;

        try {
            const { addToast } = useStore.getState();
            if (addToast) {
                // Build action if available
                let toastAction: { label: string; onClick: () => void } | undefined;
                if (enrichedMessage.action) {
                    const action = enrichedMessage.action;
                    toastAction = {
                        label: action.label,
                        onClick: action.handler || (() => {
                            if (action.route) {
                                window.location.href = action.route;
                            }
                        })
                    };
                }
                addToast(fullMessage, 'error', toastAction);
            }
        } catch {
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
        // Metrics are sent to external monitoring for production visibility
        if (this.isProduction || this.isDevelopment) {
            this.logToExternal('performance', {
                timestamp: new Date().toISOString(),
                metric,
                duration,
                context
            });
        }
    }

    /**
    * Envoyer vers système externe (Firebase Analytics, Mixpanel, etc.)
    */
    private logToExternal(type: string, data: Record<string, unknown>): void {
        // Envoi vers Firebase Analytics
        if (typeof window !== 'undefined') {
            try {
                void import('../firebase').then(async (firebaseModule) => {
                    const analyticsInstance = firebaseModule.analytics;
                    if (!analyticsInstance) return;
                    try {
                        const analyticsSdk = await import('firebase/analytics');
                        analyticsSdk.logEvent(analyticsInstance, type, data);
                    } catch (e) { // silent
                        if (this.isDevelopment) {
                            console.debug('Analytics event failed:', e);
                        }
                    }
                }).catch(() => {
                    // Ignore import errors in tests/offline
                });
            } catch (e) { // silent
                // Fail silently if analytics fails (e.g. ad blocker)
                if (this.isDevelopment) {
                    console.debug('Analytics import failed:', e);
                }
            }

            // Stockage local en développement pour debug
            if (this.isDevelopment) {
                const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
                logs.push({ type, ...data });
                if (logs.length > 100) logs.shift();
                localStorage.setItem('app_logs', JSON.stringify(logs));
            }
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

// Structure enrichie pour les messages d'erreur avec guidance et CTA
export interface EnrichedErrorMessage {
    message: string;
    hint?: string;
    action?: {
        label: string;
        route?: string;
        handler?: () => void;
    };
}

// Messages d'erreur enrichis avec contexte et actions
export const ENRICHED_ERROR_MESSAGES: Record<string, EnrichedErrorMessage> = {
    // Général
    UNKNOWN_ERROR: {
        message: "Une erreur inattendue s'est produite",
        hint: "Essayez de rafraîchir la page. Si le problème persiste, contactez le support.",
        action: { label: "Rafraîchir", handler: () => window.location.reload() }
    },
    NETWORK_ERROR: {
        message: "Connexion impossible",
        hint: "Vérifiez votre connexion internet et réessayez.",
        action: { label: "Réessayer", handler: () => window.location.reload() }
    },
    PERMISSION_DENIED: {
        message: "Accès refusé",
        hint: "Vous n'avez pas les droits nécessaires. Contactez votre administrateur pour obtenir l'accès.",
        action: { label: "Voir mes droits", route: "/settings/profile" }
    },
    MISSING_INDEX: {
        message: "Configuration en cours",
        hint: "La base de données se configure. Réessayez dans quelques instants."
    },

    // Authentification
    AUTH_FAILED: {
        message: "Connexion impossible",
        hint: "Vérifiez vos identifiants. Mot de passe oublié ?",
        action: { label: "Réinitialiser", route: "/forgot-password" }
    },
    AUTH_EXPIRED: {
        message: "Session expirée",
        hint: "Pour votre sécurité, reconnectez-vous.",
        action: { label: "Se reconnecter", route: "/login" }
    },
    AUTH_INVALID_EMAIL: {
        message: "Email invalide",
        hint: "Format attendu : exemple@domaine.com"
    },
    AUTH_INVALID_PASSWORD: {
        message: "Mot de passe incorrect",
        hint: "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.",
        action: { label: "Mot de passe oublié ?", route: "/forgot-password" }
    },
    INVITE_FAILED: {
        message: "Invitation échouée",
        hint: "Vérifiez que l'email est correct et que l'utilisateur n'est pas déjà membre."
    },

    // Données
    FETCH_FAILED: {
        message: "Chargement impossible",
        hint: "Les données n'ont pas pu être récupérées. Vérifiez votre connexion.",
        action: { label: "Réessayer", handler: () => window.location.reload() }
    },
    CREATE_FAILED: {
        message: "Création impossible",
        hint: "Vérifiez que tous les champs obligatoires sont remplis correctement."
    },
    UPDATE_FAILED: {
        message: "Mise à jour impossible",
        hint: "Les modifications n'ont pas pu être enregistrées. L'élément a peut-être été modifié par quelqu'un d'autre."
    },
    DELETE_FAILED: {
        message: "Suppression impossible",
        hint: "Cet élément est peut-être lié à d'autres données. Vérifiez ses dépendances."
    },
    EMAIL_SEND_FAILED: {
        message: "Email non envoyé",
        hint: "Vérifiez l'adresse email et réessayez."
    },

    // Validation
    VALIDATION_FAILED: {
        message: "Données invalides",
        hint: "Vérifiez les champs en rouge et corrigez les erreurs indiquées."
    },
    REQUIRED_FIELD: {
        message: "Champ obligatoire",
        hint: "Ce champ doit être rempli pour continuer."
    },
    INVALID_FORMAT: {
        message: "Format incorrect",
        hint: "Vérifiez le format attendu pour ce champ."
    },

    // Fichiers
    FILE_UPLOAD_FAILED: {
        message: "Téléversement échoué",
        hint: "Vérifiez la taille du fichier (max 10 Mo) et le format autorisé."
    },
    FILE_TOO_LARGE: {
        message: "Fichier trop volumineux",
        hint: "La taille maximale est de 10 Mo. Compressez votre fichier ou utilisez un format plus léger."
    },
    FILE_INVALID_TYPE: {
        message: "Format non supporté",
        hint: "Formats acceptés : PDF, DOC, DOCX, XLS, XLSX, PNG, JPG."
    },

    // Limites
    QUOTA_EXCEEDED: {
        message: "Quota atteint",
        hint: "Vous avez atteint la limite de votre forfait.",
        action: { label: "Voir les forfaits", route: "/settings/billing" }
    },
    RATE_LIMIT_EXCEEDED: {
        message: "Trop de requêtes",
        hint: "Patientez quelques secondes avant de réessayer."
    },

    // Métier
    ASSET_NOT_FOUND: {
        message: "Actif introuvable",
        hint: "Cet actif a peut-être été supprimé ou vous n'y avez pas accès.",
        action: { label: "Voir tous les actifs", route: "/assets" }
    },
    RISK_NOT_FOUND: {
        message: "Risque introuvable",
        hint: "Ce risque a peut-être été supprimé ou archivé.",
        action: { label: "Voir les risques", route: "/risks" }
    },
    PROJECT_NOT_FOUND: {
        message: "Projet introuvable",
        hint: "Ce projet a peut-être été supprimé ou vous n'y avez pas accès.",
        action: { label: "Voir les projets", route: "/projects" }
    },
    DOCUMENT_NOT_FOUND: {
        message: "Document introuvable",
        hint: "Ce document a peut-être été supprimé ou déplacé.",
        action: { label: "Voir les documents", route: "/documents" }
    },
    AUDIT_NOT_FOUND: {
        message: "Audit introuvable",
        hint: "Cet audit a peut-être été supprimé ou archivé.",
        action: { label: "Voir les audits", route: "/audits" }
    },
    SCAN_FAILED: {
        message: "Scan échoué",
        hint: "Le scan de sécurité n'a pas pu être effectué. Vérifiez la configuration de l'actif.",
        action: { label: "Configurer", route: "/assets" }
    },
    REPORT_GENERATION_FAILED: {
        message: "Génération échouée",
        hint: "Le rapport n'a pas pu être généré. Vérifiez que toutes les données nécessaires sont disponibles."
    },

    // IA
    AI_ERROR: {
        message: "Analyse IA indisponible",
        hint: "Le service d'analyse est temporairement indisponible. Réessayez plus tard."
    },
    HIBP_FAILED: {
        message: "Vérification impossible",
        hint: "Le service de vérification des fuites de données est indisponible."
    },
    DELETE_ACCOUNT_FAILED: {
        message: "Suppression impossible",
        hint: "Votre compte ne peut pas être supprimé actuellement. Contactez le support.",
        action: { label: "Contacter le support", route: "/support" }
    },

    // Audit Portal
    LINK_GEN_FAILED: {
        message: "Lien non généré",
        hint: "Le lien de partage n'a pas pu être créé. Réessayez."
    },
    PORTAL_ACCESS_FAILED: {
        message: "Accès au portail impossible",
        hint: "Vérifiez que le lien est valide et non expiré."
    }
};

// Messages d'erreur simples (rétrocompatibilité)
export const ERROR_MESSAGES = Object.fromEntries(
    Object.entries(ENRICHED_ERROR_MESSAGES).map(([key, value]) => [key, value.message])
) as Record<string, string>;

export type ErrorMessageKey = keyof typeof ENRICHED_ERROR_MESSAGES;
