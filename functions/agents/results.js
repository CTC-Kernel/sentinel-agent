/**
 * Agent Results - Handles compliance check result uploads
 */

const { onRequest } = require('firebase-functions/v2/https');
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
exports.uploadResults = onRequest(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Extract agent ID from path: /v1/agents/{agentId}/results
      const pathParts = req.path.split('/');
      const agentIdIndex = pathParts.indexOf('agents') + 1;
      const agentId = pathParts[agentIdIndex];

      if (!agentId || agentId === 'results') {
        return res.status(400).json({ error: 'Agent ID is required in path' });
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

      // Update agent's last check timestamp and compliance score
      const updateData = {
        lastCheckAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Calculate compliance score based on recent results
      const recentResults = await db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .collection('results')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      if (!recentResults.empty) {
        let passCount = 0;
        let totalCount = 0;

        recentResults.docs.forEach((doc) => {
          const data = doc.data();
          if (data.status !== 'not_applicable') {
            totalCount++;
            if (data.status === 'pass') {
              passCount++;
            }
          }
        });

        if (totalCount > 0) {
          updateData.complianceScore = Math.round((passCount / totalCount) * 100);
        }
      }

      await agentDoc.ref.update(updateData);

      return res.status(201).json({
        result_id: resultRef.id,
        acknowledged: true,
      });
    } catch (error) {
      console.error('Upload results error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

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

    const { agentId, organizationId, framework, limit = 50, startAfter } = request.data;

    if (!agentId || !organizationId) {
      throw new HttpsError('invalid-argument', 'agentId and organizationId are required');
    }

    try {
      let query = db
        .collection('organizations')
        .doc(organizationId)
        .collection('agents')
        .doc(agentId)
        .collection('results')
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (framework) {
        query = query.where('framework', '==', framework);
      }

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
        hasMore: results.length === limit,
        lastId: results.length > 0 ? results[results.length - 1].id : null,
      };
    } catch (error) {
      console.error('Get agent results error:', error);
      throw new HttpsError('internal', 'Failed to get agent results');
    }
  }
);
