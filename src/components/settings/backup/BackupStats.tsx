import React from 'react';
import { Database, HardDrive, CalendarDays } from '../../ui/Icons';

interface BackupStatsProps {
    stats: {
        totalBackups: number;
        totalSize: number;
        lastBackup?: string;
    };
}

export const BackupStats: React.FC<BackupStatsProps> = ({ stats }) => {
    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-premium p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400 mr-4 border border-blue-100 dark:border-blue-500/20">
                        <Database className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Total Backups</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalBackups}</p>
                    </div>
                </div>
            </div>

            <div className="glass-premium p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-colors"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 dark:text-emerald-400 mr-4 border border-emerald-100 dark:border-emerald-500/20">
                        <HardDrive className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Espace Utilisé</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{formatSize(stats.totalSize)}</p>
                    </div>
                </div>
            </div>

            <div className="glass-premium p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors"></div>
                <div className="flex items-center relative z-10">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600 dark:text-purple-400 mr-4 border border-purple-100 dark:border-purple-500/20">
                        <CalendarDays className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Dernier Backup</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">
                            {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString('fr-FR') : 'Aucun'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
