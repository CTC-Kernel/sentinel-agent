const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// Initialize Express app
const app = express();

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

        const targetUrl = decodeURIComponent(url);

        // Parse URL to extract hostname safely
        let parsedUrl;
        try {
            parsedUrl = new URL(targetUrl);
        } catch (e) {
            logger.warn(`Invalid URL format: ${targetUrl} by user ${uid}`);
            res.status(400).json({ success: false, error: "Invalid URL format" });
            return;
        }

        // Validate protocol (only HTTPS allowed)
        if (parsedUrl.protocol !== 'https:') {
            logger.warn(`Non-HTTPS URL rejected: ${targetUrl} by user ${uid}`);
            res.status(403).json({ success: false, error: "Only HTTPS URLs allowed" });
            return;
        }

        // Validate hostname exactly matches whitelist
        const isAllowed = ALLOWED_HOSTNAMES.includes(parsedUrl.hostname);

        if (!isAllowed) {
            logger.warn(`Blocked proxy attempt to unauthorized URL: ${targetUrl} (hostname: ${parsedUrl.hostname}) by user ${uid}`);
            res.status(403).json({ success: false, error: "URL not allowed" });
            return;
        }

        // Fetch the data server-side
        const response = await fetch(targetUrl);

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
        const { document_type, accepted, version } = req.body;
        const uid = req.user.uid;
        const organizationId = req.user.organizationId || null; // Optional for consent

        if (!document_type || typeof accepted !== 'boolean' || !version) {
            res.status(400).json({ success: false, error: "Missing or invalid fields" });
            return;
        }

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
        const { action, resource, details, metadata, changes } = req.body;
        const uid = req.user.uid;
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            res.status(403).json({ success: false, error: "User does not belong to an organization" });
            return;
        }

        if (!action || !resource) {
            res.status(400).json({ success: false, error: "Missing required fields (action, resource)" });
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
