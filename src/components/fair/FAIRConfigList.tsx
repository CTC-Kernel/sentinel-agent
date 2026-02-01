/**
 * FAIR Configuration List Component
 * Epic 39: Financial Risk Quantification
 * Story 39-1: FAIR Model Configuration
 *
 * List view for FAIR configurations with actions.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { getLocaleConfig, type SupportedLocale } from '../../config/localeConfig';
import i18n from '../../i18n';
import {
  Calculator,
  Play,
  Eye,
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
  Clock,
  FileText
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu';
import type { FAIRModelConfig } from '../../types/fair';

// ============================================================================
// Types
// ============================================================================

interface FAIRConfigListProps {
  configurations: FAIRModelConfig[];
  onView: (config: FAIRModelConfig) => void;
  onEdit: (config: FAIRModelConfig) => void;
  onDuplicate: (config: FAIRModelConfig) => void;
  onDelete: (config: FAIRModelConfig) => void;
  onRunSimulation: (config: FAIRModelConfig) => void;
  loading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (value: number, currency: string = 'EUR'): string => {
  return new Intl.NumberFormat(getLocaleConfig(i18n.language as SupportedLocale).intlLocale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    notation: value >= 1000000 ? 'compact' : 'standard'
  }).format(value);
};

const getComplexityBadge = (level: FAIRModelConfig['complexityLevel']) => {
  switch (level) {
    case 'simple':
      return { label: 'Simple', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' };
    case 'standard':
      return { label: 'Standard', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' };
    case 'advanced':
      return { label: 'Avancé', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' };
    default:
      return { label: level, color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' };
  }
};

const getRiskLevel = (ale: number): { level: string; color: string; bgColor: string } => {
  if (ale < 50000) return { level: 'low', color: 'text-green-600', bgColor: 'bg-green-100' };
  if (ale < 200000) return { level: 'medium', color: 'text-amber-600', bgColor: 'bg-amber-100' };
  if (ale < 1000000) return { level: 'high', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  return { level: 'critical', color: 'text-red-600', bgColor: 'bg-red-100' };
};

// ============================================================================
// Config Card Component
// ============================================================================

interface ConfigCardProps {
  config: FAIRModelConfig;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRunSimulation: () => void;
  locale: Locale;
}

const ConfigCard: React.FC<ConfigCardProps> = ({
  config,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onRunSimulation,
  locale
}) => {
  const { t } = useTranslation();
  const complexity = getComplexityBadge(config.complexityLevel);
  const hasSimulation = !!config.lastSimulation;
  const ale = config.lastSimulation?.annualLossExpectancy?.total || 0;
  const riskLevel = hasSimulation ? getRiskLevel(ale) : null;

  const formattedDate = useMemo(() => {
    try {
      const date = config.updatedAt && typeof config.updatedAt === 'object' && 'toDate' in config.updatedAt
        ? (config.updatedAt as { toDate: () => Date }).toDate()
        : new Date(config.updatedAt as string);
      return format(date, 'PPP', { locale });
    } catch {
      return '-';
    }
  }, [config.updatedAt, locale]);

  return (
    <Card
      className="p-4 hover:shadow-md transition-all cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start justify-between">
        {/* Left: Icon and info */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'p-2 rounded-lg flex-shrink-0',
              hasSimulation && riskLevel ? riskLevel.bgColor : 'bg-slate-100 dark:bg-slate-800'
            )}
          >
            <Calculator
              className={cn(
                'h-5 w-5',
                hasSimulation && riskLevel ? riskLevel.color : 'text-slate-500'
              )}
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-foreground truncate">{config.name}</h3>
            {config.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">{config.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className={complexity.color}>{complexity.label}</Badge>
              {config.riskId && (
                <Badge variant="outline" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Risque lié
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-70 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="h-4 w-4 mr-2" />
              {t('common.view', 'Voir')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRunSimulation}>
              <Play className="h-4 w-4 mr-2" />
              {t('fair.actions.runSimulation', 'Lancer simulation')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              {t('common.edit', 'Modifier')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              {t('common.duplicate', 'Dupliquer')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('common.delete', 'Supprimer')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Simulation Results Summary */}
      {hasSimulation && config.lastSimulation && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">ALE</p>
              <p className={cn('font-semibold', riskLevel?.color)}>
                {formatCurrency(ale, config.primaryLossMagnitude.currency)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">VaR 95%</p>
              <p className="font-medium">
                {formatCurrency(
                  config.lastSimulation.valueAtRisk.var95,
                  config.primaryLossMagnitude.currency
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Fréquence</p>
              <p className="font-medium">
                {config.lastSimulation.lossEventFrequencyMean.toFixed(2)}/an
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No simulation yet */}
      {!hasSimulation && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              {t('fair.list.noSimulation', 'Pas encore simulé')}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onRunSimulation();
              }}
            >
              <Play className="h-3 w-3 mr-1" />
              {t('fair.actions.simulate', 'Simuler')}
            </Button>
          </div>
        </div>
      )}

      {/* Updated date */}
      <div className="mt-3 text-xs text-muted-foreground">
        {t('common.updatedAt', 'Mis à jour le')} {formattedDate}
      </div>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const FAIRConfigList: React.FC<FAIRConfigListProps> = ({
  configurations,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onRunSimulation,
  loading
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? enUS : fr;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i || 'unknown'} className="p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (configurations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-medium mb-2">
          {t('fair.list.empty', 'Aucune analyse FAIR')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {t(
            'fair.list.emptyDesc',
            'Créez votre première analyse de risque financier pour quantifier l\'impact de vos risques cyber.'
          )}
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {configurations.map((config) => (
        <ConfigCard
          key={config.id || 'unknown'}
          config={config}
          onView={() => onView(config)}
          onEdit={() => onEdit(config)}
          onDuplicate={() => onDuplicate(config)}
          onDelete={() => onDelete(config)}
          onRunSimulation={() => onRunSimulation(config)}
          locale={locale}
        />
      ))}
    </div>
  );
};

export default FAIRConfigList;
