/**
 * OT Connector List Component
 * Story 36-2: OT Connector Configuration
 *
 * Displays list of configured OT connectors with status,
 * last sync info, and actions (create/edit/delete/sync).
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
 Plus,
 RefreshCw,
 Play,
 Pause,
 Trash2,
 Settings,
 Clock,
 AlertCircle,
 CheckCircle,
 Loader2,
 ChevronRight,
 FileText,
 Server,
 Cpu,
 Globe,
 type LucideIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useToast } from '../../hooks/useToast';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import {
 OTConnectorService,
 getRelativeTime,
 formatSyncStats
} from '../../services/OTConnectorService';
import type {
 OTConnector,
 OTConnectorType,
 ConnectorStatus
} from '../../types/otConnector';
import {
 CONNECTOR_TYPE_LABELS,
 CONNECTOR_STATUS_LABELS,
 CONNECTOR_STATUS_COLORS
} from '../../types/otConnector';

// ============================================================================
// Types
// ============================================================================

interface OTConnectorListProps {
 onCreateNew: () => void;
 onEdit: (connector: OTConnector) => void;
 onViewHistory: (connector: OTConnector) => void;
}

// ============================================================================
// Icons
// ============================================================================

const ConnectorTypeIcon: Record<OTConnectorType, LucideIcon> = {
 csv: FileText,
 opcua: Server,
 modbus: Cpu,
 api: Globe
};

// ============================================================================
// Component
// ============================================================================

export const OTConnectorList: React.FC<OTConnectorListProps> = ({
 onCreateNew,
 onEdit,
 onViewHistory
}) => {
 const { t, i18n } = useTranslation();
 const { toast } = useToast();
 const { organization } = useStore();
 const isEnglish = i18n.language === 'en';

 // State
 const [connectors, setConnectors] = useState<OTConnector[]>([]);
 const [loading, setLoading] = useState(true);
 const [syncing, setSyncing] = useState<Record<string, boolean>>({});
 const [deleteTarget, setDeleteTarget] = useState<OTConnector | null>(null);

 // Load connectors
 const loadConnectors = useCallback(async () => {
 if (!organization?.id) return;

 try {
 setLoading(true);
 const data = await OTConnectorService.getConnectors(organization.id);
 setConnectors(data);
 } catch (error) {
 ErrorLogger.error(error, 'OTConnectorList.loadConnectors');
 toast({
 variant: 'destructive',
 title: t('otConnector.errors.loadFailed', 'Échec du chargement des connecteurs'),
 description: t('errors.operationFailed') || 'Une erreur est survenue'
 });
 } finally {
 setLoading(false);
 }
 }, [organization?.id, t, toast]);

 useEffect(() => {
 loadConnectors();
 }, [loadConnectors]);

 // Handle pause/resume
 const handleToggleStatus = useCallback(async (connector: OTConnector) => {
 if (!organization?.id) return;

 try {
 if (connector.status === 'active') {
 await OTConnectorService.pauseConnector(organization.id, connector.id);
 toast({
 title: t('otConnector.paused', 'Connecteur mis en pause'),
 description: connector.name
 });
 } else if (connector.status === 'paused' || connector.status === 'error') {
 await OTConnectorService.activateConnector(organization.id, connector.id);
 toast({
 title: t('otConnector.activated', 'Connecteur activé'),
 description: connector.name
 });
 }
 await loadConnectors();
 } catch (error) {
 ErrorLogger.error(error, 'OTConnectorList.handleToggleStatus');
 toast({
 variant: 'destructive',
 title: t('otConnector.errors.statusFailed', 'Échec de la mise à jour du statut'),
 description: t('errors.operationFailed') || 'Une erreur est survenue'
 });
 }
 }, [organization?.id, loadConnectors, t, toast]);

 // Handle delete
 const handleDelete = useCallback(async (connector: OTConnector) => {
 if (!organization?.id) return;

 try {
 await OTConnectorService.deleteConnector(organization.id, connector.id);
 toast({
 title: t('otConnector.deleted', 'Connecteur supprimé'),
 description: connector.name
 });
 await loadConnectors();
 } catch (error) {
 ErrorLogger.error(error, 'OTConnectorList.handleDelete');
 toast({
 variant: 'destructive',
 title: t('otConnector.errors.deleteFailed', 'Échec de la suppression'),
 description: t('errors.operationFailed') || 'Une erreur est survenue'
 });
 } finally {
 setDeleteTarget(null);
 }
 }, [organization?.id, loadConnectors, t, toast]);

 // Handle manual sync trigger
 const handleManualSync = useCallback(async (connector: OTConnector) => {
 if (!organization?.id) return;

 setSyncing(prev => ({ ...prev, [connector.id]: true }));

 try {
 // TODO: Call Cloud Function to trigger sync
 // For now, just show a placeholder message
 toast({
 title: t('otConnector.syncTriggered', 'Synchronisation déclenchée'),
 description: t('otConnector.syncInProgress', 'La synchronisation est en cours en arrière-plan')
 });

 // Simulate sync delay for demo
 await new Promise(resolve => setTimeout(resolve, 2000));
 await loadConnectors();
 } catch (error) {
 ErrorLogger.error(error, 'OTConnectorList.handleManualSync');
 toast({
 variant: 'destructive',
 title: t('otConnector.errors.syncFailed', 'Échec de la synchronisation'),
 description: t('errors.operationFailed') || 'Une erreur est survenue'
 });
 } finally {
 setSyncing(prev => ({ ...prev, [connector.id]: false }));
 }
 }, [organization?.id, loadConnectors, t, toast]);

 // Get status badge
 const renderStatusBadge = (status: ConnectorStatus) => {
 const label = isEnglish
 ? CONNECTOR_STATUS_LABELS[status].en
 : CONNECTOR_STATUS_LABELS[status].fr;
 const colorClass = CONNECTOR_STATUS_COLORS[status];

 const StatusIcon = status === 'active' ? CheckCircle :
 status === 'error' ? AlertCircle :
 status === 'paused' ? Pause : Settings;

 return (
 <Badge variant="outline" className={cn('gap-1', colorClass)}>
 <StatusIcon className="h-3 w-3" />
 {label}
 </Badge>
 );
 };

 // Get type label
 const getTypeLabel = (type: OTConnectorType) => {
 return isEnglish
 ? CONNECTOR_TYPE_LABELS[type].en
 : CONNECTOR_TYPE_LABELS[type].fr;
 };

 // Render empty state
 if (!loading && connectors.length === 0) {
 return (
 <Card className="p-12 text-center">
 <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
 <Server className="h-8 w-8 text-muted-foreground" />
 </div>
 <h3 className="text-lg font-semibold mb-2">
 {t('otConnector.empty.title', 'Aucun connecteur configuré')}
 </h3>
 <p className="text-muted-foreground mb-6">
 {t('otConnector.empty.description', 'Créez un connecteur pour synchroniser automatiquement les actifs OT')}
 </p>
 <Button onClick={onCreateNew}>
 <Plus className="h-4 w-4 mr-2" />
 {t('otConnector.createNew', 'Créer un connecteur')}
 </Button>
 </Card>
 );
 }

 return (
 <div className="space-y-4">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">
 {t('otConnector.title', 'Connecteurs OT')}
 </h2>
 <p className="text-sm text-muted-foreground">
 {t('otConnector.subtitle', 'Configurez la synchronisation automatique des actifs')}
 </p>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" onClick={loadConnectors} disabled={loading}>
 <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
 {t('common.refresh', 'Actualiser')}
 </Button>
 <Button onClick={onCreateNew}>
 <Plus className="h-4 w-4 mr-2" />
 {t('otConnector.createNew', 'Créer')}
 </Button>
 </div>
 </div>

 {/* Loading state */}
 {loading && (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 )}

 {/* Connector list */}
 {!loading && (
 <div className="grid gap-4">
 {connectors.map(connector => {
 const TypeIcon = ConnectorTypeIcon[connector.type];
 const isSyncing = syncing[connector.id];

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


 return (
 <Card key={connector.id || 'unknown'} className="p-4">
 <div className="flex items-start gap-4">
  {/* Type icon */}
  <div className={cn(
  'p-3 rounded-3xl',
  connector.status === 'error' ? 'bg-red-100' :
  connector.status === 'active' ? 'bg-green-100' :
  'bg-muted'
  )}>
  <TypeIcon className={cn(
  'h-6 w-6',
  connector.status === 'error' ? 'text-red-600' :
  connector.status === 'active' ? 'text-green-600' :
  'text-muted-foreground'
  )} />
  </div>

  {/* Info */}
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1">
  <h3 className="font-semibold truncate">{connector.name}</h3>
  {renderStatusBadge(connector.status)}
  </div>

  <div className="flex items-center gap-4 text-sm text-muted-foreground">
  <span>{getTypeLabel(connector.type)}</span>

  {connector.lastSync && (
  <>
  <span className="text-muted-foreground">|</span>
  <span className="flex items-center gap-1">
  <Clock className="h-3 w-3" />
  {t('otConnector.lastSync', 'Dernière sync')}: {getRelativeTime(connector.lastSync.completedAt)}
  </span>
  {connector.lastSync.stats && (
  <span className="text-muted-foreground">
  ({formatSyncStats(connector.lastSync.stats)})
  </span>
  )}
  </>
  )}

  {connector.schedule.type !== 'manual' && connector.schedule.nextRun && (
  <>
  <span className="text-muted-foreground">|</span>
  <span>
  {t('otConnector.nextSync', 'Prochaine')}: {getRelativeTime(connector.schedule.nextRun)}
  </span>
  </>
  )}
  </div>

  {connector.errorMessage && (
  <p className="text-sm text-red-600 dark:text-red-400 mt-1 truncate">
  {connector.errorMessage}
  </p>
  )}
  </div>

  {/* Actions */}
  <div className="flex items-center gap-1">
  {/* Manual sync */}
  <Button
  variant="ghost"
  size="sm"
  onClick={() => handleManualSync(connector)}
  disabled={isSyncing || connector.status === 'configuring'}
  title={t('otConnector.syncNow', 'Synchroniser maintenant')}
  >
  {isSyncing ? (
  <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
  <RefreshCw className="h-4 w-4" />
  )}
  </Button>

  {/* Pause/Resume */}
  <Button
  variant="ghost"
  size="sm"
  onClick={() => handleToggleStatus(connector)}
  disabled={connector.status === 'configuring'}
  title={connector.status === 'active'
  ? t('otConnector.pause', 'Mettre en pause')
  : t('otConnector.activate', 'Activer')}
  >
  {connector.status === 'active' ? (
  <Pause className="h-4 w-4" />
  ) : (
  <Play className="h-4 w-4" />
  )}
  </Button>

  {/* View history */}
  <Button
  variant="ghost"
  size="sm"
  onClick={() => onViewHistory(connector)}
  title={t('otConnector.viewHistory', 'Voir l\'historique')}
  >
  <Clock className="h-4 w-4" />
  </Button>

  {/* Edit */}
  <Button
  variant="ghost"
  size="sm"
  onClick={() => onEdit(connector)}
  title={t('common.edit', 'Modifier')}
  >
  <Settings className="h-4 w-4" />
  </Button>

  {/* Delete */}
  <Button
  variant="ghost"
  size="sm"
  onClick={() => setDeleteTarget(connector)}
  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
  title={t('common.delete', 'Supprimer')}
  >
  <Trash2 className="h-4 w-4" />
  </Button>

  {/* Chevron */}
  <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
  </div>
 </div>
 </Card>
 );
 })}
 </div>
 )}

 <ConfirmModal
 isOpen={deleteTarget !== null}
 onClose={() => setDeleteTarget(null)}
 onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
 title={t('otConnector.deleteTitle', 'Supprimer le connecteur')}
 message={t('otConnector.confirmDelete', `Êtes-vous sûr de vouloir supprimer le connecteur "${deleteTarget?.name}" ?`)}
 type="danger"
 confirmText={t('common.delete', 'Supprimer')}
 cancelText={t('common.cancel', 'Annuler')}
 />
 </div>
 );
};

export default OTConnectorList;
