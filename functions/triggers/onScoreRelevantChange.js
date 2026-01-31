/**
 * Firestore Triggers for Compliance Score Recalculation
 * Implements ADR-003: Score de Conformité Global
 *
 * Triggers score recalculation when relevant entities change:
 * - Risks
 * - Controls
 * - Documents
 * - Audits
 *
 * Uses debouncing to avoid excessive recalculations
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

// Debounce delay in milliseconds (5 seconds)
const DEBOUNCE_DELAY_MS = 5000;

/**
 * Queue a score recalculation for an organization
 * Uses Firestore to track pending calculations and implements debouncing
 *
 * @param {string} organizationId - The organization to recalculate score for
 * @param {string} source - The source of the change (risks, controls, documents, audits)
 */
async function queueScoreRecalculation(organizationId, source) {
  if (!organizationId) {
    logger.warn('queueScoreRecalculation: No organizationId provided');
    return;
  }

  const db = admin.firestore();
  const pendingRef = db.collection('_score_recalc_queue').doc(organizationId);

  try {
    const now = Date.now();

    // Use a transaction to safely update the pending queue
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(pendingRef);

      if (doc.exists) {
        const data = doc.data();
        const lastQueued = data.queuedAt?.toMillis() || 0;

        // If already queued recently, just update the sources
        if (now - lastQueued < DEBOUNCE_DELAY_MS) {
          const sources = new Set(data.sources || []);
          sources.add(source);
          transaction.update(pendingRef, {
            sources: Array.from(sources),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          logger.debug(`Score recalc already queued for ${organizationId}, added source: ${source}`);
          return;
        }
      }

      // Queue a new recalculation
      transaction.set(pendingRef, {
        organizationId,
        sources: [source],
        queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
      });
    });

    logger.info(`Score recalculation queued for ${organizationId} from ${source}`);

    // Execute recalculation immediately if this is a fresh queue entry
    // The debouncing is handled by the queue document's timestamp check
    // Note: For production, consider using Cloud Tasks for better reliability
    await executeQueuedRecalculation(organizationId);

  } catch (error) {
    logger.error(`Error queueing score recalculation for ${organizationId}:`, error);
  }
}

/**
 * Execute the queued recalculation if it's still pending
 */
