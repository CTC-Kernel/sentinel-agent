/**
 * Epic 29: Story 29.9 - Anomaly Alert Cloud Functions
 *
 * Triggered when critical anomalies are detected:
 * - Send notifications via notificationService
 * - Rate limiting to prevent alert fatigue
 * - Per-organization alert configuration
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ALERT_CONFIG = {
    thresholds: [
        { anomalyType: 'orphan_control', minSeverity: 'medium', enabled: true },
        { anomalyType: 'circular_dependency', minSeverity: 'high', enabled: true },
        { anomalyType: 'coverage_gap', minSeverity: 'high', enabled: true },
        { anomalyType: 'stale_assessment', minSeverity: 'medium', enabled: true },
        { anomalyType: 'compliance_drift', minSeverity: 'high', enabled: true },
    ],
    channels: {
        inApp: true,
        email: false,
    },
    maxAlertsPerHour: 10,
    cooldownMinutes: 30,
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

const SEVERITY_LABELS = {
    critical: 'Critique',
    high: 'Élevé',
    medium: 'Moyen',
    low: 'Faible'
};

const ANOMALY_TYPE_LABELS = {
    orphan_control: 'Contrôle orphelin',
    circular_dependency: 'Dépendance circulaire',
    coverage_gap: 'Lacune de couverture',
    stale_assessment: 'Évaluation obsolète',
    compliance_drift: 'Dérive de conformité',
    orphan: 'Entité orpheline',
    stale: 'Entité obsolète',
    inconsistency: 'Incohérence',
    cycle: 'Cycle',
    cluster: 'Cluster anormal',
    trend: 'Tendance préoccupante'
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get alert configuration for an organization
 */
const getAlertConfig = async (db, organizationId) => {
    try {
        const configDoc = await db
            .collection('voxel_alert_configs')
            .doc(organizationId)
            .get();

        if (configDoc.exists) {
            return { ...DEFAULT_ALERT_CONFIG, ...configDoc.data() };
        }
        return DEFAULT_ALERT_CONFIG;
    } catch (error) {
        logger.warn(`Failed to get alert config for org ${organizationId}:`, error);
        return DEFAULT_ALERT_CONFIG;
    }
};

/**
 * Check if severity meets threshold
 */
const meetsSeverityThreshold = (anomalySeverity, minSeverity) => {
    const anomalyIndex = SEVERITY_ORDER.indexOf(anomalySeverity);
    const thresholdIndex = SEVERITY_ORDER.indexOf(minSeverity);
    return anomalyIndex <= thresholdIndex; // Lower index = higher severity
};

/**
 * Check if an alert should be sent based on configuration
 */
const shouldSendAlert = (anomaly, config) => {
    // Find threshold for this anomaly type
    const threshold = config.thresholds.find(t => t.anomalyType === anomaly.type);

    // If no specific threshold, check if it's a critical anomaly
    if (!threshold) {
        return anomaly.severity === 'critical';
    }

    // Check if enabled
    if (!threshold.enabled) {
        return false;
    }

    // Check severity threshold
    return meetsSeverityThreshold(anomaly.severity, threshold.minSeverity);
};

/**
 * Check rate limiting
 */
const checkRateLimit = async (db, organizationId, config) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentAlertsSnap = await db
        .collection('voxel_anomaly_alerts')
        .where('organizationId', '==', organizationId)
        .where('sentAt', '>=', oneHourAgo)
        .get();

    return recentAlertsSnap.size < config.maxAlertsPerHour;
};

/**
 * Check cooldown for specific anomaly type
 */
const checkCooldown = async (db, organizationId, anomalyType, config) => {
    const cooldownStart = new Date(Date.now() - config.cooldownMinutes * 60 * 1000);

    const recentTypeAlertsSnap = await db
        .collection('voxel_anomaly_alerts')
        .where('organizationId', '==', organizationId)
        .where('anomalyType', '==', anomalyType)
        .where('sentAt', '>=', cooldownStart)
        .limit(1)
        .get();

    return recentTypeAlertsSnap.empty;
};

/**
 * Get notification recipients (admins and rssi)
 */
