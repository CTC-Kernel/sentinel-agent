/**
 * Agent Enrollment - Handles agent registration with enrollment tokens
 */

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

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
    cors: true,
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const {
        enrollment_token,
        hostname,
        os,
        os_version,
        machine_id,
        agent_version,
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

      // Find and validate the enrollment token
      const tokensSnapshot = await db
        .collectionGroup('enrollmentTokens')
        .where('token', '==', enrollment_token)
        .where('revoked', '==', false)
        .limit(1)
        .get();

      if (tokensSnapshot.empty) {
        return res.status(401).json({ error: 'Invalid or expired enrollment token' });
      }

      const tokenDoc = tokensSnapshot.docs[0];
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

      const organizationId = tokenData.organizationId;

      // Check if agent with same machine_id already exists
      const existingAgent = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .where('machineId', '==', machine_id)
        .limit(1)
        .get();

      if (!existingAgent.empty) {
        // Return existing agent credentials
        const existingData = existingAgent.docs[0].data();
        return res.status(200).json({
          agent_id: existingAgent.docs[0].id,
          organization_id: organizationId,
          server_certificate: existingData.serverCertificate || '',
          client_certificate: existingData.clientCertificate || '',
          client_key: existingData.clientKey || '',
          certificate_expires_at: existingData.certificateExpiresAt || '',
          config: existingData.config || getDefaultAgentConfig(),
          message: 'Agent already enrolled',
        });
      }

      // Generate new agent ID
      const agentId = uuidv4();

      // Generate certificates (simplified - in production use proper PKI)
      const certificateExpiresAt = new Date();
      certificateExpiresAt.setFullYear(certificateExpiresAt.getFullYear() + 1);

      // In production, generate real certificates using a CA
      // For now, we use placeholder values that the agent can use
      const serverCertificate = generatePlaceholderCert('server');
      const clientCertificate = generatePlaceholderCert('client', agentId);
      const clientKey = generatePlaceholderKey();

      // Create agent document
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
        clientKey,
        certificateExpiresAt: certificateExpiresAt.toISOString(),
        config: getDefaultAgentConfig(),
        complianceScore: null,
        lastCheckAt: null,
        pendingSyncCount: 0,
      };

      await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .set(agentData);

      // Update token usage count
      await tokenDoc.ref.update({
        usedCount: admin.firestore.FieldValue.increment(1),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log enrollment
      await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
        type: 'agent_enrolled',
        agentId,
        hostname,
        os,
        machineId: machine_id,
        tokenId: tokenDoc.id,
        ipAddress: req.ip || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Agent enrolled: ${agentId} for org ${organizationId}`);

      return res.status(201).json({
        agent_id: agentId,
        organization_id: organizationId,
        server_certificate: serverCertificate,
        client_certificate: clientCertificate,
        client_key: clientKey,
        certificate_expires_at: certificateExpiresAt.toISOString(),
        config: agentData.config,
      });
    } catch (error) {
      console.error('Enrollment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Get default agent configuration
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
