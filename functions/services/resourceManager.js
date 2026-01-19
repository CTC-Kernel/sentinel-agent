const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

/**
 * Checks for dependencies and deletes a resource if safe.
 * Encapsulates referential integrity logic server-side.
 */
class ResourceManager {
    constructor() {
        this.db = admin.firestore();
    }

    /**
     * Main entry point for deletion
     */
    async deleteResource(collectionName, docId, userId, userRole, organizationId) {
        logger.info(`Attempting to delete ${collectionName}/${docId} by user ${userId} (${userRole}) in org ${organizationId}`);

        // 1. Validation basics
        if (!collectionName || !docId || !organizationId) {
            throw new HttpsError('invalid-argument', 'Missing required parameters');
        }

        const allowedCollections = ['assets', 'risks', 'controls', 'documents', 'projects', 'suppliers', 'incidents', 'business_processes'];
        if (!allowedCollections.includes(collectionName)) {
            throw new HttpsError('invalid-argument', `Collection ${collectionName} is not supported for secure deletion`);
        }

        // 2. Permission Check (Strict)
        // Only Admin, RSSI, or Owner can delete.
        // We trust the passed userRole from the context, or we could fetch user doc.
        // Context is usually verified by the Callable wrapper.
        const canDelete = userRole === 'admin' || userRole === 'rssi' || userRole === 'owner'; // 'owner' isn't a role per se but check caller

        // We will double check ownership of the resource context
        const docRef = this.db.collection(collectionName).doc(docId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            throw new HttpsError('not-found', 'Resource not found');
        }

        const data = docSnap.data();
        if (data.organizationId !== organizationId) {
            throw new HttpsError('permission-denied', 'Resource does not belong to your organization');
        }

        if (!canDelete) {
            // Optional: check if user is the resource owner (e.g. for projects?)
            // For strict governance, usually only Admins delete core assets.
            // We stick to the rule: Admin/RSSI.
            throw new HttpsError('permission-denied', 'Insufficient permissions to delete resources');
        }

        // 3. Dependency Checks
        await this.checkDependencies(collectionName, docId, organizationId);

        // 4. Perform Deletion
        await docRef.delete();

        // 5. Audit Log (via global logger or just return success)
        logger.info(`Successfully deleted ${collectionName}/${docId}`);

        return { success: true, id: docId };
    }

    async checkDependencies(collection, id, orgId) {
        const rules = {
            assets: [
                { col: 'risks', field: 'assetId', label: 'Risques' },
                { col: 'incidents', field: 'affectedAssetIds', array: true, label: 'Incidents' }
            ],
            risks: [
                { col: 'controls', field: 'relatedRiskIds', array: true, label: 'Contrôles' },
                { col: 'audits', field: 'relatedRiskIds', array: true, label: 'Audits' },
                { col: 'projects', field: 'relatedRiskIds', array: true, label: 'Projets' }
            ],
            controls: [
                { col: 'risks', field: 'mitigationControlIds', array: true, label: 'Risques' },
                { col: 'audits', field: 'relatedControlIds', array: true, label: 'Audits' }
            ],
            suppliers: [
                { col: 'risks', field: 'relatedSupplierIds', array: true, label: 'Risques' },
                { col: 'projects', field: 'supplierIds', array: true, label: 'Projets' }
            ],
            projects: [
                { col: 'risks', field: 'relatedProjectIds', array: true, label: 'Risques' }
            ],
            // Documents usually don't block, but let's check basic usage if needed.
            // For now, we assume strict blocking only for core GRC entities.
        };

        const checks = rules[collection] || [];

        for (const rule of checks) {
            let q = this.db.collection(rule.col).where('organizationId', '==', orgId);

            if (rule.array) {
                q = q.where(rule.field, 'array-contains', id);
            } else {
                q = q.where(rule.field, '==', id);
            }

            // Optimization: Limit 1 is enough to block
            const snap = await q.limit(1).get();

            if (!snap.empty) {
                throw new HttpsError('failed-precondition', `Impossible de supprimer : Lié à des ${rule.label} existants.`);
            }
        }
    }
}

module.exports = new ResourceManager();