const getRecipients = async (db, organizationId) => {
    const usersSnap = await db
        .collection('users')
        .where('organizationId', '==', organizationId)
        .where('role', 'in', ['admin', 'rssi'])
        .get();

    return usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

/**
 * Create in-app notification
 */
const createInAppNotification = async (db, userId, organizationId, anomaly) => {
    const typeLabel = ANOMALY_TYPE_LABELS[anomaly.type] || anomaly.type;
    const severityLabel = SEVERITY_LABELS[anomaly.severity] || anomaly.severity;

    await db.collection('notifications').add({
        organizationId,
        userId,
        type: anomaly.severity === 'critical' ? 'danger' : 'warning',
        title: `Anomalie ${severityLabel}: ${typeLabel}`,
        message: anomaly.message,
        link: '/voxel',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
            anomalyId: anomaly.id,
            anomalyType: anomaly.type,
            nodeId: anomaly.nodeId
        }
    });
};

/**
 * Send email notification (placeholder for SendGrid integration)
 */
const sendEmailNotification = async (user, anomaly) => {
    // Email sending logic would go here
    // Using SendGrid or other email service
    logger.info(`Would send email to ${user.email} for anomaly ${anomaly.id}`);

    // Placeholder: actual implementation would use sendEmail service
    /*
    const sgMail = require('@sendgrid/mail');
    await sgMail.send({
        to: user.email,
        from: 'noreply@sentinel-grc.com',
        subject: `Anomalie detectee: ${ANOMALY_TYPE_LABELS[anomaly.type]}`,
        html: `
            <h2>Anomalie ${SEVERITY_LABELS[anomaly.severity]} detectee</h2>
            <p><strong>Type:</strong> ${ANOMALY_TYPE_LABELS[anomaly.type]}</p>
            <p><strong>Message:</strong> ${anomaly.message}</p>
            <p><a href="${appBaseUrl}/voxel">Voir dans Sentinel GRC</a></p>
        `
    });
    */
};

/**
 * Record that an alert was sent (for rate limiting)
 */
const recordAlert = async (db, organizationId, anomaly) => {
    await db.collection('voxel_anomaly_alerts').add({
        organizationId,
        anomalyId: anomaly.id,
        anomalyType: anomaly.type,
        severity: anomaly.severity,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
    });
};

// ============================================================================
// Cloud Functions
// ============================================================================

/**
 * Trigger: When a new anomaly is created
 * Checks configuration and sends alerts as appropriate
 */
exports.onAnomalyCreated = onDocumentCreated({
    document: "voxel_anomalies/{anomalyId}",
    region: "europe-west1",
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        logger.warn("No data in anomaly document");
        return;
    }

    const anomaly = { id: event.params.anomalyId, ...snap.data() };
    const organizationId = anomaly.organizationId;

    if (!organizationId) {
        logger.warn("Anomaly missing organizationId:", anomaly.id);
        return;
    }

    const db = admin.firestore();

    try {
        // Get alert configuration
        const config = await getAlertConfig(db, organizationId);

        // Check if alert should be sent
        if (!shouldSendAlert(anomaly, config)) {
            logger.info(`Alert not configured for anomaly type ${anomaly.type} at severity ${anomaly.severity}`);
            return;
        }

        // Check rate limiting
        if (!await checkRateLimit(db, organizationId, config)) {
            logger.warn(`Rate limit exceeded for org ${organizationId}`);
            return;
        }

        // Check cooldown for this type
        if (!await checkCooldown(db, organizationId, anomaly.type, config)) {
            logger.info(`Cooldown active for anomaly type ${anomaly.type}`);
            return;
        }

        // Get recipients
        const recipients = await getRecipients(db, organizationId);

        if (recipients.length === 0) {
            logger.warn(`No admin recipients found for org ${organizationId}`);
            return;
        }

        // Send notifications
        const promises = [];

        for (const recipient of recipients) {
            // In-App notification
            if (config.channels.inApp) {
                promises.push(
                    createInAppNotification(db, recipient.id, organizationId, anomaly)
                        .catch(err => logger.error(`Failed to create in-app notif for ${recipient.id}:`, err))
                );
            }

            // Email notification
            if (config.channels.email && recipient.email) {
                promises.push(
                    sendEmailNotification(recipient, anomaly)
                        .catch(err => logger.error(`Failed to send email to ${recipient.email}:`, err))
                );
            }
        }

        await Promise.all(promises);

        // Record the alert for rate limiting
        await recordAlert(db, organizationId, anomaly);

        logger.info(`Alerts sent for anomaly ${anomaly.id} to ${recipients.length} recipients`);

    } catch (error) {
        logger.error(`Error processing anomaly alert for ${anomaly.id}:`, error);
    }
});

