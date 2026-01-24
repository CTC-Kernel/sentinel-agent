import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { BackupService, BackupMetadata } from '../services/backupService';
import { Save, RotateCcw, Clock, AlertTriangle, FileText, Shield, Users, Database, HardDrive, CheckCircle2, Calendar } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SubmitHandler, Controller } from 'react-hook-form';
import { useZodForm } from '../hooks/useZodForm';
import { Switch } from '../components/ui/Switch';
import { backupConfigSchema, restoreConfigSchema, BackupConfigFormData, RestoreConfigFormData } from '../schemas/backupSchema';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { SEO } from '../components/SEO';
import { usePersistedState } from '../hooks/usePersistedState';
import { hasPermission } from '../utils/permissions';

import { OnboardingService } from '../services/onboardingService';
import { BackupStats } from '../components/settings/backup/BackupStats';
import { BackupList } from '../components/settings/backup/BackupList';

export const BackupRestore: React.FC = () => {
  const { user, addToast } = useStore();
  // hasPermission check

  // Start module tour
  useEffect(() => {
    const timer = setTimeout(() => {
      OnboardingService.startBackupTour();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [activeTab, setActiveTab] = usePersistedState<'backup' | 'restore'>('backup_restore_active_tab', 'backup');
  const [stats, setStats] = useState<{ totalBackups: number; totalSize: number; lastBackup?: string }>({ totalBackups: 0, totalSize: 0 });

  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  // Backup Form
  const backupForm = useZodForm({
    schema: backupConfigSchema,
    defaultValues: {
      includeDocuments: true,
      includeAssets: true,
      includeRisks: true,
      includeControls: true,
      includeAudits: true,
      includeProjects: true,
      includeSuppliers: true,
      includeIncidents: true,
      includeUsers: false,
      includeComments: true
    }
  });

  // Restore Form
  const restoreForm = useZodForm({
    schema: restoreConfigSchema,
    defaultValues: {
      backupId: '',
      collections: [],
      overwriteExisting: false,
      dryRun: true
    }
  });

  const loadBackups = React.useCallback(async () => {
    if (!user?.organizationId) return;
    try {
      const list = await BackupService.listBackups(user.organizationId);
      setBackups(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      ErrorLogger.error(error, 'BackupRestore.loadBackups');
      addToast("Erreur lors du chargement des sauvegardes", "error");
    }
  }, [user?.organizationId, addToast]);

  const loadStats = React.useCallback(async () => {
    if (!user?.organizationId) return;
    try {
      const backupStats = await BackupService.getBackupStats(user.organizationId);
      setStats(backupStats);
    } catch (error) {
      ErrorLogger.error(error, 'BackupRestore.loadStats');
    }
  }, [user?.organizationId]);

  useEffect(() => {
    if (user?.organizationId) {
      Promise.all([loadBackups(), loadStats()]).finally(() => setInitialLoading(false));
    } else {
      setInitialLoading(false);
    }
  }, [user?.organizationId, loadBackups, loadStats]);

  if (!user || !hasPermission(user, 'Backup', 'read')) {
    return <Navigate to="/" replace />;
  }

  if (initialLoading) {
    return <LoadingScreen />;
  }

  const handleBackup: SubmitHandler<BackupConfigFormData> = async (data) => {
    if (!user) return;
    setLoading(true);
    try {
      await BackupService.createBackup(user, data);
      addToast(`Sauvegarde créée avec succès`, "success");
      loadBackups();
      loadStats();

    } catch (error) {
      ErrorLogger.error(error, 'BackupRestore.handleBackup');
      addToast("Erreur lors de la création de la sauvegarde", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleBackup = async (frequency: 'daily' | 'weekly' | 'monthly') => {
    if (!user) return;
    try {
      await BackupService.scheduleBackup(user, backupForm.getValues(), frequency);
      addToast(`Backup programmé (${frequency})`, 'success');
    } catch (error) {
      ErrorLogger.error(error, 'BackupRestore.handleScheduleBackup');
      addToast('Erreur lors de la programmation', 'error');
    }
  };

  const handleRestore: SubmitHandler<RestoreConfigFormData> = async (data) => {
    if (!user) return;
    if (!data.backupId) {
      addToast("Veuillez sélectionner une sauvegarde", "error");
      return;
    }
    if (data.collections.length === 0) {
      addToast("Veuillez sélectionner au moins une collection", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await BackupService.restoreBackup(user, data);
      if (result.success) {
        if (data.dryRun) {
          addToast("Simulation de restauration réussie", "success");
        } else {
          addToast("Restauration effectuée avec succès", "success");
        }
      } else {
        addToast("Erreur lors de la restauration", "error");
      }
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'BackupRestore.handleRestore', 'UNKNOWN_ERROR');
      addToast("Erreur lors de la restauration", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!user) return;
    try {
      await BackupService.deleteBackup(user, id);
      addToast("Sauvegarde supprimée", "success");
      loadBackups();
      loadStats();
      if (selectedBackup?.id === id) {
        setSelectedBackup(null);
        restoreForm.setValue('backupId', '');
      }
    } catch (error) {
      ErrorLogger.error(error, 'BackupRestore.handleDeleteBackup');
      addToast("Erreur lors de la suppression", "error");
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    if (!user) return;
    try {
      const url = await BackupService.getBackupUrl(user, backupId);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${backupId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      ErrorLogger.error(error, 'BackupRestore.handleDownloadBackup');
      addToast('Erreur lors du téléchargement', 'error');
    }
  };

  const toggleCollection = (collection: string) => {
    const current = restoreForm.getValues('collections');
    if (current.includes(collection)) {
      restoreForm.setValue('collections', current.filter(c => c !== collection));
    } else {
      restoreForm.setValue('collections', [...current, collection]);
    }
  };

  const selectBackupForRestore = (backup: BackupMetadata) => {
    setSelectedBackup(backup);
    restoreForm.setValue('backupId', backup.id);
    restoreForm.setValue('collections', backup.collections);
  };



  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="visible"
      className="flex flex-col gap-10 min-w-0"
    >
      <MasterpieceBackground />
      <SEO title="Sauvegardes & Restauration" description="Gérez vos points de restauration et la sécurité de vos données" />

      {/* Header */}
      <PageHeader
        title="Sauvegardes & Restauration"
        subtitle="Gérez vos points de restauration et la sécurité de vos données."
        icon={
          <img
            src="/images/administration.png"
            alt="ADMINISTRATION"
            className="w-full h-full object-contain"
          />
        }
        actions={
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl max-w-full overflow-x-auto">
            <Button
              variant="ghost"
              aria-label="Mode Sauvegarde"
              onClick={() => setActiveTab('backup')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activeTab === 'backup' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Sauvegarder
            </Button>
            <Button
              variant="ghost"
              aria-label="Mode Restauration"
              onClick={() => setActiveTab('restore')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activeTab === 'restore' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Restaurer
            </Button>
          </div>
        }
      />

      {/* Statistiques */}
      <BackupStats stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-w-0">
        {/* Left Panel: Actions */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {activeTab === 'backup' ? (
            <div className="glass-premium p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Save className="h-5 w-5 text-indigo-500" /> Nouvelle Sauvegarde
              </h2>
              <form onSubmit={backupForm.handleSubmit(handleBackup)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {[
                    { id: 'includeDocuments', label: 'Documents', icon: FileText },
                    { id: 'includeAssets', label: 'Actifs', icon: HardDrive },
                    { id: 'includeRisks', label: 'Risques', icon: AlertTriangle },
                    { id: 'includeControls', label: 'Contrôles', icon: Shield },
                    { id: 'includeAudits', label: 'Audits', icon: CheckCircle2 },
                    { id: 'includeProjects', label: 'Projets', icon: Calendar },
                    { id: 'includeSuppliers', label: 'Fournisseurs', icon: Users },
                    { id: 'includeIncidents', label: 'Incidents', icon: AlertTriangle },
                    { id: 'includeUsers', label: 'Utilisateurs', icon: Users },
                    { id: 'includeComments', label: 'Commentaires', icon: FileText },
                  ].map((item) => (
                    <label key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-slate-500 group-hover:text-indigo-500 transition-colors" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                      </div>
                      <Controller
                        control={backupForm.control}
                        name={item.id as keyof BackupConfigFormData}
                        render={({ field: { value, onChange } }) => (
                          <Switch
                            checked={!!value}
                            onChange={onChange}
                          />
                        )}
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2" data-tour="backup-schedule">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mr-2">Planifier :</span>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                      <Button type="button" variant="ghost" size="sm" aria-label="Programmer une sauvegarde quotidienne" onClick={() => handleScheduleBackup('daily')} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Quotidien</Button>
                      <Button type="button" variant="ghost" size="sm" aria-label="Programmer une sauvegarde hebdomadaire" onClick={() => handleScheduleBackup('weekly')} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Hebdo</Button>
                      <Button type="button" variant="ghost" size="sm" aria-label="Programmer une sauvegarde mensuelle" onClick={() => handleScheduleBackup('monthly')} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Mensuel</Button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    aria-label="Lancer la sauvegarde"
                    disabled={loading}
                    isLoading={loading}
                    className="px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 w-full sm:w-auto justify-center"
                  >
                    {!loading && <Save className="h-5 w-5 mr-2" />}
                    Lancer la sauvegarde
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="glass-premium p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-indigo-500" /> Restauration
              </h2>
              {!selectedBackup ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <Database className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">Sélectionnez une sauvegarde dans la liste pour commencer</p>
                </div>
              ) : (
                <form onSubmit={restoreForm.handleSubmit(handleRestore)} className="space-y-6">
                  <div className="p-4 bg-indigo-50 dark:bg-slate-900 dark:bg-slate-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Sauvegarde sélectionnée</span>
                      <span className="text-xs font-mono bg-white dark:bg-black/20 px-2 py-1 rounded text-slate-600">{selectedBackup.id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                      <Clock className="h-4 w-4" />
                      {format(new Date(selectedBackup.createdAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Collections à restaurer</label>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedBackup.collections.map((col) => (
                        <label key={col} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${restoreForm.watch('collections').includes(col) ? 'border-indigo-500 bg-indigo-50 dark:bg-slate-900 dark:bg-slate-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                          <span className="text-sm font-medium capitalize text-slate-700 dark:text-slate-300">{col}</span>
                          <Switch
                            checked={restoreForm.watch('collections').includes(col)}
                            onChange={() => toggleCollection(col)}
                          />
                        </label>
                      ))}
                    </div>
                    {restoreForm.formState.errors.collections && <p className="text-red-500 text-xs mt-1">{restoreForm.formState.errors.collections.message}</p>}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <div>
                        <span className="block font-medium text-slate-900 dark:text-white">Écraser les données existantes</span>
                        <span className="text-xs text-slate-600">Si coché, les données actuelles seront remplacées par celles de la sauvegarde.</span>
                      </div>
                      <Controller
                        control={restoreForm.control}
                        name="overwriteExisting"
                        render={({ field: { value, onChange } }) => (
                          <Switch checked={!!value} onChange={onChange} />
                        )}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <div>
                        <span className="block font-medium text-slate-900 dark:text-white">Simulation (Dry Run)</span>
                        <span className="text-xs text-slate-600">Vérifie l'intégrité sans modifier les données.</span>
                      </div>
                      <Controller
                        control={restoreForm.control}
                        name="dryRun"
                        render={({ field: { value, onChange } }) => (
                          <Switch checked={!!value} onChange={onChange} />
                        )}
                      />
                    </label>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      aria-label="Lancer la restauration"
                      disabled={loading}
                      isLoading={loading}
                      className={`px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-all ${restoreForm.watch('dryRun') ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/20'}`}
                    >
                      {!loading && <RotateCcw className="h-5 w-5 mr-2" />}
                      {restoreForm.watch('dryRun') ? 'Lancer la simulation' : 'Restaurer les données'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: History */}
        <div className="space-y-6 min-w-0">
          <BackupList
            backups={backups}
            selectedBackup={selectedBackup}
            onSelect={selectBackupForRestore}
            onDownload={handleDownloadBackup}
            onDelete={(id) => {
              setConfirmData({
                isOpen: true,
                title: 'Supprimer le backup',
                message: `Êtes-vous sûr de vouloir supprimer le backup ${id} ?`,
                onConfirm: () => handleDeleteBackup(id)
              });
            }}
          />
        </div>
      </div>

      {/* Modal de confirmation */}
      <ConfirmModal
        isOpen={confirmData.isOpen}
        title={confirmData.title}
        message={confirmData.message}
        onConfirm={() => {
          confirmData.onConfirm();
          setConfirmData({ ...confirmData, isOpen: false });
        }}
        onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
      />
    </motion.div >
  );
};

// Headless UI handles FocusTrap and keyboard navigation
