import React from 'react';
import { Search, X, Filter, LayoutGrid, List, Loader2, Grid3X3 } from './Icons';
import { Tooltip } from './Tooltip';

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
    searchPlaceholder = "Rechercher...",
    totalItems,
    isLoading,
    onAdvancedSearch,
    activeFiltersCount,
    viewMode,
    onViewModeChange,
    primaryAction,
    secondaryActions
}) => {
    return (
        <div className="flex flex-col md:flex-row flex-wrap gap-4 justify-between items-center w-full">
            {/* Left Section: Search & Count */}
            <div className="flex-1 w-full md:max-w-xl relative group z-20">
                <div className="absolute inset-0 bg-brand-50 dark:bg-white/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
                <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-300 focus-within:border-brand-300 transition-all duration-300">
                    <Search className="h-5 w-5 text-slate-500 dark:text-slate-300 group-focus-within:text-brand-500 transition-colors" />

                    <input aria-label={searchPlaceholder} value={searchQuery} onChange={e => onSearchChange(e.target.value)}
                        type="text"
                        placeholder={searchPlaceholder}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 dark:text-white py-2.5 font-medium placeholder-slate-500 dark:placeholder-slate-400"
                    />

                    {searchQuery && (
                        <Tooltip content="Effacer la recherche">
                            <button
                                aria-label="Effacer la recherche"
                                type="button"
                                onClick={() => onSearchChange('')}
                                className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </Tooltip>
                    )}

                    {/* Count Badge */}
                    {totalItems !== undefined && (
                        <div className="px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-white/5">
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : totalItems}
                        </div>
                    )}

                    {/* Filter Toggle */}
                    {onAdvancedSearch && (
                        <button
                            aria-label={activeFiltersCount && activeFiltersCount > 0 ? `Filtres actifs (${activeFiltersCount})` : "Afficher les filtres"}
                            onClick={onAdvancedSearch}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200
                                ${activeFiltersCount && activeFiltersCount > 0
                                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'}
                            `}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Filtres</span>
                            {activeFiltersCount && activeFiltersCount > 0 ? (
                                <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[11px]">
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
                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <Tooltip content="Vue Grille">
                            <button
                                aria-label="Passer en vue grille"
                                aria-pressed={viewMode === 'grid'}
                                onClick={() => onViewModeChange('grid')}
                                className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'grid'
                                    ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-sm scale-100'
                                    : 'text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5'}`}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content="Vue Liste">
                            <button
                                aria-label="Passer en vue liste"
                                aria-pressed={viewMode === 'list'}
                                onClick={() => onViewModeChange('list')}
                                className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'list'
                                    ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-sm scale-100'
                                    : 'text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5'}`}
                            >
                                <List className="h-4 w-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content="Vue Matrice">
                            <button
                                aria-label="Passer en vue matrice"
                                aria-pressed={viewMode === 'matrix'}
                                onClick={() => onViewModeChange('matrix')}
                                className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'matrix'
                                    ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-sm scale-100'
                                    : 'text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5'}`}
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
