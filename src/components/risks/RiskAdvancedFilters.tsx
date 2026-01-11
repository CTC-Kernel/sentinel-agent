/**
 * Risk Advanced Filters Panel
 * Story 3.5: Risk Register View - Inline advanced filtering
 */

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';

interface RiskAdvancedFiltersProps {
    // Filter values
    statusFilter: string;
    onStatusFilterChange: (status: string) => void;
    categoryFilter: string;
    onCategoryFilterChange: (category: string) => void;
    criticalityFilter: string;
    onCriticalityFilterChange: (criticality: string) => void;
    availableCategories: string[];
    // Actions
    onClose: () => void;
}

const RISK_STATUSES = [
    { value: '', label: 'Tous les statuts' },
    { value: 'Brouillon', label: 'Brouillon' },
    { value: 'Ouvert', label: 'Ouvert' },
    { value: 'En cours', label: 'En cours' },
    { value: 'En attente de validation', label: 'En attente de validation' },
    { value: 'Fermé', label: 'Fermé' },
];

const RISK_CRITICALITIES = [
    { value: '', label: 'Toutes les criticités' },
    { value: 'Critique', label: 'Critique (15-25)' },
    { value: 'Élevé', label: 'Élevé (10-14)' },
    { value: 'Moyen', label: 'Moyen (5-9)' },
    { value: 'Faible', label: 'Faible (1-4)' },
];

export const RiskAdvancedFilters: React.FC<RiskAdvancedFiltersProps> = ({
    statusFilter,
    onStatusFilterChange,
    categoryFilter,
    onCategoryFilterChange,
    criticalityFilter,
    onCriticalityFilterChange,
    availableCategories,
    onClose,
}) => {
    const hasActiveFilters = statusFilter || categoryFilter || criticalityFilter;

    const handleClearAll = () => {
        onStatusFilterChange('');
        onCategoryFilterChange('');
        onCriticalityFilterChange('');
    };

    return (
        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Filtres avancés
                </h3>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8"
                    aria-label="Fermer les filtres"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex flex-wrap gap-3">
                {/* Status Filter */}
                <select
                    className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none hover:bg-slate-50 dark:hover:bg-white/10 transition-colors min-w-[160px]"
                    value={statusFilter}
                    onChange={(e) => onStatusFilterChange(e.target.value)}
                    aria-label="Filtrer par statut"
                >
                    {RISK_STATUSES.map(status => (
                        <option key={status.value} value={status.value}>
                            {status.label}
                        </option>
                    ))}
                </select>

                {/* Criticality Filter */}
                <select
                    className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none hover:bg-slate-50 dark:hover:bg-white/10 transition-colors min-w-[160px]"
                    value={criticalityFilter}
                    onChange={(e) => onCriticalityFilterChange(e.target.value)}
                    aria-label="Filtrer par criticité"
                >
                    {RISK_CRITICALITIES.map(crit => (
                        <option key={crit.value} value={crit.value}>
                            {crit.label}
                        </option>
                    ))}
                </select>

                {/* Category Filter */}
                {availableCategories.length > 0 && (
                    <select
                        className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none hover:bg-slate-50 dark:hover:bg-white/10 transition-colors min-w-[160px]"
                        value={categoryFilter}
                        onChange={(e) => onCategoryFilterChange(e.target.value)}
                        aria-label="Filtrer par catégorie"
                    >
                        <option value="">Toutes les catégories</option>
                        {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                )}

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAll}
                        className="text-slate-600 hover:text-red-600 transition-colors"
                    >
                        Effacer les filtres
                    </Button>
                )}
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {statusFilter && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-medium">
                            Statut: {statusFilter}
                            <button
                                onClick={() => onStatusFilterChange('')}
                                className="ml-1 hover:text-brand-900"
                                aria-label="Supprimer le filtre statut"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {criticalityFilter && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-medium">
                            Criticité: {criticalityFilter}
                            <button
                                onClick={() => onCriticalityFilterChange('')}
                                className="ml-1 hover:text-amber-900"
                                aria-label="Supprimer le filtre criticité"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    {categoryFilter && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium">
                            Catégorie: {categoryFilter}
                            <button
                                onClick={() => onCategoryFilterChange('')}
                                className="ml-1 hover:text-emerald-900"
                                aria-label="Supprimer le filtre catégorie"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
