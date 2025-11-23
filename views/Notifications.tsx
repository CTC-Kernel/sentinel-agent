
import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertNotification } from '../types';
import { Bell, CheckCircle2, AlertTriangle, Info, X, CalendarDays, ArrowRight } from '../components/ui/Icons';
import { useStore } from '../store';
import { EmptyState } from '../components/ui/EmptyState';
import { CardSkeleton } from '../components/ui/Skeleton';

export const Notifications: React.FC = () => {
    const [notifications, setNotifications] = useState<AlertNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, addToast } = useStore();

    const fetchNotifications = async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            // Fetch from 'notifications' collection (assuming it exists or will be populated)
            // For now, we might not have any, so we can also simulate some based on system state if needed.
            // But let's stick to the collection pattern for scalability.
            const q = query(
                collection(db, 'notifications'),
                where('organizationId', '==', user.organizationId),
                where('userId', '==', user.uid), // Target specific user
                orderBy('date', 'desc'),
                limit(50)
            );

            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AlertNotification));
            setNotifications(data);
        } catch (e) {
            console.error(e);
            // addToast("Erreur chargement notifications", "error"); // Silent fail is better for notifs
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchNotifications(); }, [user]);

    const markAsRead = async (id: string) => {
        try {
            // In a real app, we'd update the 'read' status in Firestore
            // For now, let's just remove it from the local list or mark it visually
            // await updateDoc(doc(db, 'notifications', id), { read: true });
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (e) { console.error(e); }
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
        <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Notifications</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Restez informé des activités importantes.</p>
                </div>
                <button onClick={() => setNotifications([])} className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                    Tout marquer comme lu
                </button>
            </div>

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
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{new Date(notif.date).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                                {notif.link && (
                                    <a href={notif.link} className="inline-flex items-center mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                                        Voir les détails <ArrowRight className="h-3 w-3 ml-1" />
                                    </a>
                                )}
                            </div>
                            <button onClick={() => markAsRead(notif.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all self-center">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
