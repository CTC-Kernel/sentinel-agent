import React from 'react';
import { Search, LayoutGrid, List, SlidersHorizontal, Table, FileSpreadsheet, FileText } from '../ui/Icons';
import { Badge } from '../ui/Badge';

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
    const hasActiveFilters = statusFilter || categoryFilter || criticalityFilter || frameworkFilter;

    return (
        <div className="space-y-4 mb-8">
            {/* Main Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-white/5 p-4 rounded-2xl shadow-sm border border-border/40 dark:border-border/40 backdrop-blur-xl">
                <div className="relative flex-1 w-full md:max-w-md group">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-hover:text-brand-500 transition-colors h-5 w-5" />
                    <input value={query} onChange={(e) => onQueryChange(e.target.value)}
                        type="text"
                        placeholder="Rechercher une menace, une vulnérabilité..."
                        className="pl-10 pr-4 py-3 w-full bg-slate-50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-black/40 border-2 focus:border-brand-500 rounded-3xl transition-all outline-none"
                        aria-label="Rechercher un risque"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-3xl">
                        <button
                            onClick={() => onViewModeChange('cards')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-700 shadow-md text-brand-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                            title="Vue Cartes"
                        >
                            <LayoutGrid className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-md text-brand-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                            title="Vue Liste"
                        >
                            <List className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => onViewModeChange('matrix')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'matrix' ? 'bg-white dark:bg-slate-700 shadow-md text-brand-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                            title="Matrice de risques"
                        >
                            <Table className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2" />

                    <button
                        onClick={onToggleAdvancedSearch}
                        className={`p-2.5 rounded-3xl border transition-all flex items-center gap-2 ${showAdvancedSearch || hasActiveFilters ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-800 dark:border-brand-800' : 'bg-white dark:bg-white/5 border-border/40 dark:border-border/40 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        title="Filtres avancés"
                    >
                        <SlidersHorizontal className="h-5 w-5" />
                        {hasActiveFilters && (
                            <span className="text-xs font-bold">Filtres</span>
                        )}
                    </button>

                    {/* Export Buttons */}
                    {(onExportExcel || onExportPdf) && (
                        <>
                            <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2" />
                            <div className="flex items-center gap-1">
                                {onExportExcel && (
                                    <button
                                        onClick={onExportExcel}
                                        className="p-2 rounded-3xl bg-white dark:bg-white/5 border border-border/40 dark:border-border/40 text-slate-500 dark:text-slate-300 hover:bg-success-bg hover:text-success-text hover:border-success-border transition-all"
                                        title="Exporter en Excel"
                                    >
                                        <FileSpreadsheet className="h-5 w-5" />
                                    </button>
                                )}
                                {onExportPdf && (
                                    <button
                                        onClick={onExportPdf}
                                        className="p-2 rounded-3xl bg-white dark:bg-white/5 border border-border/40 dark:border-border/40 text-slate-500 dark:text-slate-300 hover:bg-error-bg hover:text-error-text hover:border-error-border transition-all"
                                        title="Exporter en PDF"
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
                <div className="flex flex-wrap gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-border/40 dark:border-border/40">
                    {/* Framework Filter */}
                    <select
                        className="bg-white dark:bg-white/5 border border-border/40 dark:border-border/40 rounded-3xl px-4 py-2.5 text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                        value={frameworkFilter}
                        onChange={(e) => onFrameworkFilterChange(e.target.value)}
                        aria-label="Filtrer par référentiel"
                    >
                        <option value="">Tous les référentiels</option>
                        <option value="ISO 27001">ISO 27001</option>
                        <option value="ISO 27005">ISO 27005</option>
                        <option value="EBIOS">EBIOS RM</option>
                        <option value="NIST">NIST</option>
                    </select>

                    {/* Status Filter */}
                    {onStatusFilterChange && (
                        <select
                            className="bg-white dark:bg-white/5 border border-border/40 dark:border-border/40 rounded-3xl px-4 py-2.5 text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                            value={statusFilter || ''}
                            onChange={(e) => onStatusFilterChange(e.target.value)}
                            aria-label="Filtrer par statut"
                        >
                            <option value="">Tous les statuts</option>
                            <option value="Brouillon">Brouillon</option>
                            <option value="Ouvert">Ouvert</option>
                            <option value="En cours">En cours</option>
                            <option value="En attente de validation">En attente de validation</option>
                            <option value="Fermé">Fermé</option>
                        </select>
                    )}

                    {/* Criticality Filter */}
                    {onCriticalityFilterChange && (
                        <select
                            className="bg-white dark:bg-white/5 border border-border/40 dark:border-border/40 rounded-3xl px-4 py-2.5 text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                            value={criticalityFilter || ''}
                            onChange={(e) => onCriticalityFilterChange(e.target.value)}
                            aria-label="Filtrer par criticité"
                        >
                            <option value="">Toutes les criticités</option>
                            <option value="Critique">Critique (15-25)</option>
                            <option value="Élevé">Élevé (10-14)</option>
                            <option value="Moyen">Moyen (5-9)</option>
                            <option value="Faible">Faible (1-4)</option>
                        </select>
                    )}

                    {/* Category Filter */}
                    {onCategoryFilterChange && availableCategories.length > 0 && (
                        <select
                            className="bg-white dark:bg-white/5 border border-border/40 dark:border-border/40 rounded-3xl px-4 py-2.5 text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                            value={categoryFilter || ''}
                            onChange={(e) => onCategoryFilterChange(e.target.value)}
                            aria-label="Filtrer par catégorie"
                        >
                            <option value="">Toutes les catégories</option>
                            {availableCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
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
                            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 transition-colors"
                        >
                            Effacer les filtres
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
