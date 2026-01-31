const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { KeyManagementServiceClient } = require("@google-cloud/kms");
const admin = require("firebase-admin");

/**
 * Cloud KMS configuration for Sentinel Vault
 */
const VAULT_CONFIG = {
  keyRingId: 'sentinel-vault',
  cryptoKeyId: 'documents-key',
  location: 'europe-west1',
  projectId: process.env.GCLOUD_PROJECT || '',
};

/**
 * Get the full Cloud KMS key path
 */
const getKeyPath = () => {
  const { projectId, location, keyRingId, cryptoKeyId } = VAULT_CONFIG;
  return `projects/${projectId}/locations/${location}/keyRings/${keyRingId}/cryptoKeys/${cryptoKeyId}`;
};

/**
 * Check Cloud KMS setup status
 * Returns key configuration details if properly configured
 */
const checkKmsSetup = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // Verify user has admin/super_admin/rssi role
    const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin' && userData.role !== 'rssi')) {
      throw new HttpsError('permission-denied', 'Insufficient permissions');
    }

    const kmsClient = new KeyManagementServiceClient();
    const keyPath = getKeyPath();

    try {
      const [cryptoKey] = await kmsClient.getCryptoKey({ name: keyPath });

      return {
        status: 'ready',
        keyName: cryptoKey.name,
        purpose: cryptoKey.purpose,
        primaryVersion: cryptoKey.primary?.name,
        rotationPeriod: cryptoKey.rotationPeriod?.seconds?.toString(),
        nextRotation: cryptoKey.nextRotationTime?.seconds?.toString(),
      };
    } catch (error) {
      console.error('KMS setup check failed:', error);
      return {
        status: 'not_configured',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);

module.exports = { checkKmsSetup, VAULT_CONFIG, getKeyPath };