/**
 * Callable: Get alert configuration
 */
exports.getAlertConfiguration = onCall({
    region: "europe-west1",
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User must belong to an organization.');
    }

    try {
        const db = admin.firestore();
        const config = await getAlertConfig(db, organizationId);

        return {
            success: true,
            config: {
                id: organizationId,
                organizationId,
                ...config
            }
        };
    } catch (error) {
        logger.error("Failed to get alert configuration:", error);
        throw new HttpsError('internal', 'Failed to get configuration.');
    }
});

/**
 * Callable: Update alert configuration
 */
exports.updateAlertConfiguration = onCall({
    region: "europe-west1",
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User must belong to an organization.');
    }

    // Check permissions (admin or rssi only)
    const role = request.auth.token.role;
    if (!['admin', 'rssi'].includes(role)) {
        throw new HttpsError('permission-denied', 'Only admins can update alert configuration.');
    }

    const { thresholds, channels, maxAlertsPerHour, cooldownMinutes } = request.data || {};

    // Validate input
    if (thresholds && !Array.isArray(thresholds)) {
        throw new HttpsError('invalid-argument', 'thresholds must be an array.');
    }

    if (maxAlertsPerHour !== undefined && (typeof maxAlertsPerHour !== 'number' || maxAlertsPerHour < 1 || maxAlertsPerHour > 100)) {
        throw new HttpsError('invalid-argument', 'maxAlertsPerHour must be between 1 and 100.');
    }

    if (cooldownMinutes !== undefined && (typeof cooldownMinutes !== 'number' || cooldownMinutes < 5 || cooldownMinutes > 1440)) {
        throw new HttpsError('invalid-argument', 'cooldownMinutes must be between 5 and 1440.');
    }

    try {
        const db = admin.firestore();
        const configRef = db.collection('voxel_alert_configs').doc(organizationId);

        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid
        };

        if (thresholds) updateData.thresholds = thresholds;
        if (channels) updateData.channels = channels;
        if (maxAlertsPerHour !== undefined) updateData.maxAlertsPerHour = maxAlertsPerHour;
        if (cooldownMinutes !== undefined) updateData.cooldownMinutes = cooldownMinutes;

        await configRef.set(updateData, { merge: true });

        logger.info(`Alert config updated for org ${organizationId} by ${request.auth.uid}`);

        return { success: true };
    } catch (error) {
        logger.error("Failed to update alert configuration:", error);
        throw new HttpsError('internal', 'Failed to update configuration.');
    }
});

/**
 * Callable: Test alert (sends a test notification)
 */
exports.testAnomalyAlert = onCall({
    region: "europe-west1",
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const organizationId = request.auth.token.organizationId;
    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User must belong to an organization.');
    }

    const { channel = 'inApp' } = request.data || {};

    try {
        const db = admin.firestore();

        // Create test anomaly notification
        const testAnomaly = {
            id: 'test-alert',
            type: 'coverage_gap',
            severity: 'medium',
            message: 'Ceci est une alerte de test pour vérifier la configuration.',
            nodeId: 'test-node'
        };

        if (channel === 'inApp') {
            await createInAppNotification(db, request.auth.uid, organizationId, testAnomaly);
        } else if (channel === 'email') {
            const userDoc = await db.collection('users').doc(request.auth.uid).get();
            if (userDoc.exists) {
                await sendEmailNotification(userDoc.data(), testAnomaly);
            }
        }

        logger.info(`Test alert sent via ${channel} to user ${request.auth.uid}`);

        return { success: true, channel };
    } catch (error) {
        logger.error("Failed to send test alert:", error);
        throw new HttpsError('internal', 'Failed to send test alert.');
    }
});

// Export for use in main index.js
module.exports = {
    onAnomalyCreated: exports.onAnomalyCreated,
    getAlertConfiguration: exports.getAlertConfiguration,
    updateAlertConfiguration: exports.updateAlertConfiguration,
    testAnomalyAlert: exports.testAnomalyAlert,
};
