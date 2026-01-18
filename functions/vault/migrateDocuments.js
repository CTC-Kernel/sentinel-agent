/**
 * Story 23.4 - Migration des Documents Existants
 *
 * Batch job pour chiffrer les documents existants non-chiffrés.
 * Peut être déclenché manuellement ou via Cloud Scheduler.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { KeyManagementServiceClient } = require('@google-cloud/kms');
const crypto = require('crypto');

const VAULT_CONFIG = {
  keyRingId: 'sentinel-vault',
  cryptoKeyId: 'documents-key',
  location: 'europe-west1',
  projectId: process.env.GCLOUD_PROJECT || '',
};

const getKeyPath = () => {
  const { projectId, location, keyRingId, cryptoKeyId } = VAULT_CONFIG;
  return `projects/${projectId}/locations/${location}/keyRings/${keyRingId}/cryptoKeys/${cryptoKeyId}`;
};

// Batch size for processing
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;

/**
 * CRC32C for KMS verification
 */
function crc32c(data) {
  const crc32cTable = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
    }
    crc32cTable[i] = crc;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crc32cTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Encrypt a single document
 */
async function encryptDocument(db, storage, kmsClient, keyPath, doc) {
  const docData = doc.data();
  const storagePath = docData.url || docData.storagePath;

  if (!storagePath) {
    return { id: doc.id, status: 'skipped', reason: 'no_storage_path' };
  }

  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  try {
    const [exists] = await file.exists();
    if (!exists) {
      return { id: doc.id, status: 'skipped', reason: 'file_not_found' };
    }

    // Check if already encrypted via metadata
    const [metadata] = await file.getMetadata();
    if (metadata.metadata?.encrypted === 'true') {
      return { id: doc.id, status: 'skipped', reason: 'already_encrypted' };
    }

    // Download content
    const [content] = await file.download();

    // Calculate hash before encryption
    const originalHash = crypto.createHash('sha256').update(content).digest('hex');

    // Encrypt with KMS
    const [encryptResponse] = await kmsClient.encrypt({
      name: keyPath,
      plaintext: content,
      plaintextCrc32c: { value: crc32c(content) },
    });

    if (!encryptResponse.verifiedPlaintextCrc32c) {
      throw new Error('CRC32C verification failed');
    }

    const ciphertext = encryptResponse.ciphertext;
    const keyVersion = encryptResponse.name?.split('/').pop() || 'unknown';

    // Upload encrypted content
    await file.save(ciphertext, {
      contentType: metadata.contentType,
      metadata: {
        ...metadata.metadata,
        encrypted: 'true',
        keyVersion,
        originalHash,
        originalSize: content.length.toString(),
        encryptedAt: new Date().toISOString(),
        algorithm: 'AES-256-GCM',
        migratedAt: new Date().toISOString(),
      },
    });

    // Update Firestore document
    await doc.ref.update({
      'encryption.encrypted': true,
      'encryption.keyVersion': keyVersion,
      'encryption.encryptedAt': FieldValue.serverTimestamp(),
      'encryption.algorithm': 'AES-256-GCM',
      'encryption.hash': originalHash,
      'encryption.migratedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      id: doc.id,
      status: 'success',
      keyVersion,
      originalSize: content.length,
      encryptedSize: ciphertext.length,
    };
  } catch (error) {
    console.error(`Error encrypting document ${doc.id}:`, error);

    // Update document with error status
    try {
      await doc.ref.update({
        'encryption.encrypted': false,
        'encryption.status': 'migration_failed',
        'encryption.error': error.message,
        'encryption.lastAttempt': FieldValue.serverTimestamp(),
        'encryption.retryCount': FieldValue.increment(1),
      });
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return { id: doc.id, status: 'error', error: error.message };
  }
}

/**
 * Manual migration trigger (callable function)
 */
exports.migrateDocuments = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '2GiB',
  },
  async (request) => {
    // Verify admin permissions
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userRole = request.auth.token.role;
    if (!['admin', 'super_admin'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Admin role required');
    }

    const { organizationId, dryRun = false, limit = BATCH_SIZE } = request.data;

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId required');
    }

    const db = getFirestore();
    const storage = getStorage();
    const kmsClient = new KeyManagementServiceClient();
    const keyPath = getKeyPath();

    console.log(`Starting migration for org ${organizationId}, dryRun=${dryRun}, limit=${limit}`);

    // Query unencrypted documents
    const docsQuery = db
      .collection('documents')
      .where('organizationId', '==', organizationId)
      .where('encryption.encrypted', '!=', true)
      .limit(limit);

    const snapshot = await docsQuery.get();

    if (snapshot.empty) {
      // Also check documents without encryption field
      const noEncryptionQuery = db
        .collection('documents')
        .where('organizationId', '==', organizationId)
        .limit(limit);

      const allDocs = await noEncryptionQuery.get();
      const unencrypted = allDocs.docs.filter(
        (doc) => !doc.data().encryption?.encrypted
      );

      if (unencrypted.length === 0) {
        return {
          status: 'complete',
          message: 'All documents are already encrypted',
          processed: 0,
          total: 0,
        };
      }

      // Process unencrypted documents
      const results = {
        success: 0,
        skipped: 0,
        errors: 0,
        details: [],
      };

      for (const doc of unencrypted.slice(0, limit)) {
        if (dryRun) {
          results.details.push({ id: doc.id, status: 'would_encrypt' });
          results.success++;
        } else {
          const result = await encryptDocument(db, storage, kmsClient, keyPath, doc);
          results.details.push(result);
          if (result.status === 'success') results.success++;
          else if (result.status === 'skipped') results.skipped++;
          else results.errors++;
        }
      }

      return {
        status: results.errors > 0 ? 'partial' : 'complete',
        dryRun,
        processed: results.success + results.skipped + results.errors,
        success: results.success,
        skipped: results.skipped,
        errors: results.errors,
        details: results.details,
        remaining: Math.max(0, unencrypted.length - limit),
      };
    }

    // Process documents from first query
    const results = {
      success: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const doc of snapshot.docs) {
      if (dryRun) {
        results.details.push({ id: doc.id, status: 'would_encrypt' });
        results.success++;
      } else {
        const result = await encryptDocument(db, storage, kmsClient, keyPath, doc);
        results.details.push(result);
        if (result.status === 'success') results.success++;
        else if (result.status === 'skipped') results.skipped++;
        else results.errors++;
      }
    }

    return {
      status: results.errors > 0 ? 'partial' : 'complete',
      dryRun,
      processed: results.success + results.skipped + results.errors,
      success: results.success,
      skipped: results.skipped,
      errors: results.errors,
      details: results.details,
    };
  }
);

