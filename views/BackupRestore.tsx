import React, { useState, useEffect } from 'react';
import { BackupService, BackupConfig, BackupMetadata, RestoreConfig } from '../services/backupService';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import {
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Calendar,
  CalendarDays,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  HelpCircle,
  User,
  X
} from '../components/ui/Icons';
import { OnboardingService } from '../services/onboardingService';

export const BackupRestore: React.FC = () => {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [stats, setStats] = useState<{ totalBackups: number; totalSize: number; lastBackup?: string }>({ totalBackups: 0, totalSize: 0 });
  const { user, addToast } = useStore();

  // Configuration du backup
  const [backupConfig, setBackupConfig] = useState<BackupConfig>({
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
  });

  // Configuration de la restauration
  const [restoreConfig, setRestoreConfig] = useState<RestoreConfig>({
    backupId: '',
    collections: [],
    overwriteExisting: false,
    dryRun: true
  });

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

  useEffect(() => {
    if (user?.organizationId) {
      loadBackups();
      loadStats();
    }
  }, [user?.organizationId]);

  const loadBackups = async () => {
    if (!user?.organizationId) return;
    try {
      const backupsList = await BackupService.listBackups(user.organizationId);
      setBackups(backupsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (_error) {
      addToast('Erreur chargement backups', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user?.organizationId) return;
    try {
      const backupStats = await BackupService.getBackupStats(user.organizationId);
      setStats(backupStats);
    } catch (_error) {
      // Error handled by toast
    }
  };

  const handleCreateBackup = async () => {
    if (!user) return;

    setCreatingBackup(true);
    try {
      await BackupService.createBackup(user, backupConfig);
      addToast('Backup créé avec succès', 'success');
      setShowCreateModal(false);
      loadBackups();
      loadStats();
    } catch (_error) {
      addToast('Erreur lors de la création du backup', 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleScheduleBackup = async (frequency: 'daily' | 'weekly' | 'monthly') => {
    if (!user) return;
    try {
      await BackupService.scheduleBackup(user, backupConfig, frequency);
      addToast(`Backup programmé (${frequency})`, 'success');
      setShowScheduleModal(false);
    } catch (_error) {
      addToast('Erreur lors de la programmation', 'error');
    }
  };

  const handleRestoreBackup = async () => {
    if (!user || !selectedBackup) return;

    setRestoring(true);
    try {
      const result = await BackupService.restoreBackup(user, restoreConfig);

      if (result.success) {
        addToast('Restauration terminée avec succès', 'success');
      } else {
        addToast('Restauration terminée avec des erreurs', 'info');
      }

      setShowRestoreModal(false);
      // Restoration complete
    } catch (_error) {
      addToast('Erreur lors de la restauration', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!user) return;
    try {
      await BackupService.deleteBackup(user, backupId);
      addToast('Backup supprimé avec succès', 'success');
      loadBackups();
      loadStats();
    } catch (_error) {
      addToast('Erreur lors de la suppression', 'error');
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

      await logAction(user!, 'DOWNLOAD', 'Backup', `Backup téléchargé: ${backupId}`);
    } catch (_error) {
      addToast('Erreur lors du téléchargement', 'error');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'creating': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
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

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/4"></div>
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      <div className="flex items-end justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Sauvegarde et Restauration</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Gérez les sauvegardes de vos données de sécurité</p>
        </div>
        <button
          onClick={() => OnboardingService.startBackupTour()}
          className="flex items-center px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors text-sm font-medium"
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          Aide
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="flex items-center relative z-10">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 mr-4">
                    <Database className="h-8 w-8" />
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total des backups</p>
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
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Espace utilisé</p>
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
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Dernier backup</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString('fr-FR') : 'Jamais'}
                    </p>
                </div>
            </div>
        </div>
      </div>

      {/* Actions */}
      <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 mb-8 flex flex-wrap gap-4 items-center">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all font-bold text-sm shadow-blue-500/20"
        >
          <Upload className="h-4 w-4 mr-2" />
          Créer un backup
        </button>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 hover:shadow-lg hover:-translate-y-0.5 transition-all font-bold text-sm shadow-purple-500/20"
          data-tour="backup-schedule"
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          Planifier
        </button>
        <button
          onClick={() => setShowRestoreModal(true)}
          className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 transition-all font-bold text-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          disabled={backups.length === 0}
          data-tour="backup-restore"
        >
          <Download className="h-4 w-4 mr-2" />
          Restaurer
        </button>
      </div>

      {/* Liste des backups */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white px-2">Backups disponibles</h2>

        {backups.length === 0 ? (
          <div className="glass-panel p-16 rounded-[2.5rem] text-center border border-white/50 dark:border-white/5 flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                <Database className="h-10 w-10 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">Aucun backup disponible</p>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">Créez votre premier backup manuellement ou planifiez une sauvegarde automatique pour sécuriser vos données.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {backups.map((backup) => (
              <div key={backup.id} className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 card-hover flex items-center justify-between group transition-all">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white font-mono text-lg tracking-tight">{backup.id}</h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wide ${getStatusColor(backup.status)}`}>
                      {getStatusIcon(backup.status)}
                      <span className="ml-2">{backup.status}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <span className="flex items-center"><Calendar className="h-4 w-4 mr-2 opacity-70" /> {formatDate(backup.createdAt)}</span>
                    <span className="flex items-center"><User className="h-4 w-4 mr-2 opacity-70" /> {backup.createdBy}</span>
                    <span className="flex items-center"><Database className="h-4 w-4 mr-2 opacity-70" /> {formatSize(backup.size)}</span>
                    <span className="flex items-center"><FileText className="h-4 w-4 mr-2 opacity-70" /> {backup.collections.length} collections</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                  {backup.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handleDownloadBackup(backup.id)}
                        className="p-3 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-colors"
                        title="Télécharger"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBackup(backup);
                          setRestoreConfig({
                            ...restoreConfig,
                            backupId: backup.id,
                            collections: backup.collections
                          });
                          setShowRestoreModal(true);
                        }}
                        className="p-3 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-2xl transition-colors"
                        title="Restaurer"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setConfirmData({
                        isOpen: true,
                        title: 'Supprimer le backup',
                        message: `Êtes-vous sûr de vouloir supprimer le backup ${backup.id} ?`,
                        onConfirm: () => handleDeleteBackup(backup.id)
                      });
                    }}
                    className="p-3 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de création de backup */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Créer un backup</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                  <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <Database className="h-5 w-5 text-blue-500" />
                      Collections à sauvegarder
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(backupConfig).map(([key, value]) => (
                      <label key={key} className={`
                        flex items-center p-4 rounded-2xl border cursor-pointer transition-all
                        ${value 
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-500/30' 
                            : 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/5 hover:border-blue-300'}
                      `}>
                        <div className={`
                            w-6 h-6 rounded-lg flex items-center justify-center mr-3 border transition-all
                            ${value ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}
                        `}>
                            {value && <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setBackupConfig({
                            ...backupConfig,
                            [key]: e.target.checked
                          })}
                          className="hidden"
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {key.replace('include', '').replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-3 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-white/5 rounded-2xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center"
              >
                {creatingBackup ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Upload className="h-5 w-5 mr-2" />}
                {creatingBackup ? 'Création...' : 'Lancer le backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de planification */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl max-w-lg w-full flex flex-col animate-scale-in">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Planification</h2>
              <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                  <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-slate-600 dark:text-slate-400">Choisissez la fréquence des sauvegardes automatiques. Les sauvegardes incluront toutes les collections sélectionnées par défaut.</p>
              <div className="space-y-3">
                <button onClick={() => handleScheduleBackup('daily')} className="w-full p-4 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-500/30 flex items-center justify-between group transition-all">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl mr-4"><Clock className="h-6 w-6" /></div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900 dark:text-white text-lg">Quotidien</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Tous les jours à minuit</p>
                    </div>
                  </div>
                </button>
                <button onClick={() => handleScheduleBackup('weekly')} className="w-full p-4 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-purple-50 dark:hover:bg-purple-900/10 hover:border-purple-200 dark:hover:border-purple-500/30 flex items-center justify-between group transition-all">
                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl mr-4"><CalendarDays className="h-6 w-6" /></div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900 dark:text-white text-lg">Hebdomadaire</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Tous les lundis</p>
                    </div>
                  </div>
                </button>
                <button onClick={() => handleScheduleBackup('monthly')} className="w-full p-4 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:border-emerald-200 dark:hover:border-emerald-500/30 flex items-center justify-between group transition-all">
                  <div className="flex items-center">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl mr-4"><Calendar className="h-6 w-6" /></div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900 dark:text-white text-lg">Mensuel</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Le 1er du mois</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de restauration */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-scale-in">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Restaurer depuis <span className="font-mono text-lg text-slate-500 ml-2">{selectedBackup.id}</span></h2>
              <button onClick={() => setShowRestoreModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                  <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-8">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <Database className="h-5 w-5 text-emerald-500" />
                      Collections à restaurer
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedBackup.collections.map((collection) => {
                        const isSelected = restoreConfig.collections.includes(collection);
                        return (
                      <label key={collection} className={`
                        flex items-center p-3 rounded-xl border cursor-pointer transition-all
                        ${isSelected 
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-500/30' 
                            : 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/5 hover:border-emerald-300'}
                      `}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRestoreConfig({
                                ...restoreConfig,
                                collections: [...restoreConfig.collections, collection]
                              });
                            } else {
                              setRestoreConfig({
                                ...restoreConfig,
                                collections: restoreConfig.collections.filter(c => c !== collection)
                              });
                            }
                          }}
                          className="hidden"
                        />
                        <div className={`
                            w-5 h-5 rounded-md flex items-center justify-center mr-3 border transition-all
                            ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}
                        `}>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </div>
                        <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{collection}</span>
                      </label>
                    )})}
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-6">
                    <h3 className="font-bold text-amber-800 dark:text-amber-400 mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Options critiques
                    </h3>
                    <div className="space-y-4">
                        <label className="flex items-center cursor-pointer">
                            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${restoreConfig.overwriteExisting ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${restoreConfig.overwriteExisting ? 'translate-x-5' : ''}`}></div>
                            </div>
                            <input
                            type="checkbox"
                            checked={restoreConfig.overwriteExisting}
                            onChange={(e) => setRestoreConfig({
                                ...restoreConfig,
                                overwriteExisting: e.target.checked
                            })}
                            className="hidden"
                            />
                            <span className="ml-3 font-medium text-slate-700 dark:text-slate-200">Écraser les données existantes (Action irréversible)</span>
                        </label>

                        <label className="flex items-center cursor-pointer">
                            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${restoreConfig.dryRun ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${restoreConfig.dryRun ? 'translate-x-5' : ''}`}></div>
                            </div>
                            <input
                            type="checkbox"
                            checked={restoreConfig.dryRun}
                            onChange={(e) => setRestoreConfig({
                                ...restoreConfig,
                                dryRun: e.target.checked
                            })}
                            className="hidden"
                            />
                            <span className="ml-3 font-medium text-slate-700 dark:text-slate-200">Mode simulation (Dry Run) - Recommandé</span>
                        </label>
                    </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 flex justify-end gap-3">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-6 py-3 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-white/5 rounded-2xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={restoring || restoreConfig.collections.length === 0}
                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center"
              >
                {restoring ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Download className="h-5 w-5 mr-2" />}
                {restoring ? 'Restauration...' : 'Lancer la restauration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation */}
      {confirmData.isOpen && (
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
      )}
    </div>
  );
};
