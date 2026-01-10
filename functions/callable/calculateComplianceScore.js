/**
 * Cloud Function: Calculate Compliance Score
 * Implements ADR-003: Score de Conformité Global (Apple Health Style)
 *
 * Calculates a weighted compliance score based on:
 * - Controls (40%): % of implemented vs actionable
 * - Risks (30%): Inverse of critical risk ratio
 * - Audits (20%): % of compliant findings
 * - Documents (10%): % of valid (not expired, not draft) documents
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

// Default weights for score calculation
const DEFAULT_WEIGHTS = {
  controls: 0.40,
  risks: 0.30,
  audits: 0.20,
  documents: 0.10,
};

// Trend threshold percentage
const TREND_THRESHOLD = 5;

/**
 * Calculate controls score
 * Formula: (implementedControls / actionableControls) * 100
 */
async function calculateControlsScore(db, organizationId) {
  const controlsRef = db.collection('controls');

  const [implementedSnap, actionableSnap] = await Promise.all([
    controlsRef
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'Implémenté')
      .count()
      .get(),
    controlsRef
      .where('organizationId', '==', organizationId)
      .where('status', 'in', ['Implémenté', 'En cours', 'Planifié', 'Non Applicable'])
      .count()
      .get(),
  ]);

  const implemented = implementedSnap.data().count;
  const actionable = actionableSnap.data().count;

  if (actionable === 0) {
    return { score: 100, implemented, actionable };
  }

  return {
    score: Math.round((implemented / actionable) * 100 * 100) / 100,
    implemented,
    actionable,
  };
}

/**
 * Calculate risks score
 * Formula: (1 - (criticalRisks / totalRisks)) * 100
 */
async function calculateRisksScore(db, organizationId) {
  const risksRef = db.collection('risks');

  const [totalSnap, criticalSnap] = await Promise.all([
    risksRef
      .where('organizationId', '==', organizationId)
      .count()
      .get(),
    risksRef
      .where('organizationId', '==', organizationId)
      .where('score', '>=', 15) // Critical risks have score >= 15
      .count()
      .get(),
  ]);

  const total = totalSnap.data().count;
  const critical = criticalSnap.data().count;

  if (total === 0) {
    return { score: 100, total, critical };
  }

  return {
    score: Math.round((1 - (critical / total)) * 100 * 100) / 100,
    total,
    critical,
  };
}

/**
 * Calculate documents score
 * Formula: (validDocs / totalDocs) * 100
 * Valid = not expired and not draft
 */
async function calculateDocumentsScore(db, organizationId) {
  const docsRef = db.collection('documents');
  const now = new Date().toISOString();

  // Total documents
  const totalSnap = await docsRef
    .where('organizationId', '==', organizationId)
    .count()
    .get();

  const total = totalSnap.data().count;

  if (total === 0) {
    return { score: 100, total, valid: 0 };
  }

  // Valid documents: status is not 'Brouillon' and not expired
  // Note: Firestore doesn't support complex queries well, so we get all and filter
  const docsSnap = await docsRef
    .where('organizationId', '==', organizationId)
    .get();

  let valid = 0;
  docsSnap.forEach((doc) => {
    const data = doc.data();
    const status = data.status || '';
    const expirationDate = data.expirationDate || data.validUntil || '';

    const isNotDraft = status !== 'Brouillon' && status !== 'Draft';
    const isNotExpired = !expirationDate || expirationDate >= now;

    if (isNotDraft && isNotExpired) {
      valid++;
    }
  });

  return {
    score: Math.round((valid / total) * 100 * 100) / 100,
    total,
    valid,
  };
}

/**
 * Calculate audits score
 * Formula: (compliantFindings / totalFindings) * 100
 */
async function calculateAuditsScore(db, organizationId) {
  // Get the most recent completed audit
  const auditsSnap = await db.collection('audits')
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'Terminé')
    .orderBy('endDate', 'desc')
    .limit(1)
    .get();

  if (auditsSnap.empty) {
    return { score: 100, total: 0, compliant: 0 };
  }

  const audit = auditsSnap.docs[0].data();
  const findings = audit.findings || [];
  const total = findings.length;

  if (total === 0) {
    return { score: 100, total: 0, compliant: 0 };
  }

  const compliant = findings.filter(
    (f) => f.status === 'Conforme' || f.status === 'Compliant' || f.status === 'Résolu'
  ).length;

  return {
    score: Math.round((compliant / total) * 100 * 100) / 100,
    total,
    compliant,
  };
}

