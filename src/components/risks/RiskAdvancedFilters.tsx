import React from 'react';
import { X } from '../ui/Icons';
import { Button } from '../ui/button';
import { CustomSelect } from '../ui/CustomSelect';

interface RiskAdvancedFiltersProps {
    statusFilter: string[];
    onStatusFilterChange: (status: string[]) => void;
    categoryFilter: string[];
    onCategoryFilterChange: (category: string[]) => void;
    criticalityFilter: string[];
    onCriticalityFilterChange: (criticality: string[]) => void;
    availableCategories: string[];
    onClose: () => void;
}

const RISK_STATUSES = [
    { value: 'Brouillon', label: 'Brouillon' },
    { value: 'Ouvert', label: 'Ouvert' },
    { value: 'En cours', label: 'En cours' },
    { value: 'En attente de validation', label: 'En attente de validation' },
    { value: 'Fermé', label: 'Fermé' },
];

const RISK_CRITICALITIES = [
    { value: 'Critique', label: 'Critique (15-25)' },
    { value: 'Élevé', label: 'Élevé (10-14)' },
    { value: 'Moyen', label: 'Moyen (5-9)' },
    { value: 'Faible', label: 'Faible (1-4)' },
];

export const RiskAdvancedFilters: React.FC<RiskAdvancedFiltersProps> = ({
    statusFilter = [],
    onStatusFilterChange,
    categoryFilter = [],
    onCategoryFilterChange,
    criticalityFilter = [],
    onCriticalityFilterChange,
    availableCategories,
    onClose,
}) => {
    const handleClearAll = () => {
        onStatusFilterChange([]);
        onCategoryFilterChange([]);
        onCriticalityFilterChange([]);
    };

    return (
        <div className="bg-white/40 dark:bg-slate-950/40 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5 p-6 shadow-2xl relative z-40">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Filtres avancés
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">Personnalisez votre vue du registre</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-10 w-10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full"
                    aria-label="Fermer les filtres"
                >
                    <X className="h-5 w-5 text-slate-500" />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                    <CustomSelect
                        label="Filtrer par statut"
                        multiple
                        value={statusFilter}
                        onChange={(v) => onStatusFilterChange(v as string[])}
                        options={RISK_STATUSES}
                        placeholder="Tous les statuts"
                    />
                </div>

                <div className="space-y-1">
                    <CustomSelect
                        label="Filtrer par criticité"
                        multiple
                        value={criticalityFilter}
                        onChange={(v) => onCriticalityFilterChange(v as string[])}
                        options={RISK_CRITICALITIES}
                        placeholder="Toutes les criticités"
                    />
                </div>

                <div className="space-y-1">
                    <CustomSelect
                        label="Filtrer par catégorie"
                        multiple
                        value={categoryFilter}
                        onChange={(v) => onCategoryFilterChange(v as string[])}
                        options={availableCategories.map(cat => ({ value: cat, label: cat }))}
                        placeholder="Toutes les catégories"
                    />
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
                    Les filtres sont appliqués en temps réel
                </p>
                {(statusFilter.length > 0 || categoryFilter.length > 0 || criticalityFilter.length > 0) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAll}
                        className="text-xs text-slate-500 dark:text-slate-300 hover:text-red-500 font-bold transition-colors"
                    >
                        Réinitialiser tous les filtres
                    </Button>
                )}
            </div>
        </div>
    );
};
