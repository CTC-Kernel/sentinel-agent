const { onRequest } = require("firebase-functions/v2/https");
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
        console.error("Error logging consent:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Secure Storage Placeholders (Mock implementation for now)
app.post("/v1/secure-storage/store", (req, res) => {
    res.json({ success: true, message: "Data securely stored (mock)" });
});

app.get("/v1/secure-storage/:type/:id", (req, res) => {
    res.json({ success: true, data: { mock: "data" } });
});

app.delete("/v1/secure-storage/:type/:id", (req, res) => {
    res.json({ success: true, message: "Data deleted (mock)" });
});

app.delete("/v1/secure-storage/organization/wipe", (req, res) => {
    res.json({ success: true, message: "Organization data wiped (mock)" });
});

app.get("/v1/secure-storage/organization/export", (req, res) => {
    res.json({ success: true, data: { export: "complete" } });
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
        console.error("Error logging audit event:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Report Generation
app.post("/v1/hybrid-features/generate-report", (req, res) => {
    // In a real app, this would generate a PDF
    res.status(501).json({ success: false, message: "Report generation not implemented yet" });
});

// Risk Analysis
app.post("/v1/hybrid-features/analyze-risks", (req, res) => {
    res.json({ success: true, message: "Risk analysis started" });
});

// Expose Express API as a single Cloud Function:
exports.api = onRequest(app);
