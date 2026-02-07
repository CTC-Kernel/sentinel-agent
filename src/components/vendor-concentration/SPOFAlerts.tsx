/**
 * SPOFAlerts Component
 * Story 37-4: Vendor Concentration Dashboard
 *
 * Displays Single Point of Failure alerts with impact
 * assessment, urgency indicators, and action buttons.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
 AlertTriangle,
 Clock,
 ChevronRight,
 Building2,
 Zap,
 Shield,
 ExternalLink,
 type LucideIcon,
} from '../ui/Icons';
import type { SPOFSummary, SPOFAlert, VendorImpactLevel, UrgencyLevel } from '../../types/vendorConcentration';

// ============================================================================
// Types
// ============================================================================

interface SPOFAlertsProps {
 summary: SPOFSummary;
 onViewDetails?: () => void;
 onAlertClick?: (alert: SPOFAlert) => void;
}

// ============================================================================
// Impact Badge Component
// ============================================================================

interface ImpactBadgeProps {
 level: VendorImpactLevel;
}

const ImpactBadge: React.FC<ImpactBadgeProps> = ({ level }) => {
 const { t } = useTranslation();

 const styles: Record<VendorImpactLevel, string> = {
 critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
 high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
 medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
 low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
 };

 return (
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[level]}`}>
 {t(`vendorConcentration.spof.impact.${level}`)}
 </span>
 );
};

// ============================================================================
// Urgency Indicator Component
// ============================================================================

interface UrgencyIndicatorProps {
 urgency: UrgencyLevel;
}

const UrgencyIndicator: React.FC<UrgencyIndicatorProps> = ({ urgency }) => {
 const { t } = useTranslation();

 const config: Record<UrgencyLevel, { icon: LucideIcon; color: string; label: string }> = {
 immediate: { icon: Zap, color: 'text-red-500', label: t('vendorConcentration.spof.urgency.immediate') },
 'short-term': { icon: Clock, color: 'text-orange-500', label: t('vendorConcentration.spof.urgency.shortTerm') },
 'long-term': { icon: Clock, color: 'text-blue-500', label: t('vendorConcentration.spof.urgency.longTerm') },
 };

 const { icon: Icon, color, label } = config[urgency];

 return (
 <div className={`flex items-center gap-1 text-xs ${color}`}>
 <Icon className="h-3.5 w-3.5" />
 <span>{label}</span>
 </div>
 );
};

// ============================================================================
// Alert Card Component
// ============================================================================

interface AlertCardProps {
 alert: SPOFAlert;
 onClick?: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onClick }) => {
 const { t } = useTranslation();
 const [expanded, setExpanded] = useState(false);

 const borderColor = {
 critical: 'border-l-red-500',
 high: 'border-l-orange-500',
 medium: 'border-l-yellow-500',
 low: 'border-l-blue-500',
 }[alert.impactLevel];

 return (
 <div
 className={`border border-border/40 rounded-3xl overflow-hidden border-l-4 ${borderColor}`}
 >
 <button
 onClick={() => setExpanded(!expanded)}
 className="w-full p-4 hover:bg-muted/50 transition-colors text-left"
 >
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
 <AlertTriangle className="h-5 w-5 text-red-500" />
 </div>
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="font-medium text-foreground">
  {alert.categoryLabel}
 </span>
 <ImpactBadge level={alert.impactLevel} />
 </div>
 <p className="text-sm text-muted-foreground">
 {t('vendorConcentration.spof.singleVendor', { vendor: alert.vendor.name })}
 </p>
 <UrgencyIndicator urgency={alert.urgency} />
 </div>
 </div>
 <ChevronRight
 className={`h-5 w-5 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
 />
 </div>
 </button>

 {expanded && (
 <div className="border-t border-border/40 p-4 bg-muted/30 space-y-4">
 {/* Vendor Info */}
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-lg bg-muted">
 <Building2 className="h-4 w-4 text-muted-foreground" />
 </div>
 <div>
 <p className="text-sm font-medium text-foreground">
 {alert.vendor.name}
 </p>
 <p className="text-xs text-muted-foreground">
 {alert.vendor.servicesCount} {t('vendorConcentration.spof.services')}
 {alert.vendor.criticalServicesCount > 0 && (
  <span className="text-red-500 ml-1">
  ({alert.vendor.criticalServicesCount} {t('vendorConcentration.spof.critical')})
  </span>
 )}
 </p>
 </div>
 </div>

 {/* Affected Services */}
 {alert.affectedServices.length > 0 && (
 <div>
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
 {t('vendorConcentration.spof.affectedServices')}
 </p>
 <div className="flex flex-wrap gap-1">
 {alert.affectedServices.slice(0, 5).map((service, idx) => (
  <span
  key={idx || 'unknown'}
  className="px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground"
  >
  {service}
  </span>
 ))}
 {alert.affectedServices.length > 5 && (
  <span className="px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground">
  +{alert.affectedServices.length - 5} {t('common.more')}
  </span>
 )}
 </div>
 </div>
 )}

 {/* Downtime Risk */}
 <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
 <Clock className="h-4 w-4 text-orange-500" />
 <span className="text-sm text-orange-700 dark:text-orange-400">
 {t('vendorConcentration.spof.downtimeRisk')}: {alert.estimatedDowntimeRisk}
 </span>
 </div>

 {/* Recommendation */}
 <div>
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
 {t('vendorConcentration.spof.recommendation')}
 </p>
 <p className="text-sm text-foreground text-muted-foreground">
 {alert.recommendation}
 </p>
 </div>

 {/* Action Button */}
 <button
 onClick={onClick}
 className="flex items-center gap-2 px-4 py-2 rounded-3xl text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
 >
 <Shield className="h-4 w-4" />
 {t('vendorConcentration.spof.viewRecommendations')}
 </button>
 </div>
 )}
 </div>
 );
};

