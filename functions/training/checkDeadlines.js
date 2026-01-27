/**
 * Training Deadline Checker
 *
 * Cloud Function that runs daily to check training assignment deadlines.
 * Part of NIS2 Article 21.2(g) compliance.
 *
 * Features:
 * - Runs daily at 8:00 AM Europe/Paris
 * - Marks overdue assignments
 * - Updates campaign progress
 * - Logs structured data for monitoring
 *
 * @module training/checkDeadlines
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');

// Collections
const ASSIGNMENTS_COLLECTION = 'training_assignments';
const CAMPAIGNS_COLLECTION = 'training_campaigns';

/**
 * Scheduled function to check training deadlines
 * Runs daily at 8:00 AM Europe/Paris
 */
exports.checkTrainingDeadlines = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 120,
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    const stats = {
      organizationsProcessed: 0,
      assignmentsChecked: 0,
      assignmentsMarkedOverdue: 0,
      campaignsUpdated: 0,
      errors: [],
    };

    logger.info('Starting training deadline check', { timestamp: now.toDate().toISOString() });

    try {
      // Get all organizations
      const orgsSnapshot = await db.collection('organizations').get();
      stats.organizationsProcessed = orgsSnapshot.size;

      // Process each organization
      for (const orgDoc of orgsSnapshot.docs) {
        const organizationId = orgDoc.id;

        try {
          // Find assignments that are past due but not completed or already overdue
          const assignmentsQuery = await db
            .collection('organizations')
            .doc(organizationId)
            .collection(ASSIGNMENTS_COLLECTION)
            .where('status', 'in', ['assigned', 'in_progress'])
            .where('dueDate', '<', now)
            .get();

          const batch = db.batch();
          let batchCount = 0;

          for (const assignmentDoc of assignmentsQuery.docs) {
            stats.assignmentsChecked++;
            const assignment = assignmentDoc.data();

            // Only update if not already marked overdue in metadata
            if (!assignment.isOverdue) {
              batch.update(assignmentDoc.ref, {
                isOverdue: true,
                overdueMarkedAt: now,
                updatedAt: now,
              });
              stats.assignmentsMarkedOverdue++;
              batchCount++;
            }

            // Commit batch in chunks of 500
            if (batchCount >= 500) {
              await batch.commit();
              batchCount = 0;
            }
          }

          // Commit remaining updates
          if (batchCount > 0) {
            await batch.commit();
          }

          // Update campaign progress
          const campaignsQuery = await db
            .collection('organizations')
            .doc(organizationId)
            .collection(CAMPAIGNS_COLLECTION)
            .where('status', '==', 'active')
            .get();

          for (const campaignDoc of campaignsQuery.docs) {
            const campaignId = campaignDoc.id;

            // Count assignments for this campaign
            const campaignAssignmentsQuery = await db
              .collection('organizations')
              .doc(organizationId)
              .collection(ASSIGNMENTS_COLLECTION)
              .where('campaignId', '==', campaignId)
              .get();

            let completed = 0;
            let overdue = 0;
            const total = campaignAssignmentsQuery.size;

            campaignAssignmentsQuery.docs.forEach((doc) => {
              const data = doc.data();
              if (data.status === 'completed') completed++;
              if (data.isOverdue && data.status !== 'completed') overdue++;
            });

            // Update campaign progress
            await campaignDoc.ref.update({
              'progress.completed': completed,
              'progress.overdue': overdue,
              'progress.totalAssignments': total,
              updatedAt: now,
            });

            stats.campaignsUpdated++;

            // Check if campaign should be marked as completed
            if (completed === total && total > 0) {
              await campaignDoc.ref.update({
                status: 'completed',
                completedAt: now,
              });
              logger.info('Campaign completed', { campaignId, organizationId, total });
            }
          }

        } catch (orgError) {
          stats.errors.push({
            organizationId,
            error: orgError.message,
          });
          logger.error('Error processing organization', {
            organizationId,
            error: orgError.message,
          });
        }
      }

      logger.info('Training deadline check completed', stats);

      return { success: true, stats };
    } catch (error) {
      logger.error('Training deadline check failed', { error: error.message });
      throw error;
    }
  }
);
