import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { Notification } from '../contexts/NotificationContext';

// Hook for auto-notifications
export const useAutoNotification = (
    condition: boolean,
    notification: Omit<Notification, 'id' | 'timestamp'>
) => {
    const { addNotification, removeNotification } = useNotifications();

    const notificationIdRef = useRef<string | null>(null);

    // Deep compare notification object to avoid re-triggering on new object references
    const notificationKey = JSON.stringify(notification);

    useEffect(() => {
        if (condition && !notificationIdRef.current) {
            const id = addNotification(notification);
            if (typeof id === 'string') {
                notificationIdRef.current = id;
            }
        }

        // Cleanup function to remove notification when condition becomes false or component unmounts
        // Only if we have an active notification
        return () => {
            if (!condition && notificationIdRef.current) {
                removeNotification(notificationIdRef.current);
                notificationIdRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notificationKey (JSON.stringify of notification) is sufficient; including notification object causes infinite re-renders
    }, [condition, notificationKey, addNotification, removeNotification]);

    // Separate effect for unmount cleanup only
    useEffect(() => {
        return () => {
            if (notificationIdRef.current) {
                removeNotification(notificationIdRef.current);
            }
        };
    }, [removeNotification]);
};
