const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// Initialize Express app
const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
app.use(express.json());

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
        const ALLOWED_DOMAINS = [
            'https://www.cisa.gov',
            'https://urlhaus-api.abuse.ch'
        ];

        const targetUrl = decodeURIComponent(url);
        const isAllowed = ALLOWED_DOMAINS.some(domain => targetUrl.startsWith(domain));

        if (!isAllowed) {
            logger.warn(`Blocked proxy attempt to unauthorized URL: ${targetUrl} by user ${uid}`);
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
        const { action, resource, details, metadata } = req.body;
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

        await admin.firestore().collection("audit_logs").add({
            organizationId, // Enforced from token
            userId: uid,    // Enforced from token
            userEmail: req.user.email || '',
            action,
            resource,
            details: details || '',
            metadata: metadata || {},
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: 'api'
        });
        res.json({ success: true, message: "Event logged" });
    } catch (error) {
        logger.error("Error logging audit event:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

// Expose Express API as a single Cloud Function:
exports.api = onRequest(app);
