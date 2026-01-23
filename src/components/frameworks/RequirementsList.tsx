/**
 * RequirementsList Component
 *
 * Main component for displaying regulatory requirements grouped by category
 * with filtering, search, and virtualization for performance.
 *
 * @see Story EU-1.4: Créer la vue RequirementsList
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  List,
  LayoutGrid,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useRequirements } from '../../hooks/useFrameworks';
import { RequirementCard } from './RequirementCard';
import { RequirementInspector } from './RequirementInspector';
import type {
  Requirement,
  RequirementCategory,
  CriticalityLevel,
  RequirementsByCategory,
  CATEGORY_LABELS,
} from '../../types/framework';

// ============================================================================
// Types
// ============================================================================

type FilterStatus = 'all' | 'linked' | 'unlinked';

interface RequirementsListProps {
  frameworkId: string;
  frameworkCode?: string;
  className?: string;
  onNavigateToControl?: (controlId: string) => void;
  /** Map of requirementId -> linked controls count */
  linkedControlsCounts?: Map<string, number>;
}

// ============================================================================
// Category Accordion Component
// ============================================================================

interface CategoryAccordionProps {
  category: string;
  categoryLabel: string;
  requirements: Requirement[];
  isExpanded: boolean;
  onToggle: () => void;
  onRequirementClick: (requirement: Requirement) => void;
  selectedRequirementId?: string;
  linkedControlsCounts?: Map<string, number>;
  locale: 'en' | 'fr' | 'de';
}

