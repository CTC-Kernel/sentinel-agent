
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Search as SearchIcon, Filter, ArrowRight, ShieldCheck, AlertTriangle, FileText, FolderKanban } from '../components/ui/Icons';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useNavigate } from 'react-router-dom';

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
    const [queryText, setQueryText] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const { user } = useStore();
    const navigate = useNavigate();

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (queryText.length > 1) {
                performSearch();
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [queryText, activeFilter]);

    const performSearch = async () => {
        if (!user?.organizationId) return;
        setLoading(true);

        try {
            const searchResults: SearchResult[] = [];
            const searchTerm = queryText.toLowerCase();

            // Helper to check if item matches
            const matches = (text: string) => text?.toLowerCase().includes(searchTerm);

            // 1. Assets
            if (activeFilter === 'all' || activeFilter === 'asset') {
                const assetsSnap = await getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId)));
                assetsSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.name) || matches(data.type)) {
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
            if (activeFilter === 'all' || activeFilter === 'risk') {
                const risksSnap = await getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId)));
                risksSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.threat) || matches(data.scenario)) {
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
            if (activeFilter === 'all' || activeFilter === 'document') {
                const docsSnap = await getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId)));
                docsSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.title) || matches(data.reference)) {
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
            if (activeFilter === 'all' || activeFilter === 'project') {
                const projSnap = await getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId)));
                projSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.name) || matches(data.description)) {
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
        } catch (error) {
            console.error("Search error:", error);
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
        switch (item.type) {
            case 'asset': navigate('/assets'); break; // Ideally navigate to specific ID
            case 'risk': navigate('/risks'); break;
            case 'document': navigate('/documents'); break;
            case 'project': navigate('/projects'); break;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Recherche Avancée</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Recherchez dans tous vos actifs, risques, documents et projets.</p>
            </div>

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
            </div>

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
