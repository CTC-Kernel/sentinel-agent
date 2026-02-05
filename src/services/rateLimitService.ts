import { ErrorLogger } from './errorLogger';

/**
 * Service de Rate Limiting côté client
 * Implémente un algorithme Token Bucket pour limiter les requêtes
 *
 * SÉCURITÉ: Ce service est une première ligne de défense côté client.
 * Il DOIT être complété par un rate limiting server-side (Cloud Functions)
 */

interface RateLimitConfig {
 maxTokens: number; // Nombre maximum de tokens
 refillRate: number; // Tokens ajoutés par seconde
 keyPrefix: string; // Préfixe pour le localStorage
}

interface BucketState {
 tokens: number;
 lastRefill: number;
}

class RateLimitService {
 private configs: Map<string, RateLimitConfig> = new Map();
 private enabled: boolean = true;

 constructor() {
 // Configuration par défaut pour différents types d'opérations
 this.configs.set('auth', {
 maxTokens: 5, // 5 tentatives max
 refillRate: 1 / 60, // 1 token par minute
 keyPrefix: 'rl_auth'
 });

 this.configs.set('api', {
 maxTokens: 100, // 100 requêtes max
 refillRate: 10, // 10 tokens par seconde
 keyPrefix: 'rl_api'
 });

 this.configs.set('search', {
 maxTokens: 30, // 30 recherches max
 refillRate: 2, // 2 tokens par seconde
 keyPrefix: 'rl_search'
 });

 this.configs.set('export', {
 maxTokens: 10, // 10 exports max
 refillRate: 1 / 30, // 1 token toutes les 30 secondes
 keyPrefix: 'rl_export'
 });

 this.configs.set('file_upload', {
 maxTokens: 20, // 20 uploads max
 refillRate: 1 / 5, // 1 token toutes les 5 secondes
 keyPrefix: 'rl_upload'
 });
 }

 /**
 * Vérifie si une action est autorisée selon le rate limit
 * @param operation Type d'opération (auth, api, search, export, file_upload)
 * @param userId ID de l'utilisateur (optionnel, utilise IP sinon)
 * @returns true si autorisé, false si rate limit atteint
 */
 checkLimit(operation: string, userId?: string): boolean {
 if (!this.enabled) return true;

 const config = this.configs.get(operation);
 if (!config) {
 ErrorLogger.warn(`Rate limit config not found for operation: ${operation}`, 'RateLimitService');
 return true; // Fail open si config manquante
 }

 const key = this.getBucketKey(config.keyPrefix, userId);
 const bucket = this.getBucket(key, config);

 // Refill tokens
 const now = Date.now();
 const timePassed = (now - bucket.lastRefill) / 1000; // en secondes
 const tokensToAdd = timePassed * config.refillRate;
 bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
 bucket.lastRefill = now;

 // Vérifier si un token est disponible
 if (bucket.tokens >= 1) {
 bucket.tokens -= 1;
 this.saveBucket(key, bucket);
 return true;
 }

 // Rate limit atteint
 ErrorLogger.warn('Rate limit exceeded', 'RateLimitService', {
 metadata: {
 operation,
 userId: userId || 'anonymous',
 remainingTokens: bucket.tokens
 }
 });

 return false;
 }

 /**
 * Obtient le temps d'attente avant la prochaine action autorisée
 * @param operation Type d'opération
 * @param userId ID de l'utilisateur
 * @returns Temps d'attente en millisecondes
 */
 getWaitTime(operation: string, userId?: string): number {
 const config = this.configs.get(operation);
 if (!config) return 0;

 const key = this.getBucketKey(config.keyPrefix, userId);
 const bucket = this.getBucket(key, config);

 const now = Date.now();
 const timePassed = (now - bucket.lastRefill) / 1000;
 const tokensToAdd = timePassed * config.refillRate;
 const currentTokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);

 if (currentTokens >= 1) return 0;

