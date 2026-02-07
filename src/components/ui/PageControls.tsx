import React from 'react';
import { Search, X, Filter, LayoutGrid, List, Loader2, Grid3X3 } from './Icons';
import { Tooltip } from './Tooltip';
import { useLocale } from '../../hooks/useLocale';

interface PageControlsProps {
 // Search
 searchQuery: string;
 onSearchChange: (query: string) => void;
 searchPlaceholder?: string;

 // Count
 totalItems?: number;
 isLoading?: boolean;

 // Filters
 onAdvancedSearch?: () => void;
 activeFiltersCount?: number;

 // View Mode
 viewMode?: 'grid' | 'list' | 'matrix';
 onViewModeChange?: (mode: 'grid' | 'list' | 'matrix') => void;

 // Actions
 primaryAction?: React.ReactNode;
 secondaryActions?: React.ReactNode;
}

export const PageControls: React.FC<PageControlsProps> = ({
 searchQuery,
 onSearchChange,
 searchPlaceholder,
 totalItems,
 isLoading,
 onAdvancedSearch,
 activeFiltersCount,
 viewMode,
 onViewModeChange,
 primaryAction,
 secondaryActions
}) => {
 const { t } = useLocale();
 const resolvedPlaceholder = searchPlaceholder ?? t('ui.pageControls.searchPlaceholder', { defaultValue: 'Rechercher...' });

 return (
 <div className="flex flex-col md:flex-row flex-wrap gap-4 justify-between items-center w-full">
 {/* Left Section: Search & Count */}
 <div className="flex-1 w-full md:max-w-xl relative group z-20">
 <div className="absolute inset-0 bg-primary/10 dark:bg-white/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
 <div className="relative bg-card border border-border/40 p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-primary/60 focus-within:border-primary/40 transition-all duration-300">
  <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />

  <input aria-label={resolvedPlaceholder} value={searchQuery} onChange={e => onSearchChange(e.target.value)}
  type="text"
  placeholder={resolvedPlaceholder}
  className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm text-foreground dark:text-white py-2.5 font-medium placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
  />

  {searchQuery && (
  <Tooltip content={t('ui.pageControls.clearSearch', { defaultValue: 'Effacer la recherche' })}>
  <button
  aria-label={t('ui.pageControls.clearSearch', { defaultValue: 'Effacer la recherche' })}
  type="button"
  onClick={() => onSearchChange('')}
  className="p-2.5 bg-muted/50 dark:bg-white/5 rounded-3xl text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors hover:bg-muted dark:hover:bg-muted"
  >
  <X className="h-4 w-4" />
  </button>
  </Tooltip>
  )}

  {/* Count Badge */}
  {totalItems !== undefined && (
  <div className="px-3 py-2 bg-muted/50 dark:bg-white/5 rounded-3xl text-xs font-bold text-muted-foreground border border-border/40 dark:border-white/5">
  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : totalItems}
  </div>
  )}

  {/* Filter Toggle */}
  {onAdvancedSearch && (
  <button
  aria-label={activeFiltersCount && activeFiltersCount > 0 ? t('ui.pageControls.activeFilters', { defaultValue: `Filtres actifs (${activeFiltersCount})`, count: activeFiltersCount }) : t('ui.pageControls.showFilters', { defaultValue: 'Afficher les filtres' })}
  onClick={onAdvancedSearch}
  className={`
  flex items-center gap-2 px-4 py-2 rounded-3xl text-xs font-bold transition-all duration-200
  ${activeFiltersCount && activeFiltersCount > 0
   ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90'
   : 'bg-muted dark:bg-white/10 text-muted-foreground hover:bg-muted dark:hover:bg-muted'}
  `}
  >
  <Filter className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">{t('ui.pageControls.filters', { defaultValue: 'Filtres' })}</span>
  {activeFiltersCount && activeFiltersCount > 0 ? (
  <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
   {activeFiltersCount}
  </span>
  ) : null}
  </button>
  )}
 </div>
 </div>

 {/* Right Section: View Mode & Actions */}
 <div className="flex items-center gap-3 w-full md:w-auto justify-end">
 {/* Secondary Actions Slot */}
 {secondaryActions && (
  <div className="flex items-center gap-2">
  {secondaryActions}
  </div>
 )}

 {/* View Mode Toggle */}
 {viewMode && onViewModeChange && (
  <div className="flex bg-card p-1 rounded-3xl border border-border/40 shadow-sm">
  <Tooltip content={t('ui.pageControls.viewGrid', { defaultValue: 'Vue Grille' })}>
  <button
  aria-label={t('ui.pageControls.switchToGrid', { defaultValue: 'Passer en vue grille' })}
  aria-pressed={viewMode === 'grid'}
  onClick={() => onViewModeChange('grid')}
  className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'grid'
   ? 'bg-card text-primary shadow-sm scale-100'
   : 'text-muted-foreground hover:text-muted-foreground hover:bg-muted/500 dark:hover:bg-muted/50'}`}
  >
  <LayoutGrid className="h-4 w-4" />
  </button>
  </Tooltip>
  <Tooltip content={t('ui.pageControls.viewList', { defaultValue: 'Vue Liste' })}>
  <button
  aria-label={t('ui.pageControls.switchToList', { defaultValue: 'Passer en vue liste' })}
  aria-pressed={viewMode === 'list'}
  onClick={() => onViewModeChange('list')}
  className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'list'
   ? 'bg-card text-primary shadow-sm scale-100'
   : 'text-muted-foreground hover:text-muted-foreground hover:bg-muted/500 dark:hover:bg-muted/50'}`}
  >
  <List className="h-4 w-4" />
  </button>
  </Tooltip>
  <Tooltip content={t('ui.pageControls.viewMatrix', { defaultValue: 'Vue Matrice' })}>
  <button
  aria-label={t('ui.pageControls.switchToMatrix', { defaultValue: 'Passer en vue matrice' })}
  aria-pressed={viewMode === 'matrix'}
  onClick={() => onViewModeChange('matrix')}
  className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'matrix'
   ? 'bg-card text-primary shadow-sm scale-100'
   : 'text-muted-foreground hover:text-muted-foreground hover:bg-muted/500 dark:hover:bg-muted/50'}`}
  >
  <Grid3X3 className="h-4 w-4" />
  </button>
  </Tooltip>
  </div>
 )}

 {/* Primary Action Slot */}
 {primaryAction && (
  <div className="ml-2">
  {primaryAction}
  </div>
 )}
 </div>
 </div>
 );
};
