/**
 * Agent API - Express router for agent endpoints
 *
 * These endpoints are called by the Sentinel agent, not the web frontend.
 * Authentication is via client certificates or agent ID validation.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineString } = require('firebase-functions/params');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configuration parameters
const agentServerUrl = defineString('AGENT_SERVER_URL', { default: '' });
const functionsUrl = defineString('FUNCTIONS_URL', { default: '' });

// Import vulnerability and incident handlers
const { uploadVulnerabilities } = require('./vulnerabilities');
const { reportIncident } = require('./incidents');
// Import software inventory and CIS handlers
const {
    uploadSoftwareInventory,
    uploadCISResults,
    getAuthorizedSoftware,
    getCISBenchmarks,
} = require('./software');

const db = admin.firestore();

// Simple rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 120; // requests per window
const RATE_LIMIT_MAX_ENTRIES = 1000;
const RATE_LIMIT_MAX_AGE = 60 * 60 * 1000; // 1 hour

function rateLimit(key, max = RATE_LIMIT_MAX) {
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + RATE_LIMIT_WINDOW;
    }
    entry.count++;
    rateLimitMap.set(key, entry);
    if (rateLimitMap.size > RATE_LIMIT_MAX_ENTRIES) {
        for (const [k, v] of rateLimitMap) {
            if (now > v.resetAt || (now - v.resetAt + RATE_LIMIT_WINDOW) > RATE_LIMIT_MAX_AGE) {
                rateLimitMap.delete(k);
            }
        }
    }
    return entry.count > max;
}

// Express app for agent API
const app = express();

// CORS - Restrict to known origins (FIXED: was allowing all origins)
const ALLOWED_ORIGINS = [
    'https://app.cyber-threat-consulting.com',
    'https://sentinel-grc-a8701.web.app',
    'https://sentinel-grc-a8701.firebaseapp.com',
    // Agents don't send Origin header, so null/undefined is allowed
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (agents, curl, etc.)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS not allowed'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-ID', 'X-Agent-Certificate', 'X-Agent-Signature', 'X-Request-Timestamp', 'X-Organization-Id'],
}));

app.use(express.json({ limit: '1mb' }));

// Rate limiting middleware for all API requests
app.use((req, res, next) => {
    if (rateLimit(`api:${req.ip}`, 120)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    next();
});

// ============================================================================
// Agent Authentication Middleware (FIXED: Added certificate/signature validation)
// ============================================================================

/**
 * Validates agent certificate or HMAC signature
 * Agents must provide either:
 * - X-Agent-Certificate header matching stored certificate
 * - X-Agent-Signature header with HMAC-SHA256 of request body
 */
async function validateAgentAuth(req, res, next) {
    const agentId = req.params.agentId;
    const providedCert = req.headers['x-agent-certificate'];
    const providedSignature = req.headers['x-agent-signature'];
    const requestTimestamp = req.headers['x-request-timestamp'];

    if (!agentId) {
        return res.status(400).json({ error: 'Agent ID is required' });
    }

    // Find agent using direct path (avoids cross-tenant collectionGroup leak)
    const orgId = req.headers['x-organization-id'];
    if (!orgId) return res.status(401).json({ error: 'Missing organization ID' });
    const agentDoc = await db.doc(`organizations/${orgId}/agents/${agentId}`).get();
    if (!agentDoc.exists) return res.status(401).json({ error: 'Agent not found' });
    const agentData = agentDoc.data();

    // SECURITY: Verify the agent's organizationId matches the header to prevent cross-tenant access
    if (agentData.organizationId !== orgId) {
        return res.status(403).json({ error: 'Organization mismatch' });
    }

    // Attach agent data to request for downstream handlers
    req.agentDoc = agentDoc;
    req.agentData = agentData;

    // Method 1: Certificate validation
    if (providedCert) {
        const storedCert = agentData.clientCertificate;
        if (!storedCert) {
            logger.warn(`Agent ${agentId} has no stored certificate`);
            return res.status(401).json({ error: 'Agent certificate not configured' });
        }

        // Compare certificates (constant-time comparison to prevent timing attacks)
        const certBuf = Buffer.from(providedCert);
        const storedBuf = Buffer.from(storedCert);
        if (certBuf.length !== storedBuf.length) {
            return res.status(401).json({ error: 'Invalid agent certificate' });
        }
        const certMatch = crypto.timingSafeEqual(certBuf, storedBuf);

        if (!certMatch) {
            logger.warn(`Invalid certificate for agent ${agentId}`);
            // Log failed auth attempt
            await logFailedAuthAttempt(agentData.organizationId, agentId, 'invalid_certificate', req.ip);
            return res.status(401).json({ error: 'Invalid agent certificate' });
        }

        return next();
    }

    // Method 2: HMAC signature validation (for lightweight auth)
    if (providedSignature && requestTimestamp) {
        // Check timestamp freshness (prevent replay attacks - 5 minute window)
        const timestampMs = parseInt(requestTimestamp, 10);
        const now = Date.now();
        const MAX_TIME_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

        if (isNaN(timestampMs) || Math.abs(now - timestampMs) > MAX_TIME_DRIFT_MS) {
            logger.warn(`Request timestamp too old/invalid for agent ${agentId}`);
            return res.status(401).json({ error: 'Request timestamp invalid or expired' });
        }

        // Get agent's HMAC secret for signature validation
        // Uses the stored hmacSecret (dedicated secret, NOT the private key)
        const hmacSecret = agentData.hmacSecret;
        if (!hmacSecret) {
            logger.warn(`Agent ${agentId} has no HMAC secret for signature validation. ` +
                'Agent may need re-enrollment to generate an HMAC secret.');
            return res.status(401).json({ error: 'Agent signature key not configured' });
        }

        // Compute expected signature: HMAC-SHA256(timestamp + method + path + body)
        const signaturePayload = `${requestTimestamp}:${req.method}:${req.path}:${JSON.stringify(req.body || {})}`;
        const expectedSignature = crypto
            .createHmac('sha256', Buffer.from(hmacSecret, 'base64'))
            .update(signaturePayload)
            .digest('hex');

        // Constant-time comparison
        try {
            const sigBuf = Buffer.from(providedSignature, 'hex');
            const expectedBuf = Buffer.from(expectedSignature, 'hex');
            if (sigBuf.length !== expectedBuf.length) {
                logger.warn(`Invalid signature length for agent ${agentId}`);
                await logFailedAuthAttempt(agentData.organizationId, agentId, 'invalid_signature', req.ip);
                return res.status(401).json({ error: 'Invalid request signature' });
            }
            const sigMatch = crypto.timingSafeEqual(sigBuf, expectedBuf);

            if (!sigMatch) {
                logger.warn(`Invalid signature for agent ${agentId}`);
                await logFailedAuthAttempt(agentData.organizationId, agentId, 'invalid_signature', req.ip);
                return res.status(401).json({ error: 'Invalid request signature' });
            }

            return next();
        } catch (e) {
            logger.warn(`Signature comparison error for agent ${agentId}:`, e);
            return res.status(401).json({ error: 'Invalid signature format' });
        }
    }

    // No authentication provided - reject
    // NOTE: For backward compatibility during migration, you can temporarily allow unauthenticated
    // requests by uncommenting the next line. Remove after all agents are updated.
    // return next();

    logger.warn(`No authentication provided for agent ${agentId}`);
    return res.status(401).json({
        error: 'Authentication required',
        message: 'Provide X-Agent-Certificate or X-Agent-Signature header'
    });
}

