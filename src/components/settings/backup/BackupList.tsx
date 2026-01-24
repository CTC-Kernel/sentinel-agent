import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Database, Download, Trash2, CheckCircle2, RefreshCw, AlertTriangle } from '../../ui/Icons';
import { Button } from '../../ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BackupMetadata } from '../../../services/backupService';

interface BackupListProps {
    backups: BackupMetadata[];
    selectedBackup: BackupMetadata | null;
    onSelect: (backup: BackupMetadata) => void;
    onDownload: (id: string) => void;
    onDelete: (id: string) => void;
}

export const BackupList: React.FC<BackupListProps> = ({
    backups,
    selectedBackup,
    onSelect,
    onDownload,
    onDelete
}) => {
    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
            case 'creating': return 'text-blue-600 bg-blue-50 dark:bg-slate-900 dark:text-blue-400';
            case 'failed': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
            default: return 'text-slate-600 bg-slate-50 dark:bg-white/5 dark:text-slate-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="h-4 w-4" />;
            case 'creating': return <RefreshCw className="h-4 w-4 animate-spin" />;
            case 'failed': return <AlertTriangle className="h-4 w-4" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    return (
        <div className="glass-premium p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50 h-full max-h-[800px] flex flex-col">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" /> Historique
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {backups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <Database className="h-10 w-10 opacity-20 mb-3" />
                        <p className="font-medium">Aucune sauvegarde</p>
                    </div>
                ) : (
                    backups.map((backup) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={backup.id}
                            onClick={() => onSelect(backup)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${selectedBackup?.id === backup.id ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-500/30 ring-1 ring-indigo-500/20' : 'bg-white/50 dark:bg-white/5 border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-md'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">#{backup.id.slice(0, 6)}...</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(backup.status).replace('bg-', 'border-').replace('/20', '/30')}`}>
                                        {getStatusIcon(backup.status)}
                                        <span className="ml-1.5">{backup.status}</span>
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    {backup.status === 'completed' && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Télécharger le backup"
                                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDownload(backup.id); }}
                                            className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                            title="Télécharger"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Supprimer le backup"
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            onDelete(backup.id); // Just propagate ID, parent handles confirmation
                                        }}
                                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <Database className="h-5 w-5 text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        {format(new Date(backup.createdAt), "d MMM yyyy", { locale: fr })}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {format(new Date(backup.createdAt), "HH:mm", { locale: fr })} • {backup.collections.length} collections
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {backup.collections.slice(0, 3).map(c => (
                                    <span key={c} className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 capitalize">{c}</span>
                                ))}
                                {backup.collections.length > 3 && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">+{backup.collections.length - 3}</span>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};
