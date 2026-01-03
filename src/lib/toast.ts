import { NotificationContextType, NotificationType } from '../contexts/NotificationContext';

let notificationContext: NotificationContextType | null = null;

// Helper to set the context when provider is mounted
export const setGlobalNotificationContext = (context: NotificationContextType | null) => {
    notificationContext = context;
};

export const toast = {
    success: (title: string, message?: string) => {
        if (notificationContext) {
            notificationContext.addNotification({ type: 'success', title, message });
        }
    },
    error: (title: string, message?: string) => {
        if (notificationContext) {
            notificationContext.addNotification({ type: 'error', title, message });
        }
    },
    warning: (title: string, message?: string) => {
        if (notificationContext) {
            notificationContext.addNotification({ type: 'warning', title, message });
        }
    },
    info: (title: string, message?: string) => {
        if (notificationContext) {
            notificationContext.addNotification({ type: 'info', title, message });
        }
    },
    persistent: (type: NotificationType, title: string, message?: string) => {
        if (notificationContext) {
            notificationContext.addNotification({ type, title, message, persistent: true });
        }
    }
};
