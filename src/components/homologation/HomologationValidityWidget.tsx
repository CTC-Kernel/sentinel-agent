/**
 * HomologationValidityWidget
 *
 * Dashboard widget displaying homologation validity status and expiring dossiers.
 * Story 38-3: Homologation Validity Tracking
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ChevronRight,
  Calendar,
  Star,
  FileText,
  Shield,
  ShieldAlert,
  Loader2
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/progress';
import { useStore } from '../../store';
import {
  HomologationService,
  type ValidityState
} from '../../services/HomologationService';
import type { HomologationDossier, HomologationLevel } from '../../types/homologation';
import { LEVEL_INFO } from '../../types/homologation';

// ============================================================================
// Types
// ============================================================================

interface ValidityItem {
  dossier: HomologationDossier;
  daysRemaining: number;
  state: ValidityState;
}

// ============================================================================
// Constants
// ============================================================================

const LEVEL_ICONS: Record<HomologationLevel, React.ElementType> = {
  etoile: Star,
  simple: FileText,
  standard: Shield,
  renforce: ShieldAlert
};

const STATE_CONFIG: Record<ValidityState, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  label: string;
  labelEn: string;
}> = {
  active: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: CheckCircle,
    label: 'Actif',
    labelEn: 'Active'
  },
  expiring_soon: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    icon: Clock,
    label: 'Expire bientôt',
    labelEn: 'Expiring soon'
  },
  critical: {
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    icon: AlertTriangle,
    label: 'Critique',
    labelEn: 'Critical'
  },
  expired: {
    color: 'text-red-700',
    bgColor: 'bg-red-200',
    borderColor: 'border-red-400',
    icon: AlertCircle,
    label: 'Expiré',
    labelEn: 'Expired'
  },
  not_set: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: Clock,
    label: 'Non défini',
    labelEn: 'Not set'
  }
};

// ============================================================================
// Component
// ============================================================================

interface HomologationValidityWidgetProps {
  compact?: boolean;
  maxItems?: number;
  showStats?: boolean;
  onRenewalClick?: (dossier: HomologationDossier) => void;
}

export const HomologationValidityWidget: React.FC<HomologationValidityWidgetProps> = ({
  compact = false,
  maxItems = 5,
  showStats = true,
  onRenewalClick
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organization } = useStore();

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalHomologated: number;
    active: number;
    expiringSoon: number;
    critical: number;
    expired: number;
    averageDaysRemaining: number | null;
    upcomingExpirations: ValidityItem[];
  } | null>(null);

  // Fetch validity stats
  const fetchStats = useCallback(async () => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      const validityStats = await HomologationService.getValidityStats(organization.id);
      setStats(validityStats);
    } catch (error) {
      console.error('Error fetching validity stats:', error);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Get items to display
  const displayItems = useMemo(() => {
    if (!stats) return [];
    return stats.upcomingExpirations.slice(0, maxItems);
  }, [stats, maxItems]);

  // Calculate overall health percentage
  const healthPercentage = useMemo(() => {
    if (!stats || stats.totalHomologated === 0) return 100;
    return Math.round((stats.active / stats.totalHomologated) * 100);
  }, [stats]);

  // Handle view dossier
  const handleViewDossier = useCallback((dossierId: string) => {
    navigate(`/homologation/${dossierId}`);
  }, [navigate]);

  // Handle renewal
  const handleRenewal = useCallback((dossier: HomologationDossier) => {
    if (onRenewalClick) {
      onRenewalClick(dossier);
    } else {
      navigate(`/homologation/${dossier.id}?action=renew`);
    }
  }, [navigate, onRenewalClick]);

  // Render loading state
  if (loading) {
    return (
      <Card className={cn('p-4', compact && 'p-3')}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  // No data state
  if (!stats || stats.totalHomologated === 0) {
    return (
      <Card className={cn('p-4', compact && 'p-3')}>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">
            {t('homologation.validity.title', 'Validité des homologations')}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          {t('homologation.validity.noData', 'Aucune homologation active')}
        </p>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', compact && 'p-0')}>
      {/* Header with stats */}
      {showStats && (
        <div className={cn('p-4 border-b bg-muted/30', compact && 'p-3')}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">
                {t('homologation.validity.title', 'Validité des homologations')}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStats}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Health bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">
                {t('homologation.validity.health', 'Santé globale')}
              </span>
              <span className={cn(
                'font-medium',
                healthPercentage >= 80 ? 'text-green-600' :
                healthPercentage >= 50 ? 'text-amber-600' : 'text-red-600'
              )}>
                {healthPercentage}%
              </span>
            </div>
            <Progress
              value={healthPercentage}
              className={cn(
                'h-2',
                healthPercentage >= 80 ? '[&>div]:bg-green-500' :
                healthPercentage >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
              )}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
              <p className="text-lg font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-muted-foreground">
                {t('homologation.validity.active', 'Actifs')}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950">
              <p className="text-lg font-bold text-amber-600">{stats.expiringSoon}</p>
              <p className="text-xs text-muted-foreground">
                {t('homologation.validity.warning', 'Attention')}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950">
              <p className="text-lg font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-muted-foreground">
                {t('homologation.validity.critical', 'Critiques')}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
              <p className="text-lg font-bold text-gray-600 dark:text-gray-400">{stats.expired}</p>
              <p className="text-xs text-muted-foreground">
                {t('homologation.validity.expired', 'Expirés')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expiring items list */}
      <div className={cn(!showStats && 'pt-4')}>
        {displayItems.length > 0 ? (
          <div className="divide-y">
            {displayItems.map((item) => {
              const config = STATE_CONFIG[item.state];
              const StateIcon = config.icon;
              const LevelIcon = LEVEL_ICONS[item.dossier.level];
              const levelInfo = LEVEL_INFO[item.dossier.level];

              return (
                <div
                  key={item.dossier.id}
                  className={cn(
                    'flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer',
                    compact && 'p-2'
                  )}
                  onClick={() => handleViewDossier(item.dossier.id)}
                >
                  {/* State indicator */}
                  <div className={cn('p-2 rounded-lg', config.bgColor)}>
                    <StateIcon className={cn('h-4 w-4', config.color)} />
                  </div>

                  {/* Dossier info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate text-sm">{item.dossier.name}</p>
                      <LevelIcon
                        className="h-3.5 w-3.5 flex-shrink-0"
                        style={{ color: levelInfo.color }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.daysRemaining < 0
                        ? t('homologation.validity.expiredDaysAgo', 'Expiré depuis {{days}} jours', {
                            days: Math.abs(item.daysRemaining)
                          })
                        : t('homologation.validity.expiresInDays', 'Expire dans {{days}} jours', {
                            days: item.daysRemaining
                          })
                      }
                    </p>
                  </div>

                  {/* Days badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      config.color,
                      config.borderColor,
                      'border'
                    )}
                  >
                    {item.daysRemaining < 0 ? 'Expiré' : `${item.daysRemaining}j`}
                  </Badge>

                  {/* Renewal button for expiring items */}
                  {item.state !== 'active' && item.state !== 'expired' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenewal(item.dossier);
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">
                        {t('homologation.validity.renew', 'Renouveler')}
                      </span>
                    </Button>
                  )}

                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('homologation.validity.allGood', 'Toutes les homologations sont à jour')}
            </p>
          </div>
        )}

        {/* View all link */}
        {stats.upcomingExpirations.length > maxItems && (
          <div className="p-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => navigate('/homologation?filter=expiring')}
            >
              {t('homologation.validity.viewAll', 'Voir toutes les homologations')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default HomologationValidityWidget;
