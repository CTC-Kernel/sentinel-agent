/**
 * Scheduled Function: Daily Score Snapshot
 * Implements ADR-003: Score de Conformité Global
 *
 * Runs daily to:
 * 1. Save current scores to history for all organizations
 * 2. Update trend calculations based on 30-day average
 * 3. Clean up old history (keep only 90 days)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

// Trend threshold percentage
const TREND_THRESHOLD = 5;
// Days of history to keep
const HISTORY_RETENTION_DAYS = 90;

/**
 * Calculate trend based on history
 */
function calculateTrendFromHistory(currentScore, historyDocs) {
  if (historyDocs.length === 0) {
    return 'stable';
  }

  let sum = 0;
  historyDocs.forEach((doc) => {
    sum += doc.data().global || 0;
  });

  const avg = sum / historyDocs.length;
  const diff = currentScore - avg;

  if (diff > TREND_THRESHOLD) return 'up';
  if (diff < -TREND_THRESHOLD) return 'down';
  return 'stable';
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get date string for N days ago
 */
function getDateNDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Process a single organization's score snapshot
 */
async function processOrganizationSnapshot(db, orgId, todayDate) {
  const scoreRef = db.collection('organizations')
    .doc(orgId)
    .collection('complianceScores')
    .doc('current');

  const scoreDoc = await scoreRef.get();

  if (!scoreDoc.exists) {
    logger.debug(`No current score for organization ${orgId}, skipping`);
    return null;
  }

  const scoreData = scoreDoc.data();
  const global = scoreData.global || 0;

  // Get history for trend calculation
  const historyRef = scoreRef.collection('history');
  const historySnap = await historyRef
    .orderBy('date', 'desc')
    .limit(30)
    .get();

  // Calculate new trend
  const trend = calculateTrendFromHistory(global, historySnap.docs);

  // Save today's snapshot to history
  const historyEntry = {
    date: todayDate,
    global: global,
    byFramework: scoreData.byFramework || null,
    breakdown: scoreData.breakdown || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await historyRef.doc(todayDate).set(historyEntry);

  // Update trend in current score if changed
  if (scoreData.trend !== trend) {
    await scoreRef.update({
      trend: trend,
      trendUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Clean up old history (older than 90 days)
  const cutoffDate = getDateNDaysAgo(HISTORY_RETENTION_DAYS);
  const oldHistorySnap = await historyRef
    .where('date', '<', cutoffDate)
    .get();

  if (!oldHistorySnap.empty) {
    const batch = db.batch();
    oldHistorySnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    logger.info(`Cleaned up ${oldHistorySnap.size} old history entries for ${orgId}`);
  }

  return { orgId, score: global, trend };
}

/**
 * Daily Score Snapshot Function
 * Runs every day at midnight UTC
 */
const dailyScoreSnapshot = onSchedule({
  schedule: '0 0 * * *', // Every day at midnight UTC
  region: 'europe-west1',
  timeZone: 'UTC',
  memory: '512MiB',
  timeoutSeconds: 540, // 9 minutes
}, async (event) => {
  const db = admin.firestore();
  const todayDate = getTodayDateString();

  logger.info(`Starting daily score snapshot for ${todayDate}`);

  try {
    // Get all organizations with compliance scores
    const orgsWithScores = await db.collectionGroup('complianceScores')
      .where(admin.firestore.FieldPath.documentId(), '==', 'current')
      .get();

    if (orgsWithScores.empty) {
      logger.info('No organizations with compliance scores found');
      return;
    }

    // Extract unique organization IDs
    const orgIds = new Set();
    orgsWithScores.docs.forEach((doc) => {
      // Path: organizations/{orgId}/complianceScores/current
      const pathParts = doc.ref.path.split('/');
      if (pathParts.length >= 2) {
        orgIds.add(pathParts[1]);
      }
    });

    logger.info(`Processing ${orgIds.size} organizations`);

    // Process each organization
    const results = [];
    for (const orgId of orgIds) {
      try {
        const result = await processOrganizationSnapshot(db, orgId, todayDate);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        logger.error(`Error processing organization ${orgId}:`, error);
      }
    }

    logger.info(`Daily score snapshot completed: ${results.length} organizations processed`);

    return {
      success: true,
      date: todayDate,
      processedCount: results.length,
    };

  } catch (error) {
    logger.error('Error in daily score snapshot:', error);
    throw error;
  }
});

module.exports = {
  dailyScoreSnapshot,
  // Export for testing
  processOrganizationSnapshot,
  calculateTrendFromHistory,
  getTodayDateString,
  getDateNDaysAgo,
  TREND_THRESHOLD,
  HISTORY_RETENTION_DAYS,
};
