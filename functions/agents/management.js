/**
 * Agent Management - List, delete, and get agent details
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

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

    const { organizationId, status, limit = 50, startAfter } = request.data;

    if (!organizationId) {
      throw new HttpsError('invalid-argument', 'organizationId is required');
    }

    try {
      // Verify user has access
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('permission-denied', 'User not found');
      }

      const userData = userDoc.data();
      if (userData.organizationId !== organizationId && !userData.isAdmin) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
      }

      let query = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
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

      // Filter by status if requested
      const filteredAgents = status
        ? agents.filter((a) => a.status === status)
        : agents;

      return {
        agents: filteredAgents,
        hasMore: agents.length === limit,
        lastId: agents.length > 0 ? agents[agents.length - 1].id : null,
      };
    } catch (error) {
      console.error('List agents error:', error);
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

    const { agentId, organizationId } = request.data;

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }

    try {
      // Verify user has access
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('permission-denied', 'User not found');
      }

      const userData = userDoc.data();
      if (userData.organizationId !== organizationId && !userData.isAdmin) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
      }

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

      resultsSnapshot.docs.forEach((doc) => {
        const status = doc.data().status;
        if (resultsSummary[status] !== undefined) {
          resultsSummary[status]++;
        }
      });

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
        complianceScore: data.complianceScore,
        lastCheckAt: data.lastCheckAt,
        enrolledAt: data.enrolledAt?.toDate?.().toISOString(),
        enrolledWithToken: data.enrolledWithToken,
        config: data.config,
        configVersion: data.configVersion,
        rulesVersion: data.rulesVersion,
        selfCheckResult: data.selfCheckResult,
        resultsSummary,
        pendingCommandsCount: commandsSnapshot.size,
      };
    } catch (error) {
      console.error('Get agent details error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to get agent details');
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

    const { agentId, organizationId, deleteResults = false } = request.data;

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }

    try {
      // Verify user has access
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError('permission-denied', 'User not found');
      }

      const userData = userDoc.data();
      if (userData.organizationId !== organizationId && !userData.isAdmin) {
        throw new HttpsError('permission-denied', 'Access denied to this organization');
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

      // Delete subcollections if requested
      if (deleteResults) {
        // Delete results
        const resultsSnapshot = await agentRef.collection('results').get();
        const batch1 = db.batch();
        resultsSnapshot.docs.forEach((doc) => batch1.delete(doc.ref));
        if (!resultsSnapshot.empty) await batch1.commit();

        // Delete commands
        const commandsSnapshot = await agentRef.collection('commands').get();
        const batch2 = db.batch();
        commandsSnapshot.docs.forEach((doc) => batch2.delete(doc.ref));
        if (!commandsSnapshot.empty) await batch2.commit();
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
      console.error('Delete agent error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to delete agent');
    }
  }
);
