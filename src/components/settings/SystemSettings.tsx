import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Activity, Trash2, AlertTriangle, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { DataExportService } from '../../services/dataExportService';
import { hasPermission } from '../../utils/permissions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SystemLog } from '../../types';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';

export const SystemSettings: React.FC = () => {
    const { user, addToast, t } = useStore();
    const [auditLogs, setAuditLogs] = useState<SystemLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [exporting, setExporting] = useState(false);

    const handleExportData = async () => {
        if (!user?.organizationId) return;
        setExporting(true);
        try {
            await DataExportService.exportOrganizationData(user.organizationId);
            addToast("Export réussi ! Le téléchargement a démarré.", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SystemSettings.handleExportData', 'UNKNOWN_ERROR');
        } finally {
            setExporting(false);
        }
    };


    useEffect(() => {
        if (!hasPermission(user, 'Settings', 'read')) return;

        const fetchLogs = async () => {
            setLoadingLogs(true);
            try {
                // Fetch last 50 logs for the user's org
                const logsRef = collection(db, 'system_logs');
                const q = query(
                    logsRef,
                    where('organizationId', '==', user?.organizationId)
                );
                const snapshot = await getDocs(q);
                // Sort on client side to avoid index issues
                const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SystemLog[];
                logs.sort((a, b) => {
                    const getMillis = (val: string | number | Timestamp | Date | undefined) => {
                        if (!val) return 0;
                        if (typeof val === 'object' && 'toMillis' in val && typeof val.toMillis === 'function') {
                            return val.toMillis();
                        }
                        if (val instanceof Date) return val.getTime();
                        return new Date(val as string | number).getTime();
                    };
                    return getMillis(b.timestamp) - getMillis(a.timestamp);
                });
                setAuditLogs(logs.slice(0, 50));
            } catch (error) {
                ErrorLogger.handleErrorWithToast(error, 'SystemSettings.fetchLogs', 'FETCH_FAILED');
            } finally {
                setLoadingLogs(false);
            }
        };

        fetchLogs();
    }, [user]);

    // const handleDeleteAccount = () => {
    //     setIsDeleting(true);
    //     // Simulate delete for now or implement real logic
    //     setTimeout(() => {
    //         addToast("Veuillez contacter votre administrateur pour supprimer votre compte.", "info");
    //         setIsDeleting(false);
    //         setIsDeleteModalOpen(false);
    //     }, 1000);
    // };

    const columns = useMemo<ColumnDef<SystemLog>[]>(() => [
        {
            accessorKey: 'timestamp',
            header: t('common.date'),
            cell: ({ row }) => {
                const val = row.original.timestamp;
                if (!val) return '-';

                let date: Date;
                if (typeof val === 'object' && val !== null && 'toDate' in val) {
                    date = (val as Timestamp).toDate();
                } else if (typeof val === 'string' || typeof val === 'number') {
                    date = new Date(val);
                } else {
                    return '-';
                }

                return format(date, 'Pp', { locale: fr });
            }
        },
        {
            accessorKey: 'userId',
            header: t('common.user'),
            cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>
        },
        {
            accessorKey: 'action',
            header: t('common.action'),
            cell: ({ getValue }) => (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {getValue() as string}
                </span>
            )
        },
        {
            accessorKey: 'details',
            header: 'Détails',
            cell: ({ row }) => {
                const details = row.original.details;
                // Safely handle unknown details structure
                const str = typeof details === 'string'
                    ? details
                    : JSON.stringify(details);

                return (
                    <span className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[200px] block" title={str}>
                        {str}
                    </span>
                );
            }
        }
    ], [t]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 animate-slide-in-left">{t('settings.system')}</h2>

            {hasPermission(user, 'Settings', 'read') && (
                <div className="glass-panel p-0 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 backdrop-blur-md shadow-sm">
                                <Activity className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.activityHistory')}</h3>
                        </div>
                    </div>
                    <div className="relative z-10 p-2">
                        <DataTable
                            columns={columns}
                            data={auditLogs}
                            loading={loadingLogs}
                            className="bg-transparent border-none"
                        />
                    </div>
                </div>
            )}

            {/* Data Export */}
            <div className="glass-panel p-8 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-60" />
                <div className="relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-brand-500/10 dark:bg-brand-500/20 rounded-2xl text-brand-600 dark:text-brand-400 shrink-0 backdrop-blur-md">
                            <Download className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                Export de Données
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed max-w-2xl">
                                Téléchargez une archive complète (ZIP) de toutes les données de votre organisation (Actifs, Risques, Contrôles, Documents).
                                Idéal pour vos sauvegardes ou pour la portabilité des données.
                            </p>
                            <Button
                                variant="outline"
                                onClick={handleExportData}
                                disabled={exporting}
                                className="w-full sm:w-auto shadow-lg shadow-brand-500/10"
                            >
                                {exporting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                        Export en cours...
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4 mr-2" />
                                        Exporter tout (.zip)
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Demo Zone - Visible only to demo user or in dev */}
            {(user?.email === 'demo@sentinel-grc.com' || import.meta.env.DEV) && (
                <div className="glass-panel p-8 rounded-[2.5rem] border border-indigo-500/30 dark:border-indigo-500/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-60" />
                    <div className="relative z-10">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0 backdrop-blur-md">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-400 mb-2 flex items-center gap-2">
                                    Zone de Démonstration
                                </h3>
                                <p className="text-sm text-indigo-700/80 dark:text-indigo-300/70 mb-6 leading-relaxed max-w-2xl">
                                    Générez un jeu de données complet (Risques, Actifs, Audits) pour peupler cet environnement de démonstration.
                                    Attention : les données seront ajoutées à l'existant.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        if (!user?.organizationId) return;
                                        setExporting(true); // Reusing loading state for simplicity or create new one
                                        try {
                                            const { DemoDataService } = await import('../../services/demoDataService');
                                            const result = await DemoDataService.generateDemoData(user.organizationId, user);
                                            addToast(`Succès ! ${result.count} éléments générés.`, "success");
                                        } catch (e) {
                                            ErrorLogger.handleErrorWithToast(e, 'GenerateDemoData', 'UNKNOWN_ERROR');
                                        } finally {
                                            setExporting(false);
                                        }
                                    }}
                                    disabled={exporting}
                                    className="w-full sm:w-auto shadow-lg shadow-indigo-500/20 rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                                >
                                    {exporting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                            Génération en cours...
                                        </>
                                    ) : (
                                        <>
                                            <Activity className="h-4 w-4 mr-2" />
                                            Générer Données Démo
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Danger Zone */}
            <div className="glass-panel p-8 rounded-[2.5rem] border border-red-500/30 dark:border-red-500/20 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-60" />
                <div className="relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-500/10 dark:bg-red-500/20 rounded-2xl text-red-600 dark:text-red-400 shrink-0 backdrop-blur-md">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-900 dark:text-red-400 mb-2 flex items-center gap-2">
                                {t('settings.dangerZone')}
                            </h3>
                            <p className="text-sm text-red-700/80 dark:text-red-300/70 mb-6 leading-relaxed max-w-2xl">
                                {t('settings.deleteAccountDescription')}
                            </p>
                            <Button
                                variant="destructive"
                                isLoading={false}
                                onClick={() => addToast("Fonctionnalité à venir pour la suppression de compte", "info")}
                                className="w-full sm:w-auto shadow-lg shadow-red-500/20 rounded-xl"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('settings.deleteAccount')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
