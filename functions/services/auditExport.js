const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

/**
 * Generates a CSV export of audit logs for a given organization.
 * @param {string} organizationId - The organization ID to filter logs.
 * @param {Object} options - { startDate, endDate, format }
 */
const generateAuditExport = async (organizationId, options = {}) => {
    const db = admin.firestore();
    const { startDate, endDate, format = 'csv' } = options;

    logger.info(`Starting audit export for Org ${organizationId}`, options);

    let query = db.collection('system_logs')
        .where('organizationId', '==', organizationId)
        .orderBy('timestamp', 'desc');

    if (startDate) query = query.where('timestamp', '>=', startDate);
    if (endDate) query = query.where('timestamp', '<=', endDate);

    // Limit to prevent memory overflow, or use streaming for large datasets (future improvement)
    // For now, hardcap at 5000 records for safety in a standard callable function.
    query = query.limit(5000);

    const snapshot = await query.get();

    if (snapshot.empty) {
        return format === 'json' ? [] : '';
    }

    const logs = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
            timestamp: d.timestamp,
            action: d.action,
            userEmail: d.userEmail || 'system',
            resource: d.resource,
            resourceId: d.resourceId || '',
            details: d.details || '',
            ip: d.ip || ''
        };
    });

    if (format === 'json') {
        return logs;
    }

    // Convert to CSV
    const headers = ['Timestamp', 'Action', 'User', 'Resource', 'Resource ID', 'Details', 'IP'];
    const csvRows = [headers.join(',')];

    logs.forEach(log => {
        const row = [
            `"${log.timestamp}"`,
            `"${log.action}"`,
            `"${log.userEmail}"`,
            `"${log.resource.replace(/"/g, '""')}"`, // Escape quotes
            `"${log.resourceId}"`,
            `"${log.details.replace(/"/g, '""')}"`,
            `"${log.ip}"`
        ];
        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
};

module.exports = {
    generateAuditExport
};
