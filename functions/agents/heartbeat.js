/**
 * Agent Heartbeat - Handles agent health monitoring and status updates
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
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
// DISABLED: Standalone onRequest heartbeat removed - use authenticated version in api.js instead
// exports.agentHeartbeat = onRequest(...);

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

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { agentId } = request.data;

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }


    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
      throw new HttpsError('permission-denied', 'Access denied to this organization');
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
      logger.error('Get agent status error:', error);
      throw new HttpsError('internal', 'Failed to get agent status');
    }
  }
);

/**
 * Get agent metrics history (callable from frontend)
 * Returns last 24h of metrics for charts
 */
exports.getAgentMetricsHistory = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // SECURITY (C5): Only trust organizationId from auth token, never from request data
    const organizationId = request.auth?.token?.organizationId;
    const { agentId, hours } = request.data;
    const safeHours = Math.min(Number(hours) || 24, 168);

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }


    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
      throw new HttpsError('permission-denied', 'Access denied to this organization');
    }

    try {
      const cutoffTime = new Date(Date.now() - safeHours * 60 * 60 * 1000);

      const metricsSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .collection('metrics_history')
        .where('timestamp', '>=', cutoffTime)
        .orderBy('timestamp', 'asc')
        .limit(1440) // Max 24h at 1min interval
        .get();

      const metrics = metricsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          timestamp: data.timestamp?.toDate?.().toISOString() || new Date().toISOString(),
          cpuPercent: data.cpuPercent || 0,
          memoryPercent: data.memoryPercent || 0,
          memoryBytes: data.memoryBytes || 0,
          diskPercent: data.diskPercent || null,
        };
      });

      return {
        agentId,
        metrics,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Get agent metrics history error:', error);
      throw new HttpsError('internal', 'Failed to get agent metrics history');
    }
  }
);
