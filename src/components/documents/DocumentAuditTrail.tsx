/**
 * Story 27.3 - Document Audit Trail Component
 *
 * Timeline view of document actions with filters, user avatars,
 * action icons, expandable details, and export capabilities.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Eye,
  Download,
  Upload,
  Edit,
  Trash2,
  Share2,
  Tag,
  PenTool,
  CheckCircle,
  Lock,
  Unlock,
  XCircle,
  AlertTriangle,
  FileText,
  Activity,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  // User, // Remove if unused
  RefreshCw,
  FileDown,
  X,
  Loader2,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { VaultAuditService, AuditLogEntry, DocumentAction, AuditFilters } from '@/services/vaultAuditService';
import { getUserAvatarUrl } from '@/utils/avatarUtils';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentAuditTrailProps {
  /** Document ID to show audit trail for (null for organization-wide) */
  documentId?: string | null;
  /** Whether to show organization-wide view (admin only) */
  organizationView?: boolean;
  /** User ID to filter by (optional) */
  userId?: string | null;
  /** Maximum height for scrollable container */
  maxHeight?: string;
  /** Callback when an entry is clicked */
  onEntryClick?: (entry: AuditLogEntry) => void;
  /** Enable real-time updates */
  realtime?: boolean;
  /** Show export buttons */
  showExport?: boolean;
  /** Custom class name */
  className?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  Download,
  Upload,
  Edit,
  Trash2,
  Share2,
  Tag,
  PenTool,
  CheckCircle,
  Lock,
  Unlock,
  XCircle,
  AlertTriangle,
  FileText,
  Activity,
};

