
import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, X, ArrowRight } from '../components/ui/Icons';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { useStore } from '../store';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { CardSkeleton } from '../components/ui/Skeleton';
import { NotificationRecord } from '../types';
import { NotificationService } from '../services/notificationService';
import { ErrorLogger } from '../services/errorLogger';

export const Notifications: React.FC = () => {
    const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useStore();

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
            case 'danger': return <X className="h-5 w-5 text-red-500" />;
            case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            default: return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-10 relative min-h-screen"
        >
            <MasterpieceBackground />
            <SEO title="Notifications" />
            <PageHeader
                title="Notifications"
                subtitle="Restez informé des activités importantes."
                breadcrumbs={[
                    { label: 'Notifications' }
                ]}
                icon={<Bell className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={notifications.some(n => !n.read) && (
                    <button
                        onClick={markAll}
                        className="px-4 py-2.5 text-sm font-bold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-colors border border-brand-200 dark:border-brand-800"
                    >
                        Tout marquer comme lu
                    </button>
                )}
            />

            {loading ? (
                <div className="space-y-4">
                    <CardSkeleton count={3} />
                </div>
            ) : notifications.length === 0 ? (
                <EmptyState
                    icon={Bell}
                    title="Aucune notification"
                    description="Vous êtes à jour ! Aucune nouvelle activité à signaler."
                />
            ) : (
                <div className="space-y-4">
                    {notifications.map(notif => (
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
                                        Voir les détails <ArrowRight className="h-3 w-3 ml-1" />
                                    </a>
                                )}
                            </motion.div>
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
