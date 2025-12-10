import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { BackupService, BackupMetadata } from '../services/backupService';
import { Save, RotateCcw, Clock, CheckCircle2, AlertTriangle, FileText, Shield, Users, Database, Download, Trash2, RefreshCw, HardDrive, Calendar, CalendarDays, HelpCircle } from '../components/ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { backupConfigSchema, restoreConfigSchema, BackupConfigFormData, RestoreConfigFormData } from '../schemas/backupSchema';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { OnboardingService } from '../services/onboardingService';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export const BackupRestore: React.FC = () => {
  const { user, addToast } = useStore();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');
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
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl"><Database className="h-8 w-8 text-indigo-500" /></div>
            Sauvegardes & Restauration
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 ml-14">Gérez vos points de restauration et la sécurité de vos données.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => OnboardingService.startBackupTour()}
            className="flex items-center px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors text-sm font-medium"
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Aide
          </button>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'backup' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Sauvegarder
            </button>
            <button
              onClick={() => setActiveTab('restore')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'restore' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Restaurer
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="flex items-center relative z-10">
            <div className="p-3 bg-blue-100 dark:bg-slate-900/30 rounded-2xl text-blue-600 dark:text-blue-400 mr-4">
              <Database className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total des backups</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.totalBackups}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="flex items-center relative z-10">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400 mr-4">
              <FileText className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Espace utilisé</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{formatSize(stats.totalSize)}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="flex items-center relative z-10">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl text-purple-600 dark:text-purple-400 mr-4">
              <CalendarDays className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Dernier backup</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString('fr-FR') : 'Jamais'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Actions */}
        <div className="lg:col-span-2 space-y-6">
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
                    <label key={item.id} className="flex items-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                        {...backupForm.register(item.id as keyof BackupConfigFormData)}
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-slate-500 group-hover:text-indigo-500 transition-colors" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Planifier :</span>
                    <button type="button" onClick={() => handleScheduleBackup('daily')} className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors">Quotidien</button>
                    <button type="button" onClick={() => handleScheduleBackup('weekly')} className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors">Hebdo</button>
                    <button type="button" onClick={() => handleScheduleBackup('monthly')} className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors">Mensuel</button>
                  </div>
                  <button
                    type="submit"
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
                        <label key={col} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${restoreForm.watch('collections').includes(col) ? 'border-indigo-500 bg-indigo-50 dark:bg-slate-900 dark:bg-slate-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                          <input
                            type="checkbox"
                            checked={restoreForm.watch('collections').includes(col)}
                            onChange={() => toggleCollection(col)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="ml-2 text-sm font-medium capitalize text-slate-700 dark:text-slate-300">{col}</span>
                        </label>
                      ))}
                    </div>
                    {restoreForm.formState.errors.collections && <p className="text-red-500 text-xs mt-1">{restoreForm.formState.errors.collections.message}</p>}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600" {...restoreForm.register('overwriteExisting')} />
                      <div>
                        <span className="block font-medium text-slate-900 dark:text-white">Écraser les données existantes</span>
                        <span className="text-xs text-slate-600">Si coché, les données actuelles seront remplacées par celles de la sauvegarde.</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600" {...restoreForm.register('dryRun')} />
                      <div>
                        <span className="block font-medium text-slate-900 dark:text-white">Simulation (Dry Run)</span>
                        <span className="text-xs text-slate-600">Vérifie l'intégrité sans modifier les données.</span>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
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
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-700/50 h-full max-h-[800px] flex flex-col">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" /> Historique
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {backups.length === 0 ? (
                <p className="text-center text-slate-600 py-8">Aucune sauvegarde disponible.</p>
              ) : (
                backups.map((backup) => (
                  <div
                    key={backup.id}
                    onClick={() => selectBackupForRestore(backup)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer group relative ${selectedBackup?.id === backup.id ? 'border-indigo-500 bg-indigo-50 dark:bg-slate-900 dark:bg-slate-900/20 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">#{backup.id.slice(0, 8)}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusColor(backup.status)}`}>
                          {getStatusIcon(backup.status)}
                          <span className="ml-1.5">{backup.status}</span>
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {backup.status === 'completed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadBackup(backup.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 rounded-lg transition-all"
                            title="Télécharger"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmData({
                              isOpen: true,
                              title: 'Supprimer le backup',
                              message: `Êtes-vous sûr de vouloir supprimer le backup ${backup.id} ?`,
                              onConfirm: () => handleDeleteBackup(backup.id)
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                        <Database className="h-5 w-5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {format(new Date(backup.createdAt), "d MMM yyyy", { locale: fr })}
                        </p>
                        <p className="text-xs text-slate-600">
                          {format(new Date(backup.createdAt), "HH:mm", { locale: fr })} • {backup.collections.length} collections
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {backup.collections.slice(0, 3).map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 capitalize">{c}</span>
                      ))}
                      {backup.collections.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600">+{backup.collections.length - 3}</span>
                      )}
                    </div>
                  </div>
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
    </div>
  );
};
