/**
 * Agent Results - Handles compliance check result uploads
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Upload compliance check results
 * POST /v1/agents/{agentId}/results
 *
 * Request body:
 * {
 *   check_id: string,
 *   framework: string,
 *   control_id: string,
 *   status: 'pass' | 'fail' | 'error' | 'not_applicable',
 *   evidence: object,
 *   timestamp: string,
 *   duration_ms: number
 * }
 *
 * Response:
 * {
 *   result_id: string,
 *   acknowledged: boolean
 * }
 */
// DISABLED: Standalone onRequest results upload removed - use authenticated version in api.js instead
// exports.uploadResults = onRequest(...);

/**
 * Get agent results (callable from frontend)
 */
exports.getAgentResults = onCall(
  {
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { agentId, organizationId, framework, limit, startAfter } = request.data;
    const safeLimit = Math.min(Number(limit) || 50, 200);

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }

    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.organizationId !== organizationId) {
      throw new HttpsError('permission-denied', 'Access denied to this organization');
    }

    try {
      let query = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .collection('results');

      if (framework) {
        query = query.where('framework', '==', framework);
      }

      query = query.orderBy('createdAt', 'desc').limit(safeLimit);

      if (startAfter) {
        const startDoc = await db
          .collection('organizations')
          .doc(organizationId)
          .collection('agents')
          .doc(agentId)
          .collection('results')
          .doc(startAfter)
          .get();
        if (startDoc.exists) {
          query = query.startAfter(startDoc);
        }
      }

      const snapshot = await query.get();

      const results = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          checkId: data.checkId,
          framework: data.framework,
          controlId: data.controlId,
          status: data.status,
          evidence: data.evidence,
          timestamp: data.agentTimestamp,
          durationMs: data.durationMs,
          createdAt: data.createdAt?.toDate?.().toISOString(),
        };
      });

      return {
        results,
        hasMore: results.length === safeLimit,
        lastId: results.length > 0 ? results[results.length - 1].id : null,
      };
    } catch (error) {
      console.error('Get agent results error:', error);
      throw new HttpsError('internal', 'Failed to get agent results');
    }
  }
);