export const DocumentAuditTrail: React.FC<DocumentAuditTrailProps> = ({
  documentId,
  organizationView = false,
  userId,
  maxHeight = '600px',
  onEntryClick,
  realtime = false,
  showExport = true,
  className = '',
}) => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActions, setSelectedActions] = useState<DocumentAction[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [exporting, setExporting] = useState(false);

  // Build filters object
  const filters = useMemo<AuditFilters>(() => {
    const f: AuditFilters = {};
    if (selectedActions.length > 0) {
      f.actions = selectedActions;
    }
    if (dateRange.start) {
      f.startDate = dateRange.start;
    }
    if (dateRange.end) {
      f.endDate = dateRange.end;
    }
    if (userId) {
      f.userId = userId;
    }
    if (documentId) {
      f.documentId = documentId;
    }
    return f;
  }, [selectedActions, dateRange, userId, documentId]);

  // Fetch audit trail
  const fetchAuditTrail = useCallback(async (reset = true) => {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      let result;

      if (documentId) {
        result = await VaultAuditService.getDocumentAuditTrail(documentId, {
          limit: 50,
          startAfter: reset ? undefined : nextCursor || undefined,
          filters,
        });
      } else if (organizationView) {
        result = await VaultAuditService.getOrganizationAuditTrail({
          limit: 50,
          startAfter: reset ? undefined : nextCursor || undefined,
          filters,
        });
      } else if (userId) {
        result = await VaultAuditService.getUserAuditTrail(userId, {
          limit: 50,
          startAfter: reset ? undefined : nextCursor || undefined,
          filters,
        });
      } else {
        // Default to user's own audit trail
        result = await VaultAuditService.getUserAuditTrail(undefined, {
          limit: 50,
          startAfter: reset ? undefined : nextCursor || undefined,
          filters,
        });
      }

      if (result.success) {
        if (reset) {
          setEntries(result.entries);
        } else {
          setEntries(prev => [...prev, ...result.entries]);
        }
        setNextCursor(result.pagination.nextCursor);
        setHasMore(result.pagination.hasMore);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [documentId, organizationView, userId, filters, nextCursor]);

  // Initial fetch
  useEffect(() => {
    fetchAuditTrail(true);
  }, [fetchAuditTrail]);

  // Real-time updates (polling for simplicity)
  useEffect(() => {
    if (!realtime) return;

    const interval = setInterval(() => {
      fetchAuditTrail(true);
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [realtime, fetchAuditTrail]);

  // Toggle entry expansion
  const toggleExpand = (entryId: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Export handler
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);
      const result = await VaultAuditService.exportAuditTrail(format, filters);
      if (result.success) {
        VaultAuditService.downloadExport(result.data, format, `audit-trail-${Date.now()}.${format}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  // Get icon component for action
  const getIconComponent = (action: DocumentAction) => {
    const iconName = VaultAuditService.getActionIcon(action);
    return iconMap[iconName] || Activity;
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: fr });
    } catch {
      return timestamp;
    }
  };

  // Format full timestamp
  const formatFullTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    try {
      return format(new Date(timestamp), 'dd MMM yyyy HH:mm:ss', { locale: fr });
    } catch {
      return timestamp;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedActions([]);
    setDateRange({ start: '', end: '' });
  };

  // All available actions
  const allActions = VaultAuditService.getAllActions();

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand-600" />
          Journal d'Audit
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAuditTrail(true)}
            disabled={loading}
            className="text-slate-500 hover:text-brand-600"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`text-slate-500 hover:text-brand-600 ${showFilters ? 'bg-brand-50 text-brand-600' : ''}`}
          >
            <Filter className="h-4 w-4" />
          </Button>
          {showExport && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="text-slate-500 hover:text-brand-600"
                title="Exporter CSV"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 space-y-4">
          {/* Action Type Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type d'action
            </label>
            <div className="flex flex-wrap gap-2">
              {allActions.map(({ value, label }) => {
                const colors = VaultAuditService.getActionColorClass(value);
                const isSelected = selectedActions.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedActions(prev => prev.filter(a => a !== value));
                      } else {
                        setSelectedActions(prev => [...prev, value]);
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${isSelected
                      ? `${colors.bg} ${colors.text} ${colors.border}`
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-brand-300'
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Calendar className="h-3 w-3 inline mr-1" />
                Date debut
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Calendar className="h-3 w-3 inline mr-1" />
                Date fin
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            {(selectedActions.length > 0 || dateRange.start || dateRange.end) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-slate-500 hover:text-red-600 mt-5"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Activity className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-sm">Aucune activite enregistree</p>
          {(selectedActions.length > 0 || dateRange.start || dateRange.end) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
              Effacer les filtres
            </Button>
          )}
        </div>
      )}

      {/* Timeline */}
      {!loading && entries.length > 0 && (
        <div className="overflow-y-auto" style={{ maxHeight }}>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.map((entry, index) => {
              const IconComponent = getIconComponent(entry.action);
              const colors = VaultAuditService.getActionColorClass(entry.action);
              const isExpanded = expandedEntries.has(entry.id);

              return (
                <div
                  key={entry.id}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${onEntryClick ? 'cursor-pointer' : ''
                    }`}
                  onClick={() => onEntryClick?.(entry)}
                >
                  <div className="flex items-start gap-4">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div className={`p-2 rounded-full ${colors.bg} ${colors.border} border`}>
                        <IconComponent className={`h-4 w-4 ${colors.text}`} />
                      </div>
                      {index < entries.length - 1 && (
                        <div className="w-px h-full bg-slate-200 dark:bg-slate-700 mt-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* User avatar */}
                          <img
                            src={getUserAvatarUrl(null, 'user')}
                            alt={entry.userEmail}
                            className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800"
                          />
                          <span className="font-medium text-slate-900 dark:text-white text-sm truncate">
                            {entry.userEmail}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap" title={formatFullTimestamp(entry.timestamp)}>
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                          {VaultAuditService.getActionLabel(entry.action)}
                        </span>
                        {entry.documentId && (
                          <span className="text-xs text-slate-500 truncate">
                            Document: {entry.documentId.substring(0, 8)}...
                          </span>
                        )}
                      </div>

                      {/* Expandable Details */}
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(entry.id);
                            }}
                            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3" />
                                Masquer les details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                Voir les details
                              </>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                              <pre className="whitespace-pre-wrap text-slate-600 dark:text-slate-400 font-mono">
                                {JSON.stringify(entry.details, null, 2)}
                              </pre>
                              {entry.integrity?.hash && (
                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                  <span className="text-slate-500">Hash d'integrite: </span>
                                  <code className="text-slate-600 dark:text-slate-400">
                                    {entry.integrity.hash.substring(0, 16)}...
                                  </code>
                                </div>
                              )}
                              {entry.metadata?.ipAddress && (
                                <div className="mt-1">
                                  <span className="text-slate-500">IP: </span>
                                  <code className="text-slate-600 dark:text-slate-400">
                                    {entry.metadata.ipAddress}
                                  </code>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                onClick={() => fetchAuditTrail(false)}
                disabled={loadingMore}
                className="w-full"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Charger plus
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentAuditTrail;
