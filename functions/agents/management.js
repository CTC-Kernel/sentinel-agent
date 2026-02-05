/**
 * Agent Management - List, delete, and get agent details
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { checkCallableRateLimit } = require('../utils/rateLimiter');

const db = admin.firestore();

// Offline threshold: 3 missed heartbeats (3 minutes with 60s interval)
const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000;

/**
 * List all agents for an organization
 */
exports.listAgents = onCall(
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
    const { status, limit: requestLimit = 50, startAfter } = request.data;
    const limit = Math.min(requestLimit, 200);

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    await checkCallableRateLimit(request, 'standard');

    try {
      let agentsQuery = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents');

      // Apply status filter at query level instead of in-memory
      if (status && status !== 'all') {
        agentsQuery = agentsQuery.where('status', '==', status);
      }

      let query = agentsQuery
        .orderBy('enrolledAt', 'desc')
        .limit(limit);

      if (startAfter) {
        const startDoc = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('agents')
          .doc(startAfter)
          .get();
        if (startDoc.exists) {
          query = query.startAfter(startDoc);
        }
      }

      const snapshot = await query.get();
      const now = Date.now();

      const agents = snapshot.docs.map((doc) => {
        const data = doc.data();
        const lastHeartbeat = data.lastHeartbeat?.toDate?.() || new Date(data.lastHeartbeat || 0);
        const isOnline = now - lastHeartbeat.getTime() < OFFLINE_THRESHOLD_MS;
        const computedStatus = isOnline ? 'active' : 'offline';

        return {
          id: doc.id,
          name: data.name,
          hostname: data.hostname,
          os: data.os,
          osVersion: data.osVersion,
          version: data.version,
          status: computedStatus,
          lastHeartbeat: lastHeartbeat.toISOString(),
          ipAddress: data.ipAddress,
          complianceScore: data.complianceScore,
          lastCheckAt: data.lastCheckAt,
          enrolledAt: data.enrolledAt?.toDate?.().toISOString(),
        };
      });

      return {
        agents,
        hasMore: agents.length === limit,
        lastId: agents.length > 0 ? agents[agents.length - 1].id : null,
      };
    } catch (error) {
      logger.error('List agents error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to list agents');
    }
  }
);

/**
 * Get detailed agent information
 */
exports.getAgentDetails = onCall(
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

    await checkCallableRateLimit(request, 'standard');

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
      const lastHeartbeat = data.lastHeartbeat?.toDate?.() || new Date(data.lastHeartbeat || 0);
      const isOnline = Date.now() - lastHeartbeat.getTime() < OFFLINE_THRESHOLD_MS;

      // Get recent results summary
      const resultsSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .collection('results')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const resultsSummary = {
        total: resultsSnapshot.size,
        pass: 0,
        fail: 0,
        error: 0,
        not_applicable: 0,
      };

      // Collect individual results and deduplicate by checkId (keep latest)
      const latestByCheckId = new Map();
      resultsSnapshot.docs.forEach((doc) => {
        const d = doc.data();
        const status = d.status;
        if (resultsSummary[status] !== undefined) {
          resultsSummary[status]++;
        }
        // Keep only the latest result per checkId
        const checkId = d.checkId;
        if (checkId && !latestByCheckId.has(checkId)) {
          latestByCheckId.set(checkId, {
            id: doc.id,
            checkId,
            status: d.status,
            framework: d.framework || null,
            controlId: d.controlId || null,
            evidence: d.evidence || d.raw_data || {},
            score: d.score ?? null,
            durationMs: d.durationMs || 0,
            timestamp: d.agentTimestamp || d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        }
      });
      const checkResults = Array.from(latestByCheckId.values());

      // Get pending commands count
      const commandsSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .collection('commands')
        .where('status', '==', 'pending')
        .get();

      return {
        id: agentDoc.id,
        name: data.name,
        hostname: data.hostname,
        os: data.os,
        osVersion: data.osVersion,
        version: data.version,
        machineId: data.machineId,
        status: isOnline ? 'active' : 'offline',
        lastHeartbeat: lastHeartbeat.toISOString(),
        ipAddress: data.ipAddress,
        cpuPercent: data.cpuPercent,
        memoryBytes: data.memoryBytes,
        memoryPercent: data.memoryPercent,
        memoryTotalBytes: data.memoryTotalBytes,
        diskPercent: data.diskPercent,
        diskUsedBytes: data.diskUsedBytes,
        diskTotalBytes: data.diskTotalBytes,
        uptimeSeconds: data.uptimeSeconds,
        complianceScore: data.complianceScore,
        lastCheckAt: data.lastCheckAt,
        enrolledAt: data.enrolledAt?.toDate?.().toISOString(),
        enrolledWithToken: data.enrolledWithToken,
        config: data.config,
        configVersion: data.configVersion,
        rulesVersion: data.rulesVersion,
        selfCheckResult: data.selfCheckResult,
        resultsSummary,
        checkResults,
        pendingCommandsCount: commandsSnapshot.size,
      };
    } catch (error) {
      logger.error('Get agent details error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to get agent details');
    }
  }
);

