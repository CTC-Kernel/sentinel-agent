/**
 * Training Assignment Completion Trigger
 *
 * Cloud Function triggered when a training assignment is marked as completed.
 * Part of NIS2 Article 21.2(g) compliance.
 *
 * Features:
 * - Triggered on Firestore document update
 * - Flags organization for compliance score recalculation
 * - Updates campaign progress
 * - Logs completion for audit trail
 *
 * @module training/onAssignmentComplete
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');

// Collections
const CAMPAIGNS_COLLECTION = 'training_campaigns';
const ASSIGNMENTS_COLLECTION = 'training_assignments';
const SCORE_RECALC_COLLECTION = 'score_recalculation_queue';

/**
 * Trigger when a training assignment is updated
 * Detects status change to 'completed' and handles side effects
 */
exports.onTrainingAssignmentComplete = onDocumentUpdated(
  {
    document: 'organizations/{organizationId}/training_assignments/{assignmentId}',
    region: 'europe-west1',
    memory: '256MiB',
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const { organizationId, assignmentId } = event.params;

    // Only process if status changed to 'completed'
    if (beforeData.status === afterData.status || afterData.status !== 'completed') {
      return null;
    }

    const db = getFirestore();
    const now = Timestamp.now();

    logger.info('Training assignment completed', {
      organizationId,
      assignmentId,
      userId: afterData.userId,
      courseId: afterData.courseId,
      completedAt: afterData.completedAt?.toDate()?.toISOString(),
    });

    try {
      // 1. Flag organization for compliance score recalculation
      await db
        .collection(SCORE_RECALC_COLLECTION)
        .doc(organizationId)
        .set(
          {
            organizationId,
            reason: 'training_completion',
            requestedAt: now,
            metadata: {
              assignmentId,
              userId: afterData.userId,
              courseId: afterData.courseId,
            },
          },
          { merge: true }
        );

      logger.info('Score recalculation flagged', { organizationId });

      // 2. Update campaign progress if this assignment belongs to a campaign
      // Uses transaction to prevent race conditions when multiple assignments complete concurrently
      if (afterData.campaignId) {
        await db.runTransaction(async (transaction) => {
          const campaignRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection(CAMPAIGNS_COLLECTION)
            .doc(afterData.campaignId);

          const campaignDoc = await transaction.get(campaignRef);

          if (!campaignDoc.exists) return;

          // Count completed assignments for this campaign
          const campaignAssignmentsQuery = await db
            .collection('organizations')
            .doc(organizationId)
            .collection(ASSIGNMENTS_COLLECTION)
            .where('campaignId', '==', afterData.campaignId)
            .get();

          let completed = 0;
          let overdue = 0;
          const total = campaignAssignmentsQuery.size;

          campaignAssignmentsQuery.docs.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'completed') completed++;
            if (data.isOverdue && data.status !== 'completed') overdue++;
          });

          // Update campaign progress inside transaction
          const updateData = {
            'progress.completed': completed,
            'progress.overdue': overdue,
            'progress.totalAssignments': total,
            updatedAt: now,
          };

          // Also mark campaign as completed if all done
          if (completed === total && total > 0) {
            updateData.status = 'completed';
            updateData.completedAt = now;
            logger.info('Campaign marked as completed', {
              campaignId: afterData.campaignId,
              organizationId,
            });
          }

          transaction.update(campaignRef, updateData);

          logger.info('Campaign progress updated', {
            campaignId: afterData.campaignId,
            completed,
            total,
            percentage: Math.round((completed / total) * 100),
          });
        });
      }

      // 3. Create audit log entry
      await db
        .collection('organizations')
        .doc(organizationId)
        .collection('audit_logs')
        .add({
          type: 'training_completion',
          action: 'complete',
          entityType: 'training_assignment',
          entityId: assignmentId,
          userId: afterData.userId,
          metadata: {
            courseId: afterData.courseId,
            score: afterData.score,
            timeSpent: afterData.timeSpent,
            campaignId: afterData.campaignId || null,
          },
          timestamp: now,
          organizationId,
        });

      logger.info('Audit log created', { assignmentId, organizationId });

      return { success: true };
    } catch (error) {
      logger.error('Error processing training completion', {
        error: error.message,
        organizationId,
        assignmentId,
      });
      throw error;
    }
  }
);

