/**
 * Agent Enrollment - Handles agent registration with enrollment tokens
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { checkRateLimit } = require('../utils/rateLimiter');
const { encrypt } = require('../utils/encryption');

const db = admin.firestore();

/**
 * Enroll a new agent using an enrollment token
 * POST /v1/agents/enroll
 *
 * Request body:
 * {
 *   enrollment_token: string,
 *   hostname: string,
 *   os: string,
 *   os_version: string,
 *   machine_id: string,
 *   agent_version: string
 * }
 *
 * Response:
 * {
 *   agent_id: string,
 *   organization_id: string,
 *   server_certificate: string,
 *   client_certificate: string,
 *   client_key: string,
 *   certificate_expires_at: string,
 *   config: object
 * }
 */
exports.enrollAgent = onRequest(
  {
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 30,
    cors: false,
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limit enrollment attempts per IP
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const rateLimitResult = checkRateLimit(clientIp, 'auth', { windowMs: 300000, maxRequests: 5 });
    if (!rateLimitResult.allowed) {
      logger.warn('Enrollment rate limit exceeded', { ip: clientIp, retryAfter: rateLimitResult.retryAfter });
      return res.status(429).json({
        error: 'Too many enrollment attempts. Try again later.',
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    try {
      const {
        enrollment_token,
        hostname,
        os,
        os_version,
        machine_id,
        agent_version,
        organization_id,
      } = req.body;

      // Validate required fields
      if (!enrollment_token) {
        return res.status(400).json({ error: 'enrollment_token is required' });
      }

      if (!hostname || !os || !machine_id) {
        return res.status(400).json({
          error: 'hostname, os, and machine_id are required',
        });
      }

      // Input length validation to prevent abuse
      if (typeof hostname !== 'string' || hostname.length > 255) {
        return res.status(400).json({ error: 'hostname must be a string of 255 characters or less' });
      }
      if (typeof os !== 'string' || os.length > 64) {
        return res.status(400).json({ error: 'os must be a string of 64 characters or less' });
      }
      if (typeof machine_id !== 'string' || machine_id.length > 256) {
        return res.status(400).json({ error: 'machine_id must be a string of 256 characters or less' });
      }
      if (os_version && (typeof os_version !== 'string' || os_version.length > 128)) {
        return res.status(400).json({ error: 'os_version must be a string of 128 characters or less' });
      }
      if (agent_version && (typeof agent_version !== 'string' || agent_version.length > 32)) {
        return res.status(400).json({ error: 'agent_version must be a string of 32 characters or less' });
      }

      // Find the enrollment token - either scoped to provided org or globally
      let tokenDoc;
      let organizationId = organization_id;

      if (organizationId) {
        // Find and validate the enrollment token scoped to the specified organization
        const tokensSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('enrollmentTokens')
          .where('token', '==', enrollment_token)
          .where('revoked', '==', false)
          .limit(1)
          .get();

        if (!tokensSnapshot.empty) {
          tokenDoc = tokensSnapshot.docs[0];
        }
      } else {
        // Fallback: Global lookup via collection group query
        // This requires a composite index on 'token' and 'revoked' in collectionGroup scope
        const globalTokensSnapshot = await db
          .collectionGroup('enrollmentTokens')
          .where('token', '==', enrollment_token)
          .where('revoked', '==', false)
          .limit(1)
          .get();

        if (!globalTokensSnapshot.empty) {
          tokenDoc = globalTokensSnapshot.docs[0];
          // Extrapolate organizationId from token data (preferred) or document path
          organizationId = tokenDoc.data().organizationId || tokenDoc.ref.parent.parent.id;
        }
      }

      if (!tokenDoc || !organizationId) {
        return res.status(401).json({ error: 'Invalid or expired enrollment token' });
      }

      const tokenData = tokenDoc.data();

      // Check expiration
      const expiresAt = tokenData.expiresAt?.toDate?.() || new Date(tokenData.expiresAt);
      if (expiresAt < new Date()) {
        return res.status(401).json({ error: 'Enrollment token has expired' });
      }

      // Check usage limit
      if (tokenData.maxUses && tokenData.usedCount >= tokenData.maxUses) {
        return res.status(401).json({ error: 'Enrollment token usage limit reached' });
      }

      // organizationId is already determined above

      // Use transaction to prevent TOCTOU race condition on machineId uniqueness
      const enrollmentResult = await db.runTransaction(async (transaction) => {
        // Check if agent with same machine_id already exists (inside transaction)
        const existingAgentSnapshot = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('agents')
          .where('machineId', '==', machine_id)
          .limit(1)
          .get();

        // Generate certificates (simplified - in production use proper PKI)
        const certificateExpiresAt = new Date();
        certificateExpiresAt.setFullYear(certificateExpiresAt.getFullYear() + 1);

        if (!existingAgentSnapshot.empty) {
          // Re-enroll existing agent: update credentials and metadata, preserve agentId and historical data
          const existingAgentDoc = existingAgentSnapshot.docs[0];
          const existingAgentId = existingAgentDoc.id;
          const existingAgentData = existingAgentDoc.data();

          const serverCertificate = generatePlaceholderCert('server');
          const clientCertificate = generatePlaceholderCert('client', existingAgentId);
          const clientKey = generatePlaceholderKey();
          const crypto = require('crypto');
          const rawHmacSecret = crypto.randomBytes(32).toString('base64');
          const hmacSecret = encrypt(rawHmacSecret);

          // Update existing agent document with fresh enrollment data
          const agentRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(existingAgentId);

          transaction.update(agentRef, {
            hostname,
            os: os.toLowerCase(),
            osVersion: os_version || existingAgentData.osVersion || '',
            version: agent_version || existingAgentData.version || '0.0.0',
            status: 'active',
            lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
            reEnrolledAt: admin.firestore.FieldValue.serverTimestamp(),
            enrolledWithToken: tokenDoc.id,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
            serverCertificate,
            clientCertificate,
            hmacSecret,
            certificateExpiresAt: certificateExpiresAt.toISOString(),
            config: getDefaultAgentConfig(),
          });

          // Update token usage count inside transaction
          transaction.update(tokenDoc.ref, {
            usedCount: admin.firestore.FieldValue.increment(1),
            lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return {
            reEnrolled: true,
            agentId: existingAgentId,
            serverCertificate,
            clientCertificate,
            clientKey,
            hmacSecret: rawHmacSecret, // Return raw to agent
            certificateExpiresAt: certificateExpiresAt.toISOString(),
          };
        }

        // Generate new agent ID for brand-new enrollment
        const agentId = uuidv4();

        const serverCertificate = generatePlaceholderCert('server');
        const clientCertificate = generatePlaceholderCert('client', agentId);
        const clientKey = generatePlaceholderKey();
        const crypto = require('crypto');
        const rawHmacSecret = crypto.randomBytes(32).toString('base64');
        const hmacSecret = encrypt(rawHmacSecret);

        // Create agent document inside transaction
        const agentRef = db
          .collection('organizations')
          .doc(organizationId)
          .collection('agents')
          .doc(agentId);

        // NOTE: clientKey (private key) is intentionally NOT stored in Firestore.
        // It is only returned once in the enrollment response to the agent.
        // Storing private keys in the database would be a security risk.
        const agentData = {
          id: agentId,
          name: hostname,
          hostname,
          os: os.toLowerCase(),
          osVersion: os_version || '',
          machineId: machine_id,
          version: agent_version || '0.0.0',
          status: 'active',
          lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
          enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
          enrolledWithToken: tokenDoc.id,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
          organizationId,
          serverCertificate,
          clientCertificate,
          hmacSecret,
          certificateExpiresAt: certificateExpiresAt.toISOString(),
          config: getDefaultAgentConfig(),
          complianceScore: null,
          lastCheckAt: null,
          pendingSyncCount: 0,
        };

        transaction.set(agentRef, agentData);

        // Update token usage count inside transaction
        transaction.update(tokenDoc.ref, {
          usedCount: admin.firestore.FieldValue.increment(1),
          lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          reEnrolled: false,
          agentId,
          agentData,
          serverCertificate,
          clientCertificate,
          clientKey,
          hmacSecret: rawHmacSecret, // Return raw to agent
          certificateExpiresAt: certificateExpiresAt.toISOString(),
        };
      });

      const { agentId, serverCertificate, clientCertificate, clientKey, hmacSecret: responseHmacSecret, certificateExpiresAt } = enrollmentResult;

      // Log enrollment or re-enrollment
      const auditType = enrollmentResult.reEnrolled ? 'agent_re_enrolled' : 'agent_enrolled';
      await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
        type: auditType,
        agentId,
        hostname,
        os,
        machineId: machine_id,
        tokenId: tokenDoc.id,
        ipAddress: req.ip || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (enrollmentResult.reEnrolled) {
        logger.info(`Agent re-enrolled (existing machineId): ${agentId} for org ${organizationId}`);
      } else {
        logger.info(`Agent enrolled: ${agentId} for org ${organizationId}`);
      }

      return res.status(enrollmentResult.reEnrolled ? 200 : 201).json({
        agent_id: agentId,
        organization_id: organizationId,
        server_certificate: serverCertificate,
        client_certificate: clientCertificate,
        client_key: clientKey,
        hmac_secret: responseHmacSecret,
        certificate_expires_at: certificateExpiresAt,
        config: getDefaultAgentConfig(),
        status: enrollmentResult.reEnrolled ? 're_enrolled' : 'enrolled',
      });
    } catch (error) {
      logger.error('Enrollment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Get default agent configuration
 * NOTE: This is duplicated in api.js - consider extracting to a shared utils module
 */
function getDefaultAgentConfig() {
  return {
    check_interval_secs: 3600,
    heartbeat_interval_secs: 60,
    log_level: 'info',
    enabled_checks: ['all'],
    offline_mode_days: 7,
  };
}

/**
 * Generate self-signed certificate for agent enrollment
 *
 * NOTE: Duplicated in api.js - consider extracting to a shared utils module
 * NOTE: In production, replace this with proper PKI:
 * - Use Cloud KMS for key generation
 * - Use a proper CA (internal or external)
 * - Implement certificate rotation
 *
 * This self-signed implementation provides real crypto but no chain of trust.
 */
function generateSelfSignedCert(type, agentId = '') {
  const crypto = require('crypto');
  const { logger } = require('firebase-functions');

  // Log warning in production
  logger.warn('Using self-signed certificates. For production, implement proper PKI with Cloud KMS.');

  // Generate key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Create a simple self-signed certificate structure
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const certData = {
    version: 3,
    serialNumber: crypto.randomBytes(16).toString('hex'),
    issuer: 'CN=Sentinel GRC Agent CA, O=Sentinel GRC',
    subject: `CN=${agentId || 'agent'}, O=Sentinel GRC, OU=${type}`,
    notBefore: now.toISOString(),
    notAfter: expiresAt.toISOString(),
    publicKey: publicKey,
    // Sign the certificate data with the private key
    signature: crypto.sign('sha256',
      Buffer.from(JSON.stringify({ agentId, type, notBefore: now.toISOString(), notAfter: expiresAt.toISOString() })),
      privateKey
    ).toString('base64')
  };

  return {
    certificate: Buffer.from(JSON.stringify(certData)).toString('base64'),
    privateKey: Buffer.from(privateKey).toString('base64'),
    publicKey: Buffer.from(publicKey).toString('base64'),
    expiresAt: expiresAt.toISOString()
  };
}

/**
 * Generate certificates for agent enrollment
 * Returns server cert, client cert, and client private key
 */
function generateAgentCertificates(agentId) {
  const serverCert = generateSelfSignedCert('server', 'sentinel-grc-server');
  const clientCert = generateSelfSignedCert('client', agentId);

  return {
    serverCertificate: serverCert.certificate,
    clientCertificate: clientCert.certificate,
    clientKey: clientCert.privateKey,
    certificateExpiresAt: clientCert.expiresAt
  };
}

// Legacy functions for backward compatibility - redirect to new implementation
// NOTE: Duplicated in api.js - consider extracting to a shared utils module
function generatePlaceholderCert(type, agentId = '') {
  const cert = generateSelfSignedCert(type, agentId);
  return cert.certificate;
}

function generatePlaceholderKey() {
  const crypto = require('crypto');
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return Buffer.from(privateKey).toString('base64');
}
