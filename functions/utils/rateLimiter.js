/**
 * Rate Limiter for Firebase Cloud Functions
 * Protects against abuse and DoS attacks
 *
 * Uses in-memory cache for performance with Firestore fallback for distributed limiting.
 * The Firestore fallback ensures rate limits persist across function instance restarts
 * and are enforced across multiple instances.
 */

const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

// In-memory rate limit cache (per function instance)
const rateLimitCache = new Map();

// Configuration
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30; // 30 requests per minute
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes

// Operations that require distributed (Firestore-backed) rate limiting
const DISTRIBUTED_OPERATIONS = new Set(['auth', 'heavy', 'admin']);

// Cleanup old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitCache.entries()) {
        if (now - data.windowStart > data.windowMs * 2) {
            rateLimitCache.delete(key);
        }
    }
}, CLEANUP_INTERVAL_MS);

/**
 * Rate limiter configuration presets
 */
const RATE_LIMITS = {
    // Standard API calls
    standard: { windowMs: 60 * 1000, maxRequests: 60 },

    // Authentication-related (more restrictive)
    auth: { windowMs: 60 * 1000, maxRequests: 10 },

    // Admin operations (very restrictive)
    admin: { windowMs: 60 * 1000, maxRequests: 20 },

    // AI/Heavy operations (most restrictive)
    heavy: { windowMs: 60 * 1000, maxRequests: 5 },

    // Webhook/Public endpoints
    webhook: { windowMs: 60 * 1000, maxRequests: 100 },
};

/**
 * Check if a request should be rate limited (in-memory)
 *
 * @param {string} identifier - Unique identifier (e.g., userId, IP address)
 * @param {string} operation - Operation name for categorization
 * @param {Object} options - Override options { windowMs, maxRequests }
 * @returns {Object} { allowed: boolean, remaining: number, resetAt: number, retryAfter?: number }
 */
function checkRateLimit(identifier, operation = 'default', options = {}) {
    const preset = RATE_LIMITS[operation] || RATE_LIMITS.standard;
    const windowMs = options.windowMs || preset.windowMs || DEFAULT_WINDOW_MS;
    const maxRequests = options.maxRequests || preset.maxRequests || DEFAULT_MAX_REQUESTS;

    const key = `${operation}:${identifier}`;
    const now = Date.now();

    let data = rateLimitCache.get(key);

    // Initialize or reset if window expired
    if (!data || (now - data.windowStart) > windowMs) {
        data = {
            windowStart: now,
            windowMs,
            maxRequests,
            count: 0
        };
    }

    data.count++;
    rateLimitCache.set(key, data);

    const remaining = Math.max(0, maxRequests - data.count);
    const resetAt = data.windowStart + windowMs;

    if (data.count > maxRequests) {
        const retryAfter = Math.ceil((resetAt - now) / 1000);

        logger.warn(`Rate limit exceeded`, {
            identifier,
            operation,
            count: data.count,
            limit: maxRequests,
            retryAfter
        });

        return {
            allowed: false,
            remaining: 0,
            resetAt,
            retryAfter
        };
    }

    return {
        allowed: true,
        remaining,
        resetAt
    };
}

/**
 * Check rate limit using Firestore for distributed enforcement.
 * Used for sensitive operations (auth, AI, admin) where limits must persist
 * across function instance restarts and be enforced across all instances.
 *
 * @param {string} identifier - Unique identifier (userId, IP, agentId)
 * @param {string} operation - Operation type from RATE_LIMITS
 * @returns {Promise<Object>} { allowed: boolean, remaining: number, retryAfter?: number }
 */
