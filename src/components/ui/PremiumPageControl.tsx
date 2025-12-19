import React, { useRef } from 'react';
import { Search, MoreVertical, LayoutGrid, List } from 'lucide-react';


interface PremiumPageControlProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    searchPlaceholder?: string;

    showAdvancedSearch?: boolean;
    onToggleAdvancedSearch?: () => void;

    viewMode?: 'grid' | 'list' | 'matrix';
    onViewModeChange?: (mode: 'grid' | 'list' | 'matrix') => void;

    /**
     * Additional actions to render on the right side, before the view toggles
     */
    actions?: React.ReactNode;
}

export const PremiumPageControl: React.FC<PremiumPageControlProps> = ({
    searchQuery,
    onSearchChange,
    searchPlaceholder = "Rechercher...",
    showAdvancedSearch,
    onToggleAdvancedSearch,
    viewMode,
    onViewModeChange,
    actions
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow duration-300">
            {/* Search Bar */}
            <div className="w-full sm:w-96">
                <div
                    className="relative group cursor-text"
                    onClick={() => inputRef.current?.focus()}
                >
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-hover:text-brand-500 transition-colors duration-300" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={searchPlaceholder}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black/20 border-none rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/50 transition-all font-medium"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
            </div>

            {/* Actions & Controls */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {actions && (
                    <div className="flex items-center gap-3 border-r border-slate-200 dark:border-white/10 pr-3 mr-1">
                        {actions}
                    </div>
                )}

                {/* Advanced Search Toggle */}
                {onToggleAdvancedSearch && (
                    <button
                        onClick={onToggleAdvancedSearch}
                        className={`p-3 rounded-xl transition-all duration-300 ${showAdvancedSearch
                            ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 shadow-inner'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
                            }`}
                        title="Filtres avancés"
                    >
                        <MoreVertical className="h-5 w-5" />
                    </button>
                )}

                {/* View Mode Toggles */}
                {onViewModeChange && viewMode && (
                    <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-xl flex">
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'list'
                                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                                }`}
                            title="Vue Liste"
                        >
                            <List className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'grid'
                                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
                                }`}
                            title="Vue Grille"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
