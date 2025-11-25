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
  User
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
      case 'completed': return 'text-green-600 bg-green-50';
      case 'creating': return 'text-blue-600 bg-blue-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
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
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sauvegarde et Restauration</h1>
        <p className="text-gray-600">Gérez les sauvegardes de vos données de sécurité</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <Database className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total des backups</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalBackups}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Espace utilisé</p>
              <p className="text-2xl font-bold text-gray-900">{formatSize(stats.totalSize)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <CalendarDays className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Dernier backup</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString('fr-FR') : 'Jamais'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload className="h-4 w-4 mr-2" />
          Créer un backup
        </button>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          data-tour="backup-schedule"
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          Planifier
        </button>
        <button
          onClick={() => setShowRestoreModal(true)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          disabled={backups.length === 0}
          data-tour="backup-restore"
        >
          <Download className="h-4 w-4 mr-2" />
          Restaurer
        </button>
        <button
          onClick={() => OnboardingService.startBackupTour()}
          className="flex items-center px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 ml-auto"
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          Aide
        </button>
      </div>

      {/* Liste des backups */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Backups disponibles</h2>

        {backups.length === 0 ? (
          <div className="glass-panel p-12 rounded-[2.5rem] text-center border border-white/50 dark:border-white/5">
            <Database className="h-16 w-16 mx-auto mb-6 text-slate-300 dark:text-slate-600" />
            <p className="text-lg font-bold text-slate-900 dark:text-white">Aucun backup disponible</p>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Créez votre premier backup pour commencer</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {backups.map((backup) => (
              <div key={backup.id} className="glass-panel p-6 rounded-2xl border border-white/50 dark:border-white/5 card-hover flex items-center justify-between group">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-slate-900 dark:text-white font-mono">{backup.id}</h3>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${getStatusColor(backup.status)}`}>
                      {getStatusIcon(backup.status)}
                      <span className="ml-1.5">{backup.status}</span>
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <span className="flex items-center"><Calendar className="h-4 w-4 mr-2 opacity-70" /> {formatDate(backup.createdAt)}</span>
                    <span className="flex items-center"><User className="h-4 w-4 mr-2 opacity-70" /> {backup.createdBy}</span>
                    <span className="flex items-center"><Database className="h-4 w-4 mr-2 opacity-70" /> {formatSize(backup.size)}</span>
                    <span className="flex items-center"><FileText className="h-4 w-4 mr-2 opacity-70" /> {backup.collections.length} collections</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {backup.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handleDownloadBackup(backup.id)}
                        className="p-2.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-colors"
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
                        className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-colors"
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
                    className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Créer un backup</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-3">Collections à sauvegarder</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(backupConfig).map(([key, value]) => (
                      <label key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setBackupConfig({
                            ...backupConfig,
                            [key]: e.target.checked
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm">
                          {key.replace('include', '').replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingBackup ? 'Création...' : 'Créer le backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de planification */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Planifier des sauvegardes</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600 text-sm">Choisissez la fréquence des sauvegardes automatiques. Les sauvegardes incluront toutes les collections sélectionnées par défaut.</p>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => handleScheduleBackup('daily')} className="p-4 border rounded-xl hover:bg-blue-50 hover:border-blue-200 flex items-center justify-between group transition-colors">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg mr-3"><Clock className="h-5 w-5" /></div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900">Quotidien</p>
                      <p className="text-xs text-gray-500">Tous les jours à minuit</p>
                    </div>
                  </div>
                </button>
                <button onClick={() => handleScheduleBackup('weekly')} className="p-4 border rounded-xl hover:bg-purple-50 hover:border-purple-200 flex items-center justify-between group transition-colors">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg mr-3"><CalendarDays className="h-5 w-5" /></div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900">Hebdomadaire</p>
                      <p className="text-xs text-gray-500">Tous les lundis</p>
                    </div>
                  </div>
                </button>
                <button onClick={() => handleScheduleBackup('monthly')} className="p-4 border rounded-xl hover:bg-green-50 hover:border-green-200 flex items-center justify-between group transition-colors">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg mr-3"><Calendar className="h-5 w-5" /></div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900">Mensuel</p>
                      <p className="text-xs text-gray-500">Le 1er du mois</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de restauration */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Restaurer depuis {selectedBackup.id}</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-3">Collections à restaurer</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedBackup.collections.map((collection) => (
                      <label key={collection} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={restoreConfig.collections.includes(collection)}
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
                          className="mr-2"
                        />
                        <span className="text-sm">{collection}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={restoreConfig.overwriteExisting}
                      onChange={(e) => setRestoreConfig({
                        ...restoreConfig,
                        overwriteExisting: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Écraser les données existantes</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={restoreConfig.dryRun}
                      onChange={(e) => setRestoreConfig({
                        ...restoreConfig,
                        dryRun: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Simulation (dry run)</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={restoring || restoreConfig.collections.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {restoring ? 'Restauration...' : 'Restaurer'}
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
