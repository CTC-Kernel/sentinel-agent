import React from 'react';
import { Search, LayoutGrid, List, SlidersHorizontal, Table, FileSpreadsheet, FileText } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { useLocale } from '@/hooks/useLocale';

interface RiskFiltersProps {
 query: string;
 onQueryChange: (query: string) => void;
 viewMode: 'matrix' | 'list' | 'cards';
 onViewModeChange: (mode: 'matrix' | 'list' | 'cards') => void;
 frameworkFilter: string;
 onFrameworkFilterChange: (framework: string) => void;
 statusFilter?: string;
 onStatusFilterChange?: (status: string) => void;
 categoryFilter?: string;
 onCategoryFilterChange?: (category: string) => void;
 criticalityFilter?: string;
 onCriticalityFilterChange?: (criticality: string) => void;
 availableCategories?: string[];
 showAdvancedSearch: boolean;
 onToggleAdvancedSearch: () => void;
 totalRisks: number;
 filteredCount: number;
 onExportExcel?: () => void;
 onExportPdf?: () => void;
}

export const RiskFilters: React.FC<RiskFiltersProps> = ({
 query, onQueryChange, viewMode, onViewModeChange, frameworkFilter, onFrameworkFilterChange,
 statusFilter, onStatusFilterChange, categoryFilter, onCategoryFilterChange,
 criticalityFilter, onCriticalityFilterChange, availableCategories = [],
 showAdvancedSearch, onToggleAdvancedSearch, totalRisks, filteredCount,
 onExportExcel, onExportPdf
}) => {
 const { t } = useLocale();
 const hasActiveFilters = statusFilter || categoryFilter || criticalityFilter || frameworkFilter;

 return (
 <div className="space-y-4 mb-8">
 {/* Main Filter Bar */}
 <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-white/5 p-4 rounded-2xl shadow-sm border border-border/40 backdrop-blur-xl">
 <div className="relative flex-1 w-full md:max-w-md group">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors h-5 w-5" />
  <input value={query} onChange={(e) => onQueryChange(e.target.value)}
  type="text"
  placeholder={t('risks.filters.searchPlaceholder', { defaultValue: 'Rechercher une menace, une vulnérabilité...' })}
  className="pl-10 pr-4 py-3 w-full bg-muted/50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-black/40 border-2 focus-visible:border-primary rounded-3xl transition-all outline-none"
  aria-label={t('risks.filters.searchAria', { defaultValue: 'Rechercher un risque' })}
  />
 </div>

 <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
  <div className="flex bg-muted p-1 rounded-3xl">
  <button
  onClick={() => onViewModeChange('cards')}
  className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-card shadow-md text-primary dark:text-white' : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground'}`}
  title={t('risks.filters.viewCards', { defaultValue: 'Vue Cartes' })}
  >
  <LayoutGrid className="h-5 w-5" />
  </button>
  <button
  onClick={() => onViewModeChange('list')}
  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-card shadow-md text-primary dark:text-white' : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground'}`}
  title={t('risks.filters.viewList', { defaultValue: 'Vue Liste' })}
  >
  <List className="h-5 w-5" />
  </button>
  <button
  onClick={() => onViewModeChange('matrix')}
  className={`p-2 rounded-lg transition-all ${viewMode === 'matrix' ? 'bg-card shadow-md text-primary dark:text-white' : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground'}`}
  title={t('risks.filters.viewMatrix', { defaultValue: 'Matrice de risques' })}
  >
  <Table className="h-5 w-5" />
  </button>
  </div>

  <div className="h-8 w-px bg-muted dark:bg-white/10 mx-2" />

  <button
  onClick={onToggleAdvancedSearch}
  className={`p-2.5 rounded-3xl border transition-all flex items-center gap-2 ${showAdvancedSearch || hasActiveFilters ? 'bg-primary/10 border-primary/30 text-primary dark:bg-primary dark:border-primary/90' : 'bg-white dark:bg-white/5 border-border/40 text-muted-foreground hover:bg-muted'}`}
  title={t('risks.filters.advancedFilters', { defaultValue: 'Filtres avancés' })}
  >
  <SlidersHorizontal className="h-5 w-5" />
  {hasActiveFilters && (
  <span className="text-xs font-bold">Filtres</span>
  )}
  </button>

  {/* Export Buttons */}
  {(onExportExcel || onExportPdf) && (
  <>
  <div className="h-8 w-px bg-muted dark:bg-white/10 mx-2" />
  <div className="flex items-center gap-1">
  {onExportExcel && (
   <button
   onClick={onExportExcel}
   className="p-2 rounded-3xl bg-white dark:bg-white/5 border border-border/40 text-muted-foreground hover:bg-success-bg hover:text-success-text hover:border-success-border transition-all"
   title={t('risks.filters.exportExcel', { defaultValue: 'Exporter en Excel' })}
   >
   <FileSpreadsheet className="h-5 w-5" />
   </button>
  )}
  {onExportPdf && (
   <button
   onClick={onExportPdf}
   className="p-2 rounded-3xl bg-white dark:bg-white/5 border border-border/40 text-muted-foreground hover:bg-error-bg hover:text-error-text hover:border-error-border transition-all"
   title={t('risks.filters.exportPdf', { defaultValue: 'Exporter en PDF' })}
   >
   <FileText className="h-5 w-5" />
   </button>
  )}
  </div>
  </>
  )}

  {totalRisks !== filteredCount && (
  <Badge status="info" variant="soft" size="sm" className="whitespace-nowrap">
  {filteredCount} / {totalRisks}
  </Badge>
  )}
 </div>
 </div>

 {/* Advanced Filters Panel */}
 {showAdvancedSearch && (
 <div className="flex flex-wrap gap-3 p-4 bg-muted/50 dark:bg-white/5 rounded-2xl border border-border/40">
  {/* Framework Filter */}
  <select
  className="bg-white dark:bg-white/5 border border-border/40 rounded-3xl px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none hover:bg-muted/50 dark:hover:bg-muted transition-colors"
  value={frameworkFilter}
  onChange={(e) => onFrameworkFilterChange(e.target.value)}
  aria-label={t('risks.filters.filterByFramework', { defaultValue: 'Filtrer par référentiel' })}
  >
  <option value="">{t('risks.filters.allFrameworks', { defaultValue: 'Tous les référentiels' })}</option>
  <option value="ISO 27001">ISO 27001</option>
  <option value="ISO 27005">ISO 27005</option>
  <option value="EBIOS">EBIOS RM</option>
  <option value="NIST">NIST</option>
  </select>

  {/* Status Filter */}
  {onStatusFilterChange && (
  <select
  className="bg-white dark:bg-white/5 border border-border/40 rounded-3xl px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none hover:bg-muted/50 dark:hover:bg-muted transition-colors"
  value={statusFilter || ''}
  onChange={(e) => onStatusFilterChange(e.target.value)}
  aria-label={t('risks.filters.filterByStatus', { defaultValue: 'Filtrer par statut' })}
  >
  <option value="">{t('risks.filters.allStatuses', { defaultValue: 'Tous les statuts' })}</option>
  <option value="Brouillon">{t('risks.filters.status.draft', { defaultValue: 'Brouillon' })}</option>
  <option value="Ouvert">{t('risks.filters.status.open', { defaultValue: 'Ouvert' })}</option>
  <option value="En cours">{t('risks.filters.status.inProgress', { defaultValue: 'En cours' })}</option>
  <option value="En attente de validation">{t('risks.filters.status.pendingValidation', { defaultValue: 'En attente de validation' })}</option>
  <option value="Fermé">{t('risks.filters.status.closed', { defaultValue: 'Fermé' })}</option>
  </select>
  )}

  {/* Criticality Filter */}
  {onCriticalityFilterChange && (
  <select
  className="bg-white dark:bg-white/5 border border-border/40 rounded-3xl px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none hover:bg-muted/50 dark:hover:bg-muted transition-colors"
  value={criticalityFilter || ''}
  onChange={(e) => onCriticalityFilterChange(e.target.value)}
  aria-label={t('risks.filters.filterByCriticality', { defaultValue: 'Filtrer par criticité' })}
  >
  <option value="">{t('risks.filters.allCriticalities', { defaultValue: 'Toutes les criticités' })}</option>
  <option value="Critique">{t('risks.filters.criticality.critical', { defaultValue: 'Critique (15-25)' })}</option>
  <option value="Élevé">{t('risks.filters.criticality.high', { defaultValue: 'Élevé (10-14)' })}</option>
  <option value="Moyen">{t('risks.filters.criticality.medium', { defaultValue: 'Moyen (5-9)' })}</option>
  <option value="Faible">{t('risks.filters.criticality.low', { defaultValue: 'Faible (1-4)' })}</option>
  </select>
  )}

  {/* Category Filter */}
  {onCategoryFilterChange && availableCategories.length > 0 && (
  <select
  className="bg-white dark:bg-white/5 border border-border/40 rounded-3xl px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none hover:bg-muted/50 dark:hover:bg-muted transition-colors"
  value={categoryFilter || ''}
  onChange={(e) => onCategoryFilterChange(e.target.value)}
  aria-label={t('risks.filters.filterByCategory', { defaultValue: 'Filtrer par catégorie' })}
  >
  <option value="">{t('risks.filters.allCategories', { defaultValue: 'Toutes les catégories' })}</option>
  {availableCategories.map(cat => (
  <option key={cat || 'unknown'} value={cat}>{cat}</option>
  ))}
  </select>
  )}

  {/* Clear Filters */}
  {hasActiveFilters && (
  <button
  onClick={() => {
  onFrameworkFilterChange('');
  onStatusFilterChange?.('');
  onCriticalityFilterChange?.('');
  onCategoryFilterChange?.('');
  }}
  className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
  >
  {t('risks.filters.clearFilters', { defaultValue: 'Effacer les filtres' })}
  </button>
  )}
 </div>
 )}
 </div>
 );
};
