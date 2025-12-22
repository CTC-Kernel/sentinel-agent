
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCircle2, AlertTriangle, Info, X, ArrowRight } from '../components/ui/Icons';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { useStore } from '../store';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { CardSkeleton } from '../components/ui/Skeleton';
import { Notification } from '../types/notification';
import { NotificationService } from '../services/notificationService';
import { ErrorLogger } from '../services/errorLogger';
import { Button } from '../components/ui/button';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';

export const Notifications: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'unread'>('all');
    const { user } = useStore();
    const { t } = useTranslation();

    // Real-time subscription
    useEffect(() => {
        if (!user?.uid) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);

        const unsubscribe = NotificationService.subscribeToNotifications(user.uid, (data) => {
            setNotifications(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    const markAsRead = async (id: string) => {
        try {
            await NotificationService.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Notifications.markAsRead', 'UPDATE_FAILED');
        }
    };

    const markAll = async () => {
        if (!user?.uid) return;
        try {
            await NotificationService.markAllAsRead(user.uid);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Notifications.markAll', 'UPDATE_FAILED');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
            case 'danger':
            case 'error': return <X className="h-5 w-5 text-red-500" />;
            case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            case 'mention': return <div className="h-5 w-5 text-brand-500 font-bold flex items-center justify-center">@</div>;
            case 'assignment': return <Bell className="h-5 w-5 text-blue-500" />;
            default: return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    const filteredNotifications = notifications.filter(n => {
        const matchesSearch = (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (n.message || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'all' ? true : !n.read;
        return matchesSearch && matchesFilter;
    });

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO title="Notifications" />
            <PageHeader
                title={t('notifications.title')}
                subtitle={t('notifications.subtitle')}
                breadcrumbs={[
                    { label: t('notifications.title') }
                ]}
                icon={<Bell className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={notifications.some(n => !n.read) && (
                    <Button
                        onClick={markAll}
                        variant="outline"
                        className="gap-2"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        {t('notifications.markAll')}
                    </Button>
                )}
            />

            <PremiumPageControl
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder={t('notifications.searchPlaceholder')}
            >
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterStatus === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10'}`}
                    >
                        {t('notifications.filter.all')}
                    </button>
                    <button
                        onClick={() => setFilterStatus('unread')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterStatus === 'unread' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10'}`}
                    >
                        {t('notifications.filter.unread')}
                    </button>
                </div>
            </PremiumPageControl>

            {loading ? (
                <div className="space-y-4">
                    <CardSkeleton count={3} />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <EmptyState
                    icon={Bell}
                    title={t('notifications.empty.title')}
                    description={searchQuery ? t('notifications.empty.descSearch') : t('notifications.empty.desc')}
                />
            ) : (
                <div className="space-y-4">
                    {filteredNotifications.map(notif => (
                        <div key={notif.id} className="glass-panel p-5 rounded-2xl border border-white/50 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex gap-4 group">
                            <div className={`p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-white/5 h-fit`}>
                                {getIcon(notif.type)}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{notif.title}</h3>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{new Date(notif.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                                {notif.link && (
                                    <a href={notif.link} className="inline-flex items-center mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                                        {t('notifications.viewDetails')} <ArrowRight className="h-3 w-3 ml-1" />
                                    </a>
                                )}
                            </div>
                            {!notif.read && (
                                <button onClick={() => markAsRead(notif.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all self-center">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
};
