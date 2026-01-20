const { onObjectFinalized } = require('firebase-functions/v2/storage');
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

/**
 * Cloud Function: Automatically encrypt documents on upload
 * Triggered when a file is uploaded to the sentinel-documents bucket
 * Uses Cloud KMS for envelope encryption (AES-256-GCM)
 */
exports.encryptOnUpload = onObjectFinalized(
  {
    bucket: 'sentinel-grc-a8701.appspot.com',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType;
    const metadata = event.data.metadata || {};

    // Skip if already encrypted
    if (metadata.encrypted === 'true') {
      console.log(`File ${filePath} already encrypted, skipping`);
      return;
    }

    // Skip non-document files (thumbnails, etc.)
    if (!filePath.startsWith('documents/') && !filePath.startsWith('uploads/')) {
      console.log(`Skipping non-document file: ${filePath}`);
      return;
    }

    console.log(`Encrypting file: ${filePath}`);

    const db = getFirestore();
    const storage = getStorage();
    const bucket = storage.bucket(event.bucket);
    const file = bucket.file(filePath);

    try {
      // Download file content
      const [content] = await file.download();

      // Calculate SHA-256 hash of original content
      const originalHash = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');

      // Initialize KMS client
      const kmsClient = new KeyManagementServiceClient();
      const keyPath = getKeyPath();

      // Encrypt content with Cloud KMS
      const [encryptResponse] = await kmsClient.encrypt({
        name: keyPath,
        plaintext: content,
        plaintextCrc32c: { value: crc32c(content) },
      });

      // Verify ciphertext
      if (!encryptResponse.verifiedPlaintextCrc32c) {
        throw new Error('Plaintext CRC32C verification failed');
      }

      const ciphertext = encryptResponse.ciphertext;

      // Extract key version from response
      const keyVersion = encryptResponse.name.split('/').pop();

      // Upload encrypted content back to same location
      await file.save(ciphertext, {
        contentType: contentType,
        metadata: {
          ...metadata,
          encrypted: 'true',
          keyVersion: keyVersion,
          originalHash: originalHash,
          encryptedAt: new Date().toISOString(),
          algorithm: 'AES-256-GCM',
        },
      });

      // Update Firestore document if exists
      const documentId = extractDocumentId(filePath);
      if (documentId) {
        const docRef = db.collection('documents').doc(documentId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          await docRef.update({
            'encryption.encrypted': true,
            'encryption.keyVersion': keyVersion,
            'encryption.encryptedAt': FieldValue.serverTimestamp(),
            'encryption.algorithm': 'AES-256-GCM',
            'encryption.hash': originalHash,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`Updated Firestore document ${documentId}`);
        }
      }

      console.log(`Successfully encrypted file: ${filePath}`);
      return { success: true, filePath, keyVersion };
    } catch (error) {
      console.error(`Error encrypting file ${filePath}:`, error);

      // Mark document as pending encryption for retry
      const documentId = extractDocumentId(filePath);
      if (documentId) {
        const docRef = db.collection('documents').doc(documentId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          await docRef.update({
            'encryption.encrypted': false,
            'encryption.status': 'pending',
            'encryption.error': error.message,
            'encryption.lastAttempt': FieldValue.serverTimestamp(),
          });
        }
      }

      throw error;
    }
  }
);

/**
 * Extract document ID from storage path
 * Pattern: documents/{orgId}/{documentId}/...
 */
function extractDocumentId(filePath) {
  const parts = filePath.split('/');
  if (parts.length >= 3 && parts[0] === 'documents') {
    return parts[2];
  }
  return null;
}

/**
 * CRC32C implementation for Cloud KMS verification
 * Uses the Castagnoli polynomial (0x82F63B78)
 */
function crc32c(data) {
  const crc32cTable = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x82F63B78 : crc >>> 1;
    }
    crc32cTable[i] = crc;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crc32cTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
