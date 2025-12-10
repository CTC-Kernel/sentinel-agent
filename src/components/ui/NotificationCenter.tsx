import React, { useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, X, Check } from './Icons';
import { NotificationService, Notification } from '../../services/notificationService';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';
import { where, orderBy, limit } from 'firebase/firestore';
import { useFirestoreCollection } from '../../hooks/useFirestore';

export const NotificationCenter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useStore();
    const navigate = useNavigate();

    // Use the hook for fetching notifications
    // Note: We need to memoize constraints or they will trigger re-renders if passed inline
    // But useFirestoreCollection handles constraint memoization internally now.
    const { data: notifications, update, refresh } = useFirestoreCollection<Notification>(
        'notifications',
        [
            where('userId', '==', user?.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        ],
        { logError: true, realtime: true, enabled: !!user?.uid }
    );

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleMarkAsRead = async (notificationId: string) => {
        await update(notificationId, { read: true });
    };

    const handleMarkAllAsRead = async () => {
        if (!user?.uid) return;



        await NotificationService.markAllAsRead(user.uid);
        refresh(); // Refresh to get updated state
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await handleMarkAsRead(notification.id);
        }
        if (notification.link) {
            navigate(notification.link);
            setIsOpen(false);
        }
    };

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'danger':
                return <X className="h-5 w-5 text-red-500" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-orange-500" />;
            case 'success':
                return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            default:
                return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    const getTypeColor = (type: Notification['type']) => {
        switch (type) {
            case 'danger':
                return 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30';
            case 'warning':
                return 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30';
            case 'success':
                return 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30';
            default:
                return 'bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/10 border-blue-100 dark:border-blue-900/30';
        }
    };

    return (
        <div className="relative">
            {/* Bell Icon with Badge */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-lg animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Panel */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute right-0 top-12 z-50 w-96 max-h-[600px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-slide-up">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Notifications
                                </h3>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                                </p>
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                                >
                                    <Check className="h-3.5 w-3.5" />
                                    Tout marquer comme lu
                                </button>
                            )}
                        </div>

                        {/* Notifications List */}
                        <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                    <Bell className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3 opacity-50" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                        Aucune notification
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                        Vous êtes à jour !
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-white/5">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`p-4 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!notification.read ? 'bg-blue-50/30 dark:bg-slate-900/5' : ''
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Icon */}
                                                <div className={`p-2 rounded-xl border ${getTypeColor(notification.type)} flex-shrink-0`}>
                                                    {getIcon(notification.type)}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                                            {notification.title}
                                                        </h4>
                                                        {!notification.read && (
                                                            <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                                                            {new Date(notification.createdAt).toLocaleDateString('fr-FR', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                        {!notification.read && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMarkAsRead(notification.id);
                                                                }}
                                                                className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                                                            >
                                                                <Check className="h-3 w-3" />
                                                                Marquer comme lu
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
