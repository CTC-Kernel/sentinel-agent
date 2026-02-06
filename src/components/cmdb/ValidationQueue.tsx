/**
 * CMDB Validation Queue
 *
 * Component for reviewing and processing pending CI validations.
 * Supports approve, reject, and merge actions.
 *
 * @module components/cmdb/ValidationQueue
 */

import React, { useState, useCallback } from 'react';
import {
  Check,
  X,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Server,
  Laptop,
  Database,
  Globe,
  Cloud,
  Loader2,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/Badge';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { useStore } from '@/store';
import {
  usePendingValidations,
  useValidationMutations,
} from '@/hooks/cmdb/useCMDBValidation';
import { CMDBValidationItem, CIClass } from '@/types/cmdb';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface ValidationQueueProps {
  /** Maximum items to display */
  maxItems?: number;
  /** Compact mode for dashboard */
  compact?: boolean;
  /** Callback when validation is processed */
  onValidationProcessed?: () => void;
}

interface ValidationItemProps {
  item: CMDBValidationItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onMerge: (id: string) => void;
  compact?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const getCIClassIcon = (ciClass: CIClass | undefined) => {
  switch (ciClass) {
    case 'Hardware': return Server;
    case 'Software': return Database;
    case 'Service': return Globe;
    case 'Cloud': return Cloud;
    default: return Laptop;
  }
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 80) return 'text-success bg-success/10';
  if (confidence >= 60) return 'text-warning bg-warning/10';
  return 'text-destructive bg-destructive/10';
};

// =============================================================================
// VALIDATION ITEM
// =============================================================================

const ValidationItem: React.FC<ValidationItemProps> = ({
  item,
  selected,
  onSelect,
  onApprove,
  onReject,
  onMerge,
  compact,
  expanded,
  onToggleExpand,
}) => {
  const { t } = useStore();
  const [processing, setProcessing] = useState<string | null>(null);

  const Icon = getCIClassIcon(item.matchResult.candidates?.[0] ? 'Hardware' : undefined);
  const confidence = item.matchResult.confidence;
  const hasMatch = item.matchResult.ciId !== null;

  const handleAction = async (action: string, handler: () => void) => {
    setProcessing(action);
    try {
      await handler();
    } finally {
      setProcessing(null);
    }
  };

  // Extract display info from agent data
  const agentData = item.agentData as {
    hostname?: string;
    networkInterfaces?: Array<{ ipv4?: string[] }>;
  };
  const hostname = agentData.hostname || item.fingerprint?.hostname || item.discoveredCI?.name || 'Unknown';
  const ipAddress = agentData.networkInterfaces?.[0]?.ipv4?.[0] || '-';

  return (
    <div
      className={cn(
        'border rounded-xl p-4 transition-all duration-200',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        compact && 'p-3'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect(item.id)}
          className="mt-1"
        />

        {/* Icon */}
        <div className="p-2 rounded-lg bg-muted/50 shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium truncate">{hostname}</p>
              <p className="text-sm text-muted-foreground">{ipAddress}</p>
            </div>

            {/* Confidence badge */}
            <Badge className={cn('shrink-0', getConfidenceColor(confidence))}>
              {confidence > 0 ? `${confidence}%` : t('cmdb.validation.noMatch', { defaultValue: 'Aucun match' })}
            </Badge>
          </div>

          {/* Match info */}
          {hasMatch && (
            <div className="mt-2 p-2 rounded-lg bg-muted/30 text-sm">
              <span className="text-muted-foreground">
                {t('cmdb.validation.matchWith', { defaultValue: 'Match avec' })}:{' '}
              </span>
              <span className="font-medium">{item.matchResult.ciId}</span>
              <span className="text-muted-foreground ml-2">
                ({item.matchResult.matchRule})
              </span>
            </div>
          )}

          {/* Expanded details */}
          {expanded && !compact && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">MAC:</span>{' '}
                  <span className="font-mono">{item.fingerprint?.primaryMacAddress || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">OS:</span>{' '}
                  <span>{item.fingerprint?.osFingerprint || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Serial:</span>{' '}
                  <span className="font-mono">{item.fingerprint?.serialNumber || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Agent:</span>{' '}
                  <span className="font-mono text-xs">{item.agentId?.slice(0, 8) || '-'}...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!compact && onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="h-8 w-8"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}

          <CustomTooltip content={t('cmdb.validation.approve', { defaultValue: 'Approuver' })}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleAction('approve', () => onApprove(item.id))}
              disabled={processing !== null}
              className="h-8 w-8 text-success hover:bg-success/10"
            >
              {processing === 'approve' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </CustomTooltip>

          <CustomTooltip content={t('cmdb.validation.reject', { defaultValue: 'Rejeter' })}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleAction('reject', () => onReject(item.id))}
              disabled={processing !== null}
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
            >
              {processing === 'reject' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </CustomTooltip>

          {hasMatch && (
            <CustomTooltip content={t('cmdb.validation.merge', { defaultValue: 'Fusionner' })}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAction('merge', () => onMerge(item.id))}
                disabled={processing !== null}
                className="h-8 w-8 text-primary hover:bg-primary/10"
              >
                {processing === 'merge' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitBranch className="h-4 w-4" />
                )}
              </Button>
            </CustomTooltip>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ValidationQueue: React.FC<ValidationQueueProps> = ({
  maxItems,
  compact = false,
  onValidationProcessed,
}) => {
  const { t } = useStore();
  const { data: pendingItems = [], isLoading } = usePendingValidations(maxItems || 50);
  const { approveValidation, rejectValidation, mergeValidation } = useValidationMutations();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Limit items if maxItems is set
  const displayItems = maxItems ? pendingItems.slice(0, maxItems) : pendingItems;

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === displayItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayItems.map((item) => item.id)));
    }
  }, [selectedIds.size, displayItems]);

  const handleApprove = useCallback(async (id: string) => {
    await approveValidation.mutateAsync({ itemId: id });
    onValidationProcessed?.();
  }, [approveValidation, onValidationProcessed]);

  const handleReject = useCallback(async (id: string) => {
    await rejectValidation.mutateAsync({ itemId: id, reason: 'Rejected by user' });
    onValidationProcessed?.();
  }, [rejectValidation, onValidationProcessed]);

  const handleMerge = useCallback(async (id: string) => {
    // For merge, we need to find the best candidate
    const item = pendingItems.find((i) => i.id === id);
    const bestCandidate = item?.matchResult.candidates?.[0];
    if (bestCandidate?.ciId) {
      await mergeValidation.mutateAsync({ itemId: id, targetCIId: bestCandidate.ciId });
      onValidationProcessed?.();
    }
  }, [mergeValidation, pendingItems, onValidationProcessed]);

  const handleBulkApprove = useCallback(async () => {
    for (const id of selectedIds) {
      await handleApprove(id);
    }
    setSelectedIds(new Set());
  }, [selectedIds, handleApprove]);

  const handleBulkReject = useCallback(async () => {
    for (const id of selectedIds) {
      await handleReject(id);
    }
    setSelectedIds(new Set());
  }, [selectedIds, handleReject]);

  // Empty state
  if (!isLoading && displayItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="p-4 rounded-full bg-success/10 mb-4">
          <Check className="h-8 w-8 text-success" />
        </div>
        <p className="font-medium">
          {t('cmdb.validation.empty', { defaultValue: 'Aucun CI en attente' })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('cmdb.validation.emptyDescription', { defaultValue: 'Tous les CIs ont été traités' })}
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {!compact && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
          <span className="text-sm">
            {selectedIds.size} {t('cmdb.validation.selected', { defaultValue: 'sélectionné(s)' })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              className="text-success border-success/30 hover:bg-success/10"
            >
              <Check className="h-4 w-4 mr-1" />
              {t('cmdb.validation.approveAll', { defaultValue: 'Tout approuver' })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkReject}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <X className="h-4 w-4 mr-1" />
              {t('cmdb.validation.rejectAll', { defaultValue: 'Tout rejeter' })}
            </Button>
          </div>
        </div>
      )}

      {/* Header with select all */}
      {!compact && displayItems.length > 1 && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={selectedIds.size === displayItems.length && displayItems.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {t('cmdb.validation.selectAll', { defaultValue: 'Tout sélectionner' })}
          </span>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-3">
        {displayItems.map((item) => (
          <ValidationItem
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onSelect={handleSelect}
            onApprove={handleApprove}
            onReject={handleReject}
            onMerge={handleMerge}
            compact={compact}
            expanded={expandedId === item.id}
            onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
          />
        ))}
      </div>

      {/* Show more indicator */}
      {maxItems && pendingItems.length > maxItems && (
        <p className="text-center text-sm text-muted-foreground">
          +{pendingItems.length - maxItems} {t('cmdb.validation.more', { defaultValue: 'autres' })}
        </p>
      )}
    </div>
  );
};

export default ValidationQueue;
