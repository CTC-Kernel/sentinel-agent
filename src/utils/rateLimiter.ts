/**
 * Rate Limiter Utility
 *
 * Implements client-side rate limiting to prevent API abuse
 * and protect backend services from excessive requests.
 *
 * @module rateLimiter
 */

interface RateLimitConfig {
 /** Maximum number of requests allowed in the window */
 maxRequests: number;
 /** Time window in milliseconds */
 windowMs: number;
 /** Optional key prefix for namespacing */
 keyPrefix?: string;
}

interface RateLimitState {
 count: number;
 resetTime: number;
}

/**
 * In-memory rate limit store
 */
const rateLimitStore = new Map<string, RateLimitState>();

/**
 * Default rate limit configurations by operation type
 */
export const RATE_LIMITS = {
 /** Standard API calls */
 api: { maxRequests: 100, windowMs: 60_000 },
 /** AI/LLM calls (expensive) */
 ai: { maxRequests: 10, windowMs: 60_000 },
 /** Authentication attempts */
 auth: { maxRequests: 5, windowMs: 300_000 },
 /** Export operations */
 export: { maxRequests: 5, windowMs: 60_000 },
 /** Import operations */
 import: { maxRequests: 3, windowMs: 60_000 },
 /** Search operations */
 search: { maxRequests: 30, windowMs: 60_000 },
 /** File uploads */
 upload: { maxRequests: 10, windowMs: 60_000 },
 /** Notification sending */
 notification: { maxRequests: 20, windowMs: 60_000 }
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Check if a request is allowed under rate limits
 *
 * @param key Unique identifier (e.g., userId, operation name)
 * @param config Rate limit configuration
 * @returns Whether the request is allowed and remaining info
 */
export function checkRateLimit(
 key: string,
 config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
 const now = Date.now();
 const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

 const state = rateLimitStore.get(fullKey);

 // No existing state or window expired - allow and reset
 if (!state || now >= state.resetTime) {
 rateLimitStore.set(fullKey, {
 count: 1,
 resetTime: now + config.windowMs
 });
 return {
 allowed: true,
 remaining: config.maxRequests - 1,
 resetIn: config.windowMs
 };
 }

 // Within window - check count
 if (state.count >= config.maxRequests) {
 return {
 allowed: false,
 remaining: 0,
 resetIn: state.resetTime - now
 };
 }

 // Increment and allow
 state.count++;
 return {
 allowed: true,
 remaining: config.maxRequests - state.count,
 resetIn: state.resetTime - now
 };
}

/**
 * Check rate limit for a specific operation type
 *
 * @param type Type of operation
 * @param userId User identifier
 * @returns Rate limit check result
 */
export function checkOperationLimit(
 type: RateLimitType,
 userId: string
): { allowed: boolean; remaining: number; resetIn: number } {
 const config = RATE_LIMITS[type];
 return checkRateLimit(`${type}:${userId}`, {
 ...config,
 keyPrefix: 'op'
 });
}

/**
 * Rate limit decorator for async functions
 *
 * @param type Type of operation
 * @param getUserId Function to extract user ID
 * @returns Decorated function that respects rate limits
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
 type: RateLimitType,
 getUserId: () => string | undefined
): (fn: T) => T {
 return (fn: T) => {
 return (async (...args: Parameters<T>) => {
 const userId = getUserId();
 if (!userId) {
 // No user - allow but don't track
 return fn(...args);
 }

 const result = checkOperationLimit(type, userId);
 if (!result.allowed) {
 const waitSeconds = Math.ceil(result.resetIn / 1000);
 throw new RateLimitError(
  `Trop de requêtes. Veuillez réessayer dans ${waitSeconds} secondes.`,
  result.resetIn
 );
 }

 return fn(...args);
 }) as T;
 };
}

/**
 * Custom error for rate limit exceeded
 */
export class RateLimitError extends Error {
 public readonly resetIn: number;
 public readonly code = 'RATE_LIMIT_EXCEEDED';

 constructor(message: string, resetIn: number) {
 super(message);
 this.name = 'RateLimitError';
 this.resetIn = resetIn;
 }
}

/**
 * Clear rate limit state for a key (useful for testing or admin)
 */
export function clearRateLimit(key: string): void {
 rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
 rateLimitStore.clear();
}

/**
 * Get current rate limit status for a user operation
 */
export function getRateLimitStatus(
 type: RateLimitType,
 userId: string
): { count: number; maxRequests: number; resetIn: number } | null {
 const config = RATE_LIMITS[type];
 const fullKey = `op:${type}:${userId}`;
 const state = rateLimitStore.get(fullKey);

 if (!state) {
 return null;
 }

 const now = Date.now();
 if (now >= state.resetTime) {
 return null;
 }

 return {
 count: state.count,
 maxRequests: config.maxRequests,
 resetIn: state.resetTime - now
 };
}

/**
 * Debounced rate limiter for search/autocomplete operations
 * Combines rate limiting with debouncing for better UX
 */
export class DebouncedRateLimiter {
 private timeoutId: ReturnType<typeof setTimeout> | null = null;
 private readonly debounceMs: number;
 private readonly type: RateLimitType;
 private readonly userId: string;

 constructor(type: RateLimitType, userId: string, debounceMs: number = 300) {
 this.type = type;
 this.userId = userId;
 this.debounceMs = debounceMs;
 }

 /**
 * Execute a function with debouncing and rate limiting
 */
 execute<T>(fn: () => Promise<T>): Promise<T> {
 return new Promise((resolve, reject) => {
 if (this.timeoutId) {
 clearTimeout(this.timeoutId);
 }

 this.timeoutId = setTimeout(async () => {
 const result = checkOperationLimit(this.type, this.userId);
 if (!result.allowed) {
  reject(new RateLimitError(
  `Limite de requêtes atteinte. Réessayez dans ${Math.ceil(result.resetIn / 1000)}s.`,
  result.resetIn
  ));
  return;
 }

 try {
  const value = await fn();
  resolve(value);
 } catch (error) {
  reject(error);
 }
 }, this.debounceMs);
 });
 }

 /**
 * Cancel pending execution
 */
 cancel(): void {
 if (this.timeoutId) {
 clearTimeout(this.timeoutId);
 this.timeoutId = null;
 }
 }
}

/**
 * Cleanup expired rate limit entries (call periodically)
 */
export function cleanupExpiredLimits(): void {
 const now = Date.now();
 for (const [key, state] of rateLimitStore.entries()) {
 if (now >= state.resetTime) {
 rateLimitStore.delete(key);
 }
 }
}

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
 setInterval(cleanupExpiredLimits, 5 * 60 * 1000);
}
