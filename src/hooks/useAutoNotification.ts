import { useEffect } from 'react';
import { useNotifications } from './useNotifications';
import { Notification } from '../contexts/NotificationContext';

// Hook for auto-notifications
export const useAutoNotification = (
    condition: boolean,
    notification: Omit<Notification, 'id' | 'timestamp'>
) => {
    const { addNotification, removeNotification } = useNotifications();

    useEffect(() => {
        if (condition) {
            const id = addNotification(notification);
            return () => {
                if (typeof id === 'string') {
                    removeNotification(id);
                }
            };
        }
    }, [condition, notification, addNotification, removeNotification]);
};
