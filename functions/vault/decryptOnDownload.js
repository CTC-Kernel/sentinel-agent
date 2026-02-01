const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const crypto = require('crypto');

const VAULT_CONFIG = {
  keyRingId: 'sentinel-vault',
  cryptoKeyId: 'documents-key',
  location: 'europe-west1',
  projectId: process.env.GCP_PROJECT || require('firebase-admin').app().options.projectId || '',
};

const getKeyPath = () => {
  const { projectId, location, keyRingId, cryptoKeyId } = VAULT_CONFIG;
  return `projects/${projectId}/locations/${location}/keyRings/${keyRingId}/cryptoKeys/${cryptoKeyId}`;
};

/**
 * Cloud Function to decrypt a document for authorized download.
 * Verifies user permissions and document integrity before returning decrypted content.
 */
exports.decryptOnDownload = onCall(
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

    const { documentId, filePath } = request.data;
    if (!documentId && !filePath) {
      throw new HttpsError('invalid-argument', 'documentId or filePath required');
    }

    const userId = request.auth.uid;
    const db = getFirestore();
    const storage = getStorage();

    try {
      // Get document metadata from Firestore
      let docData = null;
      let storagePath = filePath;

      if (documentId) {
        const userOrg = request.auth.token.organizationId;

        // Query with organizationId filter to enforce tenant isolation at the query level
        const docQuery = await db.collection('documents')
          .where('organizationId', '==', userOrg)
          .where(FieldPath.documentId(), '==', documentId)
          .limit(1)
          .get();

        if (docQuery.empty) {
          // Log access denied (could be not-found or org mismatch)
          await logAuditEvent(db, {
            documentId,
            action: 'access_denied',
            userId,
            reason: 'not_found_or_organization_mismatch',
          });
          throw new HttpsError('not-found', 'Document not found');
        }

        docData = docQuery.docs[0].data();
        storagePath = docData.url || docData.storagePath;

        // Check classification-based access
        if (docData.classification) {
          const userRole = request.auth.token.role || 'user';
          const canAccess = checkClassificationAccess(
            docData.classification.level,
            userRole
          );
          if (!canAccess) {
            await logAuditEvent(db, {
              documentId,
              action: 'access_denied',
              userId,
              reason: 'classification_restricted',
            });
            throw new HttpsError(
              'permission-denied',
              'Insufficient permissions for this classification level'
            );
          }
        }

        // Check document-level ACL if exists
        if (docData.acl && docData.acl.defaultAccess === 'explicit') {
          const hasAccess = checkACLAccess(docData.acl, userId, 'download');
          if (!hasAccess) {
            await logAuditEvent(db, {
              documentId,
              action: 'access_denied',
              userId,
              reason: 'acl_restricted',
            });
            throw new HttpsError('permission-denied', 'No download permission');
          }
        }
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

      // Download file content
      const [content] = await file.download();

      let decryptedContent = content;
      let integrityVerified = true;

      if (isEncrypted) {
        // Initialize KMS client
        const { KeyManagementServiceClient } = require('@google-cloud/kms');
        const kmsClient = new KeyManagementServiceClient();
        const keyPath = getKeyPath();

        // Decrypt content
        const [decryptResponse] = await kmsClient.decrypt({
          name: keyPath,
          ciphertext: content,
        });

        decryptedContent = decryptResponse.plaintext;

        // Verify integrity with stored hash
        const originalHash = metadata.metadata?.originalHash;
        if (originalHash) {
          const decryptedHash = crypto
            .createHash('sha256')
            .update(decryptedContent)
            .digest('hex');

          if (decryptedHash !== originalHash) {
            integrityVerified = false;
            logger.error(
              `Integrity check failed for ${storagePath}. Expected: ${originalHash}, Got: ${decryptedHash}`
            );

            // Log critical security event
            await logAuditEvent(db, {
              documentId,
              action: 'integrity_failure',
              userId,
              expectedHash: originalHash,
              actualHash: decryptedHash,
            });

            throw new HttpsError(
              'data-loss',
              'Document integrity compromised - hash mismatch detected'
            );
          }
        }
      }

      // Log successful download
      if (documentId) {
        await logAuditEvent(db, {
          documentId,
          action: 'download',
          userId,
          integrityVerified,
        });
      }

      // Return decrypted content as base64
      return {
        success: true,
        content: decryptedContent.toString('base64'),
        contentType: metadata.contentType,
        filename: metadata.name?.split('/').pop(),
        integrityVerified,
        size: decryptedContent.length,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Decryption error:', error);
      throw new HttpsError('internal', 'Failed to decrypt document');
    }
  }
);

/**
 * Check if user role can access classification level
 */
function checkClassificationAccess(level, role) {
  const accessMatrix = {
    public: ['user', 'project_manager', 'rssi', 'admin', 'super_admin'],
    internal: ['user', 'project_manager', 'rssi', 'admin', 'super_admin'],
    confidential: ['project_manager', 'rssi', 'admin', 'super_admin'],
    secret: ['rssi', 'admin', 'super_admin'],
  };

  const allowedRoles = accessMatrix[level] || [];
  return allowedRoles.includes(role);
}

/**
 * Check ACL for specific access type
 */
function checkACLAccess(acl, userId, accessType) {
  if (!acl.permissions || acl.permissions.length === 0) {
    return false;
  }

  const now = new Date();
  const accessLevels = {
    read: ['read', 'download', 'edit', 'delete', 'share', 'admin'],
    download: ['download', 'edit', 'delete', 'share', 'admin'],
    edit: ['edit', 'delete', 'share', 'admin'],
    delete: ['delete', 'admin'],
    share: ['share', 'admin'],
    admin: ['admin'],
  };

  const requiredLevels = accessLevels[accessType] || [];

  return acl.permissions.some((perm) => {
    // Check if permission is for this user
    if (perm.principalType === 'user' && perm.principalId !== userId) {
      return false;
    }

    // Check if permission has expired
    if (perm.expiresAt && perm.expiresAt.toDate() < now) {
      return false;
    }

    // Check if access level is sufficient
    return requiredLevels.includes(perm.access);
  });
}

/**
 * Log audit event
 */
async function logAuditEvent(db, event) {
  try {
    await db.collection('document_audit_logs').add({
      ...event,
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        ip: 'server-side', // Would need to pass from client
        userAgent: 'cloud-function',
      },
    });
  } catch (error) {
    logger.error('Failed to log audit event:', error);
  }
}
