import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  timestamp: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(7);
    const timestamp = Date.now();
    
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp,
      duration: notification.duration ?? 5000
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove if not persistent
    if (!notification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id; // Retourner l'ID pour le nettoyage
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearNotifications }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

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

// Toast Notifications
export const toast = {
  success: (title: string, message?: string) => {
    const { addNotification } = useNotifications();
    addNotification({ type: 'success', title, message });
  },
  error: (title: string, message?: string) => {
    const { addNotification } = useNotifications();
    addNotification({ type: 'error', title, message });
  },
  warning: (title: string, message?: string) => {
    const { addNotification } = useNotifications();
    addNotification({ type: 'warning', title, message });
  },
  info: (title: string, message?: string) => {
    const { addNotification } = useNotifications();
    addNotification({ type: 'info', title, message });
  },
  persistent: (type: NotificationType, title: string, message?: string) => {
    const { addNotification } = useNotifications();
    addNotification({ type, title, message, persistent: true });
  }
};

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
