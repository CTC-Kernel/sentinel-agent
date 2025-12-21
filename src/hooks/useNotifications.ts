import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { NotificationService, Notification } from '../services/notificationService';
import { toast } from 'sonner';
import { ErrorLogger } from '../services/errorLogger';

export const useNotifications = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;

        const unsubscribe = NotificationService.subscribeToNotifications(user.uid, (data) => {
            setNotifications(data);
            setLoading(false);
        });

        // Initial fetch to ensure we have data quickly
        NotificationService.getUnread(user.uid).then(_unread => {
            // managed by subscription generally, but good for quick check logic if needed
        }).catch(console.error);

        return () => unsubscribe();
    }, [user?.uid]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = async (id: string) => {
        try {
            await NotificationService.markAsRead(id);
            // Optimistic update handled by subscription
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useNotifications.markAsRead', 'UPDATE_FAILED');
        }
    };

    const markAllAsRead = async () => {
        if (!user?.uid) return;
        try {
            await NotificationService.markAllAsRead(user.uid);
            toast.success('Toutes les notifications marquées comme lues');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useNotifications.markAllAsRead', 'UPDATE_FAILED');
        }
    };

    const toggle = () => setIsOpen(!isOpen);

    return {
        notifications,
        unreadCount,
        isOpen,
        setIsOpen,
        toggle,
        markAsRead,
        markAllAsRead,
        loading
    };
};
