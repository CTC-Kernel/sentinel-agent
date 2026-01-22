/**
 * Scheduled Module - Scheduled Jobs and Audit Functions
 * Domain: Backups, Audit Logging, System Events
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

// Import existing scheduled functions from subdirectories
const { dailyScoreSnapshot } = require('./dailyScoreSnapshot');
const { weeklyDORARiskAlerts, checkDORARisks } = require('./doraRiskAlerts');
const { dailyContractExpirationCheck, weeklyContractExpirationDigest, checkContractExpirations } = require('./doraContractAlerts');
// AUDIT FIX: NIS2 72h notification compliance
const { nis2DeadlineChecker, onSignificantIncident, onNewSignificantIncident } = require('./nis2IncidentAlerts');

// Audit Triggers
const { generateAuditTrigger } = require('../services/auditTriggers');

// Services
const { BackupManager } = require('../services/backupManager');

/**
 * Scheduled Backup (Runs every 24 hours)
 */
exports.scheduledBackup = onSchedule({
    schedule: "every 24 hours",
    memory: '1GiB',
    timeoutSeconds: 540,
    region: 'europe-west1'
}, async (event) => {
    logger.info("Starting scheduled backup check (Hourly)...");

    const db = admin.firestore();
    const now = new Date();

    try {
        const schedulesSnap = await db.collection('backup_schedules')
            .where('nextBackupAt', '<=', now.toISOString())
            .get();

        if (schedulesSnap.empty) {
            logger.info("No backups scheduled for execution.");
            return;
        }

        const promises = schedulesSnap.docs.map(async (doc) => {
            const schedule = doc.data();
            try {
                logger.info(`Triggering backup for Org ${schedule.organizationId}`);
                await BackupManager.createBackup(schedule.organizationId, schedule.config);

                let nextRun = new Date();
                if (schedule.frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
                else if (schedule.frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
                else if (schedule.frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);

                await doc.ref.update({
                    lastBackupAt: now.toISOString(),
                    nextBackupAt: nextRun.toISOString()
                });

            } catch (err) {
                logger.error(`Failed to run backup for schedule ${doc.id}`, err);
            }
        });

        await Promise.all(promises);
        logger.info(`Completed execution of ${schedulesSnap.size} scheduled backups.`);

    } catch (error) {
        logger.error("Error in scheduledBackup function", error);
    }
});

/**
 * Log System Event (callable)
 */
exports.logEvent = onCall({
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in to log events.');
    }

    const { action, resource, details, organizationId, resourceId, metadata } = request.data;

    if (!action || !resource || !organizationId) {
        throw new HttpsError('invalid-argument', 'Missing required log fields.');
    }

    const tokenOrgId = request.auth.token.organizationId;

    if (tokenOrgId && tokenOrgId !== organizationId) {
        logger.warn(`Security Alert: User ${request.auth.uid} attempted to log for org ${organizationId} but belongs to ${tokenOrgId}`);
        throw new HttpsError('permission-denied', 'You can only log events for your own organization.');
    }

    try {
        await admin.firestore().collection('system_logs').add({
            organizationId,
            userId: request.auth.uid,
            userEmail: request.auth.token.email,
            action,
            resource,
            resourceId: resourceId || null,
            metadata: metadata || null,
            details: details || '',
            timestamp: new Date().toISOString(),
            source: 'client_secure',
            ip: request.rawRequest.ip
        });

        return { success: true };
    } catch (error) {
        logger.error('Error in logEvent callable:', error);
        throw new HttpsError('internal', 'Failed to log event.');
    }
});

/**
 * Export Audit Logs (callable)
 */
exports.exportAuditLogs = onCall({
    memory: '512MiB',
    timeoutSeconds: 300,
    region: 'europe-west1'
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { startDate, endDate, format } = request.data;
    const organizationId = request.auth.token.organizationId;
    const role = request.auth.token.role;

    if (role !== 'admin' && role !== 'rssi' && role !== 'auditor') {
        throw new HttpsError('permission-denied', 'Insufficient permissions to export audit logs.');
    }

    if (!organizationId) {
        throw new HttpsError('failed-precondition', 'User has no organization.');
    }

    const { generateAuditExport } = require('../services/auditExport');

    try {
        const data = await generateAuditExport(organizationId, { startDate, endDate, format });
        return { success: true, data };
    } catch (error) {
        logger.error("Audit export failed", error);
        throw new HttpsError('internal', 'Export failed: ' + error.message);
    }
});

// Re-export daily score snapshot
exports.dailyScoreSnapshot = dailyScoreSnapshot;

// DORA Risk Alerts (Story 35-2)
exports.weeklyDORARiskAlerts = weeklyDORARiskAlerts;
exports.checkDORARisks = checkDORARisks;

// DORA Contract Expiration Alerts (Story 35-4)
exports.dailyContractExpirationCheck = dailyContractExpirationCheck;
exports.weeklyContractExpirationDigest = weeklyContractExpirationDigest;
exports.checkContractExpirations = checkContractExpirations;

// --- AUDIT TRAIL TRIGGERS ---
exports.auditRisks = generateAuditTrigger('risks/{docId}', 'threat');
exports.auditControls = generateAuditTrigger('controls/{docId}', 'code');
exports.auditDocuments = generateAuditTrigger('documents/{docId}', 'title');
exports.auditSuppliers = generateAuditTrigger('suppliers/{docId}', 'name');
exports.auditUsers = generateAuditTrigger('users/{docId}', 'email');
exports.auditIncidents = generateAuditTrigger('incidents/{docId}', 'title');
exports.auditAssets = generateAuditTrigger('assets/{docId}', 'name');
exports.auditProjects = generateAuditTrigger('projects/{docId}', 'name');
exports.auditBusinessProcesses = generateAuditTrigger('business_processes/{docId}', 'name');
exports.auditProcessingActivities = generateAuditTrigger('processing_activities/{docId}', 'name');
exports.auditAudits = generateAuditTrigger('audits/{docId}', 'name');

// --- NIS2 COMPLIANCE (AUDIT FIX) ---
// Conformité NIS 2 Article 23 - Notification incidents significatifs
exports.nis2DeadlineChecker = nis2DeadlineChecker;           // Vérification horaire des délais
exports.onSignificantIncident = onSignificantIncident;       // Trigger: incident devient significatif
exports.onNewSignificantIncident = onNewSignificantIncident; // Trigger: nouvel incident significatif
