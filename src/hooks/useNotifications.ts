import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { NotificationService, Notification } from '../services/notificationService';
import { toast } from 'sonner';

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
            console.error('Failed to mark as read', error);
        }
    };

    const markAllAsRead = async () => {
        if (!user?.uid) return;
        try {
            await NotificationService.markAllAsRead(user.uid);
            toast.success('Toutes les notifications marquées comme lues');
        } catch {
            toast.error('Erreur lors de la mise à jour');
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
