const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

const COLLECTIONS_TO_CLEAN = [
    'assets',
    'risks',
    'controls',
    'audits',
    'projects',
    'suppliers',
    'incidents',
    'documents',
    'processing_activities',
    'business_processes',
    'bcp_drills',
    'system_logs',
    'notifications',
    'backups',
    'backup_schedules',
    'supplier_assessments',
    'supplier_incidents',
    'join_requests',
    'invitations',
    'risk_history',
    'incidentResponses',
    'audit_checklists',
    'findings',
    'project_milestones',
    'secure_storage'
];

class AccountService {

    /**
     * Delete an organization and all its related data.
     * @param {string} organizationId 
     * @param {string} callerUid 
     */
    static async deleteOrganization(organizationId, callerUid) {
        if (!organizationId) throw new Error("Organization ID is required");

        const db = admin.firestore();
        const auth = admin.auth();
        const storage = admin.storage();

        logger.info(`Starting deletion of organization ${organizationId} by ${callerUid}`);

        try {
            // 1. Verify Ownership
            const orgRef = db.collection('organizations').doc(organizationId);
            const orgSnap = await orgRef.get();

            if (!orgSnap.exists) {
                throw new Error("Organization not found");
            }

            const orgData = orgSnap.data();
            if (orgData.ownerId !== callerUid) {
                // Double check if caller is super admin (future proofing, though strictly only owner should delete)
                // For now strict owner check is safer.
                throw new Error("Permission denied: Only the owner can delete the organization.");
            }

            // 2. Delete All Users (Auth + Firestore)
            logger.info(`Deleting users for org ${organizationId}...`);
            const usersSnap = await db.collection('users').where('organizationId', '==', organizationId).get();
            const deleteUserPromises = usersSnap.docs.map(async (userDoc) => {
                const uid = userDoc.id;
                try {
                    // Delete from Auth
                    await auth.deleteUser(uid);
                } catch (e) {
                    if (e.code !== 'auth/user-not-found') {
                        logger.error(`Failed to delete Auth user ${uid}`, e);
                        // Continue even if auth deletion fails (might be already gone)
                    }
                }
                // Delete from Firestore (Users collection)
                await userDoc.ref.delete();
            });
            await Promise.all(deleteUserPromises);

            // 3. Delete Data in Collections
            logger.info(`Deleting collections for org ${organizationId}...`);
            for (const collectionName of COLLECTIONS_TO_CLEAN) {
                await this.deleteCollectionData(db, collectionName, organizationId);
            }

            // 4. Delete Subcollections (Comments)
            // Note: Cloud Functions allows recursive delete but it's heavier. 
            // We'll stick to manual batch deletion for controlled execution.
            await this.deleteCollectionGroupData(db, 'comments', organizationId);

            // 5. Cleanup Storage
            // Deleting folders in Firebase Storage from Admin SDK
            // We delete the 'organizations/{orgId}' prefix
            try {
                const bucket = storage.bucket();
                await bucket.deleteFiles({ prefix: `organizations/${organizationId}/` });
                await bucket.deleteFiles({ prefix: `backups/${organizationId}/` });
            } catch (e) {
                logger.warn(`Storage cleanup incomplete for ${organizationId}`, e);
            }

            // 6. Delete Organization Document
            await orgRef.delete();

            logger.info(`Organization ${organizationId} deleted successfully.`);
            return { success: true };

        } catch (error) {
            logger.error(`Error deleting organization ${organizationId}`, error);
            throw error;
        }
    }

    /**
     * Helper to delete documents in batches
     */
    static async deleteCollectionData(db, collectionName, organizationId) {
        const batchSize = 500;
        const q = db.collection(collectionName).where('organizationId', '==', organizationId);

        while (true) {
            const snapshot = await q.limit(batchSize).get();
            if (snapshot.empty) break;

            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            logger.info(`Deleted batch of ${snapshot.size} docs from ${collectionName}`);
        }
    }

    /**
     * Helper to delete collection groups
     */
    static async deleteCollectionGroupData(db, collectionName, organizationId) {
        // Needs index on organizationId for the subcollection
        // If index is missing, this might fail or be empty. 
        // We catch errors to avoid blocking the main flow.
        try {
            const batchSize = 500;
            const q = db.collectionGroup(collectionName).where('organizationId', '==', organizationId);

            while (true) {
                const snapshot = await q.limit(batchSize).get();
                if (snapshot.empty) break;

                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        } catch (e) {
            logger.warn(`Failed to delete collectionGroup ${collectionName} (Indexing?)`, e);
        }
    }
}

module.exports = { AccountService };
