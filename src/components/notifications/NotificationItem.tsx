import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../../types/notification';
import { cn } from '../../utils/cn';
import { Bell, AlertTriangle, CheckCircle, Info, XCircle, Clock } from '../ui/Icons';
import { formatDistanceToNow } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { Link } from 'react-router-dom';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

interface NotificationItemProps {
 notification: Notification;
 onRead: (id: string) => void;
}

const getIcon = (type: Notification['type']) => {
 switch (type) {
 case 'success': return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
 case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
 case 'error':
 case 'danger': return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
 case 'mention': return <div className="h-4 w-4 text-primary text-xs font-bold flex items-center justify-center">@</div>;
 case 'assignment': return <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
 default: return <Info className="h-4 w-4 text-muted-foreground" />;
 }
};

const getBgColor = (type: Notification['type'], read: boolean) => {
 if (read) return 'bg-transparent';
 switch (type) {
 case 'danger':
 case 'error': return 'bg-red-50 dark:bg-red-50';
 case 'warning': return 'bg-amber-50 dark:bg-amber-50';
 case 'success': return 'bg-green-50 dark:bg-green-50';
 case 'mention': return 'bg-primary/10';
 default: return 'bg-muted/50';
 }
};

const resolveNavigationLink = (notification: Notification): string | null => {
 if (notification.link) return notification.link;
 if (notification.actionPayload?.type === 'navigate' && notification.actionPayload.destination) {
 return notification.actionPayload.destination;
 }
 const meta = notification.metadata;
 if (meta) {
 const resourceType = meta.resourceType as string | undefined;
 const resourceId = meta.resourceId as string | undefined;
 const routeMap: Record<string, string> = {
 risk: '/risks',
 incident: '/incidents',
 audit: '/audits',
 asset: '/assets',
 compliance: '/compliance',
 control: '/compliance',
 continuity: '/continuity',
 vulnerability: '/vulnerabilities',
 supplier: '/suppliers',
 document: '/documents',
 project: '/projects',
 };
 if (resourceType && routeMap[resourceType]) {
 return resourceId ? `${routeMap[resourceType]}?id=${resourceId}` : routeMap[resourceType];
 }
 }
 return null;
};

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRead }) => {
 const navigate = useNavigate();
 const { dateFnsLocale } = useLocale();

 const resolvedLink = resolveNavigationLink(notification);

 const handleRead = () => {
 if (!notification.read) {
 onRead(notification.id);
 }
 };

 const handleClick = () => {
 handleRead();
 if (resolvedLink && !notification.link) {
 navigate(resolvedLink);
 }
 };

 const Content = (
 <div className={cn(
 "flex gap-3 p-4 rounded-lg transition-all border border-transparent",
 getBgColor(notification.type, notification.read),
 "hover:bg-muted"
 )}>
 <div className="mt-1 flex-shrink-0">
 {getIcon(notification.type)}
 </div>
 <div className="flex-1 space-y-1">
 <div className="flex items-start justify-between gap-2">
  <p className={cn("text-sm font-medium", notification.read ? "text-muted-foreground" : "text-foreground")}>
  {notification.title}
  </p>
  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
  <Clock className="h-3 w-3" />
  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: dateFnsLocale })}
  </span>
 </div>
 <p className="text-sm text-muted-foreground line-clamp-2">
  {notification.message}
 </p>
 </div>
 {!notification.read && (
 <div className="flex-shrink-0 self-center">
  <div className="h-2 w-2 rounded-full bg-primary" />
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

 if (resolvedLink) {
 return (
 <Link to={resolvedLink} onClick={handleRead} className="block mb-2">
 {Content}
 </Link>
 );
 }

 return (
 <div
 onClick={handleClick}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
  e.preventDefault();
  handleClick();
 }
 }}
 className="cursor-pointer mb-2"
 >
 {Content}
 </div>
 );
};
