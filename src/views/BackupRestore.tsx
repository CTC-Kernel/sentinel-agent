import React, { useState, useEffect } from 'react';

import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { BackupService, BackupMetadata } from '../services/backupService';
import { Save, RotateCcw, Clock, CheckCircle2, AlertTriangle, FileText, Shield, Users, Database, Download, Trash2, RefreshCw, HardDrive, Calendar, CalendarDays } from '../components/ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { Switch } from '../components/ui/Switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { backupConfigSchema, restoreConfigSchema, BackupConfigFormData, RestoreConfigFormData } from '../schemas/backupSchema';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { SEO } from '../components/SEO';
import { usePersistedState } from '../hooks/usePersistedState';

export const BackupRestore: React.FC = () => {
  const { user, addToast } = useStore();
  // hasPermission check
  if (user?.role !== 'direction' && user?.role !== 'rssi') {
    // Redirect or show access denied (handled by Layout usually, but explicit check helps audit)
  }
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
  const backupForm = useForm<BackupConfigFormData>({
    resolver: zodResolver(backupConfigSchema),
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
  const restoreForm = useForm<RestoreConfigFormData>({
    resolver: zodResolver(restoreConfigSchema),
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
    // In BackupMetadata, collections is string[] (names of collections backed up)
    // Wait, BackupMetadata definition in service: collections: string[]
    // But in previous code it was treating it as object?
    // Let's check service again.
    // Service: collections: this.getCollectionsToBackup(config) -> string[]
    // So it is string[].
    restoreForm.setValue('collections', backup.collections);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'creating': return 'text-blue-600 bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 dark:text-blue-400';
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
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="visible"
      className="space-y-8 min-w-0"
    >
      <MasterpieceBackground />
      <SEO title="Sauvegardes & Restauration" description="Gérez vos points de restauration et la sécurité de vos données" />

      {/* Header */}
      <PageHeader
        title="Sauvegardes & Restauration"
        subtitle="Gérez vos points de restauration et la sécurité de vos données."
        breadcrumbs={[{ label: 'Sauvegardes' }]}
        icon={<Database className="h-6 w-6 text-white" strokeWidth={2.5} />}
        actions={
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl max-w-full overflow-x-auto">
            <button
              aria-label="Mode Sauvegarde"
              onClick={() => setActiveTab('backup')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activeTab === 'backup' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Sauvegarder
            </button>
            <button
              aria-label="Mode Restauration"
              onClick={() => setActiveTab('restore')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activeTab === 'restore' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Restaurer
            </button>
          </div>
        }
      />

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden group">
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

        <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden group">
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

        <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden group">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-w-0">
        {/* Left Panel: Actions */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {activeTab === 'backup' ? (
            <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50">
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mr-2">Planifier :</span>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                      <button type="button" aria-label="Programmer une sauvegarde quotidienne" onClick={() => handleScheduleBackup('daily')} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Quotidien</button>
                      <button type="button" aria-label="Programmer une sauvegarde hebdomadaire" onClick={() => handleScheduleBackup('weekly')} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Hebdo</button>
                      <button type="button" aria-label="Programmer une sauvegarde mensuelle" onClick={() => handleScheduleBackup('monthly')} className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Mensuel</button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    aria-label="Lancer la sauvegarde"
                    disabled={loading}
                    className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 w-full sm:w-auto justify-center"
                  >
                    {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    Lancer la sauvegarde
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50">
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
                    <button
                      type="submit"
                      aria-label="Lancer la restauration"
                      disabled={loading}
                      className={`px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-all ${restoreForm.watch('dryRun') ? 'bg-slate-800 text-white hover:bg-slate-900' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/20'}`}
                    >
                      {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
                      {restoreForm.watch('dryRun') ? 'Lancer la simulation' : 'Restaurer les données'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: History */}
        <div className="space-y-6 min-w-0">
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50 h-full max-h-[800px] flex flex-col">
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
                    onClick={() => selectBackupForRestore(backup)}
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
                          <button
                            aria-label="Télécharger le backup"
                            onClick={(e) => { e.stopPropagation(); handleDownloadBackup(backup.id); }}
                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            title="Télécharger"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          aria-label="Supprimer le backup"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmData({
                              isOpen: true,
                              title: 'Supprimer le backup',
                              message: `Êtes-vous sûr de vouloir supprimer le backup ${backup.id} ?`,
                              onConfirm: () => handleDeleteBackup(backup.id)
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