async function executeQueuedRecalculation(organizationId) {
  const db = admin.firestore();
  const pendingRef = db.collection('_score_recalc_queue').doc(organizationId);

  try {
    const doc = await pendingRef.get();
    if (!doc.exists || doc.data().status !== 'pending') {
      return; // Already processed or not found
    }

    // Mark as processing
    await pendingRef.update({
      status: 'processing',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Calculate the score using exported helper functions
    const calculateModule = require('../callable/calculateComplianceScore');

    // Perform the calculation
    const controlsResult = await calculateModule.calculateControlsScore(db, organizationId);
    const risksResult = await calculateModule.calculateRisksScore(db, organizationId);
    const documentsResult = await calculateModule.calculateDocumentsScore(db, organizationId);
    const auditsResult = await calculateModule.calculateAuditsScore(db, organizationId);

    const weights = calculateModule.DEFAULT_WEIGHTS;

    // Training score: use calculateTrainingScore if available, default to 0
    const trainingResult = typeof calculateModule.calculateTrainingScore === 'function'
      ? await calculateModule.calculateTrainingScore(db, organizationId)
      : { score: 0, completed: 0, total: 0 };

    const breakdown = {
      controls: { score: controlsResult.score, weight: weights.controls },
      risks: { score: risksResult.score, weight: weights.risks },
      documents: { score: documentsResult.score, weight: weights.documents },
      audits: { score: auditsResult.score, weight: weights.audits },
      training: { score: trainingResult.score, weight: weights.training || 0.10 },
    };

    // Calculate weighted sum and normalize by the sum of weights actually used
    const weightedSum =
      breakdown.controls.score * breakdown.controls.weight +
      breakdown.risks.score * breakdown.risks.weight +
      breakdown.documents.score * breakdown.documents.weight +
      breakdown.audits.score * breakdown.audits.weight +
      breakdown.training.score * breakdown.training.weight;
    const totalWeight =
      breakdown.controls.weight +
      breakdown.risks.weight +
      breakdown.documents.weight +
      breakdown.audits.weight +
      breakdown.training.weight;
    const globalScore = Math.round((weightedSum / totalWeight) * 100) / 100;

    // Calculate trend and per-framework scores in parallel
    const [trend, byFramework] = await Promise.all([
      calculateModule.calculateTrend(db, organizationId, globalScore),
      typeof calculateModule.calculateFrameworkScores === 'function'
        ? calculateModule.calculateFrameworkScores(db, organizationId)
        : Promise.resolve({ iso27001: globalScore, nis2: globalScore, dora: globalScore, rgpd: globalScore }),
    ]);

    // Save the score
    const scoreDoc = {
      global: globalScore,
      byFramework,
      trend,
      lastCalculated: admin.firestore.FieldValue.serverTimestamp(),
      breakdown,
      calculationDetails: {
        totalRisks: risksResult.total,
        criticalRisks: risksResult.critical,
        implementedControls: controlsResult.implemented,
        actionableControls: controlsResult.actionable,
        validDocuments: documentsResult.valid,
        totalDocuments: documentsResult.total,
        compliantFindings: auditsResult.compliant,
        totalFindings: auditsResult.total,
        completedTraining: trainingResult.completed,
        totalTraining: trainingResult.total,
      },
    };

    await db.collection('organizations')
      .doc(organizationId)
      .collection('complianceScores')
      .doc('current')
      .set(scoreDoc, { merge: true });

    // Mark as completed
    await pendingRef.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      score: globalScore,
    });

    logger.info(`Score recalculation completed for ${organizationId}: ${globalScore}`);

  } catch (error) {
    logger.error(`Error executing score recalculation for ${organizationId}:`, error);

    // Mark as failed
    await pendingRef.update({
      status: 'failed',
      error: error.message,
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { });
  }
}

/**
 * Trigger: Risks collection changes
 */
const onRisksChange = onDocumentWritten({
  document: 'risks/{riskId}',
  region: 'europe-west1',
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();

  // If deleted or new, always recalculate
  if (!before || !after) {
    const data = after || before;
    if (data?.organizationId) await queueScoreRecalculation(data.organizationId, 'risks');
    return;
  }

  // Optimize: only recalculate if core fields changed
  const coreFields = ['score', 'residualScore', 'status', 'strategy', 'mitigationControlIds'];
  const hasChanged = coreFields.some(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]));

  if (hasChanged && after.organizationId) {
    await queueScoreRecalculation(after.organizationId, 'risks');
  }
});

/**
 * Trigger: Controls collection changes
 */
const onControlsChange = onDocumentWritten({
  document: 'controls/{controlId}',
  region: 'europe-west1',
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();

  if (!before || !after) {
    const data = after || before;
    if (data?.organizationId) await queueScoreRecalculation(data.organizationId, 'controls');
    return;
  }

  const coreFields = ['effectiveness', 'maturity', 'score', 'status'];
  const hasChanged = coreFields.some(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]));

  if (hasChanged && after.organizationId) {
    await queueScoreRecalculation(after.organizationId, 'controls');
  }
});

/**
 * Trigger: Documents collection changes
 */
const onDocumentsChange = onDocumentWritten({
  document: 'documents/{documentId}',
  region: 'europe-west1',
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();

  if (!before || !after) {
    const data = after || before;
    if (data?.organizationId) await queueScoreRecalculation(data.organizationId, 'documents');
    return;
  }

  const coreFields = ['status', 'validUntil'];
  const hasChanged = coreFields.some(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]));

  if (hasChanged && after.organizationId) {
    await queueScoreRecalculation(after.organizationId, 'documents');
  }
});

/**
 * Trigger: Audits collection changes
 */
const onAuditsChange = onDocumentWritten({
  document: 'audits/{auditId}',
  region: 'europe-west1',
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();

  if (!before || !after) {
    const data = after || before;
    if (data?.organizationId) await queueScoreRecalculation(data.organizationId, 'audits');
    return;
  }

  const coreFields = ['overallResult', 'status'];
  const hasChanged = coreFields.some(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]));

  if (hasChanged && after.organizationId) {
    await queueScoreRecalculation(after.organizationId, 'audits');
  }
});

module.exports = {
  onRisksChange,
  onControlsChange,
  onDocumentsChange,
  onAuditsChange,
  // Export for testing
  queueScoreRecalculation,
  executeQueuedRecalculation,
  DEBOUNCE_DELAY_MS,
};