async function checkDistributedRateLimit(identifier, operation = 'standard') {
    const preset = RATE_LIMITS[operation] || RATE_LIMITS.standard;
    const windowMs = preset.windowMs || DEFAULT_WINDOW_MS;
    const maxRequests = preset.maxRequests || DEFAULT_MAX_REQUESTS;

    // First check in-memory (fast path)
    const memoryResult = checkRateLimit(identifier, operation);
    if (!memoryResult.allowed) {
        return memoryResult;
    }

    // For non-distributed operations, in-memory is sufficient
    if (!DISTRIBUTED_OPERATIONS.has(operation)) {
        return memoryResult;
    }

    // Firestore-backed check for distributed enforcement
    try {
        const db = admin.firestore();
        const windowKey = Math.floor(Date.now() / windowMs);
        const docId = `rl_${operation}_${identifier}_${windowKey}`.replace(/[/\\]/g, '_');
        const rateLimitRef = db.collection('_rateLimits').doc(docId);

        const result = await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(rateLimitRef);
            const data = doc.exists ? doc.data() : null;

            const now = Date.now();
            let count = 0;

            if (data && (now - data.windowStart) < windowMs) {
                count = data.count;
            }

            count++;

            transaction.set(rateLimitRef, {
                identifier,
                operation,
                windowStart: data?.windowStart && (now - data.windowStart) < windowMs ? data.windowStart : now,
                count,
                windowMs,
                maxRequests,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // TTL field for automatic cleanup via Firestore TTL policy
                expiresAt: admin.firestore.Timestamp.fromMillis(now + windowMs * 2),
            });

            if (count > maxRequests) {
                const resetAt = (data?.windowStart || now) + windowMs;
                const retryAfter = Math.ceil((resetAt - now) / 1000);
                return { allowed: false, remaining: 0, resetAt, retryAfter };
            }

            return {
                allowed: true,
                remaining: Math.max(0, maxRequests - count),
                resetAt: (data?.windowStart || now) + windowMs,
            };
        });

        return result;
    } catch (error) {
        // If Firestore fails, fall back to in-memory result
        logger.warn('Distributed rate limit check failed, using in-memory fallback', {
            error: error.message,
            identifier,
            operation,
        });
        return memoryResult;
    }
}

/**
 * Express-style middleware for rate limiting HTTP functions
 *
 * @param {string} operation - Operation type from RATE_LIMITS
 * @param {Function} identifierFn - Function to extract identifier from request
 * @returns {Function} Middleware function
 */
function rateLimitMiddleware(operation = 'standard', identifierFn = null) {
    return async (req, res, next) => {
        // Default identifier: authenticated user ID or IP
        const identifier = identifierFn
            ? identifierFn(req)
            : (req.auth?.uid || req.ip || req.headers['x-forwarded-for'] || 'anonymous');

        // Use distributed rate limiting for sensitive operations
        const result = DISTRIBUTED_OPERATIONS.has(operation)
            ? await checkDistributedRateLimit(identifier, operation)
            : checkRateLimit(identifier, operation);

        // Set rate limit headers
        res.set('X-RateLimit-Limit', String(RATE_LIMITS[operation]?.maxRequests || DEFAULT_MAX_REQUESTS));
        res.set('X-RateLimit-Remaining', String(result.remaining));
        res.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

        if (!result.allowed) {
            res.set('Retry-After', String(result.retryAfter));
            return res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: result.retryAfter
            });
        }

        next();
    };
}

/**
 * Check rate limit for callable functions
 * Throws HttpsError if rate limit exceeded
 * Uses distributed limiting for sensitive operations
 *
 * @param {Object} request - Firebase callable function request
 * @param {string} operation - Operation type from RATE_LIMITS
 */
async function checkCallableRateLimit(request, operation = 'standard') {
    const identifier = request.auth?.uid || request.rawRequest?.ip || 'anonymous';

    // Use distributed rate limiting for sensitive operations
    const result = DISTRIBUTED_OPERATIONS.has(operation)
        ? await checkDistributedRateLimit(identifier, operation)
        : checkRateLimit(identifier, operation);

    if (!result.allowed) {
        const { HttpsError } = require('firebase-functions/v2/https');
        throw new HttpsError(
            'resource-exhausted',
            `Rate limit exceeded. Please wait ${result.retryAfter} seconds before retrying.`,
            { retryAfter: result.retryAfter }
        );
    }

    return result;
}

module.exports = {
    checkRateLimit,
    checkDistributedRateLimit,
    checkCallableRateLimit,
    rateLimitMiddleware,
    RATE_LIMITS
};
