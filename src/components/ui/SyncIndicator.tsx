import React from 'react';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { Cloud, CloudOff } from './Icons';
import { useStore } from '../../store';
import { Tooltip } from './Tooltip';

export const SyncIndicator: React.FC = () => {
    const { isOnline, lastSynced } = useSyncStatus();
    const { t } = useStore();

    if (!isOnline) {
        return (
            <Tooltip content={t('common.offlineMode') || "Mode Hors-ligne"} position="bottom">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-700 animate-pulse">
                    <CloudOff className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('common.offline') || "Hors-ligne"}</span>
                </div>
            </Tooltip>
        );
    }

    return (
        <Tooltip content={`${t('common.synced') || "Synchronisé"} (${lastSynced?.toLocaleTimeString()})`} position="bottom">
            <div className="flex items-center gap-2 px-2 py-1.5 text-success-600 dark:text-success-400 rounded-full text-xs font-medium hover:bg-success-50 dark:hover:bg-success-900/10 transition-colors cursor-help">
                <Cloud className="h-4 w-4" />
                <span className="hidden lg:inline text-success-600/80 dark:text-success-400/80">{t('common.saved') || "Sauvegardé"}</span>
            </div>
        </Tooltip>
    );
};