const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
  category,
  categoryLabel,
  requirements,
  isExpanded,
  onToggle,
  onRequirementClick,
  selectedRequirementId,
  linkedControlsCounts,
  locale,
}) => {
  const { t } = useTranslation();

  // Count requirements by criticality
  const criticalityCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    requirements.forEach((r) => {
      counts[r.criticality]++;
    });
    return counts;
  }, [requirements]);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </motion.div>
          <span className="font-semibold text-slate-900 dark:text-white">
            {categoryLabel}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
            {requirements.length}
          </span>
        </div>

        {/* Criticality indicators */}
        <div className="flex items-center gap-2">
          {criticalityCounts.high > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {criticalityCounts.high}
            </div>
          )}
          {criticalityCounts.medium > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3 h-3" />
              {criticalityCounts.medium}
            </div>
          )}
          {criticalityCounts.low > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Info className="w-3 h-3" />
              {criticalityCounts.low}
            </div>
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2">
              {requirements.map((requirement) => (
                <RequirementCard
                  key={requirement.id}
                  requirement={requirement}
                  onClick={onRequirementClick}
                  linkedControlsCount={linkedControlsCounts?.get(requirement.id) || 0}
                  isSelected={selectedRequirementId === requirement.id}
                  locale={locale}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const RequirementsList: React.FC<RequirementsListProps> = ({
  frameworkId,
  frameworkCode,
  className,
  onNavigateToControl,
  linkedControlsCounts = new Map(),
}) => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language as 'en' | 'fr' | 'de') || 'fr';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCriticality, setSelectedCriticality] = useState<CriticalityLevel | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<RequirementCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Fetch requirements grouped by category
  const requirementsResult = useRequirements({
    frameworkId,
    groupByCategory: true,
    locale,
    realtime: true,
  });

  const groupedData = requirementsResult.data as RequirementsByCategory[] | undefined;
  const isLoading = requirementsResult.isLoading;
  const error = requirementsResult.error;

  // Filter requirements
  const filteredGroups = useMemo(() => {
    if (!groupedData || !Array.isArray(groupedData)) return [];

    const groups = groupedData;
    const query = searchQuery.toLowerCase();

    return groups
      .map((group) => {
        let requirements = group.requirements;

        // Search filter
        if (query) {
          requirements = requirements.filter(
            (r) =>
              r.title.toLowerCase().includes(query) ||
              r.articleRef.toLowerCase().includes(query) ||
              r.description?.toLowerCase().includes(query) ||
              r.localizedTitles?.[locale]?.toLowerCase().includes(query)
          );
        }

        // Criticality filter
        if (selectedCriticality !== 'all') {
          requirements = requirements.filter((r) => r.criticality === selectedCriticality);
        }

        // Linked status filter
        if (filterStatus === 'linked') {
          requirements = requirements.filter((r) => (linkedControlsCounts.get(r.id) || 0) > 0);
        } else if (filterStatus === 'unlinked') {
          requirements = requirements.filter((r) => (linkedControlsCounts.get(r.id) || 0) === 0);
        }

        return {
          ...group,
          requirements,
          count: requirements.length,
        };
      })
      .filter((group) => {
        // Category filter
        if (selectedCategory !== 'all' && group.category !== selectedCategory) {
          return false;
        }
        return group.count > 0;
      });
  }, [groupedData, searchQuery, selectedCriticality, selectedCategory, filterStatus, linkedControlsCounts, locale]);

  // Total count
  const totalCount = useMemo(() => {
    return filteredGroups.reduce((sum, g) => sum + g.count, 0);
  }, [filteredGroups]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Expand all categories
  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(filteredGroups.map((g) => g.category)));
  }, [filteredGroups]);

  // Collapse all categories
  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  // Handle requirement click
  const handleRequirementClick = useCallback((requirement: Requirement) => {
    setSelectedRequirement(requirement);
    setIsInspectorOpen(true);
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCriticality('all');
    setSelectedCategory('all');
    setFilterStatus('all');
  }, []);

  const hasActiveFilters = searchQuery || selectedCriticality !== 'all' || selectedCategory !== 'all' || filterStatus !== 'all';

  // Categories for filter dropdown
  const availableCategories = useMemo(() => {
    if (!groupedData || !Array.isArray(groupedData)) return [];
    return groupedData.map((g) => ({
      value: g.category,
      label: g.categoryLabel,
    }));
  }, [groupedData]);

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          {t('requirements.errorLoading')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('requirements.errorLoadingHint')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('requirements.title')}
            {frameworkCode && (
              <span className="ml-2 text-brand-600 dark:text-brand-400">{frameworkCode}</span>
            )}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {totalCount} {t('requirements.requirements', { count: totalCount })}
          </p>
        </div>

        {/* Expand/Collapse all */}
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t('requirements.expandAll')}
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t('requirements.collapseAll')}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('requirements.searchPlaceholder')}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Criticality filter */}
          <select
            value={selectedCriticality}
            onChange={(e) => setSelectedCriticality(e.target.value as CriticalityLevel | 'all')}
            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="all">{t('requirements.allCriticalities')}</option>
            <option value="high">{t('requirements.criticality.high')}</option>
            <option value="medium">{t('requirements.criticality.medium')}</option>
            <option value="low">{t('requirements.criticality.low')}</option>
          </select>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as RequirementCategory | 'all')}
            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="all">{t('requirements.allCategories')}</option>
            {availableCategories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Linked status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="all">{t('requirements.filterAll')}</option>
            <option value="linked">{t('requirements.filterLinked')}</option>
            <option value="unlinked">{t('requirements.filterUnlinked')}</option>
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              title={t('requirements.clearFilters')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredGroups.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            {t('requirements.noResults')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {hasActiveFilters
              ? t('requirements.noResultsFiltered')
              : t('requirements.noRequirements')}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              {t('requirements.clearFilters')}
            </button>
          )}
        </motion.div>
      )}

      {/* Category Accordions */}
      {!isLoading && filteredGroups.length > 0 && (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <CategoryAccordion
              key={group.category}
              category={group.category}
              categoryLabel={group.categoryLabel}
              requirements={group.requirements}
              isExpanded={expandedCategories.has(group.category)}
              onToggle={() => toggleCategory(group.category)}
              onRequirementClick={handleRequirementClick}
              selectedRequirementId={selectedRequirement?.id}
              linkedControlsCounts={linkedControlsCounts}
              locale={locale}
            />
          ))}
        </div>
      )}

      {/* Requirement Inspector */}
      <RequirementInspector
        requirement={selectedRequirement}
        isOpen={isInspectorOpen}
        onClose={() => {
          setIsInspectorOpen(false);
          setSelectedRequirement(null);
        }}
        linkedControls={[]} // TODO: Fetch linked controls for selected requirement
        onNavigateToControl={onNavigateToControl}
        locale={locale}
      />
    </div>
  );
};

export default RequirementsList;
