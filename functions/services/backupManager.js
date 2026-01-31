const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');

const db = admin.firestore();
const storage = getStorage();

/**
 * Server-side Backup Manager
 * Handles creating backups from Cloud Functions (scheduled/triggered).
 */
class BackupManager {
    static async createBackup(organizationId, config = {}) {
        if (!organizationId) throw new Error('Organization ID required');

        const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`Starting backup ${backupId} for org ${organizationId}`);

        // Default config if not provided
        const finalConfig = {
            includeDocuments: true,
            includeAssets: true,
            includeRisks: true,
            includeControls: true,
            includeAudits: true,
            includeProjects: true,
            includeSuppliers: true,
            includeIncidents: true,
            includeUsers: false,
            includeComments: true,
            ...config
        };

        const metadata = {
            id: backupId,
            organizationId: organizationId,
            createdAt: new Date().toISOString(),
            createdBy: 'SYSTEM_SCHEDULER',
            config: finalConfig,
            size: 0,
            collections: this.getCollectionsToBackup(finalConfig),
            status: 'creating'
        };

        try {
            // 1. Create metadata doc
            await db.collection('backups').doc(backupId).set(metadata);

            // 2. Collect Data
            const backupData = {};
            let totalSize = 0;

            for (const collectionName of metadata.collections) {
                try {
                    const snapshot = await db.collection(collectionName)
                        .where('organizationId', '==', organizationId)
                        .get();

                    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    backupData[collectionName] = data;
                    totalSize += JSON.stringify(data).length;
                } catch (err) {
                    console.error(`Error backing up collection ${collectionName}:`, err);
                }
            }

            // 3. Upload to Storage
            const bucket = storage.bucket();
            const file = bucket.file(`backups/${organizationId}/${backupId}.json`);
            const jsonBuffer = Buffer.from(JSON.stringify(backupData, null, 2), 'utf8');

            await file.save(jsonBuffer, {
                metadata: { contentType: 'application/json' }
            });

            // Get signed URL or just path (Client can get URL via SDK)
            // For server-side, we usually just store the path or let client generate URL.
            // But let's try to get a signed URL if needed, or just skip it as client SDK `getDownloadURL` works on paths.
            // Client code expects `downloadUrl` in metadata.
            // Generating long-lived signed URL is possible but 'getDownloadURL' client-side is better.
            // Let's store a placeholder or just rely on path convention.
            // Existing client implementation uses `getDownloadURL(ref(storage, ...))` so it doesn't strictly need it in Firestore if IT constructs it.
            // BUT existing code: `metadata.downloadUrl = await getDownloadURL(backupRef);`
            // So client expects it.
            // Generating a signed URL from Admin SDK max duration is 7 days.
            // Better to let client generate it on demand?
            // Existing client `BackupRestore.tsx` uses `BackupService.getBackupUrl` which generates it from path.
            // So we don't strictly need to save `downloadUrl` in Firestore for the client to work, 
            // EXCEPT `BackupService.createBackup` (client-side) DOES save it.
            // Generate a signed URL valid for 1 hour. Client can regenerate on demand if needed.
            const [url] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000 // 1 hour
            });

            // 4. Update Metadata
            await db.collection('backups').doc(backupId).update({
                status: 'completed',
                size: totalSize,
                downloadUrl: url
            });

            console.log(`Backup ${backupId} completed successfully.`);
            return backupId;

        } catch (error) {
            console.error(`Backup ${backupId} failed:`, error);
            await db.collection('backups').doc(backupId).update({
                status: 'failed',
                error: error.message
            });
            throw error;
        }
    }

    static getCollectionsToBackup(config) {
        const collections = [];
        if (config.includeDocuments) collections.push('documents');
        if (config.includeAssets) collections.push('assets');
        if (config.includeRisks) collections.push('risks');
        if (config.includeControls) collections.push('controls');
        if (config.includeAudits) collections.push('audits');
        if (config.includeProjects) collections.push('projects');
        if (config.includeSuppliers) collections.push('suppliers');
        if (config.includeIncidents) collections.push('incidents');
        if (config.includeUsers) collections.push('users');
        if (config.includeComments) collections.push('comments');
        return collections;
    }
}

module.exports = { BackupManager };
