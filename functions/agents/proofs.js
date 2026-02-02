/**
 * Agent Proofs Upload API
 *
 * Handles evidence/proofs uploaded from Sentinel agents.
 * Links proofs to specific compliance checks/results.
 */

const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Handle proof upload from agent.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {string} agentId - Agent ID from route params
 * @param {Object} agentDoc - Agent Firestore document reference
 * @param {Object} agentData - Agent document data
 */
async function uploadProof(req, res, agentId, agentDoc, agentData) {
    try {
        const {
            proof_type,
            content,
            content_type,
            check_id,
            result_id,
            timestamp,
            metadata
        } = req.body;

        // Validate required fields
        if (!proof_type || !content || !check_id) {
            return res.status(400).json({
                error: 'Missing required fields: proof_type, content, check_id',
            });
        }

        // Validate content size (sanity check, though express limit catches 1MB)
        // Content is expected to be Base64 encoded string
        if (content.length > 1024 * 1024 * 5) { // 5MB limit check (though API might limit eariler)
            return res.status(400).json({ error: 'Proof content too large (max 5MB)' });
        }

        const organizationId = agentData.organizationId;
        const proofsCollection = db
            .collection('organizations')
            .doc(organizationId)
            .collection('agents')
            .doc(agentId)
            .collection('proofs');

        // Create proof document
        const proofRef = proofsCollection.doc();
        const proofData = {
            id: proofRef.id,
            organizationId,
            agentId,
            checkId: check_id,
            resultId: result_id || null, // Optional link to specific result
            type: proof_type, // e.g., 'log_output', 'screenshot', 'config_file'
            contentType: content_type || 'text/plain',
            content: content, // Base64 or text content
            metadata: metadata || {},
            timestamp: timestamp || new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'agent',
            hostname: agentData.hostname
        };

        await proofRef.set(proofData);

        // If result_id is provided, try to link it back to the result document
        if (result_id) {
            const resultRef = db
                .collection('organizations')
                .doc(organizationId)
                .collection('agents')
                .doc(agentId)
                .collection('results')
                .doc(result_id);

            // We blindly update, if result doesn't exist it might fail or create a partial doc if we used set with merge
            // But usually result should exist. We'll verify existence to be safe or just log.
            // For resilience: update if exists, ignore if not.
            try {
                await resultRef.update({
                    hasProof: true,
                    proofId: proofRef.id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                logger.warn(`Failed to link proof ${proofRef.id} to result ${result_id}: ${e.message}`);
                // Not fatal
            }
        }

        logger.info(`Agent ${agentId} uploaded proof ${proofRef.id} for check ${check_id}`);

        return res.status(201).json({
            success: true,
            proof_id: proofRef.id,
            message: 'Proof uploaded successfully'
        });

    } catch (error) {
        logger.error('Upload proof error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    uploadProof
};
