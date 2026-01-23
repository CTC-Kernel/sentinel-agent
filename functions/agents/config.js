/**
 * Agent Configuration - Handles agent config distribution and updates
 */

const { onRequest } = require('firebase-functions/v2/https');
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
exports.getAgentConfig = onRequest(
  {
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 15,
    cors: true,
  },
  async (req, res) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Extract agent ID from path: /v1/agents/{agentId}/config
      const pathParts = req.path.split('/');
      const agentIdIndex = pathParts.indexOf('agents') + 1;
      const agentId = pathParts[agentIdIndex];

      if (!agentId || agentId === 'config') {
        return res.status(400).json({ error: 'Agent ID is required in path' });
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
      console.error('Get config error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

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