 // Calculer le temps nécessaire pour obtenir 1 token
 const tokensNeeded = 1 - currentTokens;
 const waitTimeSeconds = tokensNeeded / config.refillRate;
 return Math.ceil(waitTimeSeconds * 1000);
 }

 /**
 * Réinitialise le rate limit pour un utilisateur
 * @param operation Type d'opération
 * @param userId ID de l'utilisateur
 */
 reset(operation: string, userId?: string): void {
 const config = this.configs.get(operation);
 if (!config) return;

 const key = this.getBucketKey(config.keyPrefix, userId);
 if (typeof window !== 'undefined') {
 localStorage.removeItem(key);
 }
 }

 /**
 * Désactive temporairement le rate limiting (pour tests)
 */
 disable(): void {
 this.enabled = false;
 }

 /**
 * Réactive le rate limiting
 */
 enable(): void {
 this.enabled = true;
 }

 /**
 * Ajoute ou modifie une configuration de rate limit
 * @param operation Nom de l'opération
 * @param config Configuration du rate limit
 */
 setConfig(operation: string, config: RateLimitConfig): void {
 this.configs.set(operation, config);
 }

 // --- Méthodes privées ---

 private getBucketKey(prefix: string, userId?: string): string {
 const identifier = userId || this.getAnonymousId();
 return `${prefix}_${identifier}`;
 }

 private getBucket(key: string, config: RateLimitConfig): BucketState {
 if (typeof window === 'undefined') {
 return { tokens: config.maxTokens, lastRefill: Date.now() };
 }

 try {
 const stored = localStorage.getItem(key);
 if (stored) {
 const parsed = JSON.parse(stored) as BucketState;
 return parsed;
 }
 } catch (error) {
 ErrorLogger.error(error, 'RateLimitService.getBucket - Corrupted data found, resetting bucket');
 // If parsing fails, remove the corrupted key to prevent future errors
 localStorage.removeItem(key);
 }

 // Initialiser un nouveau bucket
 return { tokens: config.maxTokens, lastRefill: Date.now() };
 }

 private saveBucket(key: string, bucket: BucketState): void {
 if (typeof window === 'undefined') return;

 try {
 localStorage.setItem(key, JSON.stringify(bucket));
 } catch (error) {
 ErrorLogger.error(error, 'RateLimitService.saveBucket');
 }
 }

 private getAnonymousId(): string {
 if (typeof window === 'undefined') return 'server';

 const key = 'rl_anonymous_id';
 let id = localStorage.getItem(key);

 if (!id) {
 id = `anon_${crypto.randomUUID()}`;
 localStorage.setItem(key, id);
 }

 return id;
 }

 /**
 * Nettoie les anciens buckets du localStorage
 * Appeler périodiquement (par exemple au logout)
 */
 cleanup(): void {
 if (typeof window === 'undefined') return;

 try {
 const keys = Object.keys(localStorage);
 const rateLimitKeys = keys.filter(k => k.startsWith('rl_'));

 rateLimitKeys.forEach(key => {
 const stored = localStorage.getItem(key);
 if (!stored) return;

 try {
 const bucket = JSON.parse(stored) as BucketState;
 const ageMs = Date.now() - bucket.lastRefill;
 const ageHours = ageMs / (1000 * 60 * 60);

 // Supprimer les buckets de plus de 24h
 if (ageHours > 24) {
 localStorage.removeItem(key);
 }
 } catch {
 // Si parsing échoue, supprimer la clé
 localStorage.removeItem(key);
 }
 });
 } catch (error) {
 ErrorLogger.error(error, 'RateLimitService.cleanup');
 }
 }
}

// Export singleton
export const RateLimiter = new RateLimitService();

/**
 * Hook React pour utiliser le rate limiter
 * @example
 * const canSearch = useRateLimit('search');
 * if (!canSearch) {
 * toast.error('Trop de recherches, veuillez patienter');
 * return;
 * }
 */
export const useRateLimit = (operation: string, userId?: string): boolean => {
 return RateLimiter.checkLimit(operation, userId);
};

/**
 * Décorateur pour protéger une fonction avec rate limiting
 * @example
 * const searchAssets = withRateLimit('search', async () => {
 * // Search logic
 * });
 */
export const withRateLimit = <Args extends unknown[], R>(
 operation: string,
 fn: (...args: Args) => R,
 userId?: string
): ((...args: Args) => R) => {
 return (...args: Args): R => {
 if (!RateLimiter.checkLimit(operation, userId)) {
 const waitTime = RateLimiter.getWaitTime(operation, userId);
 throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
 }
 return fn(...args);
 };
};
