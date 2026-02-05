/**
 * Agent Configuration - Handles agent config distribution and updates
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { checkCallableRateLimit } = require('../utils/rateLimiter');

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

    const { agentId, config } = request.data;
    const organizationId = request.auth.token.organizationId;

    if (!agentId || !organizationId || !config) {
      throw new HttpsError('invalid-argument', 'agentId, organizationId, and config are required');
    }

    await checkCallableRateLimit(request, 'admin');

    if (!['admin', 'rssi'].includes(request.auth.token.role)) {
      throw new HttpsError('permission-denied', 'Admin or RSSI role required');
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

      // Value type and range validation
      const fieldValidators = {
        check_interval_secs: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 60 && v <= 86400,
        heartbeat_interval_secs: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 10 && v <= 3600,
        log_level: (v) => typeof v === 'string' && ['error', 'warn', 'info', 'debug', 'trace'].includes(v),
        enabled_checks: (v) => Array.isArray(v) && v.every(item => typeof item === 'string' && item.length <= 100),
        offline_mode_days: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 365,
      };

      const sanitizedConfig = {};
      for (const key of allowedFields) {
        if (config[key] !== undefined) {
          const validator = fieldValidators[key];
          if (validator && !validator(config[key])) {
            throw new HttpsError('invalid-argument', `Invalid value for ${key}`);
          }
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
      logger.error('Update agent config error:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Failed to update agent config');
    }
  }
);
