/**
 * Story 28.4 - Sync Status Indicator
 *
 * Component showing the real-time sync status of the Voxel module.
 */

import React from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useVoxelSync } from '@/stores/voxelStore';
import { useLocale } from '@/hooks/useLocale';

interface SyncStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  connected: {
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    pulseColor: 'bg-green-500',
    labelKey: 'live',
  },
  syncing: {
    icon: RefreshCw,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
    pulseColor: 'bg-amber-500',
    labelKey: 'syncing',
  },
  offline: {
    icon: WifiOff,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    pulseColor: 'bg-red-500',
    labelKey: 'offline',
  },
};

const sizeConfig = {
  sm: { icon: 12, badge: 'text-xs px-1.5 py-0.5', pulse: 'w-1.5 h-1.5' },
  md: { icon: 14, badge: 'text-sm px-2 py-1', pulse: 'w-2 h-2' },
  lg: { icon: 16, badge: 'text-base px-3 py-1.5', pulse: 'w-2.5 h-2.5' },
};

export function SyncStatusIndicator({
  className,
  showLabel = true,
  size = 'md',
}: SyncStatusIndicatorProps) {
  const { t } = useLocale();
  const sync = useVoxelSync();
  const config = statusConfig[sync.status];
  const sizes = sizeConfig[size];

  const Icon = config.icon;

  const formatTime = (date: Date | null) => {
    if (!date) return '-';
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const tooltipContent = (
    <div className="space-y-2 text-sm">
      <div className="font-medium flex items-center gap-2">
        <span
          className={cn(
            'rounded-full',
            sizes.pulse,
            config.pulseColor,
            sync.status === 'connected' && 'animate-pulse'
          )}
        />
        {t(`voxel.sync.${config.labelKey}`, config.labelKey)}
      </div>
      {sync.lastSyncAt && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            {t('voxel.sync.lastSync', 'Dernière sync')}:
          </span>
          <span>{formatTime(sync.lastSyncAt)}</span>
        </div>
      )}
      {sync.pendingChanges > 0 && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            {t('voxel.sync.pending', 'En attente')}:
          </span>
          <span>{sync.pendingChanges}</span>
        </div>
      )}
      {sync.status === 'offline' && (
        <div className="text-amber-500 text-xs">
          {t('voxel.sync.offlineWarning', 'Les données affichées peuvent être obsolètes')}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 border cursor-help transition-colors',
              config.bgColor,
              config.color,
              sizes.badge,
              className
            )}
          >
            {/* Pulse indicator */}
            <span
              className={cn(
                'rounded-full',
                sizes.pulse,
                config.pulseColor,
                sync.status === 'connected' && 'animate-pulse'
              )}
            />
            <Icon
              size={sizes.icon}
              className={cn(sync.status === 'syncing' && 'animate-spin')}
            />
            {showLabel && (
              <span className="font-medium">
                {t(`voxel.sync.label.${config.labelKey}`, config.labelKey)}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SyncStatusIndicator;
