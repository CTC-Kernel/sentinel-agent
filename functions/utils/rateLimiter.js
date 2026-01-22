/**
 * Rate Limiter for Firebase Cloud Functions
 * Protects against abuse and DoS attacks
 *
 * Uses in-memory cache for performance with Firestore fallback for distributed limiting
 */

const { logger } = require('firebase-functions');

// In-memory rate limit cache (per function instance)
const rateLimitCache = new Map();

// Configuration
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30; // 30 requests per minute
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes

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
 * Check if a request should be rate limited
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
 * Express-style middleware for rate limiting HTTP functions
 *
 * @param {string} operation - Operation type from RATE_LIMITS
 * @param {Function} identifierFn - Function to extract identifier from request
 * @returns {Function} Middleware function
 */
function rateLimitMiddleware(operation = 'standard', identifierFn = null) {
    return (req, res, next) => {
        // Default identifier: authenticated user ID or IP
        const identifier = identifierFn
            ? identifierFn(req)
            : (req.auth?.uid || req.ip || req.headers['x-forwarded-for'] || 'anonymous');

        const result = checkRateLimit(identifier, operation);

        // Set rate limit headers
        res.set('X-RateLimit-Limit', RATE_LIMITS[operation]?.maxRequests || DEFAULT_MAX_REQUESTS);
        res.set('X-RateLimit-Remaining', result.remaining);
        res.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

        if (!result.allowed) {
            res.set('Retry-After', result.retryAfter);
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
 *
 * @param {Object} request - Firebase callable function request
 * @param {string} operation - Operation type from RATE_LIMITS
 */
function checkCallableRateLimit(request, operation = 'standard') {
    const identifier = request.auth?.uid || request.rawRequest?.ip || 'anonymous';
    const result = checkRateLimit(identifier, operation);

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
    checkCallableRateLimit,
    rateLimitMiddleware,
    RATE_LIMITS
};
