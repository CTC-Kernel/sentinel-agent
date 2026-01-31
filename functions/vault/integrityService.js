/**
 * Story 26.1 - Integrity Service for Document Vault
 *
 * Provides functions for verifying document integrity through SHA-256 hashing.
 * Includes callable functions for on-demand verification and hash history tracking.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
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

/**
 * Calculate SHA-256 hash of content
 * @param {Buffer} content - Content to hash
 * @returns {string} Hex-encoded hash
 */
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Callable function to verify document integrity
 * Decrypts the document and compares hash with stored value
 */
exports.verifyIntegrity = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { documentId } = request.data;
    if (!documentId) {
      throw new HttpsError('invalid-argument', 'documentId is required');
    }

    const userId = request.auth.uid;
    const db = getFirestore();
    const storage = getStorage();

    try {
      // Get document metadata from Firestore
      const docRef = db.collection('documents').doc(documentId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new HttpsError('not-found', 'Document not found');
      }

      const docData = docSnap.data();
      const storagePath = docData.url || docData.storagePath;

      // Check user authorization
      const userOrg = request.auth.token.organizationId;
      if (docData.organizationId !== userOrg) {
        await logIntegrityEvent(db, {
          documentId,
          action: 'verify_denied',
          userId,
          reason: 'organization_mismatch',
        });
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Get file from Cloud Storage
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', 'File not found in storage');
      }

      // Get file metadata
      const [metadata] = await file.getMetadata();
      const isEncrypted = metadata.metadata?.encrypted === 'true';
      const storedHash = metadata.metadata?.originalHash || docData.encryption?.hash;

      if (!storedHash) {
        // No hash stored - calculate and store it
        const [content] = await file.download();

        let hashContent = content;

        if (isEncrypted) {
          // Need to decrypt first to get original content hash
          const { KeyManagementServiceClient } = require('@google-cloud/kms');
          const kmsClient = new KeyManagementServiceClient();
          const keyPath = getKeyPath();

          const [decryptResponse] = await kmsClient.decrypt({
            name: keyPath,
            ciphertext: content,
          });

          hashContent = decryptResponse.plaintext;
        }

        const calculatedHash = calculateHash(hashContent);

        // Store the hash for future verifications
        await file.setMetadata({
          metadata: {
            ...metadata.metadata,
            originalHash: calculatedHash,
          },
        });

        await docRef.update({
          'encryption.hash': calculatedHash,
          'integrity.lastVerified': FieldValue.serverTimestamp(),
          'integrity.status': 'verified',
          'integrity.verifiedBy': userId,
        });

        await logIntegrityEvent(db, {
          documentId,
          action: 'hash_generated',
          userId,
          hash: calculatedHash,
        });

        return {
          success: true,
          status: 'verified',
          hash: calculatedHash,
          message: 'Hash calculated and stored for first time',
          verifiedAt: new Date().toISOString(),
        };
      }

      // Verify integrity by comparing hashes
      const [content] = await file.download();

      let hashContent = content;

      if (isEncrypted) {
        const { KeyManagementServiceClient } = require('@google-cloud/kms');
        const kmsClient = new KeyManagementServiceClient();
        const keyPath = getKeyPath();

        const [decryptResponse] = await kmsClient.decrypt({
          name: keyPath,
          ciphertext: content,
        });

        hashContent = decryptResponse.plaintext;
      }

      const calculatedHash = calculateHash(hashContent);
      const integrityValid = calculatedHash === storedHash;

      // Log verification event
      await logIntegrityEvent(db, {
        documentId,
        action: integrityValid ? 'verify_success' : 'verify_failure',
        userId,
        expectedHash: storedHash,
        calculatedHash,
      });

      // Update document with verification result
      await docRef.update({
        'integrity.lastVerified': FieldValue.serverTimestamp(),
        'integrity.status': integrityValid ? 'verified' : 'compromised',
        'integrity.verifiedBy': userId,
        'integrity.lastHash': calculatedHash,
      });

      if (!integrityValid) {
        logger.error(
          `INTEGRITY FAILURE for document ${documentId}. Expected: ${storedHash}, Got: ${calculatedHash}`
        );
      }

      return {
        success: true,
        status: integrityValid ? 'verified' : 'compromised',
        hash: calculatedHash,
        expectedHash: storedHash,
        match: integrityValid,
        verifiedAt: new Date().toISOString(),
        message: integrityValid
          ? 'Document integrity verified successfully'
          : 'ALERT: Document integrity compromised - hash mismatch detected',
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Integrity verification error:', error);
      throw new HttpsError('internal', 'Failed to verify document integrity');
    }
  }
);

/**
 * Callable function to get hash history for a document
 * Returns the audit trail of all integrity-related events
 */
