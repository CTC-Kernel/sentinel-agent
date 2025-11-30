
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Search as SearchIcon, Filter, ArrowRight, ShieldCheck, AlertTriangle, FileText, FolderKanban } from '../components/ui/Icons';

import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdvancedSearch, SearchFilters } from '../components/ui/AdvancedSearch';
import { ErrorLogger } from '../services/errorLogger';

interface SearchResult {
    id: string;
    type: 'asset' | 'risk' | 'control' | 'document' | 'project';
    title: string;
    subtitle: string;
    status?: string;
    date?: string;
    score?: number;
}

export const Search: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [queryText, setQueryText] = useState(searchParams.get('q') || '');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<SearchFilters>({ query: '', type: 'all' });
    const { user } = useStore();
    const navigate = useNavigate();

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (queryText.length > 1 || advancedFilters.status || advancedFilters.owner || advancedFilters.dateFrom) {
                performSearch();
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [queryText, activeFilter, advancedFilters]);

    const performSearch = async () => {
        if (!user?.organizationId) return;
        setLoading(true);

        try {
            const searchResults: SearchResult[] = [];
            const searchTerm = (advancedFilters.query || queryText).toLowerCase();

            // Helper to check if item matches
            const matches = (text: string) => text?.toLowerCase().includes(searchTerm);

            // Helper to check date range
            const matchesDateRange = (dateStr: string) => {
                if (!advancedFilters.dateFrom && !advancedFilters.dateTo) return true;
                const itemDate = new Date(dateStr);
                if (advancedFilters.dateFrom && itemDate < new Date(advancedFilters.dateFrom)) return false;
                if (advancedFilters.dateTo && itemDate > new Date(advancedFilters.dateTo)) return false;
                return true;
            };

            // 1. Assets
            if (activeFilter === 'all' || activeFilter === 'asset' || advancedFilters.type === 'asset' || advancedFilters.type === 'all') {
                const assetsSnap = await getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId)));
                assetsSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.name) || matches(data.type)) {
                        // Apply advanced filters
                        if (advancedFilters.status && data.status !== advancedFilters.status) return;
                        if (advancedFilters.owner && !data.owner?.toLowerCase().includes(advancedFilters.owner.toLowerCase())) return;
                        if (advancedFilters.criticality && data.criticality !== advancedFilters.criticality) return;
                        if (!matchesDateRange(data.updatedAt)) return;

                        searchResults.push({
                            id: doc.id,
                            type: 'asset',
                            title: data.name,
                            subtitle: `${data.type} • ${data.criticality}`,
                            status: data.status,
                            date: data.updatedAt
                        });
                    }
                });
            }

            // 2. Risks
            if (activeFilter === 'all' || activeFilter === 'risk' || advancedFilters.type === 'risk' || advancedFilters.type === 'all') {
                const risksSnap = await getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId)));
                risksSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.threat) || matches(data.scenario)) {
                        if (advancedFilters.status && data.status !== advancedFilters.status) return;
                        if (advancedFilters.owner && !data.owner?.toLowerCase().includes(advancedFilters.owner.toLowerCase())) return;
                        if (!matchesDateRange(data.updatedAt)) return;

                        searchResults.push({
                            id: doc.id,
                            type: 'risk',
                            title: data.threat,
                            subtitle: `Impact: ${data.impact} • Probabilité: ${data.probability}`,
                            score: data.score,
                            date: data.updatedAt
                        });
                    }
                });
            }

            // 3. Documents
            if (activeFilter === 'all' || activeFilter === 'document' || advancedFilters.type === 'document' || advancedFilters.type === 'all') {
                const docsSnap = await getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId)));
                docsSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.title) || matches(data.reference)) {
                        if (advancedFilters.status && data.status !== advancedFilters.status) return;
                        if (advancedFilters.owner && !data.owner?.toLowerCase().includes(advancedFilters.owner.toLowerCase())) return;
                        if (!matchesDateRange(data.updatedAt)) return;

                        searchResults.push({
                            id: doc.id,
                            type: 'document',
                            title: data.title,
                            subtitle: `Ref: ${data.reference} • v${data.version}`,
                            status: data.status,
                            date: data.updatedAt
                        });
                    }
                });
            }

            // 4. Projects
            if (activeFilter === 'all' || activeFilter === 'project' || advancedFilters.type === 'project' || advancedFilters.type === 'all') {
                const projSnap = await getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId)));
                projSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.name) || matches(data.description)) {
                        if (advancedFilters.status && data.status !== advancedFilters.status) return;
                        if (advancedFilters.owner && !data.manager?.toLowerCase().includes(advancedFilters.owner.toLowerCase())) return;
                        if (!matchesDateRange(data.dueDate)) return;

                        searchResults.push({
                            id: doc.id,
                            type: 'project',
                            title: data.name,
                            subtitle: `Manager: ${data.manager || 'N/A'}`,
                            status: data.status,
                            date: data.dueDate
                        });
                    }
                });
            }

            setResults(searchResults);
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(error, 'Search.performSearch', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'asset': return <ShieldCheck className="h-5 w-5 text-blue-500" />;
            case 'risk': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
            case 'document': return <FileText className="h-5 w-5 text-purple-500" />;
            case 'project': return <FolderKanban className="h-5 w-5 text-emerald-500" />;
            default: return <SearchIcon className="h-5 w-5 text-gray-500" />;
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
        <div className="space-y-6 animate-fade-in pb-10">
            {showAdvancedSearch && (
                <AdvancedSearch
                    onSearch={handleAdvancedSearch}
                    onClose={() => setShowAdvancedSearch(false)}
                />
            )}

            <PageHeader
                title="Recherche Avancée"
                subtitle="Recherchez dans tous vos actifs, risques, documents et projets."
                breadcrumbs={[
                    { label: 'Recherche' }
                ]}
                icon={<SearchIcon className="h-6 w-6 text-white" strokeWidth={2.5} />}
            />

            <div className="glass-panel p-2 rounded-2xl flex items-center space-x-4 shadow-lg ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-4 z-30">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <SearchIcon className="h-6 w-6 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder="Rechercher quelque chose..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-lg dark:text-white py-3 font-medium placeholder-gray-400"
                    value={queryText}
                    onChange={e => setQueryText(e.target.value)}
                    autoFocus
                />
                {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600 mr-4"></div>}
                <button
                    onClick={() => setShowAdvancedSearch(true)}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                >
                    <Filter className="h-4 w-4" />
                    Filtres
                </button>
            </div>

            {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtres actifs:</span>
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
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeFilter === filter.id
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {queryText.length > 1 && results.length === 0 && !loading ? (
                    <EmptyState
                        icon={SearchIcon}
                        title="Aucun résultat"
                        description={`Aucun élément ne correspond à "${queryText}"`}
                    />
                ) : (
                    results.map((result) => (
                        <div
                            key={`${result.type}-${result.id}`}
                            onClick={() => handleNavigate(result)}
                            className="glass-panel p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all group border border-transparent hover:border-brand-200 dark:hover:border-brand-900"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                        {getIcon(result.type)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">{result.title}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{result.subtitle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {result.status && (
                                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                            {result.status}
                                        </span>
                                    )}
                                    {result.score !== undefined && (
                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${result.score >= 8 ? 'bg-red-100 text-red-700' : result.score >= 5 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                            Score: {result.score}
                                        </span>
                                    )}
                                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
