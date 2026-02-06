/**
 * CI Inspector History Tab
 *
 * Displays change history and audit trail for a Configuration Item.
 * Shows status changes, attribute updates, and reconciliation events.
 *
 * @module components/cmdb/inspector/CIInspectorHistory
 */

import React, { useMemo } from 'react';
import {
  History,
  RefreshCw,
  Edit3,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Server,
  ArrowRight,
  Loader2,
} from '../../ui/Icons';
import { Badge } from '../../ui/badge';
import { useStore } from '@/store';
import { ConfigurationItem } from '@/types/cmdb';
import { ResourceHistory } from '../../shared/ResourceHistory';
import { cn } from '@/lib/utils';

// =============================================================================
// PROPS
// =============================================================================

interface CIInspectorHistoryProps {
  /** Current CI */
  ci: ConfigurationItem;
}

// =============================================================================
// TYPES
// =============================================================================

interface HistoryEvent {
  id: string;
  type: 'status_change' | 'attribute_update' | 'reconciliation' | 'creation' | 'relationship';
  timestamp: Date;
  userId: string;
  userName?: string;
  description: string;
  details?: Record<string, { old: unknown; new: unknown }>;
}

// =============================================================================
// HELPERS
// =============================================================================

const getEventIcon = (type: HistoryEvent['type']): React.ElementType => {
  switch (type) {
    case 'status_change': return AlertCircle;
    case 'attribute_update': return Edit3;
    case 'reconciliation': return RefreshCw;
    case 'creation': return CheckCircle;
    case 'relationship': return Server;
    default: return History;
  }
};

const getEventColor = (type: HistoryEvent['type']): string => {
  switch (type) {
    case 'status_change': return 'text-warning bg-warning/10';
    case 'attribute_update': return 'text-primary bg-primary/10';
    case 'reconciliation': return 'text-info bg-info/10';
    case 'creation': return 'text-success bg-success/10';
    case 'relationship': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/20';
    default: return 'text-muted-foreground bg-muted';
  }
};

const getEventLabel = (type: HistoryEvent['type']): string => {
  switch (type) {
    case 'status_change': return 'Changement de statut';
    case 'attribute_update': return 'Mise à jour';
    case 'reconciliation': return 'Réconciliation';
    case 'creation': return 'Création';
    case 'relationship': return 'Relation';
    default: return 'Événement';
  }
};

// =============================================================================
// TIMELINE EVENT
// =============================================================================

interface TimelineEventProps {
  event: HistoryEvent;
  isFirst: boolean;
  isLast: boolean;
}