exports.getHashHistory = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { documentId, limit = 50 } = request.data;
    if (!documentId) {
      throw new HttpsError('invalid-argument', 'documentId is required');
    }

    const db = getFirestore();

    try {
      // Verify document access
      const docRef = db.collection('documents').doc(documentId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new HttpsError('not-found', 'Document not found');
      }

      const docData = docSnap.data();
      const userOrg = request.auth.token.organizationId;

      if (docData.organizationId !== userOrg) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Query integrity audit logs
      const logsQuery = db
        .collection('integrity_audit_logs')
        .where('documentId', '==', documentId)
        .orderBy('timestamp', 'desc')
        .limit(Math.min(limit, 100));

      const logsSnap = await logsQuery.get();
      const history = [];

      logsSnap.forEach((logDoc) => {
        const data = logDoc.data();
        history.push({
          id: logDoc.id,
          action: data.action,
          userId: data.userId,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
          hash: data.hash || data.calculatedHash,
          expectedHash: data.expectedHash,
          status: data.action === 'verify_success' ? 'verified' :
                  data.action === 'verify_failure' ? 'compromised' : 'info',
        });
      });

      // Get current integrity status from document
      const currentStatus = {
        hash: docData.encryption?.hash || null,
        lastVerified: docData.integrity?.lastVerified?.toDate?.()?.toISOString() || null,
        status: docData.integrity?.status || 'unknown',
        verifiedBy: docData.integrity?.verifiedBy || null,
      };

      return {
        success: true,
        documentId,
        currentStatus,
        history,
        totalEvents: history.length,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Get hash history error:', error);
      throw new HttpsError('internal', 'Failed to retrieve hash history');
    }
  }
);

/**
 * Callable function to generate an integrity certificate
 * Returns certificate data that can be rendered as PDF by the client
 */
exports.generateIntegrityCertificate = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { documentId } = request.data;
    if (!documentId) {
      throw new HttpsError('invalid-argument', 'documentId is required');
    }

    const userId = request.auth.uid;
    const db = getFirestore();

    try {
      // Get document metadata
      const docRef = db.collection('documents').doc(documentId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new HttpsError('not-found', 'Document not found');
      }

      const docData = docSnap.data();
      const userOrg = request.auth.token.organizationId;

      if (docData.organizationId !== userOrg) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Get user info for certificate
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : {};

      // Get organization info
      const orgRef = db.collection('organizations').doc(docData.organizationId);
      const orgSnap = await orgRef.get();
      const orgData = orgSnap.exists ? orgSnap.data() : {};

      // Generate certificate number
      const certificateNumber = `INT-${Date.now()}-${documentId.substring(0, 8).toUpperCase()}`;

      // Create certificate data
      const certificate = {
        certificateNumber,
        generatedAt: new Date().toISOString(),
        generatedBy: {
          userId,
          name: userData.displayName || userData.email || 'Unknown',
          email: userData.email,
        },
        organization: {
          id: docData.organizationId,
          name: orgData.name || 'Unknown Organization',
        },
        document: {
          id: documentId,
          name: docData.name || docData.filename || 'Unknown Document',
          type: docData.type || docData.mimeType || 'Unknown',
          size: docData.size || null,
          uploadedAt: docData.createdAt?.toDate?.()?.toISOString() || null,
          uploadedBy: docData.createdBy || null,
        },
        integrity: {
          hash: docData.encryption?.hash || 'Not available',
          algorithm: 'SHA-256',
          status: docData.integrity?.status || 'unknown',
          lastVerified: docData.integrity?.lastVerified?.toDate?.()?.toISOString() || null,
          verifiedBy: docData.integrity?.verifiedBy || null,
        },
        encryption: {
          encrypted: docData.encryption?.encrypted || false,
          algorithm: docData.encryption?.algorithm || 'N/A',
          keyVersion: docData.encryption?.keyVersion || 'N/A',
          encryptedAt: docData.encryption?.encryptedAt?.toDate?.()?.toISOString() || null,
        },
        signatures: docData.signatures || [],
        legalDisclaimer: `This integrity certificate attests to the cryptographic hash value of the referenced document at the time of generation. The SHA-256 hash algorithm was used to compute this value. Any modification to the document content will result in a different hash value, indicating potential tampering or corruption.`,
      };

      // Log certificate generation
      await logIntegrityEvent(db, {
        documentId,
        action: 'certificate_generated',
        userId,
        certificateNumber,
      });

      return {
        success: true,
        certificate,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Generate certificate error:', error);
      throw new HttpsError('internal', 'Failed to generate integrity certificate');
    }
  }
);

/**
 * Log integrity-related events to audit trail
 */
async function logIntegrityEvent(db, event) {
  try {
    await db.collection('integrity_audit_logs').add({
      ...event,
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        source: 'cloud-function',
        version: '1.0.0',
      },
    });
  } catch (error) {
    logger.error('Failed to log integrity event:', error);
  }
}
