import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { Activity, Trash2, AlertTriangle, Download, Shield } from '../ui/Icons';
import { Button } from '../ui/button';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { DataExportService } from '../../services/dataExportService';
import { hasPermission } from '../../utils/permissions';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { SystemLog } from '../../types';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Modal } from '../ui/Modal';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { useAuditLogs } from '../../hooks/audit/useAuditLogs';
import { PremiumCard } from '../ui/PremiumCard';

export const SystemSettings: React.FC = () => {
    const { user, addToast, t } = useStore();
    const { dateFnsLocale } = useLocale();
    const { logs: auditLogsRaw, loading: loadingLogs } = useAuditLogs(
        hasPermission(user, 'Settings', 'read') ? user?.organizationId : undefined
    );
    const [exporting, setExporting] = useState(false);
    const [exportingGDPR, setExportingGDPR] = useState(false);

    // Convert AuditLog to SystemLog format and take top 50
    const auditLogs = useMemo(() => {
        return (auditLogsRaw as unknown as SystemLog[]).slice(0, 50);
    }, [auditLogsRaw]);

    const handleExportData = async () => {
        if (!user?.organizationId) return;
        setExporting(true);
        try {
            await DataExportService.exportOrganizationData({ organizationId: user.organizationId });
            addToast(t('settings.toast.exportSuccess', { defaultValue: "Export réussi ! Le téléchargement a démarré." }), "success");
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error, 'SystemSettings.handleExportData', 'UNKNOWN_ERROR');
        } finally {
            setExporting(false);
        }
    };

    /**
     * GDPR Article 20 - Right to Data Portability
     * This export is ALWAYS available regardless of subscription plan.
     */
    const handleExportGDPRData = async () => {
        if (!user?.uid || !user?.organizationId) return;
        setExportingGDPR(true);
        try {
            await DataExportService.exportGDPRData({
                userId: user.uid,
                organizationId: user.organizationId
            });
            addToast(t('settings.toast.gdprExportSuccess', { defaultValue: "Export RGPD réussi ! Le téléchargement a démarré." }), "success");
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error, 'SystemSettings.handleExportGDPRData', 'UNKNOWN_ERROR');
        } finally {
            setExportingGDPR(false);
        }
    };

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

                return format(date, 'Pp', { locale: dateFnsLocale });
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
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-border/40 dark:border-slate-700">
                    {getValue() as string}
                </span>
            )
        },
        {
            accessorKey: 'details',
            header: t('common.details'),
            cell: ({ row }) => {
                const details = row.original.details;
                // Safely handle unknown details structure
                const str = typeof details === 'string'
                    ? details
                    : JSON.stringify(details);

                return (
                    <span className="text-slate-500 dark:text-muted-foreground text-xs truncate max-w-[200px] block" title={str}>
                        {str}
                    </span>
                );
            }
        }
    ], [t]);

    // Account Deletion Logic
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
    const [reauthPassword, setReauthPassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const performDelete = async () => {
        if (!auth.currentUser) return;
        setIsDeleting(true);
        try {
            const { deleteUser } = await import('firebase/auth');
            await deleteUser(auth.currentUser);
            addToast(t('settings.toast.accountDeleted', { defaultValue: "Compte supprimé avec succès. Au revoir." }), "success");
            // AuthContext will handle logout/redirect automatically
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'auth/requires-recent-login') {
                setIsDeleteModalOpen(false);
                setIsReauthModalOpen(true);
            } else {
                ErrorLogger.handleErrorWithToast(error, 'DeleteAccount');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReauth = async () => {
        if (!auth.currentUser || !reauthPassword) return;
        setIsDeleting(true);
        try {
            const { reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth');
            const credential = EmailAuthProvider.credential(auth.currentUser.email!, reauthPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            setIsReauthModalOpen(false);
            setReauthPassword('');
            // Retry delete
            await performDelete();
        } catch (error: unknown) {
            ErrorLogger.handleErrorWithToast(error, 'ReAuth', 'AUTH_FAILED');
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 animate-slide-in-left">{t('settings.system')}</h2>

            {hasPermission(user, 'Settings', 'read') && (
                <PremiumCard glass className="p-0 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-info-bg dark:bg-info-500/20 rounded-3xl text-info-600 dark:text-info-400 backdrop-blur-md shadow-sm">
                                <Activity className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.activityHistory')}</h3>
                        </div>
                    </div>
                    <div className="relative z-10 p-2">
                        {loadingLogs ? (
                            <div className="space-y-3 p-4 animate-pulse">
                                <div className="h-10 bg-muted/50 rounded-lg" />
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i || 'unknown'} className="h-12 bg-muted/30 rounded-lg" />
                                ))}
                            </div>
                        ) : (
                            <DataTable
                                columns={columns}
                                data={auditLogs}
                                loading={loadingLogs}
                                className="bg-transparent border-none"
                            />
                        )}
                    </div>
                </PremiumCard>
            )}

            {/* Data Export */}
            <PremiumCard glass className="p-8 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-70 opacity-60" />
                <div className="relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-brand-50 dark:bg-brand-900 rounded-3xl text-brand-600 dark:text-brand-400 shrink-0 backdrop-blur-md border border-brand-100 dark:border-brand-500/20 shadow-inner">
                            <Download className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                {t('settings.systemPage.exportData')}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 leading-relaxed max-w-2xl">
                                {t('settings.systemPage.exportDataDesc')}
                            </p>
                            <Button
                                variant="outline"
                                onClick={handleExportData}
                                disabled={exporting}
                                className="w-full sm:w-auto shadow-lg shadow-brand-500/25"
                            >
                                {exporting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                        {t('settings.systemPage.exporting')}
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4 mr-2" />
                                        {t('settings.systemPage.exportAllZip')}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </PremiumCard>

            {/* GDPR Personal Data Export - Always Available */}
            <PremiumCard glass className="p-8 rounded-3xl border border-success-500/30 dark:border-success-500/20 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-success-500/5 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-70 opacity-60" />
                <div className="relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-success-bg dark:bg-success-500/20 rounded-3xl text-success-600 dark:text-success-400 shrink-0 backdrop-blur-md border border-success-500/20 shadow-inner">
                            <Shield className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                {t('settings.systemPage.gdprExport') || 'Export RGPD (Données Personnelles)'}
                                <span className="text-xs font-medium text-success-600 dark:text-success-400 bg-success-100 dark:bg-success-900/30 px-2 py-0.5 rounded-full">
                                    Art. 20 RGPD
                                </span>
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 leading-relaxed max-w-2xl">
                                {t('settings.systemPage.gdprExportDesc') || 'Téléchargez toutes vos données personnelles conformément au droit à la portabilité (Article 20 RGPD). Cet export est toujours disponible, quel que soit votre plan d\'abonnement.'}
                            </p>
                            <Button
                                variant="outline"
                                onClick={handleExportGDPRData}
                                disabled={exportingGDPR}
                                className="w-full sm:w-auto shadow-lg shadow-success-500/10 border-success-200 dark:border-success-800 text-success-700 dark:text-success-300 hover:bg-success-50 dark:hover:bg-success-900/30"
                            >
                                {exportingGDPR ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                        {t('settings.systemPage.exporting') || 'Export en cours...'}
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4 mr-2" />
                                        {t('settings.systemPage.exportGDPRZip') || 'Exporter mes données personnelles'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </PremiumCard>

            {/* Demo Zone - Visible only to demo user or in dev */}
            {(user?.email === 'demo@sentinel-grc.com' || import.meta.env.DEV) && (
                <PremiumCard glass className="p-8 rounded-3xl border border-violet-500/30 dark:border-violet-500/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-70 opacity-60" />
                    <div className="relative z-10">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-violet-500/10 dark:bg-violet-500/20 rounded-3xl text-violet-600 dark:text-violet-400 shrink-0 backdrop-blur-md border border-violet-500/20 shadow-inner">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div className="w-full">
                                <h3 className="text-lg font-bold text-violet-900 dark:text-violet-400 mb-2 flex items-center gap-2">
                                    {t('settings.systemPage.demoZone')}
                                </h3>
                                <p className="text-sm text-violet-700/80 dark:text-violet-300/70 mb-6 leading-relaxed max-w-2xl">
                                    {t('settings.systemPage.demoZoneDesc')}
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        if (!user?.organizationId) return;
                                        setExporting(true); // Reusing loading state for simplicity or create new one
                                        try {
                                            const { DemoDataService } = await import('../../services/demoDataService');
                                            const result = await DemoDataService.generateDemoData(user.organizationId, user);
                                            addToast(t('settings.toast.demoDataGenerated', { defaultValue: `Succès ! ${result.count} éléments générés.`, count: result.count }), "success");
                                        } catch (_e) {
                                            ErrorLogger.handleErrorWithToast(_e, 'GenerateDemoData', 'UNKNOWN_ERROR');
                                        } finally {
                                            setExporting(false);
                                        }
                                    }}
                                    disabled={exporting}
                                    className="w-full sm:w-auto shadow-lg shadow-violet-500/20 rounded-3xl border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                                >
                                    {exporting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                            {t('settings.systemPage.generating')}
                                        </>
                                    ) : (
                                        <>
                                            <Activity className="h-4 w-4 mr-2" />
                                            {t('settings.systemPage.generateDemoData')}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </PremiumCard>
            )}

            {/* Danger Zone */}
            <PremiumCard glass className="p-8 rounded-3xl border border-red-500/30 dark:border-red-500/20 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-70 opacity-60" />
                <div className="relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-50 dark:bg-red-500/20 rounded-3xl text-red-600 dark:text-red-400 shrink-0 backdrop-blur-md border border-red-500/20 shadow-inner">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-900 dark:text-red-400 mb-2 flex items-center gap-2">
                                {t('settings.dangerZone')}
                            </h3>
                            <p className="text-sm text-red-700/80 dark:text-red-300/70 mb-6 leading-relaxed max-w-2xl">
                                {t('settings.systemPage.deleteAccountDesc')}
                            </p>
                            <Button
                                variant="destructive"
                                isLoading={isDeleting}
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="w-full sm:w-auto shadow-lg shadow-red-500/20 rounded-3xl"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('settings.deleteAccount')}
                            </Button>
                        </div>
                    </div>
                </div>
            </PremiumCard>

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={performDelete}
                title={t('settings.deleteAccount')}
                message={t('settings.deleteAccountConfirmMessage', { defaultValue: 'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible et toutes vos données seront perdues.' })}
                type="danger"
                cancelText={t('common.cancel')}
                confirmText={t('common.delete')}
                loading={isDeleting}
            />

            <Modal
                isOpen={isReauthModalOpen}
                onClose={() => { setIsReauthModalOpen(false); setIsDeleting(false); }}
                title={t('settings.securityVerification', { defaultValue: 'Vérification de sécurité' })}
                maxWidth="max-w-md"
            >
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-500 dark:text-muted-foreground">
                        {t('settings.securityVerificationMessage', { defaultValue: 'Pour des raisons de sécurité, veuillez confirmer votre mot de passe pour continuer la suppression du compte.' })}
                    </p>
                    <FloatingLabelInput
                        label={t('common.password', { defaultValue: 'Mot de passe' })}
                        type="password"
                        value={reauthPassword}
                        onChange={(e) => setReauthPassword(e.target.value)}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsReauthModalOpen(false)}>
                            {t('common.cancel', { defaultValue: 'Annuler' })}
                        </Button>
                        <Button variant="destructive" onClick={handleReauth} isLoading={isDeleting}>
                            {t('settings.confirmDeletion', { defaultValue: 'Confirmer la suppression' })}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