/**
 * Scheduled migration job (runs daily at 3 AM)
 */
exports.scheduledDocumentMigration = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '2GiB',
  },
  async () => {
    const db = getFirestore();
    const storage = getStorage();
    const kmsClient = new KeyManagementServiceClient();
    const keyPath = getKeyPath();

    console.log('Starting scheduled document migration');

    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();

    const totalResults = {
      organizations: 0,
      success: 0,
      skipped: 0,
      errors: 0,
    };

    for (const orgDoc of orgsSnapshot.docs) {
      const organizationId = orgDoc.id;

      // Query unencrypted documents for this org
      const docsSnapshot = await db
        .collection('documents')
        .where('organizationId', '==', organizationId)
        .limit(BATCH_SIZE)
        .get();

      const unencrypted = docsSnapshot.docs.filter(
        (doc) => !doc.data().encryption?.encrypted
      );

      if (unencrypted.length === 0) continue;

      totalResults.organizations++;

      for (const doc of unencrypted) {
        const result = await encryptDocument(db, storage, kmsClient, keyPath, doc);
        if (result.status === 'success') totalResults.success++;
        else if (result.status === 'skipped') totalResults.skipped++;
        else totalResults.errors++;
      }
    }

    console.log('Migration complete:', totalResults);

    // Store migration report
    await db.collection('system_logs').add({
      type: 'document_migration',
      timestamp: FieldValue.serverTimestamp(),
      results: totalResults,
    });

    return totalResults;
  }
);

/**
 * Get migration status for an organization
 */
exports.getMigrationStatus = onCall(
  { region: 'europe-west1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { organizationId } = request.data;
    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId required');
    }

    const db = getFirestore();

    // Count total documents
    const totalSnapshot = await db
      .collection('documents')
      .where('organizationId', '==', organizationId)
      .count()
      .get();

    const total = totalSnapshot.data().count;

    // Count encrypted documents
    const encryptedSnapshot = await db
      .collection('documents')
      .where('organizationId', '==', organizationId)
      .where('encryption.encrypted', '==', true)
      .count()
      .get();

    const encrypted = encryptedSnapshot.data().count;

    // Count failed documents
    const failedSnapshot = await db
      .collection('documents')
      .where('organizationId', '==', organizationId)
      .where('encryption.status', '==', 'migration_failed')
      .count()
      .get();

    const failed = failedSnapshot.data().count;

    return {
      total,
      encrypted,
      pending: total - encrypted - failed,
      failed,
      progress: total > 0 ? Math.round((encrypted / total) * 100) : 100,
      isComplete: encrypted === total,
    };
  }
);
