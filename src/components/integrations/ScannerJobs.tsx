import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { integrationService } from '../../services/integrationService';
import { ScannerJob, ScannerJobCreate } from '../../types/job';
import { Play, Clock, Calendar, AlertCircle, CheckCircle, XCircle, Trash2, Plus, RefreshCw, Layers } from '../ui/Icons';
import { toast } from '@/lib/toast';
import { useStore } from '../../store';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';

export const ScannerJobs: React.FC = () => {
    const { demoMode, user, t } = useStore();
    const [jobs, setJobs] = useState<ScannerJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newJob, setNewJob] = useState<ScannerJobCreate>({
        scannerId: 'nessus',
        target: '',
        frequency: 'once'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteJobId, setDeleteJobId] = useState<string | null>(null);

    const loadJobs = React.useCallback(async () => {
        try {
            setLoading(true);
            const data = await integrationService.getScannerJobs(user?.organizationId, demoMode);
            setJobs(data);
        } catch {
            toast.error(t('scanner.loadFailed') || 'Erreur lors du chargement des tâches de scan');
        } finally {
            setLoading(false);
        }
    }, [demoMode, user?.organizationId, t]);

    useEffect(() => {
        loadJobs();
    }, [loadJobs]);

    const handleCreateJob = async () => {
        if (!newJob.target) {
            toast.error(t('scanner.targetRequired') || 'Veuillez spécifier une cible');
            return;
        }

        setIsSubmitting(true);
        try {
            await integrationService.scheduleScannerJob(newJob, user?.organizationId, demoMode);
            toast.success(t('scanner.jobScheduled') || 'Tâche de scan programmée avec succès');
            setIsCreateModalOpen(false);
            loadJobs();
            setNewJob({ scannerId: 'nessus', target: '', frequency: 'once' });
        } catch {
            toast.error(t('scanner.jobCreationFailed') || 'Erreur lors de la création de la tâche');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteJob = async (id: string) => {
        try {
            await integrationService.deleteScannerJob(id, user?.organizationId, demoMode);
            toast.success(t('scanner.jobDeleted') || 'Tâche supprimée');
            // Optimistic update
            setJobs(prev => prev.filter(j => j.id !== id));
        } catch {
            toast.error(t('errors.deletionFailed') || 'Erreur lors de la suppression');
        } finally {
            setDeleteJobId(null);
        }
    };

    const getStatusIcon = (status: ScannerJob['status']) => {
        switch (status) {
            case 'completed': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
            case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
            case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
            case 'scheduled': return <Clock className="h-4 w-4 text-amber-500" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Layers className="h-5 w-5 text-brand-500" />
                        Orchestrateur de Scans
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-muted-foreground">
                        Gérez vos scans de vulnérabilités planifiés.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-3xl shadow-lg shadow-brand-500/20 transition-all font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                    <Plus className="h-4 w-4" />
                    Nouveau Scan
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                </div>
            ) : jobs.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-border/40 dark:border-border/40">
                    <p className="text-slate-500 dark:text-muted-foreground">Aucune tâche de scan configurée.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {jobs.map((job) => (
                        <motion.div
                            key={job.id || 'unknown'}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-white dark:bg-slate-950 rounded-2xl border border-border/40 dark:border-white/5 hover:border-brand-300 transition-all shadow-sm hover:shadow-md"
                        >
                            <div className="flex items-center gap-4 mb-4 md:mb-0">
                                <div className={`p-3 rounded-3xl bg-slate-100 dark:bg-white/5 ${job.status === 'running' ? 'text-brand-500' : 'text-slate-500'}`}>
                                    {getStatusIcon(job.status)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 dark:text-white capitalize">{job.scannerId}</span>
                                        <span className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded-full ${job.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                            job.status === 'failed' ? 'bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-50 dark:text-red-400' :
                                                job.status === 'running' ? 'bg-blue-100 text-blue-700 dark:text-blue-400 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-amber-100 text-amber-700 dark:text-amber-400 dark:bg-amber-50 dark:text-amber-400'
                                            }`}>
                                            {job.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-muted-foreground mt-1">
                                        <span className="flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Cible: {job.target}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {job.frequency}
                                        </span>
                                        {job.nextRun && (
                                            <span className="flex items-center gap-1 text-brand-500">
                                                <Play className="h-3 w-3" />
                                                Prochain: {new Date(job.nextRun).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                <button
                                    onClick={() => setDeleteJobId(job.id)}
                                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                    title="Supprimer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Planifier un nouveau scan"
                maxWidth="max-w-md"
            >
                <div className="space-y-6 pt-4">
                    <CustomSelect
                        label="Scanner"
                        value={newJob.scannerId}
                        onChange={(val) => setNewJob({ ...newJob, scannerId: val as ScannerJobCreate['scannerId'] })}
                        options={[
                            { value: 'nessus', label: 'Nessus' },
                            { value: 'qualys', label: 'Qualys' },
                            { value: 'openvas', label: 'OpenVAS' }
                        ]}
                    />

                    <FloatingLabelInput
                        label="Cible (IP, Domaine ou Plage)"
                        value={newJob.target}
                        onChange={(e) => setNewJob({ ...newJob, target: e.target.value })}
                        placeholder="ex: 192.168.1.0/24"
                    />

                    <CustomSelect
                        label="Fréquence"
                        value={newJob.frequency}
                        onChange={(val) => setNewJob({ ...newJob, frequency: val as ScannerJobCreate['frequency'] })}
                        options={[
                            { value: 'once', label: 'Une fois' },
                            { value: 'daily', label: 'Quotidien' },
                            { value: 'weekly', label: 'Hebdomadaire' },
                            { value: 'monthly', label: 'Mensuel' }
                        ]}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded-lg"
                        >
                            {t('common.cancel', { defaultValue: 'Annuler' })}
                        </button>
                        <button
                            onClick={handleCreateJob}
                            disabled={isSubmitting || !newJob.target}
                            className="px-4 py-2 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-lg shadow-brand-500/25 transition-all disabled:bg-muted disabled:text-muted-foreground flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            {isSubmitting ? t('scanner.creating', { defaultValue: 'Création...' }) : t('scanner.schedule', { defaultValue: 'Planifier' })}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={deleteJobId !== null}
                onClose={() => setDeleteJobId(null)}
                onConfirm={() => deleteJobId && handleDeleteJob(deleteJobId)}
                title={t('scanner.deleteJobTitle', { defaultValue: 'Supprimer la tâche de scan' })}
                message={t('scanner.deleteJobMessage', { defaultValue: 'Êtes-vous sûr de vouloir supprimer cette tâche ?' })}
                type="danger"
                confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
                cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
            />
        </div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
