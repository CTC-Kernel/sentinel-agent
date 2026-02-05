import { createContext } from 'react';
import { Notification } from '../types/notification';

export type { Notification };
export type NotificationType = Notification['type'];

export interface NotificationContextType {
 notifications: Notification[];
 unreadCount: number;
 loading: boolean;
 isOpen: boolean;

 toggle: () => void;
 setIsOpen: (isOpen: boolean) => void;

 addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'createdAt'>) => string;
 removeNotification: (id: string) => void;
 clearNotifications: () => void;
 markAsRead: (id: string) => void;
 markAllAsRead: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
