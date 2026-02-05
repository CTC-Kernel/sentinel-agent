import { NotificationService } from '../services/notificationService';

/**
 * Cloud Function to run automated notification checks
 * This should be deployed as a scheduled Firebase Cloud Function
 * running every 6 hours
 */
/**
 * Cloud Function to run automated notification checks
 * MOVED TO BACKEND: functions/services/NotificationManager.js
 * The previous client-side implementation was insecure and removed.
 */
// export const scheduledNotificationChecks = async () => { ... } - REMOVED

/**
 * Manual trigger for notification checks (for testing)
 */
export const triggerNotificationChecks = async (organizationId: string) => {
 await NotificationService.runAutomatedChecks(organizationId);
};
