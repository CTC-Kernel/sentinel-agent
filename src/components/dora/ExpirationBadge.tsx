/**
 * Expiration Badge Component
 * Story 35-4: Contract Expiration Alerts
 *
 * Visual indicator for contract expiration status
 */

import React from 'react';
import { useLocale } from '../../hooks/useLocale';
import { Clock, AlertTriangle, AlertCircle } from '../ui/Icons';
import { cn } from '../../lib/utils';
import { ExpirationUrgency, ContractExpirationService } from '../../services/ContractExpirationService';

interface ExpirationBadgeProps {
 daysRemaining: number | null;
 urgency?: ExpirationUrgency;
 showIcon?: boolean;
 showLabel?: boolean;
 size?: 'sm' | 'md' | 'lg';
 className?: string;
}

export const ExpirationBadge: React.FC<ExpirationBadgeProps> = ({
 daysRemaining,
 urgency: providedUrgency,
 showIcon = true,
 showLabel = true,
 size = 'md',
 className
}) => {
 const { t } = useLocale();

 if (daysRemaining === null) return null;

 const urgency = providedUrgency || ContractExpirationService.classifyUrgency(daysRemaining);
 const colors = ContractExpirationService.getUrgencyColor(urgency);

 const sizeClasses = {
 sm: 'text-xs px-1.5 py-0.5 gap-1',
 md: 'text-sm px-2 py-1 gap-1.5',
 lg: 'text-base px-3 py-1.5 gap-2'
 };

 const iconSizes = {
 sm: 'w-3 h-3',
 md: 'w-4 h-4',
 lg: 'w-5 h-5'
 };

 const Icon = urgency === 'expired' || urgency === 'critical' ? AlertCircle :
  urgency === 'warning' ? AlertTriangle : Clock;

 const getLabel = () => {
 if (daysRemaining <= 0) {
 return t('dora.expiration.expired');
 }
 if (daysRemaining === 1) {
 return t('dora.expiration.tomorrow');
 }
 return t('dora.expiration.daysRemaining', { days: daysRemaining });
 };

 return (
 <span
 className={cn(
 'inline-flex items-center rounded-full font-medium border',
 colors.bg,
 colors.text,
 colors.border,
 sizeClasses[size],
 className
 )}
 >
 {showIcon && <Icon className={iconSizes[size]} />}
 {showLabel && <span>{getLabel()}</span>}
 </span>
 );
};

interface ExpirationCountBadgeProps {
 count: number;
 urgency: ExpirationUrgency;
 onClick?: () => void;
 className?: string;
}

export const ExpirationCountBadge: React.FC<ExpirationCountBadgeProps> = ({
 count,
 urgency,
 onClick,
 className
}) => {
 const { t } = useLocale();

 if (count === 0) return null;

 const colors = ContractExpirationService.getUrgencyColor(urgency);
 const Icon = urgency === 'expired' || urgency === 'critical' ? AlertCircle :
  urgency === 'warning' ? AlertTriangle : Clock;

 const labels = {
 expired: t('dora.expiration.expiredCount', { count }),
 critical: t('dora.expiration.critical30', { count }),
 warning: t('dora.expiration.warning60', { count }),
 notice: t('dora.expiration.notice90', { count })
 };

 return (
 <button
 onClick={onClick}
 className={cn(
 'inline-flex items-center gap-2 px-3 py-2 rounded-3xl border transition-all',
 colors.bg,
 colors.text,
 colors.border,
 'hover:opacity-80',
 className
 )}
 >
 <Icon className="w-4 h-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" />
 <span className="text-sm font-medium">{labels[urgency]}</span>
 </button>
 );
};

interface ExpirationAlertBannerProps {
 expiredCount: number;
 criticalCount: number;
 warningCount: number;
 onViewAll?: () => void;
 className?: string;
}

export const ExpirationAlertBanner: React.FC<ExpirationAlertBannerProps> = ({
 expiredCount,
 criticalCount,
 warningCount,
 onViewAll,
 className
}) => {
 const { t } = useLocale();

 const totalUrgent = expiredCount + criticalCount;

 if (totalUrgent === 0 && warningCount === 0) return null;

 const isUrgent = totalUrgent > 0;

 return (
 <div
 className={cn(
 'flex items-center justify-between p-4 rounded-3xl border',
 isUrgent
  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 dark:border-red-800'
  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 dark:border-amber-800',
 className
 )}
 >
 <div className="flex items-center gap-3">
 <div className={cn(
  'p-2 rounded-full',
  isUrgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
 )}>
  <AlertTriangle className={cn(
  'w-5 h-5',
  isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
  )} />
 </div>
 <div>
  <p className={cn(
  'font-semibold',
  isUrgent ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
  )}>
  {isUrgent
  ? t('dora.expiration.urgentTitle', { count: totalUrgent })
  : t('dora.expiration.warningTitle', { count: warningCount })
  }
  </p>
  <p className={cn(
  'text-sm',
  isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
  )}>
  {isUrgent
  ? t('dora.expiration.urgentDesc')
  : t('dora.expiration.warningDesc')
  }
  </p>
 </div>
 </div>
 {onViewAll && (
 <button
  onClick={onViewAll}
  className={cn(
  'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
  isUrgent
  ? 'bg-red-600 text-white hover:bg-red-700'
  : 'bg-amber-600 text-white hover:bg-amber-700'
  )}
 >
  {t('dora.expiration.viewContracts')}
 </button>
 )}
 </div>
 );
};