/**
 * Get latest compliance results for all agents in an organization (batch)
 * Used by the compliance heatmap
 */
exports.getAgentComplianceResults = onCall(
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
    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    await checkCallableRateLimit(request, 'standard');

    try {
      if (!['admin', 'rssi'].includes(request.auth.token.role)) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Get all agents (limited to prevent unbounded reads)
      const agentsSnapshot = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .limit(500)
        .get();

      // For each agent, get latest results (in parallel, batched in chunks of 10)
      const resultsByAgent = {};
      const agentDocs = agentsSnapshot.docs;
      const CHUNK_SIZE = 10;

      for (let i = 0; i < agentDocs.length; i += CHUNK_SIZE) {
        const chunk = agentDocs.slice(i, i + CHUNK_SIZE);
        const promises = chunk.map(async (agentDocItem) => {
          const resultsSnapshot = await db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentDocItem.id)
            .collection('results')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

          // Deduplicate by checkId (keep latest)
          const latestByCheck = new Map();
          resultsSnapshot.docs.forEach((doc) => {
            const d = doc.data();
            const checkId = d.checkId;
            if (checkId && !latestByCheck.has(checkId)) {
              latestByCheck.set(checkId, {
                id: doc.id,
                checkId,
                status: d.status,
                framework: d.framework || null,
                controlId: d.controlId || null,
                timestamp: d.agentTimestamp || d.createdAt?.toDate?.()?.toISOString() || null,
              });
            }
          });

          resultsByAgent[agentDocItem.id] = Array.from(latestByCheck.values());
        });

        await Promise.all(promises);
      }

      return { resultsByAgent };
    } catch (error) {
      logger.error('Get compliance results error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to get compliance results');
    }
  }
);

/**
 * Delete an agent
 */
exports.deleteAgent = onCall(
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
    const { agentId, deleteResults = false } = request.data;

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }

    await checkCallableRateLimit(request, 'admin');

    try {
      if (!request.auth.token.role || !['admin', 'manager'].includes(request.auth.token.role)) {
        throw new HttpsError('permission-denied', 'Insufficient permissions');
      }

      const agentRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId);

      const agentDoc = await agentRef.get();
      if (!agentDoc.exists) {
        throw new HttpsError('not-found', 'Agent not found');
      }

      const agentData = agentDoc.data();

      // Delete subcollections if requested (in batches to stay under 500 limit)
      if (deleteResults) {
        const subcollections = ['results', 'logs', 'diagnostics', 'networkSnapshots', 'metrics_history', 'commands'];
        for (const subcol of subcollections) {
          await deleteSubcollection(agentRef, subcol);
        }
      }

      // Delete the agent document
      await agentRef.delete();

      // Log deletion
      await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
        type: 'agent_deleted',
        agentId,
        agentName: agentData.name,
        hostname: agentData.hostname,
        userId: auth.uid,
        deleteResults,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      logger.error('Delete agent error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to delete agent');
    }
  }
);

/**
 * Helper: Delete a subcollection in batches of 500
 */
async function deleteSubcollection(parentRef, subcollectionName) {
  let snapshot = await parentRef.collection(subcollectionName).limit(500).get();
  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    snapshot = await parentRef.collection(subcollectionName).limit(500).get();
  }
}
