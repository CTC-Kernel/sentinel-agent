const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const crypto = require('crypto');

const n8nWebhookSecret = defineSecret("N8N_WEBHOOK_SECRET");

/**
 * Service to handle N8N Integration logic
 */
class N8NService {

    /**
     * validateSecret
     * Checks if the incoming request has the correct bearer token or header
     */
    static validateSecret(request) {
        const secret = n8nWebhookSecret.value();

        // Deny all requests if the webhook secret is not configured
        if (!secret || secret === 'unconfigured') {
            logger.warn("N8N Webhook Secret is not configured. Denying request. Please set the N8N_WEBHOOK_SECRET secret.");
            return false;
        }

        const authHeader = request.get('Authorization');
        const customHeader = request.get('X-N8N-Secret');

        if (authHeader) {
            const expected = `Bearer ${secret}`;
            if (authHeader.length === expected.length &&
                crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
                return true;
            }
        }
        if (customHeader) {
            if (customHeader.length === secret.length &&
                crypto.timingSafeEqual(Buffer.from(customHeader), Buffer.from(secret))) {
                return true;
            }
        }

        return false;
    }

    /**
     * processIngest
     * Routes the payload to the correct handler based on 'type'
     */
    static async processIngest(data, context = {}) {
        const { type, payload, organizationId } = data;

        if (!organizationId) {
            throw new Error("Missing organizationId in payload");
        }

        logger.info(`Processing N8N Ingest: ${type} for Org ${organizationId}`);

        switch (type) {
            case 'RISK':
                return await this.ingestRisk(payload, organizationId);
            case 'SECURITY_EVENT':
                return await this.ingestSecurityEvent(payload, organizationId);
            case 'REPORT_RESULT':
                return await this.handleReportResult(payload, organizationId);
            default:
                throw new Error(`Unknown ingest type: ${type}`);
        }
    }

    static async ingestRisk(riskData, organizationId) {
        const db = admin.firestore();

        // Basic validation/sanitization
        const newRisk = {
            threat: riskData.threat || 'Unknown Threat (N8N)',
            description: riskData.description || '',
            score: riskData.score || 1, // 1-25
            status: 'Ouvert',
            source: 'N8N_INTELLIGENCE',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            organizationId: organizationId,
            tags: riskData.tags || ['n8n', 'auto-generated']
        };

        const res = await db.collection('organizations').doc(organizationId).collection('risks').add(newRisk);
        return { success: true, riskId: res.id };
    }

    static async ingestSecurityEvent(eventData, organizationId) {
        const db = admin.firestore();

        // De-duplication check ? 
        // For now, just append.

        const newEvent = {
            title: eventData.title,
            severity: eventData.severity || 'Low',
            source: eventData.source || 'N8N',
            timestamp: eventData.timestamp || new Date().toISOString(),
            details: eventData.details || {},
            organizationId: organizationId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const res = await db.collection('organizations').doc(organizationId).collection('security_events').add(newEvent);
        return { success: true, eventId: res.id };
    }

    static async handleReportResult(data, organizationId) {
        const db = admin.firestore();
        // handling generated PDF link
        if (data.url && data.auditId) {
            // Before updating, verify the audit belongs to the organization
            const auditDoc = await db.collection('audits').doc(data.auditId).get();
            if (!auditDoc.exists || auditDoc.data().organizationId !== organizationId) {
                throw new Error('Access denied: audit does not belong to this organization');
            }

            await db.collection('audits').doc(data.auditId).update({
                reportUrl: data.url,
                status: 'Terminé',
                reportGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, message: "Audit updated with report" };
        }
        return { success: false, message: "Invalid report data" };
    }
}

module.exports = { N8NService, n8nWebhookSecret };
