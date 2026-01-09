import { NotificationContextType, NotificationType } from '../contexts/NotificationContext';

let notificationContext: NotificationContextType | null = null;

// Helper to set the context when provider is mounted
export const setGlobalNotificationContext = (context: NotificationContextType | null) => {
    notificationContext = context;
};

export const toast = {
    success: (title: string, message?: string) => {
        if (notificationContext) {
            const actualTitle = message ? title : 'Succès';
            const actualMessage = message ? message : title;
            return notificationContext.addNotification({ type: 'success', title: actualTitle, message: actualMessage });
        }
        return '';
    },
    error: (title: string, message?: string) => {
        if (notificationContext) {
            const actualTitle = message ? title : 'Erreur';
            const actualMessage = message ? message : title;
            return notificationContext.addNotification({ type: 'error', title: actualTitle, message: actualMessage });
        }
        return '';
    },
    warning: (title: string, message?: string) => {
        if (notificationContext) {
            const actualTitle = message ? title : 'Attention';
            const actualMessage = message ? message : title;
            return notificationContext.addNotification({ type: 'warning', title: actualTitle, message: actualMessage });
        }
        return '';
    },
    info: (title: string, message?: string) => {
        if (notificationContext) {
            const actualTitle = message ? title : 'Information';
            const actualMessage = message ? message : title;
            return notificationContext.addNotification({ type: 'info', title: actualTitle, message: actualMessage });
        }
        return '';
    },
    persistent: (type: NotificationType, title: string, message?: string) => {
        if (notificationContext) {
            return notificationContext.addNotification({ type, title, message, persistent: true });
        }
        return '';
    },
    dismiss: (id: string) => {
        if (notificationContext) {
            notificationContext.removeNotification(id);
        }
    },
    promise: <T>(promise: Promise<T>, data: { loading: string; success: string | ((data: T) => string); error: string | ((error: unknown) => string) }) => {
        const context = notificationContext;
        if (!context) return promise;
        const id = context.addNotification({ type: 'info', title: 'Chargement', message: data.loading, persistent: true });

        promise.then((res) => {
            context.removeNotification(id);
            const successMsg = typeof data.success === 'function' ? data.success(res) : data.success;
            context.addNotification({ type: 'success', title: 'Succès', message: successMsg });
        }).catch((err) => {
            context.removeNotification(id);
            const errorMsg = typeof data.error === 'function' ? data.error(err) : data.error;
            context.addNotification({ type: 'error', title: 'Erreur', message: errorMsg });
        });

        return promise;
    }
};