/**
 * Calculate trend based on 30-day history
 */
async function calculateTrend(db, organizationId, currentScore) {
  const historyRef = db.collection('organizations')
    .doc(organizationId)
    .collection('complianceScores')
    .doc('current')
    .collection('history');

  const historySnap = await historyRef
    .orderBy('date', 'desc')
    .limit(30)
    .get();

  if (historySnap.empty) {
    return 'stable';
  }

  let sum = 0;
  historySnap.forEach((doc) => {
    sum += doc.data().global || 0;
  });

  const avg = sum / historySnap.size;
  const diff = currentScore - avg;

  if (diff > TREND_THRESHOLD) return 'up';
  if (diff < -TREND_THRESHOLD) return 'down';
  return 'stable';
}

/**
 * Calculate framework-specific scores
 * For now, returns the global score for all frameworks
 * Can be enhanced to calculate per-framework scores based on control mappings
 */
function calculateFrameworkScores(globalScore) {
  // TODO: Implement framework-specific calculations based on control mappings
  return {
    iso27001: globalScore,
    nis2: globalScore,
    dora: globalScore,
    rgpd: globalScore,
  };
}

/**
 * Main Cloud Function: Calculate Compliance Score
 */
const calculateComplianceScore = onCall({
  region: 'us-west1',
  memory: '256MiB',
  timeoutSeconds: 60,
}, async (request) => {
  const { organizationId } = request.data || {};

  if (!organizationId) {
    throw new HttpsError('invalid-argument', 'organizationId is required');
  }

  logger.info(`Calculating compliance score for organization: ${organizationId}`);

  const db = admin.firestore();

  try {
    // Calculate all category scores in parallel
    const [controlsResult, risksResult, documentsResult, auditsResult] = await Promise.all([
      calculateControlsScore(db, organizationId),
      calculateRisksScore(db, organizationId),
      calculateDocumentsScore(db, organizationId),
      calculateAuditsScore(db, organizationId),
    ]);

    // Build breakdown with weights
    const breakdown = {
      controls: { score: controlsResult.score, weight: DEFAULT_WEIGHTS.controls },
      risks: { score: risksResult.score, weight: DEFAULT_WEIGHTS.risks },
      documents: { score: documentsResult.score, weight: DEFAULT_WEIGHTS.documents },
      audits: { score: auditsResult.score, weight: DEFAULT_WEIGHTS.audits },
    };

    // Calculate global score using weighted average
    const globalScore = Math.round(
      (breakdown.controls.score * breakdown.controls.weight +
        breakdown.risks.score * breakdown.risks.weight +
        breakdown.documents.score * breakdown.documents.weight +
        breakdown.audits.score * breakdown.audits.weight) * 100
    ) / 100;

    // Calculate trend
    const trend = await calculateTrend(db, organizationId, globalScore);

    // Calculate framework scores
    const byFramework = calculateFrameworkScores(globalScore);

    // Build the complete score document
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
      },
    };

    // Save to Firestore
    const scoreRef = db.collection('organizations')
      .doc(organizationId)
      .collection('complianceScores')
      .doc('current');

    await scoreRef.set(scoreDoc, { merge: true });

    logger.info(`Compliance score calculated: ${globalScore} for ${organizationId}`);

    return {
      success: true,
      score: scoreDoc,
    };
  } catch (error) {
    logger.error(`Error calculating compliance score for ${organizationId}:`, error);
    throw new HttpsError('internal', 'Failed to calculate compliance score');
  }
});

module.exports = {
  calculateComplianceScore,
  // Export helper functions for testing
  calculateControlsScore,
  calculateRisksScore,
  calculateDocumentsScore,
  calculateAuditsScore,
  calculateTrend,
  DEFAULT_WEIGHTS,
  TREND_THRESHOLD,
};
