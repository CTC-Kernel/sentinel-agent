const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Creates a standard audit log entry for a document change.
 * @param {Object} event - The Cloud Function event object.
 * @param {string} collectionName - The name of the collection being monitored.
 * @param {string} resourceNameField - The field name to use as the resource name (e.g., 'title', 'name', 'code').
 */
const createAuditLog = async (event, collectionName, resourceNameField = 'name') => {
    const eventId = event.id;
    const docId = event.params.docId; // Assuming {docId} is the param name
    const timestamp = new Date().toISOString();

    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Determine Action Type
    let action = 'UNKNOWN';
    let data = {};
    let organizationId = null;
    let resourceName = 'Unknown Resource';

    if (!beforeData && afterData) {
        action = 'CREATE';
        data = afterData;
    } else if (beforeData && afterData) {
        action = 'UPDATE';
        data = afterData;

        // Optional: Skip if no meaningful change (e.g. just a timestamp update)
        // For strict audit, we log everything.
    } else if (beforeData && !afterData) {
        action = 'DELETE';
        data = beforeData;
    } else {
        return; // No change (shouldn't happen onWritten)
    }

    organizationId = data.organizationId;
    resourceName = data[resourceNameField] || docId;

    if (!organizationId) {
        logger.warn(`Audit Log: No organizationId found for ${collectionName}/${docId} (${action})`);
        return; // Can't log if we don't know the org (or maybe log to a global admin log?)
    }

    try {
        await admin.firestore().collection('system_logs').add({
            organizationId,
            userId: 'SYSTEM', // Automated trigger has no auth context of the specific user implicitly unless we track "updatedBy" field
            userEmail: 'system@sentinel-grc.com',
            action: `${collectionName.toUpperCase()}_${action}`,
            resource: resourceName,
            resourceId: docId,
            details: `Automated audit log for ${action} on ${collectionName}`,
            timestamp,
            source: 'backend_trigger',
            meta: {
                eventId,
                docId,
                collection: collectionName
            }
        });
        logger.info(`Audit logged: ${action} on ${collectionName}/${docId} for Org ${organizationId}`);
    } catch (error) {
        logger.error(`Failed to create audit log for ${collectionName}/${docId}`, error);
    }
};

/**
 * Factory function to generate a standard audit trigger.
 * @param {string} collectionPath - Path to collection (e.g., 'risks/{docId}')
 * @param {string} resourceNameField - Field to display (e.g. 'title')
 */
const generateAuditTrigger = (collectionPath, resourceNameField) => {
    // Extract collection name for logging tag
    const collectionName = collectionPath.split('/')[0];

    return onDocumentWritten(collectionPath, (event) => {
        return createAuditLog(event, collectionName, resourceNameField);
    });
};

module.exports = {
    generateAuditTrigger,
    createAuditLog
};
