import { NotificationService } from '../services/notificationService';

/**
 * Cloud Function to run automated notification checks
 * This should be deployed as a scheduled Firebase Cloud Function
 * running every 6 hours
 */
export const scheduledNotificationChecks = async () => {
    try {
        // Get all organizations
        const { db } = await import('../firebase');
        const { collection, getDocs } = await import('firebase/firestore');

        const orgsSnapshot = await getDocs(collection(db, 'users'));
        const organizationIds = new Set<string>();

        orgsSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.organizationId) {
                organizationIds.add(data.organizationId);
            }
        });

        // Run checks for each organization
        const promises = Array.from(organizationIds).map((orgId) =>
            NotificationService.runAutomatedChecks(orgId)
        );

        await Promise.allSettled(promises);

        console.log(`Notification checks completed for ${organizationIds.size} organizations`);
    } catch (error) {
        console.error('Error running notification checks:', error);
    }
};

/**
 * Manual trigger for notification checks (for testing)
 */
export const triggerNotificationChecks = async (organizationId: string) => {
    await NotificationService.runAutomatedChecks(organizationId);
};
