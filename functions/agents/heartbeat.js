/**
 * Agent Heartbeat - Handles agent health monitoring and status updates
 */

const { onRequest } = require('firebase-functions/v2/https');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

// Offline threshold: 3 missed heartbeats (3 minutes with 60s interval)
const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000;

/**
 * Receive agent heartbeat
 * POST /v1/agents/{agentId}/heartbeat
 *
 * Request body:
 * {
 *   timestamp: string,
 *   agent_version: string,
 *   status: 'online' | 'offline',
 *   hostname: string,
 *   os_info: string,
 *   cpu_percent: number,
 *   memory_bytes: number,
 *   last_check_at: string | null,
 *   compliance_score: number | null,
 *   pending_sync_count: number,
 *   self_check_result: object | null
 * }
 *
 * Response:
 * {
 *   acknowledged: boolean,
 *   server_time: string,
 *   commands: array,
 *   config_changed: boolean,
 *   rules_changed: boolean
 * }
 */
exports.agentHeartbeat = onRequest(
  {
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 15,
    cors: true,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Extract agent ID from path: /v1/agents/{agentId}/heartbeat
      const pathParts = req.path.split('/');
      const agentIdIndex = pathParts.indexOf('agents') + 1;
      const agentId = pathParts[agentIdIndex];

      if (!agentId || agentId === 'heartbeat') {
        return res.status(400).json({ error: 'Agent ID is required in path' });
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
      console.error('Heartbeat error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Get agent status (callable from frontend)
 */
exports.getAgentStatus = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { agentId, organizationId } = request.data;

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }

    try {
      const agentDoc = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .get();

      if (!agentDoc.exists) {
        throw new HttpsError('not-found', 'Agent not found');
      }

      const data = agentDoc.data();
      const lastHeartbeat = data.lastHeartbeat?.toDate?.() || new Date(data.lastHeartbeat);
      const isOnline = Date.now() - lastHeartbeat.getTime() < OFFLINE_THRESHOLD_MS;

      return {
        id: agentDoc.id,
        name: data.name,
        hostname: data.hostname,
        os: data.os,
        version: data.version,
        status: isOnline ? 'active' : 'offline',
        lastHeartbeat: lastHeartbeat.toISOString(),
        ipAddress: data.ipAddress,
        cpuPercent: data.cpuPercent,
        memoryBytes: data.memoryBytes,
        complianceScore: data.complianceScore,
        lastCheckAt: data.lastCheckAt,
        enrolledAt: data.enrolledAt?.toDate?.().toISOString(),
      };
    } catch (error) {
      console.error('Get agent status error:', error);
      throw new HttpsError('internal', 'Failed to get agent status');
    }
  }
);
