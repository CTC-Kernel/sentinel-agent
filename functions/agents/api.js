/**
 * Agent API - Express router for agent endpoints
 *
 * These endpoints are called by the Sentinel agent, not the web frontend.
 * Authentication is via client certificates or agent ID validation.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const db = admin.firestore();

// Express app for agent API
const app = express();

// CORS - Allow agent requests (no browser origin)
app.use(cors({
    origin: true, // Agents don't have browser origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-ID', 'X-Agent-Certificate'],
}));

app.use(express.json({ limit: '1mb' }));

// Offline threshold: 3 missed heartbeats (3 minutes with 60s interval)
const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000;

// ============================================================================
// Agent Enrollment
// POST /v1/agents/enroll
// ============================================================================
app.post('/v1/agents/enroll', async (req, res) => {
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
        const { v4: uuidv4 } = require('uuid');
        const agentId = uuidv4();

        // Generate certificates (simplified - in production use proper PKI)
        const certificateExpiresAt = new Date();
        certificateExpiresAt.setFullYear(certificateExpiresAt.getFullYear() + 1);

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

        logger.info(`Agent enrolled: ${agentId} for org ${organizationId}`);

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
        logger.error('Enrollment error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================================
// Agent Heartbeat
// POST /v1/agents/:agentId/heartbeat
// ============================================================================
app.post('/v1/agents/:agentId/heartbeat', async (req, res) => {
    try {
        const { agentId } = req.params;

        if (!agentId) {
            return res.status(400).json({ error: 'Agent ID is required' });
        }

        const {
            timestamp,
            agent_version,
            status,
            hostname,
            os_info,
            cpu_percent,
            memory_bytes,
            last_check_at,
            compliance_score,
            pending_sync_count,
            self_check_result,
        } = req.body;

        // Find agent across all organizations
        const agentQuery = await db
            .collectionGroup('agents')
            .where('id', '==', agentId)
            .limit(1)
            .get();

        if (agentQuery.empty) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const agentDoc = agentQuery.docs[0];
        const agentData = agentDoc.data();
        const organizationId = agentData.organizationId;

        // Prepare update data
        const updateData = {
            lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active',
            version: agent_version || agentData.version,
            hostname: hostname || agentData.hostname,
            osInfo: os_info || agentData.osInfo,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || agentData.ipAddress,
        };

        // Add optional metrics
        if (typeof cpu_percent === 'number') {
            updateData.cpuPercent = cpu_percent;
        }
        if (typeof memory_bytes === 'number') {
            updateData.memoryBytes = memory_bytes;
        }
        if (last_check_at) {
            updateData.lastCheckAt = last_check_at;
        }
        if (typeof compliance_score === 'number') {
            updateData.complianceScore = compliance_score;
        }
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
        for (const cmdDoc of commandsSnapshot.docs) {
            const cmd = cmdDoc.data();
            commands.push({
                id: cmdDoc.id,
                type: cmd.type,
                payload: cmd.payload || {},
            });
            // Mark as delivered
            await cmdDoc.ref.update({
                status: 'delivered',
                deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
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
// Agent Config
// GET /v1/agents/:agentId/config
// ============================================================================
app.get('/v1/agents/:agentId/config', async (req, res) => {
    try {
        const { agentId } = req.params;

        if (!agentId) {
            return res.status(400).json({ error: 'Agent ID is required' });
        }

        // Find agent across all organizations
        const agentQuery = await db
            .collectionGroup('agents')
            .where('id', '==', agentId)
            .limit(1)
            .get();

        if (agentQuery.empty) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const agentDoc = agentQuery.docs[0];
        const agentData = agentDoc.data();
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
// Agent Results Upload
// POST /v1/agents/:agentId/results
// ============================================================================
app.post('/v1/agents/:agentId/results', async (req, res) => {
    try {
        const { agentId } = req.params;

        if (!agentId) {
            return res.status(400).json({ error: 'Agent ID is required' });
        }

        const {
            check_id,
            framework,
            control_id,
            status,
            evidence,
            timestamp,
            duration_ms,
        } = req.body;

        // Validate required fields
        if (!check_id || !framework || !control_id || !status) {
            return res.status(400).json({
                error: 'check_id, framework, control_id, and status are required',
            });
        }

        // Validate status
        const validStatuses = ['pass', 'fail', 'error', 'not_applicable'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: `status must be one of: ${validStatuses.join(', ')}`,
            });
        }

        // Find agent across all organizations
        const agentQuery = await db
            .collectionGroup('agents')
            .where('id', '==', agentId)
            .limit(1)
            .get();

        if (agentQuery.empty) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const agentDoc = agentQuery.docs[0];
        const agentData = agentDoc.data();
        const organizationId = agentData.organizationId;

        // Create result document
        const resultData = {
            agentId,
            checkId: check_id,
            framework,
            controlId: control_id,
            status,
            evidence: evidence || {},
            agentTimestamp: timestamp || new Date().toISOString(),
            durationMs: duration_ms || 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            hostname: agentData.hostname,
            machineId: agentData.machineId,
        };

        const resultRef = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .collection('results')
            .add(resultData);

        // Update agent's last check timestamp
        await agentDoc.ref.update({
            lastCheckAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(201).json({
            result_id: resultRef.id,
            acknowledged: true,
        });
    } catch (error) {
        logger.error('Upload results error:', error);
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

function generatePlaceholderCert(type, agentId = '') {
    const now = new Date().toISOString();
    return Buffer.from(
        JSON.stringify({
            type,
            agentId,
            issuedAt: now,
            placeholder: true,
        })
    ).toString('base64');
}

function generatePlaceholderKey() {
    return Buffer.from(
        JSON.stringify({
            type: 'placeholder_key',
            generated: new Date().toISOString(),
        })
    ).toString('base64');
}

// Export the Express API as a Cloud Function
exports.agentApi = onRequest(
    {
        region: 'europe-west1',
        memory: '256MiB',
        timeoutSeconds: 60,
        cors: true,
    },
    app
);
