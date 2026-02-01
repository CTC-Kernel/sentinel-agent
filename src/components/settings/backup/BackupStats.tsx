import React from 'react';
import { Database, HardDrive, CalendarDays } from '../../ui/Icons';
import { PremiumCard } from '../../ui/PremiumCard';
import { useLocale } from '@/hooks/useLocale';

interface BackupStatsProps {
    stats: {
        totalBackups: number;
        totalSize: number;
        lastBackup?: string;
    };
}

export const BackupStats: React.FC<BackupStatsProps> = ({ stats }) => {
    const { config } = useLocale();
    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PremiumCard glass
                className="p-6 relative overflow-hidden group"
                hover={true}
                gradientOverlay={true}
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-info-bg rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-info-500/20 transition-colors"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 bg-info-50 dark:bg-info-900/20 rounded-2xl text-info-600 dark:text-info-400 mr-4 border border-info-100 dark:border-info-500/20">
                        <Database className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-1">Total Backups</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalBackups}</p>
                    </div>
                </div>
            </PremiumCard>

            <PremiumCard glass
                className="p-6 relative overflow-hidden group"
                hover={true}
                gradientOverlay={true}
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-success-bg rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-success-500/20 transition-colors"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 bg-success-50 dark:bg-success-900/20 rounded-2xl text-success-600 dark:text-success-400 mr-4 border border-success-100 dark:border-success-500/20">
                        <HardDrive className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-1">Espace Utilisé</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{formatSize(stats.totalSize)}</p>
                    </div>
                </div>
            </PremiumCard>

            <PremiumCard glass
                className="p-6 relative overflow-hidden group"
                hover={true}
                gradientOverlay={true}
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/15 dark:bg-violet-400/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-violet-500/25 dark:group-hover:bg-violet-400/20 transition-colors"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-2xl text-violet-600 dark:text-violet-400 mr-4 border border-violet-100 dark:border-violet-500/20">
                        <CalendarDays className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-1">Dernier Backup</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">
                            {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString(config.intlLocale) : 'Aucun'}
                        </p>
                    </div>
                </div>
            </PremiumCard>
        </div>
    );
};
