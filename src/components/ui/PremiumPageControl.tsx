import React, { useRef } from 'react';
import { Search, MoreVertical, LayoutGrid, List, LayoutDashboard, RefreshCcw } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../../hooks/useLocale';

interface PremiumPageControlProps {
 searchQuery: string;
 onSearchChange: (query: string) => void;
 searchPlaceholder?: string;

 showAdvancedSearch?: boolean;
 onToggleAdvancedSearch?: () => void;

 viewMode?: 'grid' | 'list' | 'matrix' | 'kanban';
 onViewModeChange?: (mode: 'grid' | 'list' | 'matrix' | 'kanban') => void;

 /**
 * Optional refresh callback
 */
 onRefresh?: () => void;

 // Generic View Props
 activeView?: string;
 onViewChange?: (view: string) => void;
 viewOptions?: { id: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];

 /**
 * Additional actions to render on the right side
 */
 actions?: React.ReactNode;

 /**
 * Bottom content area (e.g. Filter Pills)
 */
 bottomContent?: React.ReactNode;
 showBottomContent?: boolean;

 children?: React.ReactNode;
}

export const PremiumPageControl: React.FC<PremiumPageControlProps> = ({
 searchQuery,
 onSearchChange,
 searchPlaceholder,
 showAdvancedSearch,
 onToggleAdvancedSearch,
 viewMode,
 onViewModeChange,
 onRefresh,
 activeView,
 onViewChange,
 viewOptions,
 actions,
 bottomContent,
 showBottomContent,
 children
}) => {
 const inputRef = useRef<HTMLInputElement>(null);
 const { t } = useLocale();
 const resolvedPlaceholder = searchPlaceholder ?? t('ui.pageControl.searchPlaceholder', { defaultValue: 'Rechercher...' });

 return (
 <div className="relative z-30 flex flex-col md:flex-row gap-4 p-1.5 glass-premium rounded-3xl border border-border/40 shadow-xl backdrop-blur-xl">
 {/* Search Bar */}
 <div className="relative flex-1 min-w-0 group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
 <input aria-label={resolvedPlaceholder} value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
  ref={inputRef}
  type="text"
  placeholder={resolvedPlaceholder}
  className="w-full pl-11 pr-4 py-2.5 bg-transparent rounded-3xl focus:ring-0 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-all"
 />
 </div>

 {/* Actions & Controls */}
 <div className="flex flex-wrap md:flex-nowrap items-center justify-between md:justify-start gap-2 pt-2 md:pt-0 md:pl-2 border-t md:border-t-0 md:border-l border-border/40 dark:border-white/5 w-full md:w-auto">
 {onRefresh && (
  <button
  onClick={onRefresh}
  className="p-2 text-muted-foreground hover:text-primary dark:hover:text-primary/70 hover:bg-muted rounded-3xl transition-all"
  title={t('ui.pageControl.refresh', { defaultValue: 'Actualiser' })}
  >
  <RefreshCcw className="h-4 w-4" />
  </button>
 )}
 {children}
 {actions && (
  <div className="flex items-center gap-2 mr-2">
  {actions}
  </div>
 )}

 <div className="flex items-center gap-2 ml-auto md:ml-0">
  {/* Advanced Search Toggle */}
  {onToggleAdvancedSearch && (
  <button
  onClick={onToggleAdvancedSearch}
  className={`p-2 rounded-3xl transition-all duration-300 ${showAdvancedSearch
  ? 'bg-primary text-primary-foreground shadow-inner'
  : 'text-muted-foreground hover:bg-muted dark:hover:bg-muted/50'
  }`}
  title={t('ui.pageControl.advancedFilters', { defaultValue: 'Filtres avancés' })}
  >
  <MoreVertical className="h-5 w-5" />
  </button>
  )}

  {/* Custom View Options (Generic) */}
  {viewOptions && activeView && onViewChange && (
  <div className="flex bg-muted p-1 rounded-3xl">
  {viewOptions.map((option) => {
  const Icon = option.icon;
  return (
   <button
   key={option.id || 'unknown'}
   onClick={() => onViewChange(option.id)}
   className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 ${activeView === option.id
   ? 'bg-card text-foreground shadow-sm dark:bg-muted dark:text-foreground font-bold'
   : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted'
   }`}
   title={option.label}
   >
   {Icon && <Icon className="w-4 h-4" />}
   <span className="hidden lg:inline text-sm font-medium">{option.label}</span>
   </button>
  );
  })}
  </div>
  )}

  {/* Legacy View Mode Toggles */}
  {onViewModeChange && viewMode && !viewOptions && (
  <div className="flex bg-muted p-1 rounded-3xl">
  <button
  onClick={() => onViewModeChange?.('list')}
  className={`p-1.5 rounded-lg transition-all duration-300 ${viewMode === 'list'
   ? 'bg-card text-foreground shadow-sm dark:bg-muted dark:text-foreground'
   : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted'
   }`}
  title={t('ui.pageControl.viewList', { defaultValue: 'Vue Liste' })}
  >
  <List className="w-4 h-4" />
  </button>
  <button
  onClick={() => onViewModeChange?.('grid')}
  className={`p-1.5 rounded-lg transition-all duration-300 ${viewMode === 'grid'
   ? 'bg-card text-foreground shadow-sm dark:bg-muted dark:text-foreground'
   : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted'
   }`}
  title={t('ui.pageControl.viewGrid', { defaultValue: 'Vue Grille' })}
  >
  <LayoutGrid className="w-4 h-4" />
  </button>
  <button
  onClick={() => onViewModeChange?.('matrix')}
  className={`p-1.5 rounded-lg transition-all duration-300 ${viewMode === 'matrix'
   ? 'bg-card text-foreground shadow-sm dark:bg-muted dark:text-foreground'
   : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted'
   }`}
  title={t('ui.pageControl.viewMatrix', { defaultValue: 'Vue Matrice' })}
  >
  <LayoutDashboard className="w-4 h-4" />
  </button>
  <button
  onClick={() => onViewModeChange?.('kanban')}
  className={`p-1.5 rounded-lg transition-all duration-300 ${viewMode === 'kanban'
   ? 'bg-card text-foreground shadow-sm dark:bg-muted dark:text-foreground'
   : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted'
   }`}
  title={t('ui.pageControl.viewKanban', { defaultValue: 'Vue Kanban' })}
  >
  <LayoutGrid className="w-4 h-4 rotate-90" />
  </button>
  </div>
  )}
 </div>
 </div>

 <AnimatePresence>
 {showBottomContent && bottomContent && (
  <motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
  className="overflow-hidden"
  >
  <div className="px-4 py-3 border-t border-border/40 dark:border-white/5 mt-1.5 flex flex-wrap gap-2 items-center">
  {bottomContent}
  </div>
  </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
};
