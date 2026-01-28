/**
 * TrainingCatalog Component
 *
 * Main catalog view for training courses with filters, search, and actions.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module TrainingCatalog
 */

import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  GraduationCap,
  Shield,
  Award,
  Users,
  FileText,
  X,
  LayoutGrid,
  List,
  RefreshCw,
} from '../ui/Icons';
import type { LucideIcon } from '../ui/Icons';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { TrainingCourseCard } from './TrainingCourseCard';
import { useStore } from '../../store';
import {
  useTrainingStore,
  useFilteredCourses,
  useCourseFilters,
  useTrainingLoading,
} from '../../stores/trainingStore';
import type { TrainingCourse, TrainingCategory } from '../../types/training';
import { appleEasing, staggerContainer, staggerItem } from '../../utils/microInteractions';

// ============================================================================
// Types
// ============================================================================

interface TrainingCatalogProps {
  onCreateCourse: () => void;
  onViewCourse: (course: TrainingCourse) => void;
  onEditCourse: (course: TrainingCourse) => void;
  onArchiveCourse: (course: TrainingCourse) => void;
  onAssignCourse: (course: TrainingCourse) => void;
  onRefresh?: () => void;
  canEdit?: boolean;
}

type ViewMode = 'grid' | 'list';

// ============================================================================
// Filter Categories
// ============================================================================

interface CategoryOption {
  value: TrainingCategory | 'all';
  label: string;
  icon: LucideIcon;
  color: string;
}

const categoryOptions: CategoryOption[] = [
  { value: 'all', label: 'training.catalog', icon: GraduationCap, color: 'text-foreground' },
  { value: 'security', label: 'training.categories.security', icon: Shield, color: 'text-error-text' },
  { value: 'compliance', label: 'training.categories.compliance', icon: Award, color: 'text-primary' },
  { value: 'awareness', label: 'training.categories.awareness', icon: Users, color: 'text-warning-text' },
  { value: 'technical', label: 'training.categories.technical', icon: FileText, color: 'text-info-text' },
];

const sourceOptions = [
  { value: 'all', label: 'common.all' },
  { value: 'anssi', label: 'training.sources.anssi' },
  { value: 'cnil', label: 'training.sources.cnil' },
  { value: 'internal', label: 'training.sources.internal' },
  { value: 'external', label: 'training.sources.external' },
];

// ============================================================================
// Skeleton Components
// ============================================================================

const CourseCardSkeleton: React.FC = () => (
  <div className="glass-premium p-5 rounded-3xl border border-white/5">
    <div className="flex items-start justify-between mb-4">
      <Skeleton className="w-12 h-12 rounded-2xl" />
      <Skeleton className="w-8 h-8 rounded-3xl" />
    </div>
    <Skeleton className="h-5 w-3/4 rounded-md mb-2" />
    <Skeleton className="h-4 w-full rounded-md mb-1" />
    <Skeleton className="h-4 w-2/3 rounded-md mb-4" />
    <div className="flex gap-2">
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-5 w-12 rounded-md" />
    </div>
  </div>
);

const CatalogSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <CourseCardSkeleton key={i} />
    ))}
  </div>
);

// ============================================================================
// Component
// ============================================================================

