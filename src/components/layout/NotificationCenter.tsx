import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { Bell, X, Check, AlertTriangle, Info, CheckCircle2, ShieldAlert, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';

import { Notification } from '../../services/notificationService';

export const NotificationCenter: React.FC = () => {
    const {
        notifications,
        unreadCount,
        isOpen,
        setIsOpen,
        toggle,
        markAsRead,
        markAllAsRead
    } = useNotifications();
    const navigate = useNavigate();

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await markAsRead(notification.id);
        }
        if (notification.link) {
            navigate(notification.link);
            setIsOpen(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'danger': return <ShieldAlert className="h-5 w-5 text-red-500" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
            case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            default: return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    // Group notifications by date (Today vs Earlier)
    const today = new Date().toDateString();
    const grouped = notifications.reduce((acc, curr) => {
        const date = new Date(curr.createdAt).toDateString();
        const key = date === today ? 'Aujourd\'hui' : 'Plus tôt';
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
    }, {} as Record<string, typeof notifications>);

    return (
        <>
            {/* Bell Trigger */}
            <button
                onClick={toggle}
                className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
                )}
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Drawer */}
            <div className={`fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Bell className="h-5 w-5 text-slate-900 dark:text-white" />
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                        </div>
                        <h2 className="font-bold text-slate-900 dark:text-white">Notifications</h2>
                        {unreadCount > 0 && <Badge status="error" variant="soft">{unreadCount} nouvelles</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="p-2 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                                title="Tout marquer comme lu"
                            >
                                <Check className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="h-[calc(100vh-65px)] overflow-y-auto p-4 space-y-6">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <Inbox className="h-8 w-8 opacity-50" />
                            </div>
                            <p className="font-medium text-slate-600 dark:text-slate-300">Tout est calme</p>
                            <p className="text-sm">Aucune notification pour le moment.</p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([date, items]) => (
                            <div key={date}>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 ml-1">{date}</h3>
                                <div className="space-y-2">
                                    {(items as Notification[]).map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`group relative flex gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${notification.read
                                                ? 'bg-white dark:bg-slate-900/50 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                                                : 'bg-brand-50/30 dark:bg-brand-900/10 border-brand-100 dark:border-brand-900/20 hover:border-brand-200 dark:hover:border-brand-800'
                                                }`}
                                        >
                                            <div className={`mt-1 flex-shrink-0 ${notification.read ? 'opacity-50' : ''}`}>
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className={`text-sm font-medium ${notification.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                        {format(new Date(notification.createdAt), 'HH:mm')}
                                                    </span>
                                                </div>
                                                <p className={`text-xs mt-1 line-clamp-2 ${notification.read ? 'text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {notification.message}
                                                </p>
                                            </div>
                                            {!notification.read && (
                                                <div className="absolute top-1/2 right-2 transform -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};
