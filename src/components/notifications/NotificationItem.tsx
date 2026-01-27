import React from 'react';
import { Notification } from '../../types/notification';
import { cn } from '../../utils/cn';
import { Bell, AlertTriangle, CheckCircle, Info, XCircle, Clock } from '../ui/Icons';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

interface NotificationItemProps {
    notification: Notification;
    onRead: (id: string) => void;
}

const getIcon = (type: Notification['type']) => {
    switch (type) {
        case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
        case 'error':
        case 'danger': return <XCircle className="h-4 w-4 text-red-500" />;
        case 'mention': return <div className="h-4 w-4 text-brand-500 text-xs font-bold flex items-center justify-center">@</div>;
        case 'assignment': return <Bell className="h-4 w-4 text-blue-500" />;
        default: return <Info className="h-4 w-4 text-slate-500" />;
    }
};

const getBgColor = (type: Notification['type'], read: boolean) => {
    if (read) return 'bg-transparent';
    switch (type) {
        case 'danger':
        case 'error': return 'bg-red-50 dark:bg-red-50';
        case 'warning': return 'bg-amber-50 dark:bg-amber-50';
        case 'success': return 'bg-green-50 dark:bg-green-50';
        case 'mention': return 'bg-brand-50 dark:bg-brand-900';
        default: return 'bg-slate-50 dark:bg-slate-800/50';
    }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRead }) => {
    const handleRead = () => {
        if (!notification.read) {
            onRead(notification.id);
        }
    };

    const Content = (
        <div className={cn(
            "flex gap-3 p-4 rounded-lg transition-all border border-transparent",
            getBgColor(notification.type, notification.read),
            "hover:bg-slate-100 dark:hover:bg-slate-800"
        )}>
            <div className="mt-1 flex-shrink-0">
                {getIcon(notification.type)}
            </div>
            <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-medium", notification.read ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-slate-100")}>
                        {notification.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
                    </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-muted-foreground line-clamp-2">
                    {notification.message}
                </p>
            </div>
            {!notification.read && (
                <div className="flex-shrink-0 self-center">
                    <div className="h-2 w-2 rounded-full bg-brand-500" />
                </div>
            )}
        </div>
    );

    if (notification.link) {
        return (
            <Link to={notification.link} onClick={handleRead} className="block mb-2">
                {Content}
            </Link>
        );
    }

    return (
        <div
            onClick={handleRead}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRead();
                }
            }}
            className="cursor-pointer mb-2"
        >
            {Content}
        </div>
    );
};
