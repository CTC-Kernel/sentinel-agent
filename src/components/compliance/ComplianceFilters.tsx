import React from 'react';
import { Search, AlertTriangle } from '../../components/ui/Icons';
import { CustomSelect } from '../../components/ui/CustomSelect';

interface ComplianceFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    statusFilter: string | null;
    onStatusFilterChange: (value: string | null) => void;
    showMissingEvidence: boolean;
    onShowMissingEvidenceChange: (value: boolean) => void;
}

export const ComplianceFilters: React.FC<ComplianceFiltersProps> = ({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    showMissingEvidence,
    onShowMissingEvidenceChange
}) => {
    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Rechercher un contrôle (code, nom...)"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
                    aria-label="Rechercher un contrôle"
                />
            </div>
            <div className="flex gap-3">
                <div className="w-48">
                    <CustomSelect
                        label=""
                        value={statusFilter || 'all'}
                        onChange={(val) => onStatusFilterChange(val === 'all' ? null : val as string)}
                        options={[
                            { value: 'all', label: 'Tous les statuts' },
                            { value: 'Non commencé', label: 'Non commencé' },
                            { value: 'En cours', label: 'En cours' },
                            { value: 'Partiel', label: 'Partiel' },
                            { value: 'Implémenté', label: 'Implémenté' },
                            { value: 'Non applicable', label: 'Non applicable' }
                        ]}
                        placeholder="Filtrer par statut"
                    />
                </div>
                <button
                    onClick={() => onShowMissingEvidenceChange(!showMissingEvidence)}
                    className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 text-sm font-medium transition-all whitespace-nowrap ${showMissingEvidence
                        ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-slate-300'
                        }`}
                >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Preuves manquantes</span>
                </button>
            </div>
        </div>
    );
};
