import React, { useState, useMemo } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useStore } from '../store';
import { GlassCard } from '../components/ui/GlassCard';
import { EmptyState } from '../components/ui/EmptyState';
import { CheckCircle2, AlertTriangle, Info, X, ArrowRight, Bell, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Notifications: React.FC = () => {
 const { t, addToast } = useStore();
 const { notifications, markAsRead, markAllAsRead, removeNotification } = useNotifications();
 const [filterStatus, setFilterStatus] = useState<'all' | 'unread'>('all');
 const [searchQuery, setSearchQuery] = useState('');

 const filteredNotifications = useMemo(() => {
 return notifications.filter(n => {
 const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || (n.message || '').toLowerCase().includes(searchQuery.toLowerCase());
 const matchesFilter = filterStatus === 'all' ? true : !n.read;
 return matchesSearch && matchesFilter;
 });
 }, [notifications, searchQuery, filterStatus]);

 const getIcon = (type: string) => {
 switch (type) {
 case 'success': return <CheckCircle2 className="w-5 h-5 text-success" />;
 case 'warning': return <AlertTriangle className="w-5 h-5 text-warning" />;
 case 'error': return <AlertTriangle className="w-5 h-5 text-destructive" />;
 default: return <Info className="w-5 h-5 text-info-text" />;
 }
 };

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="space-y-6 max-w-4xl mx-auto p-6"
 >
 {/* Header */}
 <div className="flex items-center justify-between mb-8">
 <div>
  <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
  <Bell className="w-6 h-6 text-primary" />
  {t('notifications.title', { defaultValue: 'Notifications' })}
  </h1>
  <p className="text-muted-foreground mt-1">
  {t('notifications.subtitle', { defaultValue: 'Gérez vos alertes et messages importants' })}
  </p>
 </div>
 <div className="flex gap-2">
  {notifications.some(n => !n.read) && (
  <button
  onClick={() => {
  const unreadCount = notifications.filter(n => !n.read).length;
  markAllAsRead();
  addToast(t('notifications.allMarkedRead', { defaultValue: '{{count}} notification(s) marquée(s) comme lue(s)', count: unreadCount }), 'success');
  }}
  className="text-sm font-medium text-primary hover:text-primary dark:hover:text-primary/50 px-4 py-2 rounded-lg hover:bg-primary/10 dark:hover:bg-primary transition-colors"
  >
  {t('notifications.markAllRead', { defaultValue: 'Tout marquer comme lu' })}
  </button>
  )}
 </div>
 </div>

 {/* Filters & Search */}
 <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-center">
 <div className="flex gap-4">
  <button
  onClick={() => setFilterStatus('all')}
  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filterStatus === 'all'
  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
  : 'bg-white dark:bg-white/5 text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted'
  }`}
  >
  {t('common.all', { defaultValue: 'Toutes' })}
  </button>
  <button
  onClick={() => setFilterStatus('unread')}
  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filterStatus === 'unread'
  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
  : 'bg-white dark:bg-white/5 text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted'
  }`}
  >
  {t('notifications.unread', { defaultValue: 'Non lues' })}
  </button>
 </div>

 <div className="relative w-full sm:w-64">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
  <label htmlFor="notification-search" className="sr-only">{t('common.search', { defaultValue: 'Rechercher...' })}</label>
  <input
  id="notification-search"
  type="text"
  placeholder={t('common.search', { defaultValue: 'Rechercher...' })}
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-white/5 border border-border rounded-xl text-sm outline-none focus:ring-2 focus-visible:ring-primary transition-all"
  />
 </div>
 </div>

 {/* Notifications List */}
 <AnimatePresence mode="wait">
 {filteredNotifications.length > 0 ? (
  <div className="space-y-4">
  {filteredNotifications.map(notif => (
  <motion.div
  key={notif.id || 'unknown'}
  layout
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
  >
  <GlassCard
   className={`p-5 flex gap-4 group items-start relative overflow-hidden transition-all ${!notif.read ? 'border-l-4 border-l-brand-500' : ''}`}
   hoverEffect={true}
  >
   <div className={`p-3 rounded-xl bg-card shadow-sm border border-border/60 dark:border-white/5 h-fit shrink-0`}>
   {getIcon(notif.type)}
   </div>
   <div className="flex-1 min-w-0">
   <div className="flex justify-between items-start gap-4">
   <h3 className={`text-base font-bold ${!notif.read ? 'text-foreground' : 'text-foreground'}`}>
   {notif.title}
   </h3>
   <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
   {new Date(notif.createdAt).toLocaleDateString()}
   </span>
   </div>
   <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
   {notif.message}
   </p>
   {notif.link && notif.link.startsWith('/') && (
   <a
   href={notif.link}
   className="inline-flex items-center mt-3 text-xs font-bold text-primary hover:underline group/link"
   >
   {t('notifications.viewDetails', { defaultValue: 'Voir les détails' })}
   <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover/link:translate-x-1" />
   </a>
   )}
   </div>

   {/* Actions */}
   <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-70 transition-opacity absolute right-4 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur-sm p-1 rounded-lg">
   {!notif.read && (
   <button
   onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
   className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
   title={t('notifications.markRead', { defaultValue: 'Marquer comme lu' })}
   >
   <CheckCircle2 className="h-4 w-4" />
   </button>
   )}
   <button
   onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
   className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-md hover:bg-muted"
   title={t('common.delete', { defaultValue: 'Supprimer' })}
   >
   <X className="h-4 w-4" />
   </button>
   </div>
  </GlassCard>
  </motion.div>
  ))}
  </div>
 ) : (
  <EmptyState
  icon={Bell}
  title={t('notifications.emptyTitle', { defaultValue: 'Aucune notification' })}
  description={filterStatus === 'unread'
   ? t('notifications.emptyUnread', { defaultValue: 'Vous êtes à jour !' })
   : t('notifications.emptyAll', { defaultValue: 'Rien à signaler pour le moment.' })}
  tip={t('notifications.emptyHint', { defaultValue: 'Les notifications sont générées automatiquement lors des actions importantes : échéances, changements de statut, nouvelles affectations et alertes de conformité.' })}
  semantic="neutral"
  />
 )}
 </AnimatePresence>
 </motion.div>
 );
};
