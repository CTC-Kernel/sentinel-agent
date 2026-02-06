const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { z } = require("zod");

// Initialize Express app
const app = express();

// =============================================================================
// SECURITY: Rate Limiting
// =============================================================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per user

const rateLimiter = (req, res, next) => {
    const userId = req.user?.uid || req.ip;
    const now = Date.now();
    const userRequests = rateLimitMap.get(userId) || [];

    // Clean old requests outside window
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW_MS);

    if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        logger.warn(`Rate limit exceeded for user: ${userId}`);
        return res.status(429).json({
            success: false,
            error: "Too many requests. Please try again later."
        });
    }

    recentRequests.push(now);
    rateLimitMap.set(userId, recentRequests);
    next();
};

// =============================================================================
// SECURITY: SSRF Protection - Block Private IP Ranges
// =============================================================================
const isPrivateIP = (hostname) => {
    // Block private IP ranges and localhost
    const privatePatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^0\./,
        /^::1$/,
        /^fc00:/i,
        /^fe80:/i,
        /^fd/i,
        /\.local$/i,
        /\.internal$/i,
        /\.localhost$/i,
    ];
    return privatePatterns.some(pattern => pattern.test(hostname));
};

// =============================================================================
// SECURITY: Input Validation Schemas
// =============================================================================
const consentLogSchema = z.object({
    document_type: z.string().min(1).max(100),
    accepted: z.boolean(),
    version: z.string().min(1).max(50)
});

const auditLogSchema = z.object({
    action: z.string().min(1).max(100),
    resource: z.string().min(1).max(200),
    details: z.string().max(2000).optional(),
    metadata: z.record(z.unknown()).optional(),
    changes: z.record(z.unknown()).optional()
});

// CORS Configuration - Whitelist approach for security
const ALLOWED_ORIGINS = [
    'https://app.cyber-threat-consulting.com',
    'https://cyber-threat-consulting.com',
    'https://sentinel-grc-a8701.web.app',
    'https://sentinel-grc-a8701.firebaseapp.com',
    // Development origins (consider removing in production)
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // SECURITY: Reject requests with no origin header to prevent CSRF.
        // Server-to-server calls should use service accounts, not this API.
        if (!origin) return callback(null, false);

        if (ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600 // Cache preflight for 10 minutes
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' })); // Limit request body size

// Middleware d'authentification
const validateFirebaseIdToken = async (req, res, next) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        logger.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
            'Make sure you authorize your request by providing the following HTTP header:',
            'Authorization: Bearer <Firebase ID Token>');
        res.status(403).send('Unauthorized');
        return;
    }

    const idToken = req.headers.authorization.split('Bearer ')[1];

    try {
        const decodedIdToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedIdToken;
        next();
    } catch (error) {
        logger.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    }
};

app.use(validateFirebaseIdToken);
app.use(rateLimiter);

// --- Routes ---

// Proxy for External Threat Feeds (CISA, UrlHaus) to bypass CORS
app.get("/v1/proxy/threat-feed", async (req, res) => {
    try {
        const { url } = req.query;
        const uid = req.user?.uid; // User is authenticated via middleware

        if (!url) {
            res.status(400).json({ success: false, error: "Missing 'url' query parameter" });
            return;
        }

        // Security Whitelist - Prevent Open Proxy Abuse
        // FIXED: Use URL parsing to prevent bypass attacks like https://www.cisa.gov.attacker.com
        const ALLOWED_HOSTNAMES = [
            'www.cisa.gov',
            'cisa.gov',
            'urlhaus-api.abuse.ch'
        ];

        // SECURITY: Parse URL BEFORE any decoding to prevent double-encoding bypass attacks.
        // new URL() handles standard percent-encoding safely on its own.
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (e) {
            logger.warn(`Invalid URL format: ${url} by user ${uid}`);
            res.status(400).json({ success: false, error: "Invalid URL format" });
            return;
        }

        // Validate protocol (only HTTPS allowed)
        if (parsedUrl.protocol !== 'https:') {
            logger.warn(`Non-HTTPS URL rejected: ${parsedUrl.href} by user ${uid}`);
            res.status(403).json({ success: false, error: "Only HTTPS URLs allowed" });
            return;
        }

        // Validate hostname exactly matches whitelist
        const isAllowed = ALLOWED_HOSTNAMES.includes(parsedUrl.hostname);

        if (!isAllowed) {
            logger.warn(`Blocked proxy attempt to unauthorized URL: ${parsedUrl.href} (hostname: ${parsedUrl.hostname}) by user ${uid}`);
            res.status(403).json({ success: false, error: "URL not allowed" });
            return;
        }

        // SECURITY: Block private IP addresses (SSRF protection)
        if (isPrivateIP(parsedUrl.hostname)) {
            logger.warn(`Blocked SSRF attempt to private IP: ${parsedUrl.hostname} by user ${uid}`);
            res.status(403).json({ success: false, error: "Private IP addresses not allowed" });
            return;
        }

        // Fetch the data server-side with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(parsedUrl.href, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Sentinel-GRC/2.0'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Upstream server responded with ${response.status}`);
        }

        const data = await response.json();

        // Cache control (1 hour) to reduce load on upstream
        res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        res.json(data);

    } catch (error) {
        logger.error("Error in threat feed proxy:", error);
        res.status(500).json({ success: false, error: "Failed to fetch threat feed" });
    }
});

// Consent Logging
app.post("/v1/consent/log", async (req, res) => {
    try {
        // SECURITY: Validate input with Zod schema
        const validationResult = consentLogSchema.safeParse(req.body);
        if (!validationResult.success) {
            logger.warn(`Invalid consent log request: ${JSON.stringify(validationResult.error.errors)}`);
            res.status(400).json({
                success: false,
                error: "Invalid request data",
                details: validationResult.error.errors.map(e => e.message)
            });
            return;
        }

        const { document_type, accepted, version } = validationResult.data;
        const uid = req.user.uid;
        const organizationId = req.user.organizationId || null; // Optional for consent

        await admin.firestore().collection("consents").add({
            documentType: document_type,
            accepted,
            version,
            userId: uid,
            organizationId, // Trusted from token
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: "Consent logged" });
    } catch (error) {
        logger.error("Error logging consent:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// Audit Log
app.post("/v1/audit/log", async (req, res) => {
    try {
        // SECURITY: Validate input with Zod schema
        const validationResult = auditLogSchema.safeParse(req.body);
        if (!validationResult.success) {
            logger.warn(`Invalid audit log request: ${JSON.stringify(validationResult.error.errors)}`);
            res.status(400).json({
                success: false,
                error: "Invalid request data",
                details: validationResult.error.errors.map(e => e.message)
            });
            return;
        }

        const { action, resource, details, metadata, changes } = validationResult.data;
        const uid = req.user.uid;
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            res.status(403).json({ success: false, error: "User does not belong to an organization" });
            return;
        }

        const logEntry = {
            organizationId, // Enforced from token
            userId: uid,    // Enforced from token
            userEmail: req.user.email || '',
            action,
            resource,
            details: details || '',
            metadata: metadata || {},
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: 'api'
        };

        // Add field-level changes if provided for better audit trail granularity
        if (changes && typeof changes === 'object') {
            logEntry.changes = changes;
        }

        await admin.firestore().collection("audit_logs").add(logEntry);
        res.json({ success: true, message: "Event logged" });
    } catch (error) {
        logger.error("Error logging audit event:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// Expose Express API as a single Cloud Function:
exports.api = onRequest(app);
