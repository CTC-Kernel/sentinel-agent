import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, XCircle } from './Icons';
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
 const id = crypto.randomUUID();
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

 // Use design tokens for consistent theming
 const getColors = (type: NotificationType) => {
 switch (type) {
 case 'success':
 return 'bg-success-bg border-success-border text-success-text';
 case 'error':
 return 'bg-error-bg border-error-border text-error-text';
 case 'warning':
 return 'bg-warning-bg border-warning-border text-warning-text';
 case 'info':
 return 'bg-info-bg border-info-border text-info-text';
 default:
 return 'bg-muted border-border text-muted-foreground';
 }
 };

 return (
 <div
 className="fixed top-4 right-4 z-toast space-y-2 max-w-sm w-full sm:w-96"
 role="region"
 aria-label="Notifications"
 aria-live="polite"
 aria-atomic="false"
 >
 {/* Screen reader announcement for new notifications */}
 <div className="sr-only" aria-live="assertive" aria-atomic="true">
 {notifications.length > 0 && notifications[0] && !notifications[0].read && (
 <span>
 {notifications[0].type === 'error' ? 'Erreur: ' : ''}
 {notifications[0].type === 'warning' ? 'Attention: ' : ''}
 {notifications[0].type === 'success' ? 'Succès: ' : ''}
 {notifications[0].title}. {notifications[0].message || ''}
 </span>
 )}
 </div>
 <AnimatePresence>
 {notifications.map((notification) => (
 <motion.div
 key={notification.id || 'unknown'}
 initial={{ opacity: 0, x: 100, scale: 0.9 }}
 animate={{ opacity: 1, x: 0, scale: 1 }}
 exit={{ opacity: 0, x: 100, scale: 0.9 }}
 transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
 className={cn(
 "relative flex items-start gap-3 p-4 rounded-2xl border shadow-lg backdrop-blur-md overflow-hidden",
 getColors(notification.type)
 )}
 >
 {/* Success sparkle effect */}
 {notification.type === 'success' && (
 <motion.div
 className="absolute inset-0 pointer-events-none"
 initial={{ opacity: 0 }}
 animate={{ opacity: [0, 0.3, 0] }}
 transition={{ duration: 0.8, ease: 'easeOut' }}
 >
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12" />
 </motion.div>
 )}

 {/* Progress bar for auto-dismiss */}
 {!notification.persistent && (
 <motion.div
 className="absolute bottom-0 left-0 h-0.5 bg-current/30"
 initial={{ width: '100%' }}
 animate={{ width: '0%' }}
 transition={{ duration: (notification.duration || 5000) / 1000, ease: 'linear' }}
 />
 )}

 <div className="flex-shrink-0 mt-0.5">
 {notification.type === 'success' ? (
 <motion.div
  initial={{ scale: 0, rotate: -180 }}
  animate={{ scale: 1, rotate: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
 >
  {getIcon(notification.type)}
 </motion.div>
 ) : (
 getIcon(notification.type)
 )}
 </div>

 <div className="flex-1 min-w-0">
 <h4 className="font-medium text-sm">{notification.title}</h4>
 {notification.message && (
 <p className="text-sm mt-1 opacity-90">{notification.message}</p>
 )}
 {notification.action && (
 <button
  onClick={() => {
  notification.action?.onClick();
  removeNotification(notification.id);
  }}
  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/20 dark:bg-black/20 hover:bg-white/30/60 backdrop-blur-sm border border-current/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
 >
  {notification.action.label}
  <span aria-hidden="true">→</span>
 </button>
 )}
 </div>

 <button
 onClick={() => removeNotification(notification.id)}
 className="flex-shrink-0 p-1 hover:bg-black/5 dark:hover:bg-muted rounded transition-colors"
 aria-label={`Fermer la notification: ${notification.title}`}
 >
 <X className="w-4 h-4 opacity-60" aria-hidden="true" />
 </button>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 );
};