/**
 * Log failed authentication attempt for security monitoring
 */
async function logFailedAuthAttempt(organizationId, agentId, reason, ipAddress) {
    try {
        await db.collection('organizations').doc(organizationId).collection('securityEvents').add({
            type: 'agent_auth_failed',
            agentId,
            reason,
            ipAddress: ipAddress || 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
        logger.error('Failed to log auth attempt:', e);
    }
}

// ============================================================================
// Agent Enrollment (DEPRECATED - prefer standalone enrollment.js onRequest)
// POST /v1/agents/enroll
// This endpoint is kept for backward compatibility but enrollment.js is the
// canonical, more secure enrollment path.
// ============================================================================
app.post('/v1/agents/enroll', async (req, res) => {
    try {
        if (rateLimit(req.ip, 10)) { // 10 enrollments per minute per IP
            return res.status(429).json({ error: 'Too many requests' });
        }

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

        // Input length validation
        if (hostname.length > 255 || os.length > 64 || (os_version && os_version.length > 128) || machine_id.length > 256) {
            return res.status(400).json({ error: 'Field value too long' });
        }

        // Find and validate the enrollment token
        // SECURITY: Require organizationId from request body to scope query to a specific org
        const reqOrganizationId = req.body.organization_id || req.headers['x-organization-id'];
        if (!reqOrganizationId) {
            return res.status(400).json({ error: 'organization_id is required for enrollment' });
        }

        const tokensSnapshot = await db
            .collection('organizations')
            .doc(reqOrganizationId)
            .collection('enrollmentTokens')
            .where('token', '==', enrollment_token)
            .where('revoked', '==', false)
            .limit(1)
            .get();

        if (tokensSnapshot.empty) {
            return res.status(401).json({ error: 'Invalid or expired enrollment token' });
        }

        const tokenDoc = tokensSnapshot.docs[0];
        const tokenData = tokenDoc.data();
        const tokenRef = tokenDoc.ref;

        // Check expiration
        const expiresAt = tokenData.expiresAt?.toDate?.() || new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
            return res.status(401).json({ error: 'Enrollment token has expired' });
        }

        // Atomic check+increment for usage limit (race condition fix)
        const tokenValidation = await db.runTransaction(async (transaction) => {
            const tokenSnap = await transaction.get(tokenRef);
            if (!tokenSnap.exists) throw new Error('Token not found');
            const tData = tokenSnap.data();
            if (tData.revoked) {
                throw new Error('Token has been revoked');
            }
            if (tData.maxUses && tData.usedCount >= tData.maxUses) {
                return { valid: false, error: 'Enrollment token usage limit reached' };
            }
            transaction.update(tokenRef, {
                usedCount: admin.firestore.FieldValue.increment(1),
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { valid: true, data: tData };
        });
        if (!tokenValidation.valid) {
            return res.status(401).json({ error: tokenValidation.error });
        }

        const organizationId = tokenValidation.data.organizationId;

        // Generate new agent ID
        const agentId = uuidv4();

        // Generate certificates (simplified - in production use proper PKI)
        const certificateExpiresAt = new Date();
        certificateExpiresAt.setFullYear(certificateExpiresAt.getFullYear() + 1);

        const serverCertificate = generatePlaceholderCert('server');
        const clientCertificate = generatePlaceholderCert('client', agentId);
        const clientKey = generatePlaceholderKey();
        // Generate a dedicated HMAC secret for signature-based auth (stored server-side)
        const hmacSecret = crypto.randomBytes(32).toString('base64');

        // Use a transaction to atomically check machine_id uniqueness and create agent (TOCTOU fix)
        const enrollmentResult = await db.runTransaction(async (transaction) => {
            // Check if agent with same machine_id already exists (inside transaction)
            const existingAgentSnapshot = await transaction.get(
                db.collection('organizations')
                  .doc(organizationId)
                  .collection('agents')
                  .where('machineId', '==', machine_id)
                  .limit(1)
            );

            if (!existingAgentSnapshot.empty) {
                return {
                    alreadyExists: true,
                    existingAgentId: existingAgentSnapshot.docs[0].id,
                };
            }

            // SECURITY: clientKey intentionally NOT stored — only returned once to the agent
            // hmacSecret IS stored — it's a dedicated server-side secret for HMAC validation
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
                ipAddress: req.ip || '',
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

            const agentRef = db
                .collection('organizations')
                .doc(organizationId)
                .collection('agents')
                .doc(agentId);
            transaction.set(agentRef, agentData);

            return { alreadyExists: false };
        });

        if (enrollmentResult.alreadyExists) {
            return res.status(200).json({
                agent_id: enrollmentResult.existingAgentId,
                organization_id: organizationId,
                status: 'already_enrolled',
                message: 'Agent already registered with this machine_id',
            });
        }

        // Token usage count already updated in transaction above

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

        logger.info(`Agent enrolled: ${agentId} for org ${organizationId}`);

        return res.status(201).json({
            agent_id: agentId,
            organization_id: organizationId,
            server_certificate: serverCertificate,
            client_certificate: clientCertificate,
            client_key: clientKey,
            hmac_secret: hmacSecret,
            certificate_expires_at: certificateExpiresAt.toISOString(),
            config: agentData.config,
        });
    } catch (error) {
        logger.error('Enrollment error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Heartbeat (SECURED with authentication middleware)
// POST /v1/agents/:agentId/heartbeat
// ============================================================================
app.post('/v1/agents/:agentId/heartbeat', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        // Agent data already validated and attached by middleware
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const {
            timestamp,
            agent_version,
            status,
            hostname,
            os_info,
            cpu_percent,
            memory_bytes,
            memory_percent,
            memory_total_bytes,
            disk_percent,
            disk_used_bytes,
            disk_total_bytes,
            uptime_seconds,
            ip_address,
            last_check_at,
            compliance_score,
            pending_sync_count,
            self_check_result,
        } = req.body;

        // Prepare update data
        const updateData = {
            lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
            status: 'Actif',
            version: agent_version || agentData.version,
            hostname: hostname || agentData.hostname,
            osVersion: os_info || agentData.osVersion,
            ipAddress: ip_address || req.ip || agentData.ipAddress,
        };

        // Add optional metrics
        if (typeof cpu_percent === 'number') {
            updateData.cpuPercent = cpu_percent;
        }
        if (typeof memory_bytes === 'number') {
            updateData.memoryBytes = memory_bytes;
        }
        if (typeof memory_percent === 'number') {
            updateData.memoryPercent = memory_percent;
        }
        if (typeof memory_total_bytes === 'number') {
            updateData.memoryTotalBytes = memory_total_bytes;
        }
        if (typeof disk_percent === 'number') {
            updateData.diskPercent = disk_percent;
        }
        if (typeof disk_used_bytes === 'number') {
            updateData.diskUsedBytes = disk_used_bytes;
        }
        if (typeof disk_total_bytes === 'number') {
            updateData.diskTotalBytes = disk_total_bytes;
        }
        if (typeof uptime_seconds === 'number') {
            updateData.uptimeSeconds = uptime_seconds;
        }
        if (last_check_at) {
            updateData.lastCheckAt = last_check_at;
        }
        // compliance_score intentionally NOT accepted from agent - calculated server-side only
        if (typeof pending_sync_count === 'number') {
            updateData.pendingSyncCount = pending_sync_count;
        }
        if (self_check_result) {
            updateData.selfCheckResult = self_check_result;
        }

        // Update agent document
        await agentDoc.ref.update(updateData);

        // Check for pending commands
        const commandsSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .collection('commands')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'asc')
            .limit(10)
            .get();

        const commands = [];
        const cmdBatch = db.batch();
        for (const cmdDoc of commandsSnapshot.docs) {
            const cmd = cmdDoc.data();
            commands.push({
                id: cmdDoc.id,
                type: cmd.type,
                payload: cmd.payload || {},
            });
            // Mark as delivered atomically
            cmdBatch.update(cmdDoc.ref, {
                status: 'delivered',
                deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        if (commands.length > 0) {
            await cmdBatch.commit();
        }

        // Check if config or rules have changed
        const configVersion = agentData.configVersion || 0;
        const rulesVersion = agentData.rulesVersion || 0;

        // Get latest versions from org settings
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgData = orgDoc.data() || {};
        const latestConfigVersion = orgData.agentConfigVersion || 0;
        const latestRulesVersion = orgData.agentRulesVersion || 0;

        return res.status(200).json({
            acknowledged: true,
            server_time: new Date().toISOString(),
            commands,
            config_changed: latestConfigVersion > configVersion,
            rules_changed: latestRulesVersion > rulesVersion,
        });
    } catch (error) {
        logger.error('Heartbeat error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Config (SECURED with authentication middleware)
// GET /v1/agents/:agentId/config
// ============================================================================
app.get('/v1/agents/:agentId/config', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        // Agent data already validated and attached by middleware
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        // Get organization settings
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgData = orgDoc.data() || {};

        // Get rules for this organization
        const rulesSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agentRules')
            .where('enabled', '==', true)
            .get();

        const rules = rulesSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                type: data.type,
                framework: data.framework,
                control_id: data.controlId,
                check_command: data.checkCommand,
                expected_result: data.expectedResult,
                remediation: data.remediation,
                severity: data.severity,
                platforms: data.platforms || ['all'],
            };
        });

        // Merge agent config with org defaults
        const config = {
            config_version: orgData.agentConfigVersion || 1,
            check_interval_secs: agentData.config?.check_interval_secs || 3600,
            heartbeat_interval_secs: agentData.config?.heartbeat_interval_secs || 60,
            log_level: agentData.config?.log_level || 'info',
            enabled_checks: agentData.config?.enabled_checks || ['all'],
            offline_mode_days: agentData.config?.offline_mode_days || 7,
            rules_version: orgData.agentRulesVersion || 1,
            rules,
        };

        // Update agent's config version
        await agentDoc.ref.update({
            configVersion: config.config_version,
            rulesVersion: config.rules_version,
        });

        return res.status(200).json(config);
    } catch (error) {
        logger.error('Get config error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Rules Download (SECURED with authentication middleware)
// GET /v1/agents/:agentId/rules
// ============================================================================
app.get('/v1/agents/:agentId/rules', validateAgentAuth, async (req, res) => {
    try {
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        // Get rules for this organization
        const rulesSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agentRules')
            .where('enabled', '==', true)
            .get();

        const rules = rulesSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || doc.id,
                description: data.description || null,
                category: data.category || 'security',
                severity: data.severity || 'medium',
                enabled: true,
                check_type: data.type || data.checkType || doc.id,
                parameters: data.parameters || null,
                frameworks: data.frameworks || [],
                version: data.version || '1.0',
                created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                updated_at: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            };
        });

        // Support ETag-based caching
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        const orgData = orgDoc.data() || {};
        const etag = `"rules-v${orgData.agentRulesVersion || 1}"`;

        // Check If-None-Match
        const ifNoneMatch = req.get('If-None-Match');
        if (ifNoneMatch && ifNoneMatch === etag) {
            return res.status(304).end();
        }

        res.set('ETag', etag);
        return res.status(200).json({
            rules,
            etag,
            total_count: rules.length,
        });
    } catch (error) {
        logger.error('Get rules error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Check ID Normalization
// ============================================================================

/**
 * Normalize check IDs to use consistent underscore format.
 * Converts hyphens to underscores and lowercases for consistency.
 * Frontend expects: mfa_enabled, disk_encryption, firewall_active, etc.
 */
function normalizeCheckId(checkId) {
    if (!checkId || typeof checkId !== 'string') return checkId;
    // Convert hyphens to underscores for consistency
    return checkId.toLowerCase().replace(/-/g, '_');
}

// ============================================================================
// Agent Results Upload (SECURED with authentication middleware)
// POST /v1/agents/:agentId/results
// ============================================================================
app.post('/v1/agents/:agentId/results', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const validStatuses = ['pass', 'fail', 'error', 'not_applicable'];

        // Support batch uploads from Rust agent: { results: [...], agent_id, timestamp }
        const isBatch = Array.isArray(req.body.results);
        const resultsToProcess = isBatch
            ? req.body.results
            : [req.body];

        if (resultsToProcess.length === 0) {
            return res.status(400).json({ error: 'No results provided' });
        }

        const resultsCollection = db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .collection('results');

        let accepted = 0;
        let rejected = 0;
        const rejectedIds = [];
        const BATCH_LIMIT = 400;
        let batch = db.batch();
        let opCount = 0;

        for (const item of resultsToProcess) {
            const checkId = normalizeCheckId(item.check_id);
            const status = item.status;

            if (!checkId || !status) {
                rejected++;
                if (checkId) rejectedIds.push(checkId);
                continue;
            }

            if (!validStatuses.includes(status)) {
                rejected++;
                rejectedIds.push(checkId);
                continue;
            }

            const resultData = {
                organizationId,
                agentId,
                checkId,
                framework: item.framework || null,
                controlId: normalizeCheckId(item.control_id) || null,
                status,
                evidence: item.evidence || item.raw_data || {},
                score: typeof item.score === 'number' ? item.score : null,
                proofHash: item.proof_hash || null,
                agentTimestamp: item.executed_at || item.timestamp || new Date().toISOString(),
                durationMs: item.duration_ms || 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                hostname: agentData.hostname,
                machineId: agentData.machineId,
            };

            const docRef = resultsCollection.doc();
            batch.set(docRef, resultData);
            accepted++;
            opCount++;

            if (opCount >= BATCH_LIMIT) {
                await batch.commit();
                batch = db.batch();
                opCount = 0;
            }
        }

        if (opCount > 0) {
            await batch.commit();
        }

        // Update agent's last check timestamp
        await agentDoc.ref.update({
            lastCheckAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (isBatch) {
            return res.status(201).json({
                accepted,
                rejected,
                rejected_ids: rejectedIds,
                timestamp: new Date().toISOString(),
            });
        } else {
            // Legacy single-result response
            return res.status(201).json({
                result_id: 'batch',
                acknowledged: true,
            });
        }
    } catch (error) {
        logger.error('Upload results error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Logs Upload (Story 12.1 AC4) - SECURED
// POST /v1/agents/:agentId/logs
// ============================================================================
app.post('/v1/agents/:agentId/logs', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const { entries, uploaded_at } = req.body;

        // Validate entries
        if (!entries || !Array.isArray(entries)) {
            return res.status(400).json({
                error: 'entries array is required',
            });
        }

        // Store logs in a subcollection
        const batch = db.batch();
        const logsCollection = db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .collection('logs');

        // Create a log upload document
        const uploadRef = logsCollection.doc();
        batch.set(uploadRef, {
            uploadedAt: uploaded_at || new Date().toISOString(),
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            entryCount: entries.length,
            hostname: agentData.hostname,
        });

        // Store individual entries (limit to 100 per upload to avoid write limits)
        const allowedLogFields = ['level', 'message', 'timestamp', 'source', 'category'];
        const entriesToStore = entries.slice(0, 100);
        for (const entry of entriesToStore) {
            const sanitizedEntry = {};
            for (const key of allowedLogFields) {
                if (entry[key] !== undefined) {
                    sanitizedEntry[key] = typeof entry[key] === 'string' ? entry[key].slice(0, 2000) : entry[key];
                }
            }
            const entryRef = logsCollection.doc(uploadRef.id).collection('entries').doc();
            batch.set(entryRef, {
                ...sanitizedEntry,
                storedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        await batch.commit();

        logger.info(`Received ${entries.length} log entries from agent ${agentId}`);

        return res.status(200).json({
            received_count: entriesToStore.length,
            ack_id: uploadRef.id,
        });
    } catch (error) {
        logger.error('Log upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Diagnostics Upload (Story 12.4) - SECURED
// POST /v1/agents/:agentId/diagnostics
// ============================================================================
app.post('/v1/agents/:agentId/diagnostics', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const diagnosticData = req.body;

        // Sanitize diagnostic data with explicit field whitelist
        const allowedDiagFields = ['cpuInfo', 'memoryInfo', 'diskInfo', 'networkInfo', 'osInfo', 'errors', 'warnings', 'status'];
        const sanitizedData = {};
        for (const key of allowedDiagFields) {
            if (diagnosticData[key] !== undefined) {
                const val = JSON.stringify(diagnosticData[key]);
                if (val.length <= 10000) { // 10KB per field max
                    sanitizedData[key] = diagnosticData[key];
                }
            }
        }

        // Store diagnostic result
        const diagnosticRef = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .collection('diagnostics')
            .add({
                ...sanitizedData,
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

        logger.info(`Received diagnostics from agent ${agentId}: ${diagnosticData.id}`);

        return res.status(200).json({
            acknowledged: true,
            diagnostic_id: diagnosticRef.id,
        });
    } catch (error) {
        logger.error('Diagnostics upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Vulnerabilities Upload - SECURED
// POST /v1/agents/:agentId/vulnerabilities
// ============================================================================
app.post('/v1/agents/:agentId/vulnerabilities', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentData = req.agentData;

        // Delegate to vulnerability handler
        return await uploadVulnerabilities(req, res, agentId, req.agentDoc, agentData);
    } catch (error) {
        logger.error('Vulnerabilities upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Incident Report - SECURED
// POST /v1/agents/:agentId/incidents
// ============================================================================
app.post('/v1/agents/:agentId/incidents', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentData = req.agentData;

        // Delegate to incident handler
        return await reportIncident(req, res, agentId, req.agentDoc, agentData);
    } catch (error) {
        logger.error('Incident report error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Network Snapshot Upload - SECURED
// POST /v1/agents/:agentId/network
// ============================================================================
app.post('/v1/agents/:agentId/network', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const {
            timestamp,
            interfaces,
            connections,
            routes,
            dns,
            primary_ip,
            primary_mac,
            hash,
        } = req.body;

        // Validate required fields
        if (!interfaces || !Array.isArray(interfaces)) {
            return res.status(400).json({ error: 'interfaces array is required' });
        }

        // Store network snapshot
        const snapshotData = {
            agentId,
            timestamp: timestamp || new Date().toISOString(),
            interfaces: interfaces || [],
            connections: connections || [],
            routes: routes || [],
            dns: dns || { servers: [], search_domains: [] },
            primaryIp: primary_ip,
            primaryMac: primary_mac,
            hash: hash || '',
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Store in networkSnapshots subcollection
        const snapshotRef = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .collection('networkSnapshots')
            .add(snapshotData);

        // Update agent document with network info for quick access
        const agentUpdate = {
            lastNetworkSyncAt: admin.firestore.FieldValue.serverTimestamp(),
            networkHash: hash,
        };

        // Update primary IP/MAC if available
        if (primary_ip) {
            agentUpdate.ipAddress = primary_ip;
        }
        if (primary_mac) {
            agentUpdate.macAddress = primary_mac;
        }

        // Extract interface count and connection count for stats
        agentUpdate.networkStats = {
            interfaceCount: interfaces.length,
            connectionCount: connections?.length || 0,
            routeCount: routes?.length || 0,
            dnsServerCount: dns?.servers?.length || 0,
        };

        await agentDoc.ref.update(agentUpdate);

        // Also update corresponding Asset if exists (for voxel cartography)
        try {
            const assetsQuery = await db
                .collection('organizations')
                .doc(organizationId)
                .collection('assets')
                .where('agentId', '==', agentId)
                .limit(1)
                .get();

            if (!assetsQuery.empty) {
                const assetDoc = assetsQuery.docs[0];
                const assetUpdate = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (primary_ip) assetUpdate.ipAddress = primary_ip;
                if (primary_mac) assetUpdate.macAddress = primary_mac;
                if (interfaces.length > 0) {
                    assetUpdate.networkInterfaces = interfaces.map(iface => ({
                        name: iface.name,
                        macAddress: iface.mac_address || iface.macAddress,
                        ipv4Addresses: iface.ipv4_addresses || iface.ipv4Addresses || [],
                        ipv6Addresses: iface.ipv6_addresses || iface.ipv6Addresses || [],
                        status: iface.status,
                        type: iface.interface_type || iface.interfaceType,
                    }));
                }
                await assetDoc.ref.update(assetUpdate);
            }
        } catch (assetError) {
            logger.warn('Failed to update asset with network info:', assetError);
            // Don't fail the whole request if asset update fails
        }

        logger.info(`Received network snapshot from agent ${agentId}: ${interfaces.length} interfaces, ${connections?.length || 0} connections`);

        return res.status(200).json({
            acknowledged: true,
            snapshot_id: snapshotRef.id,
        });
    } catch (error) {
        logger.error('Network snapshot upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Network Security Alert - SECURED
// POST /v1/agents/:agentId/network/alerts
// ============================================================================
app.post('/v1/agents/:agentId/network/alerts', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const {
            alert_type,
            severity,
            title,
            description,
            connection,
            evidence,
            confidence,
            detected_at,
            iocs_matched,
        } = req.body;

        // Validate required fields
        if (!alert_type || !severity || !title) {
            return res.status(400).json({
                error: 'alert_type, severity, and title are required',
            });
        }

        // Map network alert severity to incident severity
        const severityMap = {
            'Low': 'Faible',
            'Medium': 'Moyenne',
            'High': 'Élevée',
            'Critical': 'Critique',
            'low': 'Faible',
            'medium': 'Moyenne',
            'high': 'Élevée',
            'critical': 'Critique',
        };

        // Create network alert document
        const alertData = {
            agentId,
            organizationId,
            alertType: alert_type,
            severity: severityMap[severity] || 'Moyenne',
            title,
            description: description || '',
            connection: connection || null,
            evidence: evidence || {},
            confidence: Math.min(100, Math.max(0, Number(confidence) || 0)),
            detectedAt: detected_at || new Date().toISOString(),
            iocsMatched: iocs_matched || [],
            hostname: agentData.hostname,
            ipAddress: agentData.ipAddress,
            status: 'Ouvert',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Store in networkAlerts collection (organization level for SOC visibility)
        const alertRef = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('networkAlerts')
            .add(alertData);

        // Also create an incident for high/critical alerts
        if (['Élevée', 'Critique'].includes(alertData.severity)) {
            const incidentData = {
                type: 'network_security',
                subType: alert_type,
                severity: alertData.severity,
                title: `[Network] ${title}`,
                description: description,
                agentId,
                hostname: agentData.hostname,
                ipAddress: agentData.ipAddress,
                evidence: {
                    ...evidence,
                    networkAlertId: alertRef.id,
                    connection,
                    iocsMatched: iocs_matched,
                },
                status: 'Ouvert',
                detectedAt: detected_at || new Date().toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            await db
                .collection('organizations')
                .doc(organizationId)
                .collection('incidents')
                .add(incidentData);

            logger.warn(`High severity network alert from agent ${agentId}: ${title}`);
        }

        logger.info(`Received network alert from agent ${agentId}: ${title} (${severity})`);

        return res.status(201).json({
            alert_id: alertRef.id,
            acknowledged: true,
        });
    } catch (error) {
        logger.error('Network alert upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Software Inventory Upload - SECURED
// POST /v1/agents/:agentId/software
// ============================================================================
app.post('/v1/agents/:agentId/software', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;

        // Delegate to software handler
        return await uploadSoftwareInventory(req, res, agentId, agentDoc, agentData);
    } catch (error) {
        logger.error('Software inventory upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent CIS Benchmark Results Upload - SECURED
// POST /v1/agents/:agentId/cis
// ============================================================================
app.post('/v1/agents/:agentId/cis', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;

        // Delegate to CIS handler
        return await uploadCISResults(req, res, agentId, agentDoc, agentData);
    } catch (error) {
        logger.error('CIS results upload error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Get Authorized Software List - SECURED
// GET /v1/agents/:agentId/software/authorized
// ============================================================================
app.get('/v1/agents/:agentId/software/authorized', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentData = req.agentData;

        // Delegate to authorized software handler
        return await getAuthorizedSoftware(req, res, agentData);
    } catch (error) {
        logger.error('Get authorized software error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Get CIS Benchmarks for Agent - SECURED
// GET /v1/agents/:agentId/cis/benchmarks
// ============================================================================
app.get('/v1/agents/:agentId/cis/benchmarks', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentData = req.agentData;

        // Delegate to CIS benchmarks handler
        return await getCISBenchmarks(req, res, agentData);
    } catch (error) {
        logger.error('Get CIS benchmarks error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Token Validation (NO AUTH - public for pre-enrollment)
// GET /v1/agents/tokens/validate
// ============================================================================
app.get('/v1/agents/tokens/validate', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                code: 'MISSING_TOKEN',
                message: 'token query parameter is required',
            });
        }

        // Find the token
        // SECURITY: Require organizationId to scope query to a specific org
        const orgId = req.query.organization_id || req.headers['x-organization-id'];
        if (!orgId) {
            return res.status(400).json({
                code: 'MISSING_ORGANIZATION_ID',
                message: 'organization_id query parameter is required',
            });
        }

        const tokensSnapshot = await db
            .collection('organizations')
            .doc(orgId)
            .collection('enrollmentTokens')
            .where('token', '==', token)
            .limit(1)
            .get();

        if (tokensSnapshot.empty) {
            return res.status(404).json({
                code: 'TOKEN_NOT_FOUND',
                message: 'Enrollment token not found',
                valid: false,
            });
        }

        const tokenDoc = tokensSnapshot.docs[0];
        const tokenData = tokenDoc.data();

        // Check if revoked
        if (tokenData.revoked) {
            return res.status(200).json({
                valid: false,
            });
        }

        // Check expiration
        const expiresAt = tokenData.expiresAt?.toDate?.() || new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
            return res.status(200).json({
                valid: false,
            });
        }

        // Check usage limit
        if (tokenData.maxUses && tokenData.usedCount >= tokenData.maxUses) {
            return res.status(200).json({
                valid: false,
            });
        }

        // Token is valid
        return res.status(200).json({
            valid: true,
            organization_id: tokenData.organizationId,
            expires_at: expiresAt.toISOString(),
            remaining_uses: tokenData.maxUses
                ? tokenData.maxUses - (tokenData.usedCount || 0)
                : null,
            name: tokenData.name || null,
        });
    } catch (error) {
        logger.error('Token validation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Certificate Renewal (SECURED)
// POST /v1/agents/:agentId/certificate/renew
// ============================================================================
app.post('/v1/agents/:agentId/certificate/renew', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const { reason } = req.body;

        logger.info(`Certificate renewal requested for agent ${agentId}: ${reason || 'no reason'}`);

        // Generate new certificates
        const certificateExpiresAt = new Date();
        certificateExpiresAt.setFullYear(certificateExpiresAt.getFullYear() + 1);

        const clientCertificate = generatePlaceholderCert('client', agentId);
        const clientKey = generatePlaceholderKey();
        const serverCertificate = agentData.serverCertificate || generatePlaceholderCert('server');

        // Update agent document with new certificates
        // SECURITY: clientKey intentionally NOT stored — only returned to the agent
        await agentDoc.ref.update({
            clientCertificate,
            certificateExpiresAt: certificateExpiresAt.toISOString(),
            lastCertificateRenewal: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Audit log
        await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
            type: 'agent_certificate_renewed',
            agentId,
            reason: reason || 'agent_request',
            hostname: agentData.hostname,
            ipAddress: req.ip || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info(`Certificate renewed for agent ${agentId}, expires ${certificateExpiresAt.toISOString()}`);

        return res.status(200).json({
            client_certificate: clientCertificate,
            client_private_key: clientKey,
            server_certificate: serverCertificate,
            certificate_expires_at: certificateExpiresAt.toISOString(),
            server_fingerprints: [],
        });
    } catch (error) {
        logger.error('Certificate renewal error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Re-enrollment (SECURED)
// POST /v1/agents/:agentId/re-enroll
// ============================================================================
app.post('/v1/agents/:agentId/re-enroll', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const { reason, hostname, os, os_version, machine_id, agent_version } = req.body;

        logger.info(`Re-enrollment requested for agent ${agentId}: ${reason || 'no reason'}`);

        // Generate new certificates
        const certificateExpiresAt = new Date();
        certificateExpiresAt.setFullYear(certificateExpiresAt.getFullYear() + 1);

        const serverCertificate = generatePlaceholderCert('server');
        const clientCertificate = generatePlaceholderCert('client', agentId);
        const clientKey = generatePlaceholderKey();
        // Regenerate HMAC secret on re-enrollment
        const hmacSecret = crypto.randomBytes(32).toString('base64');

        // Update agent document
        // SECURITY: clientKey intentionally NOT stored — only returned to the agent
        // hmacSecret IS stored — dedicated server-side secret for HMAC validation
        const updateData = {
            serverCertificate,
            clientCertificate,
            hmacSecret,
            certificateExpiresAt: certificateExpiresAt.toISOString(),
            status: 'active',
            lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
            reEnrolledAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (hostname) updateData.hostname = hostname;
        if (os) updateData.os = os.toLowerCase();
        if (os_version) updateData.osVersion = os_version;
        if (machine_id) updateData.machineId = machine_id;
        if (agent_version) updateData.version = agent_version;

        await agentDoc.ref.update(updateData);

        // Audit log
        await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
            type: 'agent_re_enrolled',
            agentId,
            reason: reason || 'agent_request',
            hostname: hostname || agentData.hostname,
            ipAddress: req.ip || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info(`Agent ${agentId} re-enrolled successfully`);

        return res.status(200).json({
            agent_id: agentId,
            organization_id: organizationId,
            server_certificate: serverCertificate,
            client_certificate: clientCertificate,
            client_key: clientKey,
            hmac_secret: hmacSecret,
            certificate_expires_at: certificateExpiresAt.toISOString(),
            config: agentData.config || getDefaultAgentConfig(),
        });
    } catch (error) {
        logger.error('Re-enrollment error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Firebase Auth Middleware (for frontend-facing endpoints)
// ============================================================================
async function validateFirebaseAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid authentication token' });
    }
}

// ============================================================================
// QR Code Generation for Enrollment Token
// POST /v1/organizations/:orgId/enrollment-tokens/:tokenId/qr
// ============================================================================
app.post('/v1/organizations/:orgId/enrollment-tokens/:tokenId/qr', validateFirebaseAuth, async (req, res) => {
    try {
        const { orgId, tokenId } = req.params;

        // Verify org membership via token claims
        const callerOrgId = req.user.organizationId || req.user.token?.organizationId;
        if (!callerOrgId || callerOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Validate the token exists and belongs to the organization
        const tokenRef = db
            .collection('organizations')
            .doc(orgId)
            .collection('enrollmentTokens')
            .doc(tokenId);
        const tokenDoc = await tokenRef.get();

        if (!tokenDoc.exists) {
            return res.status(404).json({
                code: 'TOKEN_NOT_FOUND',
                message: 'Enrollment token not found',
            });
        }

        const tokenData = tokenDoc.data();

        // Check if revoked
        if (tokenData.revoked) {
            return res.status(400).json({
                code: 'TOKEN_REVOKED',
                message: 'Token has been revoked',
            });
        }

        // Check expiration
        const expiresAt = tokenData.expiresAt?.toDate?.() || new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
            return res.status(400).json({
                code: 'TOKEN_EXPIRED',
                message: 'Token has expired',
            });
        }

        // Build the QR payload - this is what the agent scans
        const serverUrl = agentServerUrl.value()
            || functionsUrl.value()
            || `https://${process.env.GCLOUD_PROJECT ? 'europe-west1-' + process.env.GCLOUD_PROJECT : 'europe-west1-sentinel-grc-a8701'}.cloudfunctions.net/agentApi`;

        const qrPayload = {
            version: 1,
            server_url: serverUrl,
            enrollment_token: tokenData.token,
            organization_id: orgId,
            expires_at: expiresAt.toISOString(),
        };

        // Return the QR data as JSON (client-side rendering with qrcode library)
        return res.status(200).json({
            qr_data: JSON.stringify(qrPayload),
            qr_payload: qrPayload,
            token_name: tokenData.name || null,
            expires_at: expiresAt.toISOString(),
        });
    } catch (error) {
        logger.error('QR generation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Migration Notification (SECURED)
// POST /v1/agents/:agentId/migrate
// ============================================================================
app.post('/v1/agents/:agentId/migrate', validateAgentAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const agentDoc = req.agentDoc;
        const agentData = req.agentData;
        const organizationId = agentData.organizationId;

        const {
            previous_machine_id,
            new_machine_id,
            hostname,
            os,
            os_version,
            reason,
        } = req.body;

        if (!new_machine_id) {
            return res.status(400).json({
                error: 'new_machine_id is required',
            });
        }

        logger.info(`Migration notification for agent ${agentId}: ${previous_machine_id || 'unknown'} -> ${new_machine_id}`);

        // Update agent with new machine info
        const updateData = {
            machineId: new_machine_id,
            previousMachineId: previous_machine_id || agentData.machineId,
            lastMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active',
            lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (hostname) updateData.hostname = hostname;
        if (os) updateData.os = os.toLowerCase();
        if (os_version) updateData.osVersion = os_version;

        await agentDoc.ref.update(updateData);

        // Audit log
        await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
            type: 'agent_migrated',
            agentId,
            previousMachineId: previous_machine_id || agentData.machineId,
            newMachineId: new_machine_id,
            hostname: hostname || agentData.hostname,
            reason: reason || 'hardware_change',
            ipAddress: req.ip || '',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info(`Agent ${agentId} migration recorded: ${new_machine_id}`);

        return res.status(200).json({
            acknowledged: true,
            agent_id: agentId,
            organization_id: organizationId,
            message: 'Migration recorded successfully',
        });
    } catch (error) {
        logger.error('Migration notification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Health Check
// GET /v1/health
// ============================================================================
app.get('/v1/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// ============================================================================
// Helper Functions
// ============================================================================

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
 * NOTE: In production, replace with proper PKI using Cloud KMS
 */
function generatePlaceholderCert(type, agentId = '') {
    logger.warn('Using self-signed certificates. For production, implement proper PKI with Cloud KMS.');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const certData = {
        version: 3,
        serialNumber: crypto.randomBytes(16).toString('hex'),
        issuer: 'CN=Sentinel GRC Agent CA, O=Sentinel GRC',
        subject: `CN=${agentId || 'agent'}, O=Sentinel GRC, OU=${type}`,
        notBefore: now.toISOString(),
        notAfter: expiresAt.toISOString(),
        publicKey: publicKey,
        signature: crypto.sign('sha256',
            Buffer.from(JSON.stringify({ agentId, type, notBefore: now.toISOString(), notAfter: expiresAt.toISOString() })),
            privateKey
        ).toString('base64')
    };

    return Buffer.from(JSON.stringify(certData)).toString('base64');
}

function generatePlaceholderKey() {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return Buffer.from(privateKey).toString('base64');
}

// Export the Express API as a Cloud Function
exports.agentApi = onRequest(
    {
        region: 'europe-west1',
        memory: '256MiB',
        timeoutSeconds: 60,
    },
    app
);
