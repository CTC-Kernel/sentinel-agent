/**
 * MappingMatrix Component
 *
 * Cross-framework mapping matrix showing controls vs frameworks
 * with coverage status and hover details.
 *
 * @see Story EU-1.5: Implémenter le Cross-Framework Mapping
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Grid,
  List,
  RefreshCw,
  Check,
  Minus,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useFrameworks, useActiveFrameworks } from '../../hooks/useFrameworks';
import { MappingCell } from './MappingCell';
import { ControlMappingCard } from './ControlMappingCard';
import type {
  RegulatoryFramework,
  ControlWithMappings,
  CoverageStatus,
} from '../../types/framework';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'matrix' | 'list';
type FilterCoverage = 'all' | 'full' | 'partial' | 'none' | 'unmapped';

interface MappingMatrixProps {
  /** Controls with their mappings */
  controls: ControlWithMappings[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a control is selected */
  onSelectControl?: (control: ControlWithMappings) => void;
  /** Callback when a mapping cell is clicked */
  onCellClick?: (controlId: string, frameworkId: string) => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Coverage Legend Component
// ============================================================================

const CoverageLegend: React.FC = () => {
  const { t } = useTranslation();

  const items = [
    { status: 'full', icon: Check, label: t('mapping.coverage.full'), color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 dark:bg-emerald-900/30' },
    { status: 'partial', icon: Minus, label: t('mapping.coverage.partial'), color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30 dark:bg-amber-900/30' },
    { status: 'none', icon: X, label: t('mapping.coverage.none'), color: 'text-red-500 bg-red-100 dark:bg-red-900/30 dark:bg-red-900/30' },
    { status: 'not_assessed', icon: AlertCircle, label: t('mapping.coverage.not_assessed'), color: 'text-slate-400 bg-slate-100 dark:bg-slate-800' },
  ];

  return (
    <div className="flex items-center gap-4 text-xs">
      {items.map((item) => (
        <div key={item.status} className="flex items-center gap-1.5">
          <div className={cn('w-6 h-6 rounded flex items-center justify-center', item.color)}>
            <item.icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-slate-600 dark:text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Stats Summary Component
// ============================================================================

interface StatsSummaryProps {
  controls: ControlWithMappings[];
  frameworks: RegulatoryFramework[];
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ controls, frameworks }) => {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    let totalMappings = 0;
    let fullCoverage = 0;
    let partialCoverage = 0;
    let unmapped = 0;

    controls.forEach((control) => {
      if (control.mappings.length === 0) {
        unmapped++;
      } else {
        control.mappings.forEach((m) => {
          totalMappings++;
          if (m.coveragePercentage >= 75) fullCoverage++;
          else if (m.coveragePercentage > 0) partialCoverage++;
        });
      }
    });

    return { totalMappings, fullCoverage, partialCoverage, unmapped };
  }, [controls]);

  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-900 dark:text-white">{controls.length}</span>
        <span className="text-slate-500 dark:text-muted-foreground">{t('mapping.controls')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-900 dark:text-white">{frameworks.length}</span>
        <span className="text-slate-500 dark:text-muted-foreground">{t('mapping.frameworks')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.fullCoverage}</span>
        <span className="text-slate-500 dark:text-muted-foreground">{t('mapping.fullCoverage')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-amber-600 dark:text-amber-400 dark:text-amber-400">{stats.partialCoverage}</span>
        <span className="text-slate-500 dark:text-muted-foreground">{t('mapping.partialCoverage')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-500 dark:text-muted-foreground">{stats.unmapped}</span>
        <span className="text-slate-500 dark:text-muted-foreground">{t('mapping.unmapped')}</span>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const MappingMatrix: React.FC<MappingMatrixProps> = ({
  controls,
  isLoading = false,
  onSelectControl,
  onCellClick,
  className,
}) => {
  const { t } = useTranslation();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCoverage, setFilterCoverage] = useState<FilterCoverage>('all');
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);

  // Fetch active frameworks
  const { data: activeFrameworks = [] } = useActiveFrameworks({ realtime: true });
  const { data: allFrameworks = [] } = useFrameworks({ realtime: true });

  // Get frameworks that are active
  const frameworks = useMemo(() => {
    const activeIds = new Set(activeFrameworks.map((af) => af.frameworkId));
    return allFrameworks.filter((f) => activeIds.has(f.id));
  }, [allFrameworks, activeFrameworks]);

  // Filter controls
  const filteredControls = useMemo(() => {
    let result = controls;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.controlCode.toLowerCase().includes(query) ||
          c.controlName.toLowerCase().includes(query)
      );
    }

    // Coverage filter
    if (filterCoverage !== 'all') {
      result = result.filter((c) => {
        if (filterCoverage === 'unmapped') {
          return c.mappings.length === 0;
        }
        return c.mappings.some((m) => {
          if (filterCoverage === 'full') return m.coveragePercentage >= 75;
          if (filterCoverage === 'partial') return m.coveragePercentage > 0 && m.coveragePercentage < 75;
          if (filterCoverage === 'none') return m.coveragePercentage === 0;
          return true;
        });
      });
    }

    return result;
  }, [controls, searchQuery, filterCoverage]);

  // Handle control selection
  const handleControlSelect = useCallback((control: ControlWithMappings) => {
    setSelectedControlId(control.controlId);
    onSelectControl?.(control);
  }, [onSelectControl]);

  // Get mapping for a specific control and framework
  const getMapping = useCallback((controlId: string, frameworkId: string) => {
    const control = controls.find((c) => c.controlId === controlId);
    if (!control) return null;
    return control.mappings.find((m) => m.frameworkId === frameworkId);
  }, [controls]);

  // Determine coverage status from percentage
  const getCoverageStatus = (percentage: number | undefined): CoverageStatus => {
    if (percentage === undefined) return 'not_assessed';
    if (percentage >= 75) return 'full';
    if (percentage > 0) return 'partial';
    return 'none';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('mapping.title')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1">
            {t('mapping.subtitle')}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('matrix')}
              className={cn(
                'p-2 rounded-md transition-all',
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-slate-300'
              )}
              title={t('mapping.viewMatrix')}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-all',
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-slate-300'
              )}
              title={t('mapping.viewList')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {!isLoading && (
        <StatsSummary controls={filteredControls} frameworks={frameworks} />
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('mapping.searchPlaceholder')}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-muted-foreground focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Coverage filter */}
        <select
          value={filterCoverage}
          onChange={(e) => setFilterCoverage(e.target.value as FilterCoverage)}
          className="px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent transition-all"
        >
          <option value="all">{t('mapping.filterAll')}</option>
          <option value="full">{t('mapping.filterFull')}</option>
          <option value="partial">{t('mapping.filterPartial')}</option>
          <option value="none">{t('mapping.filterNone')}</option>
          <option value="unmapped">{t('mapping.filterUnmapped')}</option>
        </select>
      </div>

      {/* Legend */}
      <CoverageLegend />

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredControls.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Grid className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            {t('mapping.noResults')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            {searchQuery ? t('mapping.noResultsSearch') : t('mapping.noControls')}
          </p>
        </motion.div>
      )}

      {/* Matrix View */}
      {!isLoading && filteredControls.length > 0 && viewMode === 'matrix' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[200px]">
                  {t('mapping.control')}
                </th>
                {frameworks.map((framework) => (
                  <th
                    key={framework.id}
                    className="px-3 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{framework.code}</span>
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                        {framework.requirementCount || 0} {t('mapping.reqs')}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredControls.map((control, index) => (
                <motion.tr
                  key={control.controlId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    'border-b border-slate-100 dark:border-white/5 transition-colors',
                    selectedControlId === control.controlId && 'bg-brand-50 dark:bg-brand-900'
                  )}
                >
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-4 py-3">
                    <button
                      onClick={() => handleControlSelect(control)}
                      className="text-left group"
                    >
                      <div className="font-mono text-xs font-semibold text-slate-500 dark:text-muted-foreground">
                        {control.controlCode}
                      </div>
                      <div className="text-sm text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
                        {control.controlName}
                      </div>
                    </button>
                  </td>
                  {frameworks.map((framework) => {
                    const mapping = getMapping(control.controlId, framework.id);
                    return (
                      <td key={framework.id} className="px-3 py-2">
                        <MappingCell
                          coverageStatus={getCoverageStatus(mapping?.coveragePercentage)}
                          coveragePercentage={mapping?.coveragePercentage || 0}
                          requirementCount={mapping?.requirementCount || 0}
                          onClick={() => onCellClick?.(control.controlId, framework.id)}
                          isHighlighted={selectedControlId === control.controlId}
                        />
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* List View */}
      {!isLoading && filteredControls.length > 0 && viewMode === 'list' && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredControls.map((control) => (
              <ControlMappingCard
                key={control.controlId}
                control={control}
                onClick={handleControlSelect}
                isSelected={selectedControlId === control.controlId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default MappingMatrix;
