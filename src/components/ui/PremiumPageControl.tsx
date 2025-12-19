import React, { useRef } from 'react';
import { Search, MoreVertical, LayoutGrid, List, LayoutDashboard } from 'lucide-react';


interface PremiumPageControlProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    searchPlaceholder?: string;

    showAdvancedSearch?: boolean;
    onToggleAdvancedSearch?: () => void;

    viewMode?: 'grid' | 'list' | 'matrix';
    onViewModeChange?: (mode: 'grid' | 'list' | 'matrix') => void;

    /**
     * Additional actions to render on the right side
     */
    actions?: React.ReactNode;
    children?: React.ReactNode;
}

export const PremiumPageControl: React.FC<PremiumPageControlProps> = ({
    searchQuery,
    onSearchChange,
    searchPlaceholder = "Rechercher...",
    showAdvancedSearch,
    onToggleAdvancedSearch,
    viewMode,
    onViewModeChange,
    actions,
    children
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="flex flex-col md:flex-row gap-4 p-1.5 bg-white/60 dark:bg-[#0B1120]/60 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-xl">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-0 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={searchPlaceholder}
                    className="w-full pl-11 pr-4 py-2.5 bg-transparent rounded-xl border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {/* Actions & Controls */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200/50 dark:border-white/5">
                {children}
                {actions && (
                    <div className="flex items-center gap-2 mr-2">
                        {actions}
                    </div>
                )}

                {/* Advanced Search Toggle */}
                {onToggleAdvancedSearch && (
                    <button
                        onClick={onToggleAdvancedSearch}
                        className={`p-2 rounded-xl transition-all duration-300 ${showAdvancedSearch
                            ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 shadow-inner'
                            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                            }`}
                        title="Filtres avancés"
                    >
                        <MoreVertical className="h-5 w-5" />
                    </button>
                )}

                {/* View Mode Toggles */}
                {onViewModeChange && viewMode && (
                    <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                        <button
                            onClick={() => onViewModeChange?.('list')}
                            className={`p-1.5 rounded-lg transition-all duration-300 ${viewMode === 'list'
                                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/10'
                                }`}
                            title="Vue Liste"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onViewModeChange?.('grid')}
                            className={`p-1.5 rounded-lg transition-all duration-300 ${viewMode === 'grid'
                                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/10'
                                }`}
                            title="Vue Grille"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onViewModeChange?.('matrix')}
                            className={`p-1.5 rounded-lg transition-all duration-300 ${viewMode === 'matrix'
                                ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/10'
                                }`}
                            title="Vue Matrice"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
