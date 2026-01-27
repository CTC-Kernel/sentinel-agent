import React, { useState } from 'react';
import { Search, X, Filter, Calendar, User as UserIcon } from './Icons';
import { Button } from './button';

export interface SearchFilters {
    query: string;
    type?: 'asset' | 'risk' | 'document' | 'audit' | 'incident' | 'project' | 'all';
    status?: string;
    owner?: string;
    dateFrom?: string;
    dateTo?: string;
    criticality?: 'Faible' | 'Moyenne' | 'Élevée' | 'Critique';
    tags?: string[];
}

interface AdvancedSearchProps {
    onSearch: (filters: SearchFilters) => void;
    onClose: () => void;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onSearch, onClose }) => {
    const [filters, setFilters] = useState<SearchFilters>({
        query: '',
        type: 'all',
    });

    const [showFilters, setShowFilters] = useState(false);

    const handleSearch = () => {
        onSearch(filters);
    };

    const handleReset = () => {
        setFilters({ query: '', type: 'all' });
        onSearch({ query: '', type: 'all' });
    };

    const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-3xl mx-4 glass-premium rounded-3xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-brand-500/10 to-purple-500/10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Search className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                            Recherche Avancée
                        </h2>
                        <Button
                            aria-label="Fermer la recherche avancée"
                            onClick={onClose}
                            variant="ghost"
                            size="icon"
                        >
                            <X className="h-5 w-5 text-slate-600" />
                        </Button>
                    </div>

                    {/* Main Search Input */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                        <input value={filters.query}
                            aria-label="Champ de recherche principal"
                            type="text"
                            onChange={(e) => updateFilter('query', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Rechercher dans tous les modules..."
                            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus-visible:ring-brand-500 text-lg"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Filters Toggle */}
                <div className="px-6 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
                    <Button
                        aria-label={showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                        onClick={() => setShowFilters(!showFilters)}
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400"
                    >
                        <Filter className="h-4 w-4" />
                        {showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                    </Button>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="p-6 space-y-4 bg-white dark:bg-slate-900">
                        {/* Type Filter */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Type de ressource
                            </label>
                            <select
                                aria-label="Filtrer par type de ressource"
                                value={filters.type}
                                onChange={(e) => updateFilter('type', e.target.value as SearchFilters['type'])}
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
                            >
                                <option value="all">Tous les types</option>
                                <option value="asset">Actifs</option>
                                <option value="risk">Risques</option>
                                <option value="document">Documents</option>
                                <option value="audit">Audits</option>
                                <option value="incident">Incidents</option>
                                <option value="project">Projets</option>
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Statut
                            </label>
                            <input value={filters.status || ''}
                                aria-label="Filtrer par statut"
                                type="text"
                                onChange={(e) => updateFilter('status', e.target.value)}
                                placeholder="Ex: Actif, En cours, Fermé..."
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
                            />
                        </div>

                        {/* Owner Filter */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <UserIcon className="h-4 w-4" />
                                Propriétaire
                            </label>
                            <input value={filters.owner || ''}
                                aria-label="Filtrer par propriétaire"
                                type="text"
                                onChange={(e) => updateFilter('owner', e.target.value)}
                                placeholder="Nom du propriétaire..."
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
                            />
                        </div>

                        {/* Date Range */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Date de début
                                </label>
                                <input value={filters.dateFrom || ''}
                                    aria-label="Date de début"
                                    type="date"
                                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Date de fin
                                </label>
                                <input value={filters.dateTo || ''}
                                    aria-label="Date de fin"
                                    type="date"
                                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
                                />
                            </div>
                        </div>

                        {/* Criticality Filter */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Criticité
                            </label>
                            <select
                                aria-label="Filtrer par criticité"
                                value={filters.criticality || ''}
                                onChange={(e) => updateFilter('criticality', e.target.value as SearchFilters['criticality'])}
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus-visible:ring-brand-500"
                            >
                                <option value="">Toutes les criticités</option>
                                <option value="Faible">Faible</option>
                                <option value="Moyenne">Moyenne</option>
                                <option value="Élevée">Élevée</option>
                                <option value="Critique">Critique</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <Button
                        aria-label="Réinitialiser les filtres"
                        onClick={handleReset}
                        variant="ghost"
                        className="text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                    >
                        Réinitialiser
                    </Button>
                    <div className="flex gap-3">
                        <Button
                            aria-label="Annuler la recherche"
                            onClick={onClose}
                            variant="secondary"
                            className="text-slate-600 dark:text-slate-300"
                        >
                            Annuler
                        </Button>
                        <Button
                            aria-label="Lancer la recherche"
                            onClick={handleSearch}
                            className="bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105"
                        >
                            Rechercher
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
