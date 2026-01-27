/**
 * OT Sync History Component
 * Story 36-2: OT Connector Configuration
 *
 * Displays sync history for a connector with timeline view,
 * statistics, error details, and export functionality.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  User,
  Timer,
  Plus,
  Edit3,
  MinusCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../../hooks/useToast';
import { useStore } from '../../store';
import {
  OTConnectorService
} from '../../services/OTConnectorService';
import type {
  OTConnector,
  SyncResult
} from '../../types/otConnector';

// ============================================================================
// Types
// ============================================================================

interface OTSyncHistoryProps {
  open: boolean;
  onClose: () => void;
  connector: OTConnector;
}

// ============================================================================
// Component
// ============================================================================

export const OTSyncHistory: React.FC<OTSyncHistoryProps> = ({
  open,
  onClose,
  connector
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { organization } = useStore();

  // State
  const [history, setHistory] = useState<SyncResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Load history
  const loadHistory = useCallback(async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      const data = await OTConnectorService.getSyncHistory(
        organization.id,
        connector.id,
        50
      );
      setHistory(data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('otConnector.errors.loadHistoryFailed', 'Failed to load history'),
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, connector.id, t, toast]);

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open, loadHistory]);

  // Toggle expanded state
  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (history.length === 0) return null;

    const successCount = history.filter(h => h.status === 'success').length;
    const failedCount = history.filter(h => h.status === 'failed').length;
    const partialCount = history.filter(h => h.status === 'partial').length;

    const totalCreated = history.reduce((sum, h) => sum + (h.stats?.created || 0), 0);
    const totalUpdated = history.reduce((sum, h) => sum + (h.stats?.updated || 0), 0);
    const totalFailed = history.reduce((sum, h) => sum + (h.stats?.failed || 0), 0);

    const avgDuration = history
      .filter(h => h.durationMs)
      .reduce((sum, h, _, arr) => sum + (h.durationMs || 0) / arr.length, 0);

    return {
      total: history.length,
      successCount,
      failedCount,
      partialCount,
      totalCreated,
      totalUpdated,
      totalFailed,
      avgDuration: Math.round(avgDuration)
    };
  }, [history]);

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = [
      'Timestamp',
      'Status',
      'Duration (ms)',
      'Created',
      'Updated',
      'Unchanged',
      'Failed',
      'Triggered By',
      'Errors'
    ];

    const rows = history.map(h => [
      h.startedAt,
      h.status,
      h.durationMs || '',
      h.stats.created,
      h.stats.updated,
      h.stats.unchanged,
      h.stats.failed,
      h.triggeredBy,
      h.errors.map(e => e.message).join('; ')
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-history-${connector.name}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: t('otConnector.history.exported', 'History exported'),
      description: t('otConnector.history.exportedDesc', 'CSV file downloaded')
    });
  }, [history, connector.name, t, toast]);

  // Get status icon
  const getStatusIcon = (status: SyncResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: SyncResult['status']) => {
    const configs: Record<SyncResult['status'], { label: string; className: string }> = {
      success: {
        label: t('otConnector.status.success', 'Success'),
        className: 'bg-green-100 text-green-700'
      },
      partial: {
        label: t('otConnector.status.partial', 'Partial'),
        className: 'bg-yellow-100 text-yellow-700'
      },
      failed: {
        label: t('otConnector.status.failed', 'Failed'),
        className: 'bg-red-100 text-red-700'
      },
      running: {
        label: t('otConnector.status.running', 'Running'),
        className: 'bg-blue-100 text-blue-700'
      }
    };

    const config = configs[status];
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // Format duration
  const formatDuration = (ms: number | undefined) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            {t('otConnector.history.title', 'Sync History')} - {connector.name}
          </DialogTitle>
        </DialogHeader>

        {/* Summary stats */}
        {summaryStats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{summaryStats.total}</p>
              <p className="text-xs text-slate-500">{t('otConnector.history.totalSyncs', 'Total Syncs')}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{summaryStats.successCount}</p>
              <p className="text-xs text-slate-500">{t('otConnector.history.successful', 'Successful')}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">+{summaryStats.totalCreated}</p>
              <p className="text-xs text-slate-500">{t('otConnector.history.assetsCreated', 'Assets Created')}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-slate-600">{formatDuration(summaryStats.avgDuration)}</p>
              <p className="text-xs text-slate-500">{t('otConnector.history.avgDuration', 'Avg Duration')}</p>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            {t('common.refresh', 'Refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={history.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {t('otConnector.history.exportCSV', 'Export CSV')}
          </Button>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>{t('otConnector.history.empty', 'No sync history yet')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(sync => {
                const isExpanded = expandedItems.has(sync.id);
                const hasErrors = sync.errors && sync.errors.length > 0;

                return (
                  <Card key={sync.id} className="overflow-hidden">
                    {/* Header */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(sync.id)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {/* Status icon */}
                      {getStatusIcon(sync.status)}

                      {/* Info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {new Date(sync.startedAt).toLocaleString()}
                          </span>
                          {getStatusBadge(sync.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-300 mt-1">
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {formatDuration(sync.durationMs)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Plus className="h-3 w-3 text-green-500" />
                            {sync.stats.created}
                          </span>
                          <span className="flex items-center gap-1">
                            <Edit3 className="h-3 w-3 text-blue-500" />
                            {sync.stats.updated}
                          </span>
                          {sync.stats.failed > 0 && (
                            <span className="flex items-center gap-1 text-red-500">
                              <MinusCircle className="h-3 w-3" />
                              {sync.stats.failed}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {sync.triggeredBy === 'manual'
                              ? t('otConnector.history.manual', 'Manual')
                              : t('otConnector.history.scheduled', 'Scheduled')}
                          </span>
                        </div>
                      </div>

                      {/* Expand icon */}
                      {hasErrors && (
                        isExpanded
                          ? <ChevronUp className="h-5 w-5 text-slate-400" />
                          : <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </button>

                    {/* Expanded error details */}
                    {isExpanded && hasErrors && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="bg-red-50 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                            {t('otConnector.history.errors', 'Errors')} ({sync.errors.length})
                          </h4>
                          <ul className="space-y-2 max-h-40 overflow-y-auto">
                            {sync.errors.map((error, i) => (
                              <li key={i} className="text-sm">
                                <span className={cn(
                                  'inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2',
                                  error.severity === 'error'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                )}>
                                  {error.severity === 'error' ? 'ERROR' : 'WARN'}
                                </span>
                                {error.rowNumber && (
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Row {error.rowNumber}:{' '}
                                  </span>
                                )}
                                <span className="text-slate-700">{error.message}</span>
                                {error.field && (
                                  <span className="text-muted-foreground"> ({error.field})</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OTSyncHistory;