const TimelineEvent: React.FC<TimelineEventProps> = ({ event, isFirst, isLast }) => {
  const Icon = getEventIcon(event.type);

  return (
    <div className="flex gap-4">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'p-2 rounded-xl z-10',
          getEventColor(event.type)
        )}>
          <Icon className="h-4 w-4" />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border/40 mt-2" />
        )}
      </div>

      {/* Event content */}
      <div className={cn(
        'flex-1 pb-6',
        isLast && 'pb-0'
      )}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge
              variant="outline"
              className={cn('text-xs mb-2', getEventColor(event.type))}
            >
              {getEventLabel(event.type)}
            </Badge>
            <p className="font-medium text-sm">{event.description}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            <p>{event.timestamp.toLocaleDateString()}</p>
            <p>{event.timestamp.toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Details */}
        {event.details && Object.keys(event.details).length > 0 && (
          <div className="mt-3 p-3 bg-muted/30 rounded-xl space-y-2">
            {Object.entries(event.details).map(([field, change]) => (
              <div key={field} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground font-medium">{field}:</span>
                <span className="line-through text-muted-foreground/60">
                  {String(change.old || '-')}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{String(change.new || '-')}</span>
              </div>
            ))}
          </div>
        )}

        {/* User info */}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{event.userName || event.userId}</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CIInspectorHistory: React.FC<CIInspectorHistoryProps> = ({ ci }) => {
  const { t, users } = useStore();

  // Get user name by ID
  const getUserName = (userId: string): string => {
    const user = users.find((u) => u.uid === userId);
    return user?.displayName || user?.email || userId;
  };

  // Generate mock history from CI data
  // In production, this would come from a dedicated audit log collection
  const events = useMemo<HistoryEvent[]>(() => {
    const history: HistoryEvent[] = [];

    // Creation event
    if (ci.createdAt) {
      history.push({
        id: 'creation',
        type: 'creation',
        timestamp: ci.createdAt.toDate(),
        userId: ci.createdBy,
        userName: getUserName(ci.createdBy),
        description: `CI "${ci.name}" créé`,
      });
    }

    // Last reconciliation event
    if (ci.lastReconciliationAt) {
      history.push({
        id: 'reconciliation',
        type: 'reconciliation',
        timestamp: ci.lastReconciliationAt.toDate(),
        userId: 'system',
        userName: 'Système',
        description: `Réconciliation automatique depuis ${ci.discoverySource}`,
        details: ci.sourceAgentId
          ? { agent: { old: null, new: ci.sourceAgentId.slice(0, 8) + '...' } }
          : undefined,
      });
    }

    // Last discovery event
    if (ci.lastDiscoveredAt) {
      history.push({
        id: 'discovery',
        type: 'reconciliation',
        timestamp: ci.lastDiscoveredAt.toDate(),
        userId: 'system',
        userName: 'Agent',
        description: `Découverte par agent`,
      });
    }

    // Last update event
    if (ci.updatedAt && ci.updatedBy !== ci.createdBy) {
      history.push({
        id: 'update',
        type: 'attribute_update',
        timestamp: ci.updatedAt.toDate(),
        userId: ci.updatedBy,
        userName: getUserName(ci.updatedBy),
        description: 'Mise à jour des attributs',
      });
    }

    // Sort by timestamp descending
    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [ci, users]);

  return (
    <div className="space-y-8">
      {/* CMDB-specific history */}
      <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
          <History className="h-4 w-4" />
          {t('cmdb.history.title', { defaultValue: 'Historique CMDB' })}
        </h3>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('cmdb.history.empty', { defaultValue: 'Aucun historique disponible' })}
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {events.map((event, idx) => (
              <TimelineEvent
                key={event.id}
                event={event}
                isFirst={idx === 0}
                isLast={idx === events.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Discovery Stats */}
      <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('cmdb.history.discoveryStats', { defaultValue: 'Statistiques de Découverte' })}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/30 rounded-2xl">
            <span className="text-[11px] uppercase text-muted-foreground font-bold block mb-1">
              Source
            </span>
            <p className="text-lg font-bold">{ci.discoverySource}</p>
          </div>

          <div className="p-4 bg-muted/30 rounded-2xl">
            <span className="text-[11px] uppercase text-muted-foreground font-bold block mb-1">
              Dernière découverte
            </span>
            <p className="text-lg font-bold">
              {ci.lastDiscoveredAt
                ? ci.lastDiscoveredAt.toDate().toLocaleDateString()
                : '-'}
            </p>
          </div>

          <div className="p-4 bg-muted/30 rounded-2xl">
            <span className="text-[11px] uppercase text-muted-foreground font-bold block mb-1">
              Score Qualité
            </span>
            <p className={cn(
              'text-lg font-bold',
              ci.dataQualityScore >= 80 ? 'text-success' :
              ci.dataQualityScore >= 60 ? 'text-warning' : 'text-destructive'
            )}>
              {ci.dataQualityScore}%
            </p>
          </div>
        </div>

        {/* Agent info */}
        {ci.sourceAgentId && (
          <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/20">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Agent ID:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {ci.sourceAgentId}
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Generic Resource History */}
      <div className="px-1">
        <ResourceHistory resourceId={ci.id} resourceType="ConfigurationItem" />
      </div>
    </div>
  );
};

export default CIInspectorHistory;