// ============================================================================
// Main Component
// ============================================================================

export const SPOFAlerts: React.FC<SPOFAlertsProps> = ({
 summary,
 onViewDetails,
 onAlertClick,
}) => {
 const { t } = useTranslation();

 if (summary.totalSPOFs === 0) {
 return (
 <div className="text-center py-8">
 <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 w-fit mx-auto mb-4">
 <Shield className="h-8 w-8 text-green-500" />
 </div>
 <p className="text-lg font-medium text-foreground mb-1">
 {t('vendorConcentration.spof.noSPOFs')}
 </p>
 <p className="text-sm text-muted-foreground">
 {t('vendorConcentration.spof.noSPOFsDescription')}
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Summary Stats */}
 <div className="grid grid-cols-3 gap-3">
 <div className="text-center p-3 rounded-3xl bg-muted/50">
 <p className="text-2xl font-bold text-foreground">
 {summary.totalSPOFs}
 </p>
 <p className="text-xs text-muted-foreground">{t('vendorConcentration.spof.total')}</p>
 </div>
 <div className="text-center p-3 rounded-3xl bg-red-50 dark:bg-red-900/20">
 <p className="text-2xl font-bold text-red-600">
 {summary.criticalSPOFs}
 </p>
 <p className="text-xs text-red-500">{t('vendorConcentration.spof.criticalCount')}</p>
 </div>
 <div className="text-center p-3 rounded-3xl bg-orange-50 dark:bg-orange-900/20">
 <p className="text-2xl font-bold text-orange-600">
 {summary.highImpactSPOFs}
 </p>
 <p className="text-xs text-orange-500">{t('vendorConcentration.spof.highImpact')}</p>
 </div>
 </div>

 {/* Alert List */}
 <div className="space-y-3 max-h-[400px] overflow-y-auto">
 {summary.alerts.map(alert => (
 <AlertCard
 key={alert.id || 'unknown'}
 alert={alert}
 onClick={() => onAlertClick?.(alert)}
 />
 ))}
 </div>

 {/* View All Button */}
 {onViewDetails && summary.totalSPOFs > 3 && (
 <button
 onClick={onViewDetails}
 className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-3xl text-sm font-medium border border-border/40 hover:bg-muted transition-colors"
 >
 {t('vendorConcentration.spof.viewAll')}
 <ExternalLink className="h-4 w-4" />
 </button>
 )}
 </div>
 );
};

export default SPOFAlerts;
