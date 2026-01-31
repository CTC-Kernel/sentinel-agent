import React, { useState, useEffect } from 'react';

import { Search as SearchIcon, Filter, ArrowRight, ShieldCheck, AlertTriangle, FileText, FolderKanban } from '../components/ui/Icons';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';

import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdvancedSearch, SearchFilters } from '../components/ui/AdvancedSearch';
import { useGlobalSearch, SearchResult } from '../hooks/useGlobalSearch';

export const Search: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [queryText, setQueryText] = useState(searchParams.get('q') || '');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<SearchFilters>({ query: '', type: 'all' });
    const navigate = useNavigate();
    const { results, loading, performSearch, setResults } = useGlobalSearch();

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (queryText.length > 1 || advancedFilters.status || advancedFilters.owner || advancedFilters.dateFrom) {
                performSearch(queryText, advancedFilters, activeFilter);
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [queryText, activeFilter, advancedFilters, performSearch, setResults]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'asset': return <ShieldCheck className="h-5 w-5 text-blue-500" />;
            case 'risk': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
            case 'document': return <FileText className="h-5 w-5 text-purple-500" />;
            case 'project': return <FolderKanban className="h-5 w-5 text-emerald-500" />;
            default: return <SearchIcon className="h-5 w-5 text-slate-600" />;
        }
    };

    const handleNavigate = (item: SearchResult) => {
        const state = { fromVoxel: true, voxelSelectedId: item.id, voxelSelectedType: item.type };
        switch (item.type) {
            case 'asset': navigate('/assets', { state }); break;
            case 'risk': navigate('/risks', { state }); break;
            case 'document': navigate('/documents', { state }); break;
            case 'project': navigate('/projects', { state }); break;
        }
    };

    const handleAdvancedSearch = (filters: SearchFilters) => {
        setAdvancedFilters(filters);
        setQueryText(filters.query);
        setShowAdvancedSearch(false);
    };

    const clearAdvancedFilters = () => {
        setAdvancedFilters({ query: '', type: 'all' });
        setQueryText('');
    };

    const hasActiveFilters = advancedFilters.status || advancedFilters.owner || advancedFilters.dateFrom || advancedFilters.dateTo || advancedFilters.criticality;

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO title="Recherche Avancée" description="Recherchez dans tous vos actifs, risques, documents et projets" />
            {showAdvancedSearch && (
                <AdvancedSearch
                    onSearch={handleAdvancedSearch}
                    onClose={() => setShowAdvancedSearch(false)}
                />
            )}

            <PageHeader
                title="Recherche Avancée"
                subtitle="Recherchez dans tous vos actifs, risques, documents et projets."
                icon={<SearchIcon className="h-6 w-6 text-white" strokeWidth={2.5} />}
            />

            <div className="glass-premium p-2 rounded-2xl flex items-center space-x-4 shadow-lg ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-4 z-30 border border-border/40">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <SearchIcon className="h-6 w-6 text-slate-500" />
                </div>
                <input value={queryText}
                    aria-label="Rechercher"
                    type="text"
                    placeholder="Rechercher quelque chose..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-lg dark:text-white py-3 font-medium placeholder-gray-400"
                    onChange={e => setQueryText(e.target.value)}
                />
                {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600 mr-4"></div>}
                <button
                    aria-label="Filtres"
                    onClick={() => setShowAdvancedSearch(true)}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                >
                    <Filter className="h-4 w-4" />
                    Filtres
                </button>
            </div>

            {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Filtres actifs:</span>
                    {advancedFilters.status && (
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">
                            Statut: {advancedFilters.status}
                        </span>
                    )}
                    {advancedFilters.owner && (
                        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold">
                            Propriétaire: {advancedFilters.owner}
                        </span>
                    )}
                    {advancedFilters.criticality && (
                        <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg text-xs font-bold">
                            Criticité: {advancedFilters.criticality}
                        </span>
                    )}
                    {(advancedFilters.dateFrom || advancedFilters.dateTo) && (
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-bold">
                            Période: {advancedFilters.dateFrom || '...'} → {advancedFilters.dateTo || '...'}
                        </span>
                    )}
                    <button
                        aria-label="Effacer les filtres"
                        onClick={clearAdvancedFilters}
                        className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Effacer
                    </button>
                </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {[
                    { id: 'all', label: 'Tout' },
                    { id: 'asset', label: 'Actifs' },
                    { id: 'risk', label: 'Risques' },
                    { id: 'document', label: 'Documents' },
                    { id: 'project', label: 'Projets' }
                ].map(filter => (
                    <button
                        aria-label={filter.label}
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeFilter === filter.id
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {queryText.length > 1 && results.length === 0 && !loading ? (
                    <div className="space-y-6">
                        <EmptyState
                            icon={SearchIcon}
                            title="Aucun résultat"
                            description={`Aucun élément ne correspond à "${queryText}"`}
                        />
                        <div className="glass-premium p-6 rounded-3xl border border-border/40 space-y-4">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                Essayez avec des termes différents, ou parcourez directement les sections :
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    onClick={() => navigate('/risks')}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-white/60 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-brand-200 dark:hover:border-brand-900 transition-all group text-left"
                                >
                                    <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 group-hover:scale-110 transition-transform">
                                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">Parcourir les risques</span>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Registre des risques</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-400 ml-auto group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                                </button>
                                <button
                                    onClick={() => navigate('/assets')}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-white/60 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-brand-200 dark:hover:border-brand-900 transition-all group text-left"
                                >
                                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 group-hover:scale-110 transition-transform">
                                        <ShieldCheck className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">Voir les actifs</span>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Inventaire des actifs</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-400 ml-auto group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                                </button>
                                <button
                                    onClick={() => navigate('/compliance')}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-white/60 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-brand-200 dark:hover:border-brand-900 transition-all group text-left"
                                >
                                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 group-hover:scale-110 transition-transform">
                                        <FileText className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">Consulter les controles</span>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Cadre de conformite</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-400 ml-auto group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    results.map((result) => (
                        <div
                            role="button"
                            tabIndex={0}
                            key={`${result.type}-${result.id}`}
                            onClick={() => handleNavigate(result)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleNavigate(result);
                                }
                            }}
                            className="glass-premium p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all group border border-border/40 hover:border-brand-200 dark:hover:border-brand-900 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                        {getIcon(result.type)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">{result.title}</h3>
                                        <p className="text-sm text-slate-600 dark:text-muted-foreground font-medium">{result.subtitle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {result.status && (
                                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                            {result.status}
                                        </span>
                                    )}
                                    {result.score !== undefined && (
                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${result.score >= 8 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : result.score >= 5 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                                            Score: {result.score}
                                        </span>
                                    )}
                                    <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    );
};
