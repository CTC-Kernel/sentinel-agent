import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Notification, NotificationContext, NotificationType } from '../../contexts/NotificationContext';
import { useNotifications } from '../../hooks/useNotifications';
import { setGlobalNotificationContext } from '../../lib/toast';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const loading = false;

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'createdAt'>) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7) + Date.now().toString(36);
    const timestamp = Date.now();

    const newNotification: Notification = {
      ...notification,
      id,
      timestamp,
      createdAt: timestamp,
      read: false,
      duration: notification.duration ?? 5000
    };

    setNotifications(prev => [newNotification, ...prev]);

    if (!notification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, [removeNotification]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const contextValue = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    isOpen,
    toggle,
    setIsOpen,
    addNotification,
    removeNotification,
    clearNotifications,
    markAsRead,
    markAllAsRead
  }), [notifications, unreadCount, loading, isOpen, toggle, setIsOpen, addNotification, removeNotification, clearNotifications, markAsRead, markAllAsRead]);

  useEffect(() => {
    setGlobalNotificationContext(contextValue);
    return () => {
      setGlobalNotificationContext(null);
    };
  }, [contextValue]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  // Filter only for "toast" notifications (transient or explicitly toast)
  // But wait, our logic deletes transient notifications from state.
  // So all notifications in state ARE in the center.
  // If we want Toasts to show up, we just render them.
  // The persistent ones? They stay in state.
  // Should persistent notifications show as toasts? Usually yes.
  // Should read notifications show as toasts? No.
  // We can filter by !read for toasts? No, what if I read it in center but want toast?
  // Let's assume NotificationContainer shows ALL notifications currently in state.
  // Transient ones are removed quickly.
  // Persistent ones stay. If they stay, do they stay on SCREEN?
  // If a notification is persistent, it would clutter the screen.
  // So NotificationContainer should probably filter out old persistent notifications?
  // Or persistent notifications are "alerts" that MUST be dismissed manually?
  // Let's assume existing behavior: everything in state is shown.

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getColors = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
      default:
        return 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence mode="wait">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm",
              getColors(notification.type)
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(notification.type)}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm">{notification.title}</h4>
              {notification.message && (
                <p className="text-sm mt-1 opacity-90">{notification.message}</p>
              )}
              {notification.action && (
                <button
                  onClick={notification.action.onClick}
                  className="mt-2 text-sm font-medium underline hover:no-underline"
                >
                  {notification.action.label}
                </button>
              )}
            </div>

            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 opacity-60" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
