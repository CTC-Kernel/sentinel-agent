import React, { useRef, useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Bell, CheckCheck, Filter } from '../ui/Icons';
import { useOnClickOutside } from '../../hooks/utils/useOnClickOutside';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { Tooltip } from '../ui/Tooltip';
import { useLocale } from '../../hooks/useLocale';

export const NotificationCenter: React.FC = () => {
 const { t } = useLocale();
 const {
 notifications,
 unreadCount,
 toggle,
 isOpen,
 setIsOpen,
 markAsRead,
 markAllAsRead,
 loading
 } = useNotifications();
 const containerRef = useRef<HTMLDivElement>(null);
 const [filter, setFilter] = useState<'all' | 'unread'>('all');

 useOnClickOutside(containerRef, () => setIsOpen(false));

 const filteredNotifications = notifications.filter(n => {
 if (filter === 'unread') return !n.read;
 return true;
 });

 return (
 <div className="relative" ref={containerRef}>
 <button
 onClick={toggle}
 className="relative p-2 text-muted-foreground hover:text-foreground/60 transition-colors rounded-full hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 aria-label={unreadCount > 0 ? t('notifications.unreadAriaLabel', { defaultValue: `Notifications - ${unreadCount} non lues`, count: unreadCount }) : t('notifications.title', { defaultValue: 'Notifications' })}
 >
 <Bell className="h-5 w-5" aria-hidden="true" />
 {unreadCount > 0 && (
  <>
  <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
  <span className="sr-only" aria-live="polite">{t('notifications.unreadCount', { defaultValue: `${unreadCount} notifications non lues`, count: unreadCount })}</span>
  </>
 )}
 </button>

 <AnimatePresence>
 {isOpen && (
  <motion.div
  initial={{ opacity: 0, scale: 0.95, y: 10 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: 10 }}
  transition={{ duration: 0.1 }}
  className="absolute right-0 mt-2 w-[90vw] sm:w-96 max-w-[384px] max-h-[80vh] glass-premium bg-background/95 rounded-3xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)] border border-border/40 overflow-hidden z-dropdown flex flex-col origin-top-right ring-1 ring-border/20"
  >
  {/* Header */}
  <div className="p-4 border-b border-border/40 flex items-center justify-between bg-gradient-to-br from-muted/30 to-transparent shrink-0">
  <h3 className="font-semibold text-foreground">{t('notifications.title', { defaultValue: 'Notifications' })}</h3>
  <div className="flex gap-2">
  <Tooltip content={filter === 'unread' ? t('notifications.showAll', { defaultValue: 'Afficher tout' }) : t('notifications.filterUnread', { defaultValue: 'Filtrer les non-lus' })}>
   <button
   onClick={() => setFilter(f => f === 'all' ? 'unread' : 'all')}
   className={cn(
   "p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
   filter === 'unread'
   ? "bg-muted text-foreground"
   : "text-muted-foreground hover:bg-muted/50"
   )}
   >
   <Filter className="h-3.5 w-3.5" />
   {filter === 'unread' ? t('notifications.unreadLabel', { defaultValue: 'Non-lus' }) : t('notifications.allLabel', { defaultValue: 'Tout' })}
   </button>
  </Tooltip>
  <Tooltip content={t('notifications.markAllAsRead', { defaultValue: 'Tout marquer comme lu' })}>
   <button
   onClick={() => markAllAsRead()}
   className="p-1.5 text-muted-foreground hover:text-foreground/60 hover:bg-muted/50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
   >
   <CheckCheck className="h-4 w-4" />
   </button>
  </Tooltip>
  </div>
  </div>

  {/* Content */}
  <div className="overflow-y-auto flex-1 p-2 min-h-[200px] sm:min-h-[300px]">
  {loading ? (
  <div className="flex items-center justify-center h-48 space-x-2" aria-live="polite" aria-label={t('common.loading', { defaultValue: 'Chargement en cours' })}>
   <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
   <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
   <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
  </div>
  ) : filteredNotifications.length === 0 ? (
  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
   <div className="w-12 h-12 rounded-full bg-primary/15 dark:bg-primary flex items-center justify-center mb-3">
   <Bell className="h-6 w-6 text-primary" />
   </div>
   <p className="text-foreground font-medium mb-1">{t('notifications.noNotificationTitle', { defaultValue: 'Aucune notification' })}</p>
   <p className="text-xs text-muted-foreground max-w-[200px]">
   {filter === 'unread' ? t('notifications.allRead', { defaultValue: "Vous êtes à jour ! Tout a été lu." }) : t('notifications.noNotifications', { defaultValue: "C'est calme par ici..." })}
   </p>
  </div>
  ) : (
  <div className="space-y-1">
   {filteredNotifications.map((notification) => (
   <NotificationItem
   key={notification.id || 'unknown'}
   notification={notification}
   onRead={markAsRead}
   />
   ))}
  </div>
  )}
  </div>

  {/* Footer */}
  <div className="p-2 border-t border-border/40 bg-gradient-to-br from-muted/20 to-transparent shrink-0 text-center">
  <Link to="/settings/notifications" onClick={() => setIsOpen(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
  {t('notifications.managePreferences', { defaultValue: 'Gérer les préférences' })}
  </Link>
  </div>
  </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
};
