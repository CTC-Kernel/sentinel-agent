const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { KeyManagementServiceClient } = require("@google-cloud/kms");
const admin = require("firebase-admin");

/**
 * Cloud KMS configuration for Sentinel Vault
 */
const VAULT_CONFIG = {
  keyRingId: 'sentinel-vault',
  cryptoKeyId: 'documents-key',
  location: 'europe-west1',
  projectId: process.env.GCP_PROJECT || admin.app().options.projectId || '',
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

    // Verify user has admin/super_admin/rssi role via token
    const role = request.auth.token.role;
    if (!role || !['admin', 'super_admin', 'rssi'].includes(role)) {
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
      logger.error('KMS setup check failed:', error);
      return {
        status: 'not_configured',
        error: 'Unable to verify KMS configuration',
      };
    }
  }
);

module.exports = { checkKmsSetup, VAULT_CONFIG, getKeyPath };