export const TrainingCatalog: React.FC<TrainingCatalogProps> = ({
  onCreateCourse,
  onViewCourse,
  onEditCourse,
  onArchiveCourse,
  onAssignCourse,
  onRefresh,
  canEdit = false,
}) => {
  const { t } = useStore();

  // Store state
  const courses = useFilteredCourses();
  const filters = useCourseFilters();
  const isLoading = useTrainingLoading();
  const setCourseFilters = useTrainingStore((s) => s.setCourseFilters);
  const resetFilters = useTrainingStore((s) => s.resetFilters);

  // Local state
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = React.useState(false);

  // Handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCourseFilters({ searchQuery: e.target.value });
  }, [setCourseFilters]);

  const handleCategoryChange = useCallback((category: TrainingCategory | 'all') => {
    setCourseFilters({ category });
  }, [setCourseFilters]);

  const handleSourceChange = useCallback((source: string) => {
    setCourseFilters({ source });
  }, [setCourseFilters]);

  const handleRequiredOnlyToggle = useCallback(() => {
    setCourseFilters({ showRequiredOnly: !filters.showRequiredOnly });
  }, [setCourseFilters, filters.showRequiredOnly]);

  const handleClearFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.category !== 'all' ||
      filters.source !== 'all' ||
      filters.searchQuery !== '' ||
      filters.showRequiredOnly
    );
  }, [filters]);

  // Stats
  const stats = useMemo(() => {
    const allCourses = useTrainingStore.getState().courses;
    return {
      total: allCourses.length,
      required: allCourses.filter((c) => c.isRequired).length,
      filtered: courses.length,
    };
  }, [courses]);

  return (
    <div className="space-y-6">
      {/* Header with search and actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('training.searchPlaceholder') || 'Rechercher une formation...'}
            value={filters.searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 rounded-3xl bg-muted/50 border border-muted focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm text-foreground placeholder:text-muted-foreground transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => setCourseFilters({ searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center rounded-3xl bg-muted/50 border border-muted p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Filter toggle */}
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="w-4 h-4 mr-2" />
            {t('common.filters') || 'Filtres'}
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
            )}
          </Button>

          {/* Refresh */}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}

          {/* Create */}
          {canEdit && (
            <Button onClick={onCreateCourse} className="shadow-sm shadow-primary">
              <Plus className="w-4 h-4 mr-2" />
              {t('training.course.create')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: appleEasing }}
            className="overflow-hidden"
          >
            <div className="glass-premium p-6 rounded-3xl border border-border/40 space-y-4">
              {/* Category chips */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  {t('training.course.category')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = filters.category === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleCategoryChange(option.value)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-3xl text-sm font-medium transition-all ${isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-muted'
                          }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? '' : option.color}`} />
                        {t(option.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source and Required toggle */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Source dropdown */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                    {t('training.course.source')}
                  </label>
                  <select
                    value={filters.source}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    className="px-3 py-2 rounded-3xl bg-muted/50 border border-muted text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.label)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Required only toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="required-only"
                    checked={filters.showRequiredOnly}
                    onChange={handleRequiredOnlyToggle}
                    className="w-4 h-4 rounded-md border-muted text-primary focus:ring-primary/20"
                  />
                  <label htmlFor="required-only" className="text-sm text-foreground cursor-pointer">
                    {t('training.course.isRequired')}
                  </label>
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('common.clearFilters') || 'Effacer les filtres'}
                  </button>
                )}
              </div>

              {/* Results count */}
              <div className="text-sm text-muted-foreground">
                {stats.filtered} {t('training.stats.total').toLowerCase()} sur {stats.total}
                {filters.showRequiredOnly && ` (${stats.required} ${t('common.required').toLowerCase()})`}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {isLoading ? (
        <CatalogSkeleton />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={hasActiveFilters
            ? (t('training.empty.noResults') || 'Aucun résultat')
            : (t('training.empty.catalog'))
          }
          description={hasActiveFilters
            ? (t('training.empty.noResultsDesc') || 'Essayez de modifier vos filtres.')
            : (t('training.empty.catalogDesc'))
          }
          actionLabel={hasActiveFilters ? undefined : (canEdit ? t('training.course.create') : undefined)}
          onAction={hasActiveFilters ? undefined : (canEdit ? onCreateCourse : undefined)}
          secondaryActionLabel={hasActiveFilters ? (t('common.clearFilters') || 'Effacer les filtres') : undefined}
          onSecondaryAction={hasActiveFilters ? handleClearFilters : undefined}
          semantic="info"
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
            : 'flex flex-col gap-4'
          }
        >
          {courses.map((course) => (
            <motion.div key={course.id} variants={staggerItem}>
              <TrainingCourseCard
                course={course}
                onView={onViewCourse}
                onEdit={canEdit ? onEditCourse : undefined}
                onArchive={canEdit ? onArchiveCourse : undefined}
                onAssign={canEdit ? onAssignCourse : undefined}
                canEdit={canEdit}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

TrainingCatalog.displayName = 'TrainingCatalog';
