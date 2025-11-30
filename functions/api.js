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

// --- Routes ---

// Consent Logging
app.post("/v1/consent/log", async (req, res) => {
    try {
        const { document_type, accepted, version } = req.body;
        const uid = req.user ? req.user.uid : 'anonymous'; // Middleware would be needed for auth

        await admin.firestore().collection("consents").add({
            documentType: document_type,
            accepted,
            version,
            userId: uid,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: "Consent logged" });
    } catch (error) {
        logger.error("Error logging consent:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Audit Log
app.post("/v1/audit/log", async (req, res) => {
    try {
        await admin.firestore().collection("audit_logs").add({
            ...req.body,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ success: true, message: "Event logged" });
    } catch (error) {
        logger.error("Error logging audit event:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Expose Express API as a single Cloud Function:
exports.api = onRequest(app);
