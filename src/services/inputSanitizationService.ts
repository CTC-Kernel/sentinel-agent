import DOMPurify from 'dompurify';
import { ErrorLogger } from './errorLogger';

/**
 * Service centralisé de sanitization des inputs
 * Protection contre XSS, injection, et autres attaques
 *
 * SÉCURITÉ: Ce service complète DOMPurify avec des validations supplémentaires
 */

interface SanitizationOptions {
  allowHTML?: boolean;
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: string[];
  trim?: boolean;
  lowercase?: boolean;
}

class InputSanitizationService {
  /**
   * Sanitize une chaîne de caractères
   * @param input Input utilisateur
   * @param options Options de sanitization
   * @returns Chaîne sanitizée
   */
  sanitizeString(input: unknown, options: SanitizationOptions = {}): string {
    // Validation du type
    if (typeof input !== 'string') {
      if (input === null || input === undefined) return '';
      input = String(input);
    }

    let sanitized = input as string;

    // Trim
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    // Lowercase
    if (options.lowercase) {
      sanitized = sanitized.toLowerCase();
    }

    // Max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
      ErrorLogger.warn('Input truncated due to max length', 'InputSanitization', {
        metadata: { originalLength: (input as string).length, maxLength: options.maxLength }
      });
    }

    // HTML sanitization
    if (!options.allowHTML) {
      // Supprimer complètement les tags HTML
      sanitized = this.stripHTML(sanitized);
    } else {
      // Sanitizer avec DOMPurify
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: options.allowedTags || ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: options.allowedAttributes || ['href', 'title'],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false
      });
    }

    return sanitized;
  }

  /**
   * Sanitize un email
   * @param email Email à valider
   * @returns Email sanitizé ou vide si invalide
   */
  sanitizeEmail(email: unknown): string {
    if (typeof email !== 'string') return '';

    const sanitized = this.sanitizeString(email, {
      trim: true,
      lowercase: true,
      maxLength: 254, // RFC 5321
      allowHTML: false
    });

    // Validation basique d'email
    const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

    if (!emailRegex.test(sanitized)) {
      ErrorLogger.warn('Invalid email format', 'InputSanitization', {
        metadata: { email: sanitized.substring(0, 20) + '...' }
      });
      return '';
    }

    return sanitized;
  }

  /**
   * Sanitize une URL
   * @param url URL à valider
   * @param allowedProtocols Protocoles autorisés
   * @returns URL sanitizée ou vide si invalide
   */
  sanitizeURL(url: unknown, allowedProtocols: string[] = ['https', 'http']): string {
    if (typeof url !== 'string') return '';

    const sanitized = this.sanitizeString(url, {
      trim: true,
      maxLength: 2048, // RFC 7230
      allowHTML: false
    });

    try {
      const parsed = new URL(sanitized);

      // Vérifier le protocole
      if (!allowedProtocols.includes(parsed.protocol.replace(':', ''))) {
        ErrorLogger.warn('URL protocol not allowed', 'InputSanitization', {
          metadata: { protocol: parsed.protocol, allowedProtocols }
        });
        return '';
      }

      // Bloquer les URLs locales (SSRF protection)
      const hostname = parsed.hostname.toLowerCase();
      const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];
      const isLocal = localHosts.some(local => hostname === local || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./));

      if (isLocal) {
        ErrorLogger.warn('Local URL blocked (SSRF protection)', 'InputSanitization', {
          metadata: { hostname }
        });
        return '';
      }

      return parsed.toString();
    } catch (error) {
      ErrorLogger.warn('Invalid URL format', 'InputSanitization', {
        metadata: { url: sanitized.substring(0, 50) + '...' }
      });
      return '';
    }
  }

  /**
   * Sanitize un nom de fichier
   * @param filename Nom de fichier
   * @returns Nom de fichier sécurisé
   */
  sanitizeFilename(filename: unknown): string {
    if (typeof filename !== 'string') return 'file';

    let sanitized = this.sanitizeString(filename, {
      trim: true,
      maxLength: 255,
      allowHTML: false
    });

    // Supprimer les caractères dangereux
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Éviter les chemins relatifs
    sanitized = sanitized.replace(/\.\./g, '_');

    // Éviter les noms de fichiers réservés (Windows)
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'LPT1', 'LPT2', 'LPT3'];
    const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
    if (reserved.includes(nameWithoutExt)) {
      sanitized = `file_${sanitized}`;
    }

    return sanitized || 'file';
  }

  /**
   * Sanitize un objet récursivement
   * @param obj Objet à sanitizer
   * @param options Options de sanitization
   * @returns Objet sanitizé
   */
  sanitizeObject<T extends Record<string, unknown>>(obj: T, options: SanitizationOptions = {}): T {
    const sanitized = {} as T;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key as keyof T] = this.sanitizeString(value, options) as T[keyof T];
      } else if (Array.isArray(value)) {
        sanitized[key as keyof T] = value.map(item =>
          typeof item === 'string' ? this.sanitizeString(item, options) : item
        ) as T[keyof T];
      } else if (value !== null && typeof value === 'object') {
        sanitized[key as keyof T] = this.sanitizeObject(value as Record<string, unknown>, options) as T[keyof T];
      } else {
        sanitized[key as keyof T] = value as T[keyof T];
      }
    }

    return sanitized;
  }

  /**
   * Sanitize les données pour export CSV/Excel
   * Prévient les injections de formules (CSV Injection)
   * @param value Valeur à exporter
   * @returns Valeur sécurisée
   */
  sanitizeForExport(value: unknown): string {
    if (value === null || value === undefined) return '';

    let str = String(value);

    // CSV Injection: Supprimer les caractères dangereux en début de cellule
    const dangerousStarts = ['=', '+', '-', '@', '\t', '\r'];
    while (dangerousStarts.some(char => str.startsWith(char))) {
      str = str.substring(1);
    }

    // Échapper les guillemets
    str = str.replace(/"/g, '""');

    return str;
  }

  /**
   * Valide un numéro de téléphone
   * @param phone Numéro de téléphone
   * @returns Numéro formaté ou vide si invalide
   */
  sanitizePhone(phone: unknown): string {
    if (typeof phone !== 'string') return '';

    // Supprimer tous les caractères non numériques sauf + et espaces
    let sanitized = phone.replace(/[^\d+\s()-]/g, '');

    // Supprimer les espaces excessifs
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Validation basique (au moins 10 chiffres)
    const digitsOnly = sanitized.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return '';
    }

    return sanitized;
  }

  /**
   * Valide et sanitize une date
   * @param date Date à valider
   * @returns Date ISO string ou vide si invalide
   */
  sanitizeDate(date: unknown): string {
    if (!date) return '';

    try {
      const parsed = new Date(date as string | number | Date);
      if (isNaN(parsed.getTime())) {
        return '';
      }

      // Vérifier que la date est raisonnable (entre 1900 et 2100)
      const year = parsed.getFullYear();
      if (year < 1900 || year > 2100) {
        ErrorLogger.warn('Date out of reasonable range', 'InputSanitization', {
          metadata: { year }
        });
        return '';
      }

      return parsed.toISOString();
    } catch (error) {
      ErrorLogger.warn('Invalid date format', 'InputSanitization');
      return '';
    }
  }

  /**
   * Valide un nombre
   * @param value Valeur à valider
   * @param min Valeur minimale
   * @param max Valeur maximale
   * @returns Nombre validé ou null si invalide
   */
  sanitizeNumber(value: unknown, min?: number, max?: number): number | null {
    const num = Number(value);

    if (isNaN(num) || !isFinite(num)) {
      return null;
    }

    if (min !== undefined && num < min) {
      return min;
    }

    if (max !== undefined && num > max) {
      return max;
    }

    return num;
  }

  /**
   * Supprime tous les tags HTML d'une chaîne
   * @param html HTML à nettoyer
   * @returns Texte sans HTML
   */
  private stripHTML(html: string): string {
    // Créer un élément temporaire
    if (typeof document !== 'undefined') {
      const tmp = document.createElement('div');
      tmp.textContent = html;
      return tmp.innerHTML;
    }

    // Fallback pour Node.js (SSR)
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Détecte les tentatives d'injection SQL (pour logging uniquement)
   * Note: Les injections SQL ne sont pas possibles avec Firestore,
   * mais on log les tentatives pour détecter les attaquants
   * @param input Input à analyser
   * @returns true si injection détectée
   */
  detectSQLInjection(input: string): boolean {
    const patterns = [
      /(\bUNION\b.*\bSELECT\b)|(\bSELECT\b.*\bFROM\b)/i,
      /(\bINSERT\b.*\bINTO\b)|(\bUPDATE\b.*\bSET\b)/i,
      /(\bDELETE\b.*\bFROM\b)|(\bDROP\b.*\bTABLE\b)/i,
      /(--|#|\/\*|\*\/)/,
      /(\bOR\b.*=.*\bOR\b)|(\bAND\b.*=.*\bAND\b)/i,
      /'.*--/,
      /\bEXEC\b|\bEXECUTE\b/i
    ];

    const detected = patterns.some(pattern => pattern.test(input));

    if (detected) {
      ErrorLogger.warn('Potential SQL injection attempt detected', 'InputSanitization', {
        metadata: {
          input: input.substring(0, 100),
          timestamp: new Date().toISOString()
        }
      });
    }

    return detected;
  }

  /**
   * Détecte les tentatives de path traversal
   * @param input Input à analyser
   * @returns true si path traversal détecté
   */
  detectPathTraversal(input: string): boolean {
    const patterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i,
      /\.\.%2f/i,
      /\.\.%5c/i
    ];

    const detected = patterns.some(pattern => pattern.test(input));

    if (detected) {
      ErrorLogger.warn('Potential path traversal attempt detected', 'InputSanitization', {
        metadata: {
          input: input.substring(0, 100),
          timestamp: new Date().toISOString()
        }
      });
    }

    return detected;
  }
}

// Export singleton
export const InputSanitizer = new InputSanitizationService();

/**
 * Hook React pour sanitizer un input
 * @example
 * const sanitize = useSanitization();
 * const cleanValue = sanitize.sanitizeString(userInput);
 */
export const useSanitization = () => InputSanitizer;
