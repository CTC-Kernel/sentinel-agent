import React, { useRef, useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Bell, CheckCheck, Filter } from 'lucide-react';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

export const NotificationCenter: React.FC = () => {
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
                className="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
                aria-label={unreadCount > 0 ? `Notifications - ${unreadCount} non lues` : "Notifications"}
            >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 && (
                    <>
                        <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#0B1120]" />
                        <span className="sr-only" aria-live="polite">{unreadCount} notifications non lues</span>
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
                        className="absolute right-0 mt-2 w-96 max-h-[80vh] bg-white dark:bg-[#151e32] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 flex flex-col origin-top-right ring-1 ring-black/5"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-[#151e32] shrink-0">
                            <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilter(f => f === 'all' ? 'unread' : 'all')}
                                    className={cn(
                                        "p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
                                        filter === 'unread'
                                            ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                                            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                                    )}
                                    title="Filtrer les non-lus"
                                >
                                    <Filter className="h-3.5 w-3.5" />
                                    {filter === 'unread' ? 'Non-lus' : 'Tout'}
                                </button>
                                <button
                                    onClick={() => markAllAsRead()}
                                    className="p-1.5 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                    title="Tout marquer comme lu"
                                >
                                    <CheckCheck className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto flex-1 p-2 min-h-[300px]">
                            {loading ? (
                                <div className="flex items-center justify-center h-48 space-x-2">
                                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"></div>
                                </div>
                            ) : filteredNotifications.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                        <Bell className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <p className="text-slate-900 dark:text-white font-medium mb-1">Aucune notification</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">
                                        {filter === 'unread' ? "Vous êtes à jour ! Tout a été lu." : "C'est calme par ici..."}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredNotifications.map((notification) => (
                                        <NotificationItem
                                            key={notification.id}
                                            notification={notification}
                                            onRead={markAsRead}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] shrink-0 text-center">
                            <Link to="/settings/notifications" onClick={() => setIsOpen(false)} className="text-xs text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                                Gérer les préférences
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
