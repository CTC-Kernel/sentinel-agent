/**
 * Story 23.5 - UI Indicateur de Chiffrement
 *
 * Badge component showing document encryption status with tooltip details.
 */

import React from 'react';
import { Lock, LockOpen, Loader2, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DocumentEncryptionMetadata } from '@/types/vault';
import { useLocale } from '@/hooks/useLocale';

interface EncryptionBadgeProps {
  encryption?: DocumentEncryptionMetadata;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

type EncryptionState = 'encrypted' | 'pending' | 'unencrypted' | 'error';

function getEncryptionState(encryption?: DocumentEncryptionMetadata): EncryptionState {
  if (!encryption) return 'unencrypted';
  if (encryption.encrypted) return 'encrypted';
  if ((encryption as unknown as { status?: string }).status === 'pending') return 'pending';
  if ((encryption as unknown as { error?: string }).error) return 'error';
  return 'unencrypted';
}

const stateConfig: Record<EncryptionState, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  labelKey: string;
}> = {
  encrypted: {
    icon: Lock,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    labelKey: 'encrypted',
  },
  pending: {
    icon: Loader2,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
    labelKey: 'pending',
  },
  unencrypted: {
    icon: LockOpen,
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700',
    labelKey: 'unencrypted',
  },
  error: {
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    labelKey: 'error',
  },
};

const sizeConfig = {
  sm: { icon: 14, badge: 'text-xs px-1.5 py-0.5' },
  md: { icon: 16, badge: 'text-sm px-2 py-1' },
  lg: { icon: 20, badge: 'text-base px-3 py-1.5' },
};

export function EncryptionBadge({
  encryption,
  size = 'md',
  showLabel = false,
  className,
}: EncryptionBadgeProps) {
  const { t } = useLocale();
  const state = getEncryptionState(encryption);
  const config = stateConfig[state];
  const sizes = sizeConfig[size];

  const Icon = config.icon;

  const formatDate = (timestamp?: { toDate?: () => Date } | Date) => {
    if (!timestamp) return '-';
    const date = typeof (timestamp as { toDate?: () => Date }).toDate === 'function'
      ? (timestamp as { toDate: () => Date }).toDate()
      : timestamp as Date;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tooltipContent = (
    <div className="space-y-2 text-sm">
      <div className="font-medium">
        {t(`encryption.status.${config.labelKey}`, config.labelKey)}
      </div>
      {encryption?.encrypted && (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('encryption.algorithm', 'Algorithme')}:</span>
            <span className="font-mono">{encryption.algorithm}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('encryption.keyVersion', 'Version clé')}:</span>
            <span className="font-mono">{encryption.keyVersion}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('encryption.encryptedAt', 'Chiffré le')}:</span>
            <span>{formatDate(encryption.encryptedAt)}</span>
          </div>
          {encryption.hash && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('encryption.hash', 'Hash')}:</span>
              <span className="font-mono text-xs truncate max-w-[120px]" title={encryption.hash}>
                {encryption.hash.substring(0, 12)}...
              </span>
            </div>
          )}
        </>
      )}
      {state === 'error' && (
        <div className="text-red-500">
          {(encryption as unknown as { error?: string })?.error || t('encryption.error', 'Erreur de chiffrement')}
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
              'gap-1 border cursor-help transition-colors',
              config.bgColor,
              config.color,
              sizes.badge,
              className
            )}
          >
            <Icon
              size={sizes.icon}
              className={cn(state === 'pending' && 'animate-spin')}
            />
            {showLabel && (
              <span>{t(`encryption.label.${config.labelKey}`, config.labelKey)}</span>
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

export default EncryptionBadge;
