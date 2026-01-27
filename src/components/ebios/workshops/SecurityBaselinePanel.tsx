/**
 * Security Baseline Panel Component
 * Displays and manages security baseline assessment in Workshop 1
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, MinusCircle, Search, Filter } from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { ProgressRing } from '../../ui/ProgressRing';
import type { SecurityBaseline, SecurityBaselineMeasure } from '../../../types/ebios';

interface SecurityBaselinePanelProps {
  baseline: SecurityBaseline;
  onChange: (baseline: SecurityBaseline) => void;
  readOnly?: boolean;
}

type MeasureStatus = SecurityBaselineMeasure['status'];
type FilterStatus = MeasureStatus | 'all';

const STATUS_CONFIG: Record<MeasureStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  implemented: {
    icon: CheckCircle,
    color: 'green',
    label: 'ebios.workshop1.measureImplemented',
  },
  partial: {
    icon: AlertCircle,
    color: 'yellow',
    label: 'ebios.workshop1.measurePartial',
  },
  not_implemented: {
    icon: MinusCircle,
    color: 'red',
    label: 'ebios.workshop1.measureNotImplemented',
  },
};

export const SecurityBaselinePanel: React.FC<SecurityBaselinePanelProps> = ({
  baseline,
  onChange,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Filter measures
  const filteredMeasures = useMemo(() => {
    return baseline.measures.filter((measure) => {
      const matchesSearch =
        searchQuery === '' ||
        measure.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        measure.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || measure.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [baseline.measures, searchQuery, filterStatus]);

  const filteredByCategory = useMemo(() => {
    const groups: Record<string, SecurityBaselineMeasure[]> = {};
    filteredMeasures.forEach((measure) => {
      if (!groups[measure.category]) {
        groups[measure.category] = [];
      }
      groups[measure.category].push(measure);
    });
    return groups;
  }, [filteredMeasures]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const updateMeasureStatus = (measureId: string, newStatus: MeasureStatus) => {
    const updatedMeasures = baseline.measures.map((m) =>
      m.id === measureId ? { ...m, status: newStatus } : m
    );

    // Recalculate totals
    const implemented = updatedMeasures.filter((m) => m.status === 'implemented').length;
    const partial = updatedMeasures.filter((m) => m.status === 'partial').length;
    const notImplemented = updatedMeasures.filter((m) => m.status === 'not_implemented').length;
    const total = updatedMeasures.length;
    const maturityScore = total > 0 ? Math.round(((implemented + partial * 0.5) / total) * 100) : 0;

    onChange({
      ...baseline,
      measures: updatedMeasures,
      implementedMeasures: implemented,
      partialMeasures: partial,
      notImplementedMeasures: notImplemented,
      totalMeasures: total,
      maturityScore,
    });
  };

  if (baseline.measures.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 dark:text-muted-foreground">
          {t('ebios.workshop1.noSecurityBaselineYet')}
        </p>
        <p className="text-sm text-muted-foreground dark:text-slate-500 mt-1">
          {t('ebios.workshop1.securityBaselineHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
          <ProgressRing
            progress={baseline.maturityScore}
            size={80}
            strokeWidth={6}
            className="mx-auto"
          />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('ebios.workshop1.maturityScore')}</p>
        </div>

        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/50">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {baseline.implementedMeasures}
            </span>
          </div>
          <p className="text-sm text-green-600/70 dark:text-green-400/70 text-center mt-1">
            {t('ebios.workshop1.implemented')}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200/50 dark:border-yellow-700/50">
          <div className="flex items-center justify-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {baseline.partialMeasures}
            </span>
          </div>
          <p className="text-sm text-yellow-600/70 dark:text-yellow-400/70 text-center mt-1">
            {t('ebios.workshop1.partial')}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-1000 dark:border-red-700/50">
          <div className="flex items-center justify-center gap-2">
            <MinusCircle className="w-5 h-5 text-red-500" />
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {baseline.notImplementedMeasures}
            </span>
          </div>
          <p className="text-sm text-red-600/70 dark:text-red-400/70 text-center mt-1">
            {t('ebios.workshop1.notImplemented')}
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('ebios.workshop1.searchMeasures')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">{t('ebios.workshop1.allMeasures')}</option>
            <option value="implemented">{t('ebios.workshop1.implemented')}</option>
            <option value="partial">{t('ebios.workshop1.partial')}</option>
            <option value="not_implemented">{t('ebios.workshop1.notImplemented')}</option>
          </select>
        </div>
      </div>

      {/* Measures List by Category */}
      <div className="space-y-3">
        {Object.entries(filteredByCategory).map(([category, measures]) => (
          <div
            key={category}
            className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900 dark:text-white">
                  {category}
                </span>
                <span className="text-sm text-slate-500">
                  ({measures.length} {t('ebios.workshop1.measures')})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                  {measures.filter((m) => m.status === 'implemented').length}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                  {measures.filter((m) => m.status === 'partial').length}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  {measures.filter((m) => m.status === 'not_implemented').length}
                </span>
              </div>
            </button>

            {expandedCategories.has(category) && (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {measures.map((measure) => {
                  const statusConfig = STATUS_CONFIG[measure.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={measure.id}
                      className="p-4 bg-white dark:bg-slate-900/50"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm">
                            {measure.name}
                          </h4>
                          {measure.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {measure.description}
                            </p>
                          )}
                        </div>

                        {!readOnly ? (
                          <div className="flex items-center gap-1">
                            {(['implemented', 'partial', 'not_implemented'] as MeasureStatus[]).map(
                              (status) => {
                                const config = STATUS_CONFIG[status];
                                const Icon = config.icon;
                                return (
                                  <button
                                    key={status}
                                    onClick={() => updateMeasureStatus(measure.id, status)}
                                    className={cn(
                                      "p-2 rounded-lg transition-colors",
                                      measure.status === status
                                        ? `bg-${config.color}-100 dark:bg-${config.color}-900/30`
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                    title={t(config.label)}
                                  >
                                    <Icon
                                      className={cn(
                                        "w-5 h-5",
                                        measure.status === status
                                          ? `text-${config.color}-500`
                                          : "text-slate-300 dark:text-slate-600"
                                      )}
                                    />
                                  </button>
                                );
                              }
                            )}
                          </div>
                        ) : (
                          <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                            `bg-${statusConfig.color}-100 dark:bg-${statusConfig.color}-900/30`,
                            `text-${statusConfig.color}-600 dark:text-${statusConfig.color}-400`
                          )}>
                            <StatusIcon className="w-4 h-4" />
                            {t(statusConfig.label)}
                          </div>
                        )}
                      </div>

                      {measure.notes && (
                        <p className="mt-2 text-xs text-muted-foreground dark:text-slate-500 italic">
                          {measure.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {Object.keys(filteredByCategory).length === 0 && (
          <div className="text-center py-8 text-slate-500">
            {t('ebios.workshop1.noMeasuresFound')}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityBaselinePanel;
