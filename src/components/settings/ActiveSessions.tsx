import React, { useState } from 'react';
import { Monitor, Smartphone, Globe, Trash2, ShieldCheck, Clock } from '../ui/Icons';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/Tooltip';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Session {
    id: string;
    device: string;
    type: 'desktop' | 'mobile';
    location: string;
    ip: string;
    lastActive: Date;
    isCurrent: boolean;
    browser: string;
}

export const ActiveSessions: React.FC = () => {
    const { t, addToast } = useStore();

    const [sessions, setSessions] = useState<Session[]>(() => [
        {
            id: '1',
            device: 'MacBook Pro 16"',
            type: 'desktop',
            location: 'Paris, France',
            ip: '192.168.1.1',
            lastActive: new Date(),
            isCurrent: true,
            browser: 'Chrome 120.0'
        },
        {
            id: '2',
            device: 'iPhone 15 Pro',
            type: 'mobile',
            location: 'Lyon, France',
            ip: '10.0.0.1',
            lastActive: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
            isCurrent: false,
            browser: 'Safari Mobile'
        },
        {
            id: '3',
            device: 'Windows Workstation',
            type: 'desktop',
            location: 'Bordeaux, France',
            ip: '172.16.0.5',
            lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
            isCurrent: false,
            browser: 'Edge'
        }
    ]);

    const handleRevokeSession = (sessionId: string) => {
        // Here we would call an API to revoke the refresh token
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        addToast(t('settings.sessionRevoked') || "Session déconnectée avec succès", "success");
    };

    const handleRevokeAll = () => {
        if (!confirm(t('settings.revokeAllConfirm') || "Voulez-vous vraiment déconnecter tous les autres appareils ?")) return;
        setSessions(prev => prev.filter(s => s.isCurrent));
        addToast(t('settings.allSessionsRevoked') || "Toutes les autres sessions ont été fermées", "success");
    };

    return (
        <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col h-full col-span-1 md:col-span-2">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 backdrop-blur-md">
                        <Globe className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.activeSessions') || "Sessions Actives"}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings.manageDevices') || "Gérez vos appareils connectés"}</p>
                    </div>
                </div>
                {sessions.length > 1 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRevokeAll}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 dark:text-red-400"
                    >
                        {t('settings.revokeAll') || "Tout déconnecter"}
                    </Button>
                )}
            </div>

            <div className="relative z-10 p-6 space-y-4">
                {sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/40 dark:border-white/5 transition-all hover:bg-white/80 dark:hover:bg-white/10">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${session.isCurrent ? 'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                {session.type === 'desktop' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{session.device}</h4>
                                    {session.isCurrent && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wide rounded-full">
                                            {t('settings.thisDevice') || "Cet appareil"}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Globe className="w-3 h-3" /> {session.location}
                                    </span>
                                    <span>•</span>
                                    <span>{session.browser}</span>
                                    <span>•</span>
                                    <span className="font-mono opacity-70">{session.ip}</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1.5 text-[10px] font-medium text-slate-400">
                                    <Clock className="w-3 h-3" />
                                    {session.isCurrent ? (t('settings.onlineNow') || 'En ligne maintenant') : `${t('settings.lastActive') || 'Dernière activité'} : ${format(session.lastActive, "d MMM à HH:mm", { locale: fr })}`}
                                </div>
                            </div>
                        </div>

                        {!session.isCurrent && (
                            <Tooltip content={t('settings.revokeAccess') || "Révoquer l'accès"} position="left">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevokeSession(session.id)}
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </Tooltip>
                        )}
                        {session.isCurrent && (
                            <Tooltip content={t('settings.secureSession') || "Session sécurisée"} position="left">
                                <div className="text-emerald-500 dark:text-emerald-400 p-2">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                            </Tooltip>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
