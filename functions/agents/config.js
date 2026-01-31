/**
 * Agent Configuration - Handles agent config distribution and updates
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Get agent configuration
 * GET /v1/agents/{agentId}/config
 *
 * Response:
 * {
 *   config_version: number,
 *   check_interval_secs: number,
 *   heartbeat_interval_secs: number,
 *   log_level: string,
 *   enabled_checks: string[],
 *   offline_mode_days: number,
 *   rules: object[]
 * }
 */
// DISABLED: Standalone onRequest config removed - use authenticated version in api.js instead
// exports.getAgentConfig = onRequest(...);

/**
 * Update agent configuration (callable from frontend)
 */
exports.updateAgentConfig = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { agentId, organizationId, config } = request.data;

    if (!agentId || !organizationId || !config) {
      throw new HttpsError('invalid-argument', 'agentId, organizationId, and config are required');
    }

    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
      throw new HttpsError('permission-denied', 'Access denied to this organization');
    }

    try {
      const agentRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId);

      const agentDoc = await agentRef.get();
      if (!agentDoc.exists) {
        throw new HttpsError('not-found', 'Agent not found');
      }

      // Validate config fields
      const allowedFields = [
        'check_interval_secs',
        'heartbeat_interval_secs',
        'log_level',
        'enabled_checks',
        'offline_mode_days',
      ];

      const sanitizedConfig = {};
      for (const key of allowedFields) {
        if (config[key] !== undefined) {
          sanitizedConfig[key] = config[key];
        }
      }

      // Update agent config
      await agentRef.update({
        config: sanitizedConfig,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Increment org config version to trigger agent refresh
      await db.collection('organizations').doc(organizationId).update({
        agentConfigVersion: admin.firestore.FieldValue.increment(1),
      });

      // Log config change
      await db.collection('organizations').doc(organizationId).collection('auditLogs').add({
        type: 'agent_config_updated',
        agentId,
        userId: auth.uid,
        changes: Object.keys(sanitizedConfig),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Update agent config error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to update agent config');
    }
  }
);
