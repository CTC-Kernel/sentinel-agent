/**
 * Training Reminders Sender
 *
 * Cloud Function that runs daily to send training reminders.
 * Part of NIS2 Article 21.2(g) compliance.
 *
 * Features:
 * - Runs daily at 9:00 AM Europe/Paris
 * - Sends reminders 7 days before deadline
 * - Sends urgent reminders 1 day before deadline
 * - Tracks reminder history to avoid spam
 * - Uses email notification system
 *
 * @module training/sendReminders
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');

// Collections
const ASSIGNMENTS_COLLECTION = 'training_assignments';
const CATALOG_COLLECTION = 'training_catalog';
const NOTIFICATIONS_COLLECTION = 'notifications';

// Reminder thresholds (in days)
const REMINDER_THRESHOLDS = [7, 1];

/**
 * Calculate days until deadline
 */
function daysUntilDeadline(dueDate) {
  const now = new Date();
  const due = dueDate.toDate();
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Scheduled function to send training reminders
 * Runs daily at 9:00 AM Europe/Paris
 */
exports.sendTrainingReminders = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 180,
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    const stats = {
      organizationsProcessed: 0,
      assignmentsChecked: 0,
      reminders7Days: 0,
      reminders1Day: 0,
      errors: [],
    };

    logger.info('Starting training reminders check', { timestamp: now.toDate().toISOString() });

    try {
      // Get all organizations
      const orgsSnapshot = await db.collection('organizations').get();
      stats.organizationsProcessed = orgsSnapshot.size;

      // Process each organization
      for (const orgDoc of orgsSnapshot.docs) {
        const organizationId = orgDoc.id;
        const orgData = orgDoc.data();

        try {
          // Get organization settings for notification preferences
          const notificationsEnabled = orgData.settings?.notifications?.training !== false;

          if (!notificationsEnabled) {
            logger.info('Notifications disabled for organization', { organizationId });
            continue;
          }

          // Find pending assignments
          const assignmentsQuery = await db
            .collection('organizations')
            .doc(organizationId)
            .collection(ASSIGNMENTS_COLLECTION)
            .where('status', 'in', ['assigned', 'in_progress'])
            .get();

          for (const assignmentDoc of assignmentsQuery.docs) {
            stats.assignmentsChecked++;
            const assignment = assignmentDoc.data();
            const daysLeft = daysUntilDeadline(assignment.dueDate);

            // Check if we should send a reminder
            let reminderType = null;
            if (daysLeft === 7) {
              reminderType = '7_days';
            } else if (daysLeft === 1) {
              reminderType = '1_day';
            }

            if (!reminderType) continue;

            // Check if reminder was already sent for this threshold
            const lastReminder = assignment.lastReminderType;
            if (lastReminder === reminderType) {
              continue; // Already sent this reminder
            }

            // Get course details for the notification
            const courseDoc = await db
              .collection('organizations')
              .doc(organizationId)
              .collection(CATALOG_COLLECTION)
              .doc(assignment.courseId)
              .get();

            const courseName = courseDoc.exists
              ? courseDoc.data().title
              : 'Formation';

            // Get user details
            const userDoc = await db.collection('users').doc(assignment.userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            // Create notification
            const notificationData = {
              type: 'training_reminder',
              userId: assignment.userId,
              organizationId,
              title: daysLeft === 1
                ? 'Formation urgente - Derniers jours'
                : 'Rappel de formation',
              message: daysLeft === 1
                ? `La formation "${courseName}" est due demain. Veuillez la compléter.`
                : `La formation "${courseName}" est due dans ${daysLeft} jours.`,
              metadata: {
                assignmentId: assignmentDoc.id,
                courseId: assignment.courseId,
                courseName,
                dueDate: assignment.dueDate.toDate().toISOString(),
                daysLeft,
                reminderType,
              },
              priority: daysLeft === 1 ? 'high' : 'normal',
              read: false,
              createdAt: now,
            };

            // Save notification
            await db
              .collection('organizations')
              .doc(organizationId)
              .collection(NOTIFICATIONS_COLLECTION)
              .add(notificationData);

            // Update assignment with reminder info
            await assignmentDoc.ref.update({
              lastReminderAt: now,
              lastReminderType: reminderType,
              remindersSent: FieldValue.increment(1),
            });

            // Track stats
            if (reminderType === '7_days') {
              stats.reminders7Days++;
            } else if (reminderType === '1_day') {
              stats.reminders1Day++;
            }

            logger.info('Reminder sent', {
              assignmentId: assignmentDoc.id,
              userId: assignment.userId,
              courseName,
              daysLeft,
              reminderType,
            });

            // Optional: Send email notification
            // This would integrate with your email service
            // await sendEmailReminder(userData.email, courseName, daysLeft);
          }
        } catch (orgError) {
          stats.errors.push({
            organizationId,
            error: orgError.message,
          });
          logger.error('Error processing organization reminders', {
            organizationId,
            error: orgError.message,
          });
        }
      }

      logger.info('Training reminders check completed', stats);

      return { success: true, stats };
    } catch (error) {
      logger.error('Training reminders check failed', { error: error.message });
      throw error;
    }
  }
);
